import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { makeFixture } from "./fixture.mjs";
import { runRoundTrip } from "./src/round-trip.ts";

class AudioTrack {
  arrangementClips = [];
  clipSlots = [];
  takeLanes = [];
}

async function fakeLive(t) {
  const tempDirectory = await mkdtemp(join(tmpdir(), "aopx-spike-test-"));
  t.after(() => rm(tempDirectory, { recursive: true, force: true }));
  const wav = makeFixture();
  const path = join(tempDirectory, "render.wav");
  const imported = join(tempDirectory, "imported.wav");
  await writeFile(path, wav);

  const track = new AudioTrack();
  const clip = Object.freeze({
    parent: track, name: "Synthetic", startTime: 8, endTime: 12, muted: false,
    warping: false, looping: false, startMarker: 0, endMarker: 2, warpMarkers: [],
  });
  track.arrangementClips.push(clip);
  const events = [];
  const controller = new AbortController();
  const outputTrack = new AudioTrack();
  outputTrack.createAudioClip = async (args) => {
    events.push("clip");
    assert.deepEqual(args, { filePath: imported, startTime: 8, duration: 4, isWarped: false });
    return { startTime: args.startTime, endTime: args.startTime + args.duration, warping: args.isWarped, looping: false };
  };
  const song = {
    async createAudioTrack() {
      events.push("track");
      return outputTrack;
    },
    async deleteTrack(value) {
      assert.equal(value, outputTrack);
      events.push("cleanup");
    },
  };
  const context = {
    application: { song },
    environment: { tempDirectory },
    resources: {
      async renderPreFxAudio(inputTrack, start, end) {
        assert.equal(inputTrack, track);
        assert.deepEqual([start, end], [8, 12]);
        events.push("render");
        return path;
      },
      async importIntoProject(value) {
        assert.equal(value, path);
        events.push("import");
        return imported;
      },
    },
    ui: {
      async withinProgressDialog(_title, { progress }, callback) {
        assert.equal(progress, 0);
        return callback(async () => {}, controller.signal);
      },
      async showModalDialog(url, width, height) {
        events.push("modal");
        assert.deepEqual([width, height], [420, 220]);
        const html = decodeURIComponent(url.slice("data:text/html,".length));
        assert.match(html, /96000 frames/);
        assert.match(html, /close_and_send/);
        return "import";
      },
    },
  };
  return {
    context, events, track, controller, outputTrack, path, wav,
    run: () => runRoundTrip(context, () => clip, AudioTrack, () => {}),
  };
}

test("renders, measures and confirms before importing on a separate track", async (t) => {
  const live = await fakeLive(t);
  assert.deepEqual(await live.run(), {
    status: "imported",
    placement: { startTime: 8, endTime: 12, warping: false, looping: false },
    render: {
      formatTag: 1, channels: 2, sampleRate: 48000, blockAlign: 4, bitDepth: 16,
      frames: 96000, seconds: 2, bytes: live.wav.length,
      sha256: createHash("sha256").update(live.wav).digest("hex"),
    },
  });
  assert.deepEqual(live.events, ["render", "modal", "import", "track", "clip"]);
  assert.deepEqual(await readFile(live.path), live.wav);
});

test("rejects extra Arrangement clips and take lanes before rendering", async (t) => {
  const live = await fakeLive(t);
  live.track.arrangementClips.push({});
  await assert.rejects(live.run(), /only Arrangement clip/);
  live.track.arrangementClips.pop();
  live.track.takeLanes.push({});
  await assert.rejects(live.run(), /no take lanes/);
  assert.deepEqual(live.events, []);
});

test("accepts only host-generated WAVs inside the temp directory", async (t) => {
  const live = await fakeLive(t);
  live.context.resources.renderPreFxAudio = async () => join(tmpdir(), "outside.wav");
  await assert.rejects(live.run(), /outside the Extension temp/);
  live.context.resources.renderPreFxAudio = async () => join(live.context.environment.tempDirectory, "render.aif");
  await assert.rejects(live.run(), /Record File Type/);
  live.context.resources.renderPreFxAudio = async () => live.path;
  await writeFile(live.path, live.wav.subarray(0, 100));
  await assert.rejects(live.run(), /truncated/);
  assert.deepEqual(live.events, []);
});

test("cancellation while render is pending keeps import and UI closed", async (t) => {
  const live = await fakeLive(t);
  live.context.resources.renderPreFxAudio = async () => {
    live.events.push("render");
    live.controller.abort();
    return live.path;
  };
  assert.deepEqual(await live.run(), { status: "cancelled" });
  assert.deepEqual(live.events, ["render"]);
});

test("only an explicit import action permits the Set mutation path", async (t) => {
  const live = await fakeLive(t);
  for (const result of ["cancel", "", "unknown"]) {
    live.context.ui.showModalDialog = async () => result;
    assert.deepEqual(await live.run(), { status: "cancelled" });
  }
  assert.deepEqual(live.events, ["render", "render", "render"]);
});

test("a changed Set is rejected before import", async (t) => {
  const live = await fakeLive(t);
  live.context.ui.showModalDialog = async () => {
    live.context.application.song = {};
    return "import";
  };
  await assert.rejects(live.run(), /active Set changed/);
  assert.deepEqual(live.events, ["render"]);
});

test("a createAudioClip failure cleans up only the new empty track", async (t) => {
  const live = await fakeLive(t);
  live.outputTrack.createAudioClip = async () => { throw new Error("host clip error"); };
  await assert.rejects(live.run(), /host clip error/);
  assert.deepEqual(live.events, ["render", "modal", "import", "track", "cleanup"]);
});
