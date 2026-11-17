// T8-0 Fix 2, CI only (needs Playwright on NODE_PATH; not part of `npm test` on the owner PC).
// Loads the exact editor document the T8-0 flow delivers to Live's modal, in Chromium (the engine
// of Live's WebView2), and counts painted waveform pixels: the Fix 1 GUI painted 0 for every source.
//   node test/waveform-gui.browser.mts
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { encodeWav, makeMetadata } from "../src/product/engine/src/wav.ts";
import { runReadOnlyFlow } from "../src/flow.ts";

const { chromium } = createRequire(import.meta.url)("playwright");
const editorHtml = readFileSync(fileURLToPath(new URL("../src/interface.html", import.meta.url)), "utf8");

async function deliveredUrl(f: (i: number) => number): Promise<string> {
  const n = 48000;
  const bytes = encodeWav(makeMetadata(1, 48000, 32, "float", n), Float64Array.from({ length: n }, (_, i) => f(i))).bytes;
  let url = "";
  await runReadOnlyFlow({
    resolveClip: async () => ({ scope: "Arrangement", track: "t", trackIndex: 0, startBeat: 0, endBeat: 4, overlappingClipCount: 0 }),
    renderPreFx: async () => "render.wav",
    readRenderedWav: async () => bytes,
    showModal: async (u: string) => { url = u; return ""; },
    log: () => {},
  }, { id: 1 }, editorHtml);
  assert.ok(url.startsWith("data:text/html;charset=utf-8;base64,"));
  return url;
}

const browser = await chromium.launch();
async function measure(f: (i: number) => number) {
  // Live's observed modal viewport (S3 real host: innerSize 1281x1032, DPR 1).
  const page = await browser.newPage({ viewport: { width: 1281, height: 1032 }, deviceScaleFactor: 1 });
  await page.goto(await deliveredUrl(f));
  const png = (await page.locator(".wave-area").screenshot()).toString("base64");
  const out = await page.evaluate(async (b64: string) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    let top = c.height, bottom = 0;
    for (let i = 0; i < px.length; i += 4) {
      // waveform colour #8b9b9f (139,155,159); the grid and midline are far darker
      if (Math.abs(px[i]! - 139) < 30 && Math.abs(px[i + 1]! - 155) < 30 && Math.abs(px[i + 2]! - 159) < 30) {
        lit++;
        const y = Math.floor(i / 4 / c.width);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    return {
      lit, height: c.height, span: lit ? bottom - top + 1 : 0,
      level: document.getElementById("wave-level")?.textContent ?? null,
      button: document.getElementById("apply")?.textContent ?? null,
      warning: document.getElementById("aopx-t8-0-warning")?.textContent ?? "",
      stroke: getComputedStyle(document.getElementById("wave-path")!).stroke,
    };
  }, png);
  await page.close();
  return out;
}

try {
  const loud = await measure(i => 0.8 * Math.sin((2 * Math.PI * i) / 400));
  const quiet = await measure(i => 0.02 * Math.sin((2 * Math.PI * i) / 400));
  const silent = await measure(() => 0);
  console.log(JSON.stringify({ loud, quiet, silent }));
  assert.notEqual(loud.stroke, "none");
  assert.ok(loud.lit > 5000, `loud waveform must be clearly painted (lit=${loud.lit})`);
  assert.ok(loud.span >= 0.7 * loud.height, `loud waveform spans most of the height (span=${loud.span})`);
  assert.ok(quiet.lit > 0 && quiet.lit < loud.lit / 5, `quiet waveform is visible but small (lit=${quiet.lit})`);
  assert.equal(silent.lit, 0, "a silent source paints no waveform bars (only the midline)");
  assert.equal(loud.level, "PEAK -1.9 dBFS");
  assert.equal(quiet.level, "PEAK -34.0 dBFS");
  assert.equal(silent.level, "SILENT SOURCE · ALL PEAKS 0");
  for (const r of [loud, quiet, silent]) {
    assert.equal(r.button, "RUN DRY TEST");
    assert.match(r.warning, /READ-ONLY TEST — RUN DRY TEST processes audio in memory only; NO clip will be saved or imported/);
  }
  console.log("WAVEFORM GUI PASS: loud, quiet and silent sources render distinguishably; RUN DRY TEST label and READ-ONLY warning present");
} finally {
  await browser.close();
}
