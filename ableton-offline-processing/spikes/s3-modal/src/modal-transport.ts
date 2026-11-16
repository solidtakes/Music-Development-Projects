/**
 * S3 spike helpers: SDK-independent ways to hand an HTML document to the SDK modal and to record
 * what the modal returns. Nothing here imports the Ableton SDK; the spike extension passes the
 * resulting URL to `context.ui.showModalDialog(url, width, height)` itself.
 *
 * Three delivery variants are compared on Windows (see ../README.md):
 *   A. base64 data URL      toBase64DataUrl(html)
 *   B. file in tempDirectory writeModalFile(dir, html) -> pathToFileURL(...)
 *   C. raw data URL         toRawDataUrl(html)   (negative control: '#' starts a fragment)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** `data:` URL with the document base64-encoded, so `#`, `%` and non-ASCII characters survive. */
export function toBase64DataUrl(html: string): string {
  return `data:text/html;charset=utf-8;base64,${Buffer.from(html, 'utf8').toString('base64')}`;
}

/** `data:` URL with the document percent-encoded. Also safe; larger than base64 for this markup. */
export function toPercentDataUrl(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/**
 * Unencoded `data:` URL. Deliberately unsafe: everything after the first `#` is a URL fragment, so
 * the document is truncated there. Used only as a negative control in the spike.
 */
export function toRawDataUrl(html: string): string {
  return `data:text/html;charset=utf-8,${html}`;
}

/**
 * Write the document into `dir` (the Extension's tempDirectory in Live) and return its file URL.
 * `pathToFileURL` turns `C:\Users\…\x.html` into `file:///C:/Users/…/x.html`, encoding spaces and
 * other characters, which string concatenation would get wrong on Windows.
 */
export async function writeModalFile(dir: string, html: string, name = `aopx-modal-${Date.now()}.html`): Promise<{ path: string; url: string }> {
  await mkdir(dir, { recursive: true });
  const path = join(dir, name);
  await writeFile(path, html, 'utf8');
  return { path, url: pathToFileURL(path).href };
}

/** FNV-1a 32-bit hash of a string's UTF-16 code units; the probe page computes the same in-browser. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export interface ProbeInjection {
  variant: string;
  /** Filler of this many characters, to test how large an injected state can be. */
  padding: string;
  paddingLength: number;
  paddingHash: string;
  injectedAt: string;
}

/** Filler that contains every character that breaks naive embedding: `#`, `%`, `</script>`, U+2028, non-ASCII. */
export function makePadding(length: number): string {
  const unit = '#%&<>/script\u2028é音';
  let out = '';
  while (out.length < length) out += unit;
  return out.slice(0, length);
}

/** Inject `window.AOPX_PROBE` into the probe document, before its first script. Same escaping as host/src/modal.ts. */
export function injectProbe(html: string, variant: string, paddingLength = 0): string {
  const padding = makePadding(paddingLength);
  const probe: ProbeInjection = { variant, padding, paddingLength, paddingHash: fnv1a(padding), injectedAt: new Date().toISOString() };
  const json = JSON.stringify(probe)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const marker = '<script id="probe-main">';
  const at = html.indexOf(marker);
  if (at < 0) throw new Error('probe document must contain <script id="probe-main">');
  return `${html.slice(0, at)}<script>window.AOPX_PROBE=${json};</script>\n${html.slice(at)}`;
}

export type ModalReturnKind = 'string' | 'empty-string' | 'undefined' | 'null' | 'other' | 'rejected';

export interface ModalReturnRecord {
  kind: ModalReturnKind;
  typeofValue: string;
  length: number | null;
  /** First 200 characters of a string result, for the log. */
  preview: string | null;
  parsedJson: boolean;
  errorName: string | null;
  errorMessage: string | null;
}

/**
 * Describe whatever `showModalDialog` produced, without assuming its type. The spike logs this for
 * each way of closing the modal (Return, Cancel, the window's X button, Esc), because the SDK does
 * not document what an X-close returns.
 */
export function classifyModalReturn(settled: PromiseSettledResult<unknown>): ModalReturnRecord {
  if (settled.status === 'rejected') {
    const e = settled.reason as { name?: unknown; message?: unknown } | undefined;
    return { kind: 'rejected', typeofValue: typeof settled.reason, length: null, preview: null, parsedJson: false, errorName: e && typeof e.name === 'string' ? e.name : null, errorMessage: e && typeof e.message === 'string' ? e.message : String(settled.reason) };
  }
  const v = settled.value;
  const base = { typeofValue: typeof v, errorName: null, errorMessage: null };
  if (v === undefined) return { ...base, kind: 'undefined', length: null, preview: null, parsedJson: false };
  if (v === null) return { ...base, kind: 'null', length: null, preview: null, parsedJson: false };
  if (typeof v === 'string') {
    let parsedJson = false;
    try { JSON.parse(v); parsedJson = true; } catch { /* not JSON */ }
    return { ...base, kind: v.length === 0 ? 'empty-string' : 'string', length: v.length, preview: v.slice(0, 200), parsedJson };
  }
  return { ...base, kind: 'other', length: null, preview: null, parsedJson: false };
}
