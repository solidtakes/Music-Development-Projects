import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyModalReturn,
  encodeUrlState,
  fnv1a,
  injectProbeState,
  makeProbeState,
  scriptSafeJson,
  toBase64DataUrl,
  toNaiveDataUrl,
  toPercentDataUrl,
  withUrlState,
  writeModalDocument,
} from '../delivery.mjs';
import { S3_CASES, buildCaseUrl } from '../s3-runner.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const probeHtml = await readFile(join(here, '..', 'probe.html'), 'utf8');
const guiHtml = await readFile(join(here, '..', '..', '..', 'editor', 'interface.html'), 'utf8');

test('fnv1a is stable and matches known vectors', () => {
  assert.equal(fnv1a(''), '811c9dc5');
  assert.equal(fnv1a('a'), 'e40c292c');
  assert.equal(fnv1a('foobar'), 'bf9cf968');
});

test('makeProbeState carries the exact payload size and checksum, including hostile characters', () => {
  const s = makeProbeState({ payloadBytes: 5000, nonce: 'n' });
  assert.equal(s.payload.length, 5000);
  assert.equal(s.expectFnv1a, fnv1a(s.payload));
  for (const ch of ['#', '%', '&', '<', '>', 'é']) assert.ok(s.payload.includes(ch), `payload contains ${ch}`);
});

test('scriptSafeJson cannot close a script tag and round-trips', () => {
  const v = { name: '</script><script>alert(1)</script>', sep: '\u2028\u2029', amp: 'a&b' };
  const out = scriptSafeJson(v);
  assert.ok(!out.includes('</script'));
  assert.ok(!out.includes('\u2028'));
  assert.deepEqual(JSON.parse(out), v);
});

test('injectProbeState inserts exactly one state script before the probe script', () => {
  const out = injectProbeState(probeHtml, makeProbeState({ nonce: 'x' }));
  const stateAt = out.indexOf('window.AOPX_PROBE_STATE=');
  const mainAt = out.indexOf('<script id="aopx-probe-main">');
  assert.ok(stateAt > 0 && stateAt < mainAt);
  assert.throws(() => injectProbeState('<html></html>', {}), /exactly one/);
});

test('the product GUI and the probe both contain "#", so a naive data URL is unsafe (review R1)', () => {
  assert.ok((guiHtml.match(/#/g) ?? []).length > 10);
  assert.ok(probeHtml.includes('#'));
  const naive = new URL(toNaiveDataUrl(guiHtml));
  assert.notEqual(naive.hash, '', 'a raw "#" starts a fragment');
  for (const url of [toBase64DataUrl(guiHtml), toPercentDataUrl(guiHtml)]) {
    assert.equal(new URL(url).hash, '', 'encoded forms have no fragment');
  }
});

test('base64 data URL decodes back to the identical UTF-8 document', () => {
  const html = injectProbeState(probeHtml, makeProbeState({ payloadBytes: 2048 }));
  const url = toBase64DataUrl(html);
  assert.ok(url.startsWith('data:text/html;charset=utf-8;base64,'));
  assert.equal(Buffer.from(url.split(',')[1], 'base64').toString('utf8'), html);
  assert.equal(decodeURIComponent(toPercentDataUrl(html).split(',').slice(1).join(',')), html);
});

test('URL state (query and hash) is base64url and survives URL parsing', () => {
  const state = makeProbeState({ payloadBytes: 300, nonce: 'q' });
  const enc = encodeUrlState(state);
  assert.match(enc, /^[A-Za-z0-9_-]+$/);
  const h = new URL(withUrlState('file:///C:/tmp/p.html', state, 'hash'));
  const q = new URL(withUrlState('file:///C:/tmp/p.html', state, 'query'));
  for (const got of [h.hash.slice('#aopx='.length), q.searchParams.get('aopx')]) {
    assert.deepEqual(JSON.parse(Buffer.from(got, 'base64url').toString('utf8')), state);
  }
  assert.throws(() => withUrlState('file:///x', state, 'path'));
});

test('writeModalDocument writes a new unique file, never overwrites, and returns a file URL', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aopx s3 é-'));
  const a = await writeModalDocument(dir, '<p>a</p>');
  const b = await writeModalDocument(dir, '<p>b</p>');
  assert.notEqual(a.path, b.path);
  assert.ok(a.url.startsWith('file://'));
  assert.ok(!a.url.includes(' '), 'spaces are percent-encoded');
  assert.equal(await readFile(new URL(a.url), 'utf8'), '<p>a</p>');
  assert.equal((await readdir(dir)).length, 2);
  await assert.rejects(() => writeModalDocument('relative/dir', 'x'), /absolute/);
  // 'wx' semantics: an existing path is refused rather than replaced.
  await assert.rejects(() => writeFile(a.path, 'clobber', { flag: 'wx' }), /EEXIST/);
});

test('classifyModalReturn treats every non-result as cancel (review R2)', () => {
  const cases = [
    [undefined, 'undefined'], [null, 'null'], [42, 'non-string:number'], [{}, 'non-string:object'],
    ['', 'empty-string'], ['  ', 'empty-string'], ['not json', 'not-json'], ['[1]', 'json-non-object'], ['"x"', 'json-non-object'],
  ];
  for (const [value, kind] of cases) {
    const c = classifyModalReturn(value);
    assert.equal(c.kind, kind);
    assert.equal(c.treatAs, 'cancel');
  }
  assert.equal(classifyModalReturn('{"envelopeVersion":1,"action":"cancel"}').treatAs, 'cancel');
  const p = classifyModalReturn('{"envelopeVersion":1,"action":"process","plan":{"version":1,"operations":[]}}');
  assert.equal(p.kind, 'json-object');
  assert.equal(p.treatAs, 'process');
});

test('every S3 case builds a URL; file cases land in tempDirectory only', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aopx-s3-cases-'));
  const ids = new Set();
  for (const c of S3_CASES) {
    assert.ok(!ids.has(c.id), `unique id ${c.id}`);
    ids.add(c.id);
    assert.ok(c.ask.length > 0);
    const built = await buildCaseUrl(c, { tempDirectory: dir, probeHtml, guiHtml });
    assert.ok(built.url.length > 0);
    if (built.path) assert.ok(built.path.startsWith(dir), `${c.id} wrote inside tempDirectory`);
    if (c.method === 'data-base64') assert.ok(built.url.startsWith('data:text/html;charset=utf-8;base64,'));
  }
});
