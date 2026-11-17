// T8-0 Fix 2: waveform pipeline, RUN DRY TEST label and completion feedback. SDK-independent.
// Pipeline under test: decoded PCM -> computePeaks(decoded, 96) -> HostInitialState.waveform -> GUI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decodeWav, encodeWav, makeMetadata } from "../src/product/engine/src/wav.ts";
import { computePeaks } from "../src/product/engine/src/dsp.ts";
import { runReadOnlyFlow, summarizeWaveform, WAVEFORM_BINS, type ReadOnlyPort } from "../src/flow.ts";

const editorHtml = readFileSync(fileURLToPath(new URL("../src/interface.html", import.meta.url)), "utf8");
const FRAMES = 48000; // 1 s at 48 kHz: 500 frames per bin, more than one 400-frame sine period per bin
const wavOf = (channels: number, f: (frame: number, channel: number) => number) => {
  const s = new Float64Array(FRAMES * channels);
  for (let i = 0; i < FRAMES; i++) for (let c = 0; c < channels; c++) s[i * channels + c] = f(i, c);
  return encodeWav(makeMetadata(channels, 48000, 32, "float", FRAMES), s).bytes;
};
const loud = wavOf(1, i => 0.8 * Math.sin((2 * Math.PI * i) / 400));
const silent = wavOf(1, () => 0);

/** Run the real flow with a fake host; capture the delivered editor document and logs. */
async function capture(rendered: Uint8Array, modal: unknown = "") {
  const logs: string[] = [];
  let document = "";
  const host: ReadOnlyPort<string> = {
    resolveClip: async () => ({ scope: "Arrangement", track: "t", trackIndex: 0, startBeat: 0, endBeat: 4, overlappingClipCount: 0 }),
    renderPreFx: async () => "C:\\Users\\Private\\Temp\\never-log-me.wav",
    readRenderedWav: async () => rendered,
    showModal: async url => { document = Buffer.from(url.split(",")[1]!, "base64").toString("utf8"); return modal; },
    log: line => { logs.push(line); },
  };
  const result = await runReadOnlyFlow(host, { id: 1 }, editorHtml);
  const m = /window\.AOPX_INITIAL_STATE=(.*?);<\/script>/s.exec(document);
  assert.ok(m, "initial state injected into the delivered editor");
  return { result, logs, document, state: JSON.parse(m[1]!) as { waveform: { min: number; max: number }[] } };
}
const jsonAfter = (logs: string[], prefix: string) => JSON.parse(logs.find(l => l.startsWith(prefix))!.slice(prefix.length));

test("computePeaks: nonzero signal gives 96 bins, each with a positive max and a negative min", () => {
  const peaks = computePeaks(decodeWav(loud), WAVEFORM_BINS);
  assert.equal(peaks.length, 96);
  for (const [i, p] of peaks.entries()) {
    assert.ok(p.max > 0.79 && p.max <= 0.8000001, `bin ${i} max ${p.max}`);
    assert.ok(p.min < -0.79 && p.min >= -0.8000001, `bin ${i} min ${p.min}`);
  }
  // Deterministic: the same input always yields identical peaks.
  assert.deepEqual(computePeaks(decodeWav(loud), 96), peaks);
});

test("computePeaks: stereo peaks span both channels; a shape is preserved (rising ramp)", () => {
  const ramp = wavOf(2, (i, c) => (c === 0 ? 1 : -1) * (i / FRAMES) * 0.5);
  const peaks = computePeaks(decodeWav(ramp), 96);
  assert.equal(peaks.length, 96);
  for (let b = 1; b < 96; b++) {
    assert.ok(peaks[b]!.max > peaks[b - 1]!.max, "max rises with the ramp");
    assert.ok(peaks[b]!.min < peaks[b - 1]!.min, "min (other channel) falls with the ramp");
  }
});

test("silent reference: every peak is exactly 0 and the summary says silent", () => {
  const peaks = computePeaks(decodeWav(silent), 96);
  assert.equal(peaks.length, 96);
  assert.ok(peaks.every(p => p.min === 0 && p.max === 0));
  assert.deepEqual(summarizeWaveform(peaks), { bins: 96, peakAbs: 0, peakDbfs: null, nonzeroBins: 0, silent: true });
});

test("flow injects exactly the computed 96-bin peaks into the GUI state and logs a numbers-only summary", async () => {
  const { state, logs } = await capture(loud);
  assert.deepEqual(state.waveform, computePeaks(decodeWav(loud), 96));
  const summary = jsonAfter(logs, "AOPX_T8_0_WAVEFORM ");
  assert.deepEqual(Object.keys(summary).sort(), ["bins", "nonzeroBins", "peakAbs", "peakDbfs", "silent"]);
  assert.equal(summary.bins, 96);
  assert.equal(summary.nonzeroBins, 96);
  assert.equal(summary.silent, false);
  assert.equal(summary.peakDbfs, -1.9); // 20*log10(0.8) = -1.94
  const waveIdx = logs.findIndex(l => l.startsWith("AOPX_T8_0_WAVEFORM "));
  assert.ok(waveIdx >= 0 && logs[waveIdx + 1] === "AOPX_T8_0_EDITOR_OPEN read-only", "summary precedes editor open");
  assert.ok(!logs.join("\n").includes("Private") && !logs.join("\n").includes("never-log-me"));
});

test("flow with a genuinely silent render: state peaks all 0 and summary silent=true", async () => {
  const { state, logs } = await capture(silent);
  assert.equal(state.waveform.length, 96);
  assert.ok(state.waveform.every(p => p.min === 0 && p.max === 0));
  assert.deepEqual(jsonAfter(logs, "AOPX_T8_0_WAVEFORM "), { bins: 96, peakAbs: 0, peakDbfs: null, nonzeroBins: 0, silent: true });
});

test("probe GUI draws the waveform visibly: stroked path, no artificial floor for silence, true level caption", () => {
  const css = /\.waveform\{([^}]*)\}/.exec(editorHtml)?.[1] ?? "";
  assert.match(css, /fill:none/);
  assert.match(css, /stroke:#8b9b9f/);
  assert.match(css, /stroke-width:3/);
  assert.doesNotMatch(css, /stroke:none/);
  assert.ok(editorHtml.includes("const h=v>0?Math.max(1,Math.min(46,v*46)):0;"), "silence draws nothing; nonzero >= 1 unit");
  assert.ok(!editorHtml.includes("Math.max(2,Math.min(46,v*46))"), "old 2-unit floor removed");
  assert.ok(editorHtml.includes('id="wave-level"'));
  assert.ok(editorHtml.includes('"SILENT SOURCE · ALL PEAKS 0"') && editorHtml.includes('"PEAK "+(20*Math.log10(peakAbs)).toFixed(1)+" dBFS"'));
});

test("probe GUI label is RUN DRY TEST; the strict modal contract is unchanged", async () => {
  assert.ok(editorHtml.includes('<button class="action-button primary" id="apply" type="button">RUN DRY TEST</button>'));
  assert.ok(!/APPLY TO CLIP/i.test(editorHtml), "misleading label removed");
  assert.ok(!/\bApply\b/.test(editorHtml), "no user-facing 'Apply' wording left in the probe GUI");
  // Envelope sent by the button is still the strict ModalResult the parser accepts.
  assert.ok(editorHtml.includes('closeWith({envelopeVersion:ENVELOPE_VERSION,action:"process",plan})'));
  assert.ok(editorHtml.includes('closeWith({envelopeVersion:ENVELOPE_VERSION,action:"cancel"})'));
  const { document } = await capture(loud);
  assert.match(document, /RUN DRY TEST<\/button>/);
  assert.match(document, /AOPX T8-0 READ-ONLY TEST — RUN DRY TEST processes audio in memory only; NO clip will be saved or imported\./);
});

test("completion feedback: plain-language in-memory success line with counts only", async () => {
  const plan = { version: 1, operations: [
    { id: "r", type: "reverse", enabled: true },
    { id: "g", type: "gain", enabled: false, db: -3 },
  ] };
  const { result, logs } = await capture(loud, JSON.stringify({ envelopeVersion: 1, action: "process", plan }));
  assert.equal(result.status, "dry-run-complete");
  const ok = logs.filter(l => l.startsWith("AOPX_T8_0_DRY_RUN_OK "));
  assert.deepEqual(ok, [
    "AOPX_T8_0_DRY_RUN_OK In-memory dry test succeeded: 1 of 2 operation(s) ran on 48000 frames -> 48000 frames. Nothing was saved, imported or changed in Live.",
  ]);
  const complete = logs.findIndex(l => l.startsWith("AOPX_T8_0_DRY_RUN_COMPLETE "));
  assert.equal(logs[complete + 1], ok[0], "OK line follows the unchanged COMPLETE JSON line");
  assert.ok(!logs.join("\n").match(/Private|never-log-me|[A-Za-z]:\\|\/Users\//));
});

test("cancel paths print no completion line", async () => {
  for (const modal of ["", JSON.stringify({ envelopeVersion: 1, action: "cancel" })]) {
    const { result, logs } = await capture(loud, modal);
    assert.equal(result.status, "cancelled");
    assert.ok(!logs.some(l => l.startsWith("AOPX_T8_0_DRY_RUN_")));
  }
});
