/*
 * Spike S3 delivery helpers (AOPX-01). SDK-independent and dependency-free.
 *
 * They build the candidate URLs that the S3 spike hands to showModalDialog, so each delivery
 * method can be exercised in a desktop browser first (CI, Playwright) and then in Live on Windows:
 *   A. generated HTML file in the extension's tempDirectory, opened via a file:// URL
 *   B. base64 data URL (safe for '#', '%', non-ASCII)
 *   C. percent-encoded data URL (encodeURIComponent)
 *   D. static page + state in the URL query or hash (base64url JSON)
 * The naive `data:text/html,<raw html>` form is exported only so tests can prove it is broken:
 * the first '#' in the document (CSS colours) starts a fragment and truncates the page.
 *
 * This is spike code, not the T8 adapter. Whatever S3 proves on Windows is what T8 ports.
 */
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

/** FNV-1a over UTF-16 code units; must match probe.html. */
export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** JSON safe inside an inline <script> (same escaping as host/src/modal.ts serializeInitialState). */
export function scriptSafeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** A probe state carrying `payloadBytes` of filler and the checksum the page should reproduce. */
export function makeProbeState({ payloadBytes = 1024, nonce = randomUUID() } = {}) {
  const unit = 'aopx-s3-#%&<>/é漢-';
  let payload = '';
  while (payload.length < payloadBytes) payload += unit;
  payload = payload.slice(0, payloadBytes);
  return { nonce, payload, expectFnv1a: fnv1a(payload) };
}

const PROBE_MARKER = '<script id="aopx-probe-main">';

/** Insert `window.AOPX_PROBE_STATE = ...` before the probe's main script. */
export function injectProbeState(html, state) {
  const at = html.indexOf(PROBE_MARKER);
  if (at < 0 || html.indexOf(PROBE_MARKER, at + 1) >= 0) {
    throw new Error('Probe document must contain exactly one <script id="aopx-probe-main">.');
  }
  return `${html.slice(0, at)}<script>window.AOPX_PROBE_STATE=${scriptSafeJson(state)};</script>\n${html.slice(at)}`;
}

/** B: base64 data URL. Robust against '#', '%' and non-ASCII. */
export function toBase64DataUrl(html) {
  return `data:text/html;charset=utf-8;base64,${Buffer.from(html, 'utf8').toString('base64')}`;
}

/** C: percent-encoded data URL. */
export function toPercentDataUrl(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/** Known-broken form, for tests only: the first '#' becomes a fragment. */
export function toNaiveDataUrl(html) {
  return `data:text/html;charset=utf-8,${html}`;
}

/** base64url of the JSON, for D (query or hash). */
export function encodeUrlState(state) {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
}

/** D: a base URL (file:// or data:) plus ?aopx= or #aopx=. */
export function withUrlState(baseUrl, state, where = 'hash') {
  const enc = encodeUrlState(state);
  if (where === 'query') return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}aopx=${enc}`;
  if (where === 'hash') return `${baseUrl}#aopx=${enc}`;
  throw new Error(`where must be 'query' or 'hash', got ${where}`);
}

/**
 * A: write the document to a NEW uniquely named file in `dir` and return its file:// URL.
 * Uses flag 'wx', so it never overwrites an existing file (Windows file-lock caveat from T4/R4).
 * pathToFileURL handles drive letters, backslashes, spaces and non-ASCII on Windows.
 */
export async function writeModalDocument(dir, html, prefix = 'aopx-modal') {
  if (!isAbsolute(dir)) throw new Error(`dir must be absolute, got ${dir}`);
  const path = join(dir, `${prefix}-${randomUUID()}.html`);
  await writeFile(path, html, { encoding: 'utf8', flag: 'wx' });
  return { path, url: pathToFileURL(path).href };
}

/**
 * Classify whatever showModalDialog resolved with, for S3 logging. T8 rule (review finding R2):
 * anything that is not a parseable JSON-object string is treated as a cancel, never a crash.
 */
export function classifyModalReturn(value) {
  if (value === undefined) return { kind: 'undefined', treatAs: 'cancel' };
  if (value === null) return { kind: 'null', treatAs: 'cancel' };
  if (typeof value !== 'string') return { kind: `non-string:${typeof value}`, treatAs: 'cancel' };
  if (value.trim() === '') return { kind: 'empty-string', treatAs: 'cancel' };
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { kind: 'not-json', length: value.length, treatAs: 'cancel' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'json-non-object', treatAs: 'cancel' };
  }
  // 'process' needs the same envelope version the product parser (host/src/modal.ts) accepts; any
  // other version is a cancel. This is a logging aid: in T8, parseModalResult stays the authority.
  const isProcess = parsed.action === 'process' && parsed.envelopeVersion === 1;
  return { kind: 'json-object', length: value.length, action: parsed.action ?? null, treatAs: isProcess ? 'process' : 'cancel', parsed };
}
