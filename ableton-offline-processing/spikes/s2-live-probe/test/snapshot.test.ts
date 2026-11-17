import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshotClip, type ClipView, type TrackView } from "../src/snapshot.ts";
function clip(): ClipView {
  return {
    handle: { id: 7n }, startTime: 16, endTime: 32, duration: 16,
    startMarker: 0, endMarker: 16, loopStart: 0, loopEnd: 16,
    looping: false, muted: false, warping: true, warpMode: 4,
    warpMarkers: [{}, {}], filePath: "C:\\Users\\private\\secret.wav",
  };
}
function track(items: TrackView["arrangementClips"]): TrackView {
  return { handle: { id: 9n }, arrangementClips: items };
}
test("beat fields, source path and handle privacy", () => {
  const r = snapshotClip(clip(), track([{ handle: { id: 7n }, startTime: 16, endTime: 32 }]), "Arrangement", 2, 120);
  assert.equal(r.clip.startTime, 16);
  assert.equal(r.clip.sourceExtension, ".wav");
  assert.equal(r.timeUnits, "beats");
  assert.equal(r.overlap.otherClipCount, 0);
  const text = JSON.stringify(r);
  assert.ok(!text.includes("private"));
  assert.ok(!text.includes("secret"));
  assert.ok(!text.includes('"id"'));
});
test("counts overlap but not adjacent clips or the selected clip", () => {
  const items = [
    { handle: { id: 7n }, startTime: 16, endTime: 32 },
    { handle: { id: 10n }, startTime: 12, endTime: 17 },
    { handle: { id: 11n }, startTime: 31, endTime: 35 },
    { handle: { id: 12n }, startTime: 32, endTime: 40 },
    { handle: { id: 13n }, startTime: 0, endTime: 16 },
  ];
  const r = snapshotClip(clip(), track(items), "Arrangement", 0, 120);
  assert.equal(r.overlap.otherClipCount, 2);
  assert.equal(r.overlap.overlapsOtherClips, true);
});
test("session and take lane overlap remain unknown", () => {
  for (const scope of ["Session", "TakeLane", "Unknown"] as const) {
    const r = snapshotClip(clip(), track([]), scope, 0, 120);
    assert.equal(r.overlap.status, "not-measured");
    assert.equal(r.overlap.overlapsOtherClips, "unknown");
  }
});
test("missing parent track is never guessed", () => {
  const r = snapshotClip(clip(), null, "Unknown", null, 120);
  assert.equal(r.parentTrackResolved, false);
  assert.equal(r.trackIndex, null);
  assert.equal(r.overlap.otherClipCount, null);
});
