import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMetadata, encodeWav } from "../src/product/engine/src/wav.ts";
import { runReadOnlyFlow, MAX_RENDER_BYTES, MAX_MODAL_URL_CHARS, MAX_OPERATIONS, type ReadOnlyPort, type ResolvedClip } from "../src/flow.ts";

const html = '<!doctype html><html><body><main>Editor</main><script id="aopx-plan-core"></script></body></html>';
const samples = Float64Array.from({ length: 64 }, (_, i) => Math.sin(i / 10));
const bytes = encodeWav(makeMetadata(1, 48000, 32, "float", samples.length), samples).bytes;
const plan = { version: 1, operations: [
  { id: "r", type: "reverse", enabled: true },
  { id: "g", type: "gain", enabled: true, db: -3 },
]};
const apply = JSON.stringify({ envelopeVersion: 1, action: "process", plan });
const cancel = JSON.stringify({ envelopeVersion: 1, action: "cancel" });

function createFake(settings: {
  resolved?: Partial<ResolvedClip<string>>;
  rendered?: Uint8Array;
  modal?: unknown;
  renderError?: Error;
  throwRead?: Error;
} = {}) {
  const calls: string[] = [];
  const logs: string[] = [];
  const resolved: ResolvedClip<string> = {
    scope: "Arrangement", track: "fake-track", trackIndex: 2,
    startBeat: 16, endBeat: 20, overlappingClipCount: 0, ...settings.resolved,
  };
  const host: ReadOnlyPort<string> = {
    async resolveClip() { calls.push("resolve"); return resolved; },
    async renderPreFx(_track, start, end) {
      calls.push("render");
      assert.equal(start, resolved.startBeat);
      assert.equal(end, resolved.endBeat);
      if (settings.renderError) throw settings.renderError;
      return "C:\\Users\\Private\\Audio\\never-log-me.wav";
    },
    async readRenderedWav(path, cap) {
      calls.push("read");
      assert.match(path, /never-log-me\.wav/);
      assert.equal(cap, MAX_RENDER_BYTES);
      if (settings.throwRead) throw settings.throwRead;
      return settings.rendered ?? bytes;
    },
    async showModal(url, width, height) {
      calls.push("modal");
      assert.ok(url.startsWith("data:text/html;charset=utf-8;base64,"));
      assert.ok(url.length < MAX_MODAL_URL_CHARS);
      assert.equal(width, 860);
      assert.equal(height, 660);
      const document = Buffer.from(url.split(",")[1]!, "base64").toString("utf8");
      assert.match(document, /READ-ONLY TEST/);
      assert.match(document, /AOPX_INITIAL_STATE/);
      assert.match(document, /NO clip will be saved or imported/);
      assert.ok(!document.includes("Private"));
      return settings.modal ?? apply;
    },
    log(line) { logs.push(line); },
  };
  return { host, calls, logs };
}

test("S2→S4→AOPX editor→DSP: valid Apply is in-memory and never mutates Live", async () => {
  const f = createFake();
  const r = await runReadOnlyFlow(f.host, { id: 1n }, html);
  assert.equal(r.status, "dry-run-complete");
  assert.deepEqual(f.calls, ["resolve", "render", "read", "modal"]);
  if (r.status === "dry-run-complete") {
    assert.equal(r.sourceFrames, 64);
    assert.equal(r.outputFrames, 64);
    assert.equal(r.operations, 2);
    assert.equal(r.enabledOperations, 2);
    assert.ok(r.outputBytes > 0);
    assert.notEqual(r.outputFingerprintPrefix, r.sourceFingerprintPrefix);
  }
  assert.ok(f.logs.some(x => x.startsWith("AOPX_T8_0_DRY_RUN_COMPLETE ")));
});

test("X/window-close is a cancel; never processes", async () => {
  const f = createFake({ modal: "" });
  const r = await runReadOnlyFlow(f.host, null, html);
  assert.deepEqual(r, { status: "cancelled", reason: "modal-closed" });
  assert.deepEqual(f.calls, ["resolve", "render", "read", "modal"]);
});
test("explicit editor Cancel is cancel", async () => {
  const f = createFake({ modal: cancel });
  assert.deepEqual(await runReadOnlyFlow(f.host, null, html), { status: "cancelled", reason: "user-cancel" });
});
test("malformed, wrong-version and nonstring return cancel safely", async () => {
  for (const modal of ["{", "hello", 123, JSON.stringify({ envelopeVersion: 9, action: "process", plan })]) {
    const f = createFake({ modal });
    const r = await runReadOnlyFlow(f.host, null, html);
    assert.equal(r.status, "cancelled");
  }
});
test("wrong scope, unknown overlap and actual overlap fail before any render", async () => {
  for (const resolved of [
    { scope: "Other" as const },
    { track: null },
    { trackIndex: null },
    { startBeat: 20, endBeat: 20 },
    { overlappingClipCount: null },
    { overlappingClipCount: 1 },
  ]) {
    const f = createFake({ resolved });
    const r = await runReadOnlyFlow(f.host, null, html);
    assert.equal(r.status, "blocked");
    assert.deepEqual(f.calls, ["resolve"]);
  }
});
test("AIFF/non-WAVE decode blocked; never shows editor", async () => {
  const f = createFake({ rendered: Buffer.from("FORMxxxxAIFF") });
  const r = await runReadOnlyFlow(f.host, null, html);
  assert.equal(r.status, "blocked");
  assert.deepEqual(f.calls, ["resolve", "render", "read"]);
  assert.ok(!f.logs.join(" ").includes("never-log-me"));
});
test("read failure never logs path or error message", async () => {
  const f = createFake({ throwRead: new Error("C:\\Users\\Private\\secret.wav") });
  const r = await runReadOnlyFlow(f.host, null, html);
  assert.equal(r.status, "blocked");
  assert.match(f.logs.join(" "), /failed-read-Error/);
  assert.ok(!f.logs.join(" ").includes("Private"));
  assert.ok(!f.logs.join(" ").includes("secret"));
});
test("render failure stops before reading audio or showing editor", async () => {
  const f = createFake({ renderError: new Error("C:\\Users\\Private\\secret.wav") });
  assert.equal((await runReadOnlyFlow(f.host, null, html)).status, "blocked");
  assert.deepEqual(f.calls, ["resolve", "render"]);
});
test("overlarge modal never opens (S3 B3 failure guard)", async () => {
  const f = createFake();
  const huge = html + "<!--" + "X".repeat(1_250_000) + "-->";
  const r = await runReadOnlyFlow(f.host, null, huge);
  assert.deepEqual(r, { status: "blocked", reason: "modal-url-too-large" });
  assert.deepEqual(f.calls, ["resolve", "render", "read"]);
});
test("too many operations rejected before DSP; input unchanged", async () => {
  const hugePlan = { version: 1, operations: Array.from({ length: MAX_OPERATIONS + 1 }, (_, i) => ({
    id: "r" + i, type: "reverse", enabled: true,
  })) };
  const f = createFake({ modal: JSON.stringify({ envelopeVersion: 1, action: "process", plan: hugePlan }) });
  const r = await runReadOnlyFlow(f.host, null, html);
  assert.deepEqual(r, { status: "blocked", reason: "too-many-operations" });
  assert.deepEqual(f.calls, ["resolve", "render", "read", "modal"]);
});
test("encoder/header sanity and renderer size guard", async () => {
  assert.equal(String.fromCharCode(...bytes.subarray(0, 4)), "RIFF");
  const f = createFake({ rendered: new Uint8Array(MAX_RENDER_BYTES + 1) });
  const r = await runReadOnlyFlow(f.host, null, html);
  assert.deepEqual(r, { status: "blocked", reason: "render-too-large" });
  assert.deepEqual(f.calls, ["resolve", "render", "read"]);
});


test("long 48 kHz audio >65536 frames succeeds without the global setImmediate provided by Node", async () => {
  // Live returned failed-dsp-ReferenceError for an approximately 2.82 s / 48 kHz WAV.
  // The previous 64-frame FakeHost sample never crossed the DSP event-loop yield.
  // Simulate a host context where the Node global is not injected.
  const frames = (1 << 16) + 4097;
  const audio = Float64Array.from({ length: frames }, (_, i) => Math.sin(i / 37));
  const wav = encodeWav(makeMetadata(1, 48000, 32, "float", frames), audio).bytes;
  const f = createFake({ rendered: wav });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "setImmediate");
  Object.defineProperty(globalThis, "setImmediate", {
    value: undefined, configurable: true, writable: true,
  });
  try {
    const r = await runReadOnlyFlow(f.host, null, html);
    assert.equal(r.status, "dry-run-complete", JSON.stringify(r));
    assert.deepEqual(f.calls, ["resolve", "render", "read", "modal"]);
    if (r.status === "dry-run-complete") {
      assert.equal(r.sourceFrames, frames);
      assert.equal(r.outputFrames, frames);
      assert.equal(r.enabledOperations, 2);
    }
    assert.ok(f.logs.some(line => line.startsWith("AOPX_T8_0_DRY_RUN_COMPLETE ")));
    assert.ok(f.logs.every(line => !line.includes("failed-dsp-ReferenceError")));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "setImmediate", descriptor);
    else Reflect.deleteProperty(globalThis, "setImmediate");
  }
});
