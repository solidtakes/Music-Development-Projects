import { randomUUID } from 'node:crypto';
import { renameSync } from 'node:fs';
import { mkdir, mkdtemp, open, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { digest, SHA256_PATTERN } from './history.ts';
import { parseWav } from './wav.ts';
import type { Wav } from './wav.ts';

const MAX_WAV_BYTES = 256 * 1024 * 1024;
export const SOURCE_FILE = 'source.wav';
export const MANIFEST_FILE = 'project.json';
export const CACHE_DIR = 'cache';

export async function readWavFile(path: string, signal?: AbortSignal): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > MAX_WAV_BYTES) {
      throw new Error('Expected a WAV file no larger than 256 MiB');
    }
    const data = Buffer.alloc(info.size);
    for (let offset = 0; offset < data.length;) {
      signal?.throwIfAborted();
      const chunk = await handle.read(data, offset, Math.min(data.length - offset, 1024 * 1024), offset);
      if (chunk.bytesRead === 0) throw new Error('WAV was truncated during read');
      offset += chunk.bytesRead;
    }
    if ((await handle.stat()).size !== info.size) throw new Error('WAV length changed during read');
    return data;
  } finally {
    await handle.close();
  }
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

export async function writeManifest(root: string, data: string, beforeCommit: () => void) {
  const temporary = join(root, `.manifest-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, data, { flag: 'wx' });
    beforeCommit();
    // The stale-job check and commit are one turn of the JS event loop.
    renameSync(temporary, join(root, MANIFEST_FILE));
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export function cachePath(root: string, key: string): string {
  if (!SHA256_PATTERN.test(key)) throw new Error('Invalid cache key');
  return join(root, CACHE_DIR, key);
}

interface CacheMetadata {
  checksum: string;
  renderMs: number;
}

interface CacheEntry {
  file: Buffer;
  wav: Wav;
  path: string;
  renderMs: number;
}

export async function lookup(root: string, key: string, signal?: AbortSignal): Promise<CacheEntry | undefined> {
  const directory = cachePath(root, key);
  try {
    await stat(directory);
  } catch (error) {
    if (hasCode(error, 'ENOENT')) return undefined;
    throw error;
  }
  const path = join(directory, 'output.wav');
  const metadataPath = join(directory, 'metadata.json');
  const file = await readWavFile(path, signal);
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as CacheMetadata;
  if (!Number.isFinite(metadata.renderMs) || metadata.renderMs < 0 || metadata.checksum !== digest(file)) {
    throw new Error(`Cached render failed its integrity check: ${key}`);
  }
  return { file, wav: parseWav(file), renderMs: metadata.renderMs, path };
}

export async function cacheRender(
  root: string, key: string, file: Buffer, started: number, signal: AbortSignal,
): Promise<CacheEntry> {
  const directory = cachePath(root, key);
  const spool = join(root, CACHE_DIR);
  await mkdir(spool, { recursive: true });
  const temporary = await mkdtemp(join(spool, '.render-'));
  try {
    const checksum = digest(file);
    await writeFile(join(temporary, 'output.wav'), file, { flag: 'wx', signal });
    const renderMs = performance.now() - started;
    const metadata: CacheMetadata = { checksum, renderMs };
    await writeFile(join(temporary, 'metadata.json'), JSON.stringify(metadata), { flag: 'wx', signal });
    signal.throwIfAborted();
    try {
      renameSync(temporary, directory);
    } catch (error) {
      // Another branch may have rendered the same deterministic entry concurrently.
      const existing = await lookup(root, key, signal);
      if (!existing || digest(existing.file) !== checksum) throw error;
      return { ...existing, renderMs };
    }
    return { file, wav: parseWav(file), renderMs, path: join(directory, 'output.wav') };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function cacheFootprint(root: string): Promise<number> {
  const spool = join(root, CACHE_DIR);
  let entries;
  try {
    entries = await readdir(spool, { withFileTypes: true });
  } catch (error) {
    if (hasCode(error, 'ENOENT')) return 0;
    throw error;
  }
  let bytes = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || !SHA256_PATTERN.test(entry.name)) continue;
    const path = cachePath(root, entry.name);
    bytes += (await stat(join(path, 'output.wav'))).size;
    bytes += (await stat(join(path, 'metadata.json'))).size;
  }
  return bytes;
}
