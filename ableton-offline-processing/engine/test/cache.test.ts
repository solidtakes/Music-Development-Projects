import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat, writeFile, chmod, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ContentCache, ENGINE_VERSION, computeCacheKey, type CacheKeyInputs } from '../src/cache.ts';
import { makeSignal } from './fixtures.ts';
import { tempDir } from './helpers.ts';

const baseInputs = (): CacheKeyInputs => ({
  kind: 'aopx.render',
  engineVersion: ENGINE_VERSION,
  contractVersion: 1,
  sourceFingerprint: 'a'.repeat(64),
  upstreamKey: null,
  operation: { type: 'gain', schemaVersion: 1 },
  processor: { format: 'native', uniqueId: 'aopx.gain', version: '1', binaryHash: null, stateHash: null },
  params: { db: -3 },
  settings: { sampleRate: 48000, channels: 2, outputEncoding: 'pcm', outputBitDepth: 24, clipMode: 'saturate', quality: 'standard', dither: 'none' },
});

test('cache key is deterministic and independent of property order', () => {
  const a = baseInputs();
  const reorder = (v: unknown): unknown =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reorder(x)]))
      : v;
  const b = reorder(a) as CacheKeyInputs;
  assert.notEqual(JSON.stringify(a), JSON.stringify(b), 'property order really differs');
  assert.equal(computeCacheKey(a), computeCacheKey(b));
  assert.match(computeCacheKey(a), /^[0-9a-f]{64}$/);
});

test('cache key changes when any output-affecting input changes', () => {
  const k0 = computeCacheKey(baseInputs());
  const mutations: Array<[string, (i: CacheKeyInputs) => void]> = [
    ['source', (i) => { i.sourceFingerprint = 'b'.repeat(64); }],
    ['upstream', (i) => { i.upstreamKey = 'c'.repeat(64); }],
    ['op type', (i) => { i.operation.type = 'reverse'; }],
    ['op schema', (i) => { i.operation.schemaVersion = 2; }],
    ['processor impl version', (i) => { i.processor.version = '2'; }],
    ['processor format', (i) => { i.processor.format = 'vst3'; }],
    ['processor unique id', (i) => { i.processor.uniqueId = 'x'; }],
    ['binary hash', (i) => { i.processor.binaryHash = 'd'; }],
    ['state hash', (i) => { i.processor.stateHash = 'e'; }],
    ['params', (i) => { i.params = { db: -3.5 }; }],
    ['engine version', (i) => { i.engineVersion = '9'; }],
    ['contract version', (i) => { i.contractVersion = 2; }],
    ['sample rate', (i) => { i.settings.sampleRate = 44100; }],
    ['channels', (i) => { i.settings.channels = 1; }],
    ['output encoding', (i) => { i.settings.outputEncoding = 'float'; }],
    ['output bit depth', (i) => { i.settings.outputBitDepth = 16; }],
  ];
  const seen = new Set([k0]);
  for (const [name, mutate] of mutations) {
    const i = baseInputs();
    mutate(i);
    const k = computeCacheKey(i);
    assert.ok(!seen.has(k), `${name} must change the key`);
    seen.add(k);
  }
});

async function published(verify: 'hash' | 'size' = 'hash') {
  const cache = new ContentCache(join(await tempDir(), 'cache'), verify);
  await cache.init();
  const { audio, bytes } = makeSignal(1000);
  const inputs = baseInputs();
  const entry = await cache.publish(inputs, bytes, audio.format, 1.5, 0);
  return { cache, inputs, entry, format: audio.format, bytes };
}

test('publish then lookup hits; object is immutable (0444) and sizes are real', async () => {
  const { cache, inputs, entry, format, bytes } = await published();
  const r = await cache.lookup(entry.key, inputs, format);
  assert.ok(r.hit);
  assert.equal(r.entry.bytes, bytes.byteLength);
  const st = await stat(cache.objectPath(entry.key));
  assert.equal(st.size, bytes.byteLength);
  assert.equal(st.mode & 0o777, 0o444);
  assert.equal(await cache.totalBytes(), st.size + (await stat(cache.metaPath(entry.key))).size);
  assert.ok(r.lookupMs >= 0);
});

test('lookup never returns an entry whose inputs or format differ from the request', async () => {
  const { cache, inputs, entry, format } = await published();
  const other = { ...inputs, params: { db: -4 } };
  assert.deepEqual((await cache.lookup(entry.key, other, format)).hit, false);
  // tampered metadata (inputs edited but key left) -> key-mismatch and eviction
  const p2 = await published();
  const meta = JSON.parse(await readFile(p2.cache.metaPath(p2.entry.key), 'utf8'));
  meta.inputs.params.db = -9;
  await writeFile(p2.cache.metaPath(p2.entry.key), JSON.stringify(meta));
  const r = await p2.cache.lookup(p2.entry.key, p2.inputs, p2.format);
  assert.equal(r.hit, false);
  assert.equal(!r.hit && r.reason, 'key-mismatch');
  assert.deepEqual(await p2.cache.keys(), []);
  // format mismatch
  const p3 = await published();
  const r3 = await p3.cache.lookup(p3.entry.key, p3.inputs, { ...p3.format, frames: 999 });
  assert.equal(!r3.hit && r3.reason, 'format-mismatch');
});

test('cache corruption is detected and evicted', async () => {
  const flip = async (path: string, mutate: (b: Buffer) => Buffer) => {
    await chmod(path, 0o644);
    await writeFile(path, mutate(await readFile(path)));
  };
  const a = await published('hash');
  await flip(a.cache.objectPath(a.entry.key), (b) => { b[b.length - 1] = b[b.length - 1]! ^ 0xff; return b; });
  const ra = await a.cache.lookup(a.entry.key, a.inputs, a.format);
  assert.equal(!ra.hit && ra.reason, 'hash-mismatch');
  assert.deepEqual(await a.cache.keys(), [], 'evicted');

  const b = await published('size');
  await flip(b.cache.objectPath(b.entry.key), (x) => x.subarray(0, x.length - 6));
  const rb = await b.cache.lookup(b.entry.key, b.inputs, b.format);
  assert.equal(!rb.hit && rb.reason, 'size-mismatch');

  const c = await published();
  await writeFile(c.cache.metaPath(c.entry.key), '{not json');
  const rc = await c.cache.lookup(c.entry.key, c.inputs, c.format);
  assert.equal(!rc.hit && rc.reason, 'corrupt-meta');

  const d = await published();
  await chmod(d.cache.objectPath(d.entry.key), 0o644);
  await (await import('node:fs/promises')).rm(d.cache.objectPath(d.entry.key));
  const rd = await d.cache.lookup(d.entry.key, d.inputs, d.format);
  assert.equal(!rd.hit && rd.reason, 'missing-object');

  const e = await published('size');
  await flip(e.cache.objectPath(e.entry.key), (x) => { x[22] = 1; x[32] = 3; return x; }); // header now says mono
  const re = await e.cache.lookup(e.entry.key, e.inputs, e.format);
  assert.equal(!re.hit && re.reason, 'header-mismatch');
});

test('garbage collection keeps retained keys and frees real bytes', async () => {
  const { cache, entry } = await published();
  const { audio, bytes } = makeSignal(500);
  const other = await cache.publish({ ...baseInputs(), params: { db: -1 } }, bytes, audio.format, 1, 0);
  const freed = await cache.collectGarbage(new Set([entry.key]));
  assert.ok(freed > bytes.byteLength);
  assert.deepEqual(await cache.keys(), [entry.key]);
  assert.notEqual(other.key, entry.key);
});
