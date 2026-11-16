import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { classifyModalReturn, fnv1a, injectProbe, makePadding, toBase64DataUrl, toPercentDataUrl, toRawDataUrl, writeModalFile } from '../src/modal-transport.ts';

const here = dirname(fileURLToPath(import.meta.url));
const probeHtml = await readFile(join(here, '..', 'probe', 'probe.html'), 'utf8');
const decodeData = (url: string) => {
  const comma = url.indexOf(',');
  const meta = url.slice(0, comma);
  const body = url.slice(comma + 1);
  return meta.endsWith(';base64') ? Buffer.from(body, 'base64').toString('utf8') : decodeURIComponent(body);
};

test('base64 and percent data URLs carry the whole document, including # characters', () => {
  assert.ok(probeHtml.includes('#'), 'the probe deliberately contains #');
  for (const url of [toBase64DataUrl(probeHtml), toPercentDataUrl(probeHtml)]) {
    assert.ok(!url.includes('#'), 'no raw # left in the URL');
    assert.equal(decodeData(url), probeHtml);
  }
  const raw = toRawDataUrl(probeHtml);
  assert.ok(raw.indexOf('#') > 0, 'raw data URL has a # that starts a fragment (negative control)');
  assert.ok(raw.indexOf('#') < raw.indexOf('probe-main'), 'and the fragment begins before the probe script');
});

test('writeModalFile returns a file URL that maps back to the written path', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aopx s3 #space-'));
  const { path, url } = await writeModalFile(dir, '<p>x</p>', 'probe file.html');
  assert.ok(url.startsWith('file:///'));
  assert.ok(!url.includes(' ') && !url.slice('file://'.length).includes('#'), 'spaces and # are encoded');
  assert.equal(fileURLToPath(url), path);
  assert.equal(await readFile(path, 'utf8'), '<p>x</p>');
});

test('injectProbe embeds hostile padding safely and intact', () => {
  const html = injectProbe(probeHtml, 'unit', 5000);
  const start = html.indexOf('window.AOPX_PROBE=');
  const script = html.slice(start, html.indexOf('</script>', start));
  assert.ok(!script.includes('</script'), 'padding cannot close the script');
  const sandbox: { window: Record<string, any> } = { window: {} };
  vm.runInNewContext(script, sandbox);
  const p = sandbox.window['AOPX_PROBE'];
  assert.equal(p.variant, 'unit');
  assert.equal(p.padding, makePadding(5000));
  assert.equal(p.paddingHash, fnv1a(p.padding));
  assert.throws(() => injectProbe('<html></html>', 'x'), /probe-main/);
});

test('classifyModalReturn records every shape a modal might return', () => {
  assert.equal(classifyModalReturn({ status: 'fulfilled', value: '{"a":1}' }).kind, 'string');
  assert.equal(classifyModalReturn({ status: 'fulfilled', value: '{"a":1}' }).parsedJson, true);
  assert.equal(classifyModalReturn({ status: 'fulfilled', value: 'abc' }).parsedJson, false);
  assert.equal(classifyModalReturn({ status: 'fulfilled', value: '' }).kind, 'empty-string');
  assert.equal(classifyModalReturn({ status: 'fulfilled', value: undefined }).kind, 'undefined');
  assert.equal(classifyModalReturn({ status: 'fulfilled', value: null }).kind, 'null');
  assert.equal(classifyModalReturn({ status: 'fulfilled', value: 42 }).kind, 'other');
  const r = classifyModalReturn({ status: 'rejected', reason: new TypeError('closed') });
  assert.deepEqual([r.kind, r.errorName, r.errorMessage], ['rejected', 'TypeError', 'closed']);
  assert.equal(classifyModalReturn({ status: 'rejected', reason: 'plain' }).errorMessage, 'plain');
  assert.equal(classifyModalReturn({ status: 'fulfilled', value: 'y'.repeat(500) }).preview!.length, 200);
});
