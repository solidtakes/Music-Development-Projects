/**
 * Content-addressed, immutable render cache.
 *
 * Layout under `<root>`:
 *   objects/<k0k1>/<key>.wav   immutable render output (mode 0444)
 *   objects/<k0k1>/<key>.json  entry metadata; its presence is the commit marker
 *   staging/                   in-progress writes, renamed into place atomically
 *
 * A cache key is sha256(canonicalJson(CacheKeyInputs)). Every output-affecting input is part of the
 * key: source fingerprint, upstream key, operation type + schema version, processor identity
 * (format, unique id, implementation version, binary hash, state hash), normalized parameters,
 * engine version, contract version and render settings (sample rate, channels, output sample format,
 * clip mode, quality, dither).
 *
 * A lookup returns an entry only if: metadata parses, its key and full key inputs equal the request,
 * its output format equals the expected format, the object exists with the recorded byte length, the
 * WAV header agrees with the recorded format, and (in 'hash' mode) the object's sha256 matches.
 * Anything else is reported as a miss with a reason and the entry is evicted.
 */
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AudioMetadata } from './contract.ts';
import { canonicalJson, hashJson, sha256File, sha256Hex } from './hash.ts';
import type { ProcessorIdentity, RenderSettings } from './processor.ts';
import { readWavMetadata } from './wav.ts';

export const ENGINE_VERSION = '0.1.0-alpha.0';
const META_VERSION = 1;

export interface CacheKeyInputs {
  kind: 'aopx.render';
  engineVersion: string;
  contractVersion: number;
  sourceFingerprint: string;
  /** Cache key of the upstream render, or null when the input is the source itself. */
  upstreamKey: string | null;
  operation: { type: string; schemaVersion: number };
  processor: ProcessorIdentity;
  params: Record<string, unknown>;
  settings: RenderSettings;
}

export function computeCacheKey(inputs: CacheKeyInputs): string {
  return hashJson(inputs);
}

export interface CacheEntry {
  metaVersion: number;
  key: string;
  inputs: CacheKeyInputs;
  contentSha256: string;
  bytes: number;
  format: AudioMetadata;
  /** Measured time to produce this entry (input decode + process + encode + write). */
  renderMs: number;
  clippedSamples: number;
  createdAt: string;
}

export type MissReason = 'absent' | 'corrupt-meta' | 'key-mismatch' | 'format-mismatch' | 'missing-object' | 'size-mismatch' | 'header-mismatch' | 'hash-mismatch';

export type LookupResult =
  | { hit: true; entry: CacheEntry; path: string; lookupMs: number }
  | { hit: false; reason: MissReason; lookupMs: number };

export type VerifyMode = 'hash' | 'size';

const sameFormat = (a: AudioMetadata, b: AudioMetadata) =>
  a.channels === b.channels && a.sampleRate === b.sampleRate && a.bitDepth === b.bitDepth &&
  a.frames === b.frames && a.encoding === b.encoding;

export class ContentCache {
  readonly root: string;
  readonly verify: VerifyMode;

  constructor(root: string, verify: VerifyMode = 'hash') {
    this.root = root;
    this.verify = verify;
  }

  async init(): Promise<void> {
    await mkdir(join(this.root, 'objects'), { recursive: true });
    await mkdir(join(this.root, 'staging'), { recursive: true });
  }

  objectPath(key: string): string {
    return join(this.root, 'objects', key.slice(0, 2), `${key}.wav`);
  }

  metaPath(key: string): string {
    return join(this.root, 'objects', key.slice(0, 2), `${key}.json`);
  }

  async lookup(key: string, inputs: CacheKeyInputs, expectedFormat: AudioMetadata): Promise<LookupResult> {
    const t0 = performance.now();
    const miss = async (reason: MissReason, evict: boolean): Promise<LookupResult> => {
      if (evict) await this.evict(key);
      return { hit: false, reason, lookupMs: performance.now() - t0 };
    };
    let raw: string;
    try {
      raw = await readFile(this.metaPath(key), 'utf8');
    } catch {
      return miss('absent', false);
    }
    let entry: CacheEntry;
    try {
      entry = JSON.parse(raw) as CacheEntry;
      if (entry.metaVersion !== META_VERSION || typeof entry.contentSha256 !== 'string') throw new Error('bad meta');
    } catch {
      return miss('corrupt-meta', true);
    }
    if (entry.key !== key || computeCacheKey(entry.inputs) !== key || canonicalJson(entry.inputs) !== canonicalJson(inputs)) {
      return miss('key-mismatch', true);
    }
    if (!sameFormat(entry.format, expectedFormat)) return miss('format-mismatch', true);
    const path = this.objectPath(key);
    let size: number;
    try {
      size = (await stat(path)).size;
    } catch {
      return miss('missing-object', true);
    }
    if (size !== entry.bytes) return miss('size-mismatch', true);
    try {
      const fh = await open(path, 'r');
      try {
        const head = new Uint8Array(Math.min(size, 4096));
        await fh.read(head, 0, head.length, 0);
        if (!sameFormat(readWavMetadata(head, size), entry.format)) {
          return miss('header-mismatch', true);
        }
      } finally {
        await fh.close();
      }
    } catch {
      return miss('header-mismatch', true);
    }
    if (this.verify === 'hash' && (await sha256File(path)) !== entry.contentSha256) return miss('hash-mismatch', true);
    return { hit: true, entry, path, lookupMs: performance.now() - t0 };
  }

  /**
   * Atomically publish an immutable entry. If a valid entry for the key already exists it is kept
   * (identical inputs produce identical bytes, so either copy is correct).
   */
  async publish(
    inputs: CacheKeyInputs,
    bytes: Uint8Array,
    format: AudioMetadata,
    renderMs: number,
    clippedSamples: number,
  ): Promise<CacheEntry> {
    const key = computeCacheKey(inputs);
    const existing = await this.lookup(key, inputs, format);
    if (existing.hit) return existing.entry;
    const entry: CacheEntry = {
      metaVersion: META_VERSION,
      key,
      inputs,
      contentSha256: sha256Hex(bytes),
      bytes: bytes.byteLength,
      format,
      renderMs,
      clippedSamples,
      createdAt: new Date().toISOString(),
    };
    const dir = join(this.root, 'objects', key.slice(0, 2));
    await mkdir(dir, { recursive: true });
    const stage = join(this.root, 'staging', randomUUID());
    try {
      await writeFile(`${stage}.wav`, bytes);
      await chmod(`${stage}.wav`, 0o444);
      await rename(`${stage}.wav`, this.objectPath(key));
      await writeFile(`${stage}.json`, JSON.stringify(entry, null, 2));
      await rename(`${stage}.json`, this.metaPath(key)); // commit marker last
    } finally {
      await rm(`${stage}.wav`, { force: true });
      await rm(`${stage}.json`, { force: true });
    }
    return entry;
  }

  async readObject(key: string): Promise<Uint8Array> {
    return readFile(this.objectPath(key));
  }

  async evict(key: string): Promise<void> {
    await rm(this.metaPath(key), { force: true });
    await rm(this.objectPath(key), { force: true });
  }

  /** Real on-disk byte total of committed objects + metadata. */
  async totalBytes(): Promise<number> {
    return directoryBytes(join(this.root, 'objects'));
  }

  async keys(): Promise<string[]> {
    const out: string[] = [];
    let shards: string[];
    try {
      shards = await readdir(join(this.root, 'objects'));
    } catch {
      return out;
    }
    for (const s of shards) {
      for (const f of await readdir(join(this.root, 'objects', s))) if (f.endsWith('.json')) out.push(f.slice(0, -5));
    }
    return out.sort();
  }

  /** Remove every committed entry whose key is not in `retain`. Returns bytes freed. */
  async collectGarbage(retain: Set<string>): Promise<number> {
    const before = await this.totalBytes();
    for (const k of await this.keys()) if (!retain.has(k)) await this.evict(k);
    await rm(join(this.root, 'staging'), { recursive: true, force: true });
    await mkdir(join(this.root, 'staging'), { recursive: true });
    return before - (await this.totalBytes());
  }
}

export async function directoryBytes(path: string): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const p = join(path, e.name);
    if (e.isDirectory()) total += await directoryBytes(p);
    else if (e.isFile()) total += (await stat(p)).size;
  }
  return total;
}
