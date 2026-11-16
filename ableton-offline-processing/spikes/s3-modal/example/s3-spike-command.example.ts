/**
 * S3 spike: example command body to paste into the OFFICIAL minimal extension that the SDK's own
 * project generator creates on the owner's Windows machine. It is type-checked here with `context`
 * typed as `any`, because the SDK packages are not in this repository (and must not be committed).
 *
 * API names used, and where they come from:
 *   context.ui.showModalDialog(url, width, height) -> string   [SDK_ARCHIVE_REVIEW_BETA_1.md §2 "User interface"]
 *   context.environment.tempDirectory                           [SDK_ARCHIVE_REVIEW_BETA_1.md §2 "Filesystem"]
 * UNVERIFIED (check your local SDK docs and the bundled modal-dialog example before running):
 *   - how a command is registered and receives `context` (copy that glue from the generated project);
 *   - whether showModalDialog returns a Promise, and what it resolves/rejects with on an X-close;
 *   - which URL schemes showModalDialog accepts (data:, file:, bundled asset paths).
 *
 * Safety: this only opens dialogs and writes a JSON log into tempDirectory. It reads no project
 * media and changes nothing in the Live Set. Run it only in a new, disposable Set.
 */
import { readFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { classifyModalReturn, injectProbe, toBase64DataUrl, toRawDataUrl, writeModalFile } from '../src/modal-transport.ts';

// Width/height from the editor README (860 x 660). S3 records how these map to CSS px at the
// display's scaling (see devicePixelRatio / inner size in the returned diagnostics).
const WIDTH = 860;
const HEIGHT = 660;

type Variant = { id: string; url: (html: string, tempDir: string) => Promise<string>; padding: number };

// Each run opens one dialog. The id tells the tester what to do in it (it is shown in the probe's title).
const VARIANTS: Variant[] = [
  { id: 'A1 base64 data URL: press RETURN DIAGNOSTICS', padding: 0, url: async (html) => toBase64DataUrl(html) },
  { id: 'A2 base64 data URL: press SEND CANCEL ENVELOPE', padding: 0, url: async (html) => toBase64DataUrl(html) },
  { id: 'A3 base64 data URL: close with the window X button', padding: 0, url: async (html) => toBase64DataUrl(html) },
  { id: 'A4 base64 data URL: press Esc (then X if it stays open)', padding: 0, url: async (html) => toBase64DataUrl(html) },
  { id: 'A5 base64 data URL: press RETURN 1 MB STRING', padding: 0, url: async (html) => toBase64DataUrl(html) },
  { id: 'B1 temp file URL: press RETURN DIAGNOSTICS', padding: 0, url: async (html, dir) => (await writeModalFile(dir, html, 'aopx-s3-B1.html')).url },
  { id: 'B2 temp file URL: close with the window X button', padding: 0, url: async (html, dir) => (await writeModalFile(dir, html, 'aopx-s3-B2.html')).url },
  // Negative control: everything after the first '#' is a fragment, so the page should be blank or broken.
  { id: 'C1 raw data URL (expected broken): close with X', padding: 0, url: async (html) => toRawDataUrl(html) },
  { id: 'D1 base64 data URL + 256 KB state: press RETURN DIAGNOSTICS', padding: 256 * 1024, url: async (html) => toBase64DataUrl(html) },
  // Chromium refuses data URLs over ~2 MiB (test/browser-probe.test.ts). E checks whether Live's
  // modal does the same: expect it not to load. F is the same state delivered as a temp file.
  { id: 'E1 base64 data URL + 2 MB state (expected to exceed the limit): close with X', padding: 2 * 1024 * 1024, url: async (html) => toBase64DataUrl(html) },
  { id: 'F1 temp file URL + 2 MB state: press RETURN DIAGNOSTICS', padding: 2 * 1024 * 1024, url: async (html, dir) => (await writeModalFile(dir, html, 'aopx-s3-F1.html')).url },
];

// `probeHtml` must be the contents of spikes/s3-modal/probe/probe.html, copied next to this file
// in the generated extension (how assets are bundled is SDK-specific: follow the generated project).
export async function runS3Spike(context: any, probeHtml: string): Promise<void> {
  const tempDir: string = context.environment.tempDirectory;
  const logPath = join(tempDir, 'aopx-s3-log.jsonl');
  const log = (entry: unknown) => appendFile(logPath, JSON.stringify(entry) + '\n', 'utf8');
  await log({ event: 'start', at: new Date().toISOString(), node: process.version, platform: process.platform, arch: process.arch });

  for (const v of VARIANTS) {
    const html = injectProbe(probeHtml, v.id, v.padding);
    let url: string;
    try {
      url = await v.url(html, tempDir);
    } catch (e) {
      await log({ variant: v.id, stage: 'build-url', error: String(e) });
      continue;
    }
    const t0 = Date.now();
    // Wrap in Promise.resolve so a synchronous return and a Promise are handled alike.
    const settled = await Promise.allSettled([Promise.resolve().then(() => context.ui.showModalDialog(url, WIDTH, HEIGHT))]);
    await log({ variant: v.id, urlScheme: url.slice(0, url.indexOf(':') + 1), urlLength: url.length, ms: Date.now() - t0, result: classifyModalReturn(settled[0]!) });
  }
  await log({ event: 'end', at: new Date().toISOString() });
}

/** Helper for the checklist: read the log back to paste into Issue #40. */
export async function readS3Log(context: any): Promise<string> {
  return readFile(join(context.environment.tempDirectory, 'aopx-s3-log.jsonl'), 'utf8');
}
