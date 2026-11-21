import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beatsToSeconds, expectedFrames, secondsToBeats } from '../src/timing.ts';
import { classifyAudioHeader } from '../src/render-input.ts';
import { ProgressForwarder, inBand, toSdkPercent } from '../src/progress.ts';

const head = (s: string) => new TextEncoder().encode(s);

test('timing: one second at 120 BPM is two beats, not half a beat', () => {
  assert.equal(secondsToBeats(1, 120), 2);
  assert.equal(beatsToSeconds(2, 120), 1);
  assert.equal(beatsToSeconds(3, 90), 2);
  assert.equal(expectedFrames(8, 12, 120, 48_000), 96_000);
  assert.equal(expectedFrames(0, 1, 100, 44_100), 26_460);
});

test('timing: rejects non-finite, zero or negative inputs', () => {
  assert.throws(() => beatsToSeconds(1, 0), RangeError);
  assert.throws(() => beatsToSeconds(Number.NaN, 120), RangeError);
  assert.throws(() => secondsToBeats(1, -5), RangeError);
  assert.throws(() => expectedFrames(4, 4, 120, 48_000), RangeError);
  assert.throws(() => expectedFrames(0, 1, 120, 0), RangeError);
});

test('header classification: WAV, RF64/BW64, AIFF/AIFC, other', () => {
  assert.equal(classifyAudioHeader(head('RIFF\0\0\0\0WAVE')), 'wav');
  assert.equal(classifyAudioHeader(head('RF64\0\0\0\0WAVE')), 'rf64');
  assert.equal(classifyAudioHeader(head('BW64\0\0\0\0WAVE')), 'rf64');
  assert.equal(classifyAudioHeader(head('FORM\0\0\0\0AIFF')), 'aiff');
  assert.equal(classifyAudioHeader(head('FORM\0\0\0\0AIFC')), 'aiff');
  assert.equal(classifyAudioHeader(head('RIFF\0\0\0\0AVI ')), 'unknown');
  assert.equal(classifyAudioHeader(head('RIFF')), 'unknown');
});

test('progress: engine fraction maps to beta.1 0..100, clamped', () => {
  assert.equal(toSdkPercent(0), 0);
  assert.equal(toSdkPercent(0.5), 50);
  assert.equal(toSdkPercent(1), 100);
  assert.equal(toSdkPercent(1.7), 100);
  assert.equal(toSdkPercent(-1), 0);
  assert.equal(toSdkPercent(Number.NaN), 0);
  assert.equal(inBand([0.1, 0.85], 0.5), 0.475);
});

test('progress: monotonic, throttled, serialized, latest wins, errors swallowed', async () => {
  let t = 0;
  const sent: number[] = [];
  let release: () => void = () => undefined;
  let first = true;
  const f = new ProgressForwarder(
    async (_text, pct) => {
      sent.push(pct);
      if (first) {
        first = false;
        await new Promise<void>((r) => (release = r));
      }
    },
    { minIntervalMs: 100, now: () => t },
  );
  f.update('a', 0.1); // sent immediately, then blocks
  f.update('a', 0.2); // queued behind the in-flight update
  f.update('a', 0.3); // replaces 0.2
  f.update('a', 0.25); // never moves backwards
  release();
  await f.flush();
  assert.deepEqual(sent, [10, 30]);
  t = 150;
  f.update('a', 0.4);
  await f.flush();
  t = 160;
  f.update('a', 0.5); // inside the throttle window: held until flush
  assert.deepEqual(sent, [10, 30, 40]);
  await f.flush();
  assert.deepEqual(sent, [10, 30, 40, 50]);

  const bad = new ProgressForwarder(async () => {
    throw new Error('dialog gone');
  });
  bad.update('x', 1);
  await bad.flush();
  assert.match(String(bad.error), /dialog gone/);
});
