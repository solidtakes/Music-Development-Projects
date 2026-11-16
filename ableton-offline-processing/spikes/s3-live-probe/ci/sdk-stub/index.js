"use strict";
// CI-only runtime stub: hands the extension a fake context supplied by the smoke test.
class Clip {}
class AudioClip extends Clip {}
class MidiClip extends Clip {}
function initialize(activation, apiVersion) {
  const ctx = globalThis.__AOPX_FAKE_CONTEXT__;
  if (!ctx) throw new Error("CI stub: globalThis.__AOPX_FAKE_CONTEXT__ is not set");
  ctx.__initializedWith = { activation, apiVersion };
  return ctx;
}
module.exports = { initialize, Clip, AudioClip, MidiClip };
