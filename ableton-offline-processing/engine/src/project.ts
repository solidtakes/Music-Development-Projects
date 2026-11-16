/**
 * Project: immutable sources + version graph + content-addressed cache + render orchestration.
 *
 * Storage layout under `storageRoot` (intended to be the Extension's `storageDirectory`):
 *   project.json              manifest (schema-versioned, written atomically)
 *   sources/<sha256>.wav      immutable copies of imported sources (mode 0444)
 *   cache/                    ContentCache (see cache.ts)
 * `tempRoot` (intended to be the Extension's `tempDirectory`) holds disposable exports only.
 */
import { copyFile, chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import {
  CONTRACT_VERSION,
  type AudioMetadata,
  type Operation,
  type OperationPlan,
  type RenderProgress,
  type RenderReport,
  type RenderStep,
  type SourceInfo,
} from './contract.ts';
import { ContentCache, ENGINE_VERSION, computeCacheKey, directoryBytes, writeImmutable, type CacheKeyInputs, type VerifyMode } from './cache.ts';
import { GraphError, VersionGraph, rootId, type GraphSnapshot, type OperationNode } from './graph.ts';
import { sha256File, sha256Hex } from './hash.ts';
import { getAdapter, normalizeOperation, toContractOperation } from './operations.ts';
import type { RenderSettings } from './processor.ts';
import { decodeWav, encodeWav, type DecodedAudio } from './wav.ts';

export const MANIFEST_SCHEMA_VERSION = 1;

export interface ProjectOptions {
  storageRoot: string;
  tempRoot?: string;
  /** Cache verification on lookup. 'hash' (default) re-hashes the object; 'size' checks size+header only. */
  verify?: VerifyMode;
}

/** Per-node render record (history model fields required by ALPHA_0_1_SPEC). */
export interface NodeRenderRecord {
  status: 'rendered' | 'cached' | 'bypassed' | 'failed';
  cacheKey: string | null;
  renderMs: number;
  lookupMs: number;
  bytes: number;
  format: AudioMetadata;
  clippedSamples: number;
  error: string | null;
  at: string;
}

export interface HistoryEntry {
  position: number;
  nodeId: string;
  inputNodeId: string;
  operation: Operation;
  schemaVersion: number;
  render: NodeRenderRecord | null;
}

export interface BranchOutput {
  revision: number;
  head: string;
  /** null when the active chain is a pass-through of the source. */
  outputKey: string | null;
  report: RenderReport;
}

export interface StoredSource extends SourceInfo {
  /** Path relative to storageRoot. */
  storedPath: string;
  importedFrom: string;
}

interface ManifestV1 {
  schemaVersion: 1;
  engineVersion: string;
  contractVersion: number;
  createdAt: string;
  savedAt: string;
  sources: Record<string, StoredSource>;
  graph: GraphSnapshot;
  /** branch name -> source fingerprint */
  branchSources: Record<string, string>;
  renders: Record<string, NodeRenderRecord>;
  outputs: Record<string, BranchOutput>;
}

export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestError';
  }
}

/**
 * Manifest migration. Prototype policy: each released schema version gets a pure upgrade function
 * to the next version; unknown/newer versions are refused rather than guessed at.
 */
const MIGRATIONS: Record<number, (m: Record<string, unknown>) => Record<string, unknown>> = {
  // 1: (m) => ({ ...m, schemaVersion: 2, ... })  // add when schema 2 exists
};

export function migrateManifest(raw: unknown): ManifestV1 {
  if (typeof raw !== 'object' || raw === null) throw new ManifestError('Manifest is not an object.');
  let m = raw as Record<string, unknown>;
  const declared = m['schemaVersion'];
  if (typeof declared !== 'number' || !Number.isInteger(declared) || declared < 1) {
    throw new ManifestError('Manifest has no valid schemaVersion.');
  }
  let v: number = declared;
  if (v > MANIFEST_SCHEMA_VERSION) {
    throw new ManifestError(`Manifest schema ${v} is newer than this engine supports (${MANIFEST_SCHEMA_VERSION}).`);
  }
  while (v < MANIFEST_SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new ManifestError(`No migration from manifest schema ${v}.`);
    m = step(m);
    v = m['schemaVersion'] as number;
  }
  return m as unknown as ManifestV1;
}

export type RenderStatus = 'completed' | 'superseded' | 'cancelled' | 'failed';

export interface RenderResult {
  status: RenderStatus;
  branch: string;
  revision: number;
  head: string;
  /** Absolute path of the immutable output (cache object, or the stored source for pass-through). */
  outputPath: string | null;
  outputKey: string | null;
  report: RenderReport | null;
  wallMs: number;
  error?: string;
}

export interface RenderOptions {
  signal?: AbortSignal;
  onProgress?: (p: RenderProgress) => void;
  /** Test hook: awaited before each operation step. */
  beforeStep?: (operationId: string) => Promise<void> | void;
}

export class Project {
  readonly storageRoot: string;
  readonly tempRoot: string;
  readonly cache: ContentCache;
  private graph = new VersionGraph();
  private sources: Record<string, StoredSource> = {};
  private branchSources: Record<string, string> = {};
  private renders: Record<string, NodeRenderRecord> = {};
  private outputs: Record<string, BranchOutput> = {};
  private createdAt = new Date().toISOString();
  /** In-memory latest-request tickets and controllers per branch. */
  private tickets = new Map<string, number>();
  private inflight = new Map<string, AbortController>();

  private constructor(opts: ProjectOptions) {
    this.storageRoot = opts.storageRoot;
    this.tempRoot = opts.tempRoot ?? join(tmpdir(), 'aopx-temp');
    this.cache = new ContentCache(join(opts.storageRoot, 'cache'), opts.verify ?? 'hash');
  }

  get manifestPath(): string {
    return join(this.storageRoot, 'project.json');
  }

  static async create(opts: ProjectOptions): Promise<Project> {
    const p = new Project(opts);
    await mkdir(join(p.storageRoot, 'sources'), { recursive: true });
    await mkdir(p.tempRoot, { recursive: true });
    await p.cache.init();
    await p.save();
    return p;
  }

  static async open(opts: ProjectOptions): Promise<Project> {
    const p = new Project(opts);
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(p.manifestPath, 'utf8'));
    } catch (e) {
      throw new ManifestError(`Cannot read manifest: ${(e as Error).message}`);
    }
    const m = migrateManifest(raw);
    p.createdAt = m.createdAt;
    p.sources = m.sources;
    p.graph = VersionGraph.fromJSON(m.graph);
    p.branchSources = m.branchSources;
    p.renders = m.renders;
    p.outputs = m.outputs;
    // Reports saved before RenderReport.wallMs existed have no measured wall time: record it as unknown.
    for (const out of Object.values(p.outputs)) {
      if (typeof out.report.wallMs !== 'number') out.report.wallMs = null;
    }
    await mkdir(p.tempRoot, { recursive: true });
    await p.cache.init();
    for (const s of Object.values(p.sources)) {
      try {
        await stat(join(p.storageRoot, s.storedPath));
      } catch {
        throw new ManifestError(`Stored source ${s.storedPath} is missing.`);
      }
    }
    return p;
  }

  async save(): Promise<void> {
    const m: ManifestV1 = {
      schemaVersion: 1,
      engineVersion: ENGINE_VERSION,
      contractVersion: CONTRACT_VERSION,
      createdAt: this.createdAt,
      savedAt: new Date().toISOString(),
      sources: this.sources,
      graph: this.graph.toJSON(),
      branchSources: this.branchSources,
      renders: this.renders,
      outputs: this.outputs,
    };
    const tmp = `${this.manifestPath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(m, null, 2));
    await rename(tmp, this.manifestPath);
  }

  // ---------------------------------------------------------------- sources

  /** Copy a WAV into immutable project storage. The file at `path` is only read, never modified. */
  async importSource(path: string, name: string = basename(path)): Promise<SourceInfo> {
    const bytes = await readFile(path);
    const { format } = decodeWav(bytes); // validates the whole file
    const fingerprint = sha256Hex(bytes);
    const storedPath = join('sources', `${fingerprint}.wav`);
    const abs = join(this.storageRoot, storedPath);
    if (!this.sources[fingerprint]) {
      // The stored copy may already exist on disk without being in the manifest (e.g. a crash before
      // save). A copy whose sha256 matches the fingerprint is reused; an invalid one is replaced.
      await writeImmutable(abs, bytes, `${abs}.${process.pid}.tmp`, fingerprint);
      this.sources[fingerprint] = { name, fingerprint, bytes: bytes.byteLength, format, storedPath, importedFrom: path };
    }
    this.graph.addSource(fingerprint);
    return this.sourceInfo(fingerprint);
  }

  sourceInfo(fingerprint: string): SourceInfo {
    const s = this.sources[fingerprint];
    if (!s) throw new GraphError(`Unknown source ${fingerprint}.`);
    return { name: s.name, fingerprint: s.fingerprint, bytes: s.bytes, format: { ...s.format } };
  }

  sourcePath(fingerprint: string): string {
    const s = this.sources[fingerprint];
    if (!s) throw new GraphError(`Unknown source ${fingerprint}.`);
    return join(this.storageRoot, s.storedPath);
  }

  /** Re-hash the stored source and confirm it still matches its fingerprint. */
  async verifySource(fingerprint: string): Promise<boolean> {
    return (await sha256File(this.sourcePath(fingerprint))) === fingerprint;
  }

  // ---------------------------------------------------------------- history

  /** Commit an operation plan to `branch` (created if needed). Returns the new branch revision. */
  setPlan(branch: string, sourceFingerprint: string, plan: OperationPlan): { head: string; revision: number } {
    if (plan.version !== CONTRACT_VERSION) throw new GraphError(`Unsupported plan version ${String(plan.version)}.`);
    if (!this.sources[sourceFingerprint]) throw new GraphError(`Unknown source ${sourceFingerprint}.`);
    const bound = this.branchSources[branch];
    if (bound && bound !== sourceFingerprint) throw new GraphError(`Branch '${branch}' belongs to a different source.`);
    const ops = plan.operations.map(normalizeOperation);
    const ref = this.graph.commit(branch, sourceFingerprint, ops);
    this.branchSources[branch] = sourceFingerprint;
    return { head: ref.head, revision: ref.revision };
  }

  /** Branch from any existing node (default: the head of `from`). Does not affect `from`. */
  createBranch(name: string, from: { branch: string } | { node: string }): { head: string; revision: number } {
    const at = 'branch' in from ? this.graph.branch(from.branch).head : from.node;
    const ref = this.graph.createBranch(name, at);
    this.branchSources[name] = this.graph.node(at).sourceFingerprint;
    return { head: ref.head, revision: ref.revision };
  }

  /** Append operations after the current head of a branch. */
  extendBranch(branch: string, operations: Operation[]): { head: string; revision: number } {
    const fp = this.branchSources[branch];
    if (!fp) throw new GraphError(`Unknown branch '${branch}'.`);
    const ref = this.graph.commit(branch, fp, operations.map(normalizeOperation), this.graph.branch(branch).head);
    return { head: ref.head, revision: ref.revision };
  }

  branches(): string[] {
    return this.graph.branchNames();
  }

  branchRef(branch: string) {
    return this.graph.branch(branch);
  }

  /** The Alpha 0.1 linear history list: a projection of the branch path. */
  history(branch: string): HistoryEntry[] {
    return this.graph.linear(branch).map((n: OperationNode, i) => ({
      position: i,
      nodeId: n.id,
      inputNodeId: n.parent,
      operation: toContractOperation(n.operation),
      schemaVersion: n.operation.schemaVersion,
      render: this.renders[n.id] ? { ...this.renders[n.id]! } : null,
    }));
  }

  plan(branch: string): OperationPlan {
    return { version: CONTRACT_VERSION, operations: this.history(branch).map((h) => h.operation) };
  }

  graphSnapshot(): GraphSnapshot {
    return this.graph.toJSON();
  }

  lastOutput(branch: string): BranchOutput | null {
    return this.outputs[branch] ? structuredClone(this.outputs[branch]!) : null;
  }

  // ---------------------------------------------------------------- rendering

  private settingsFor(format: AudioMetadata): RenderSettings {
    return {
      sampleRate: format.sampleRate,
      channels: format.channels,
      outputEncoding: format.encoding,
      outputBitDepth: format.bitDepth,
      clipMode: 'saturate',
      quality: 'standard',
      dither: 'none',
    };
  }

  /** Cache key inputs for every enabled node on a branch, without rendering (for diagnostics/tests). */
  plannedKeys(branch: string): Array<{ operationId: string; cacheKey: string | null }> {
    const fp = this.branchSources[branch]!;
    let format = this.sources[fp]!.format;
    let upstream: string | null = null;
    return this.graph.linear(branch).map((n) => {
      if (!n.operation.enabled) return { operationId: n.operation.id, cacheKey: null };
      const inputs = this.keyInputs(fp, upstream, n, format);
      format = getAdapter(n.operation.type).outputFormat(format, n.operation.params);
      upstream = computeCacheKey(inputs);
      return { operationId: n.operation.id, cacheKey: upstream };
    });
  }

  private keyInputs(fp: string, upstreamKey: string | null, n: OperationNode, format: AudioMetadata): CacheKeyInputs {
    const adapter = getAdapter(n.operation.type);
    return {
      kind: 'aopx.render',
      engineVersion: ENGINE_VERSION,
      contractVersion: CONTRACT_VERSION,
      sourceFingerprint: fp,
      upstreamKey,
      operation: { type: n.operation.type, schemaVersion: n.operation.schemaVersion },
      processor: adapter.identity(n.operation.params),
      params: n.operation.params,
      settings: this.settingsFor(format),
    };
  }

  /**
   * Render the branch head. Latest request wins: starting a render aborts any in-flight render of the
   * same branch, and a render publishes its result to the branch only if no newer commit or render
   * request happened meanwhile. Cache entries written before supersession remain valid for their keys.
   */
  async render(branch: string, opts: RenderOptions = {}): Promise<RenderResult> {
    const t0 = performance.now();
    const ref = this.graph.branch(branch);
    const fp = this.branchSources[branch]!;
    const ticket = (this.tickets.get(branch) ?? 0) + 1;
    this.tickets.set(branch, ticket);
    this.inflight.get(branch)?.abort(new DOMException('Superseded by a newer render request', 'AbortError'));
    const own = new AbortController();
    this.inflight.set(branch, own);
    const signal = opts.signal ? AbortSignal.any([opts.signal, own.signal]) : own.signal;
    const isStale = () => this.tickets.get(branch) !== ticket || this.graph.branch(branch).revision !== ref.revision;

    const base = { branch, revision: ref.revision, head: ref.head };
    const finish = (status: RenderStatus, extra: Partial<RenderResult> = {}): RenderResult => {
      if (this.inflight.get(branch) === own) this.inflight.delete(branch);
      return { ...base, status, outputPath: null, outputKey: null, report: null, wallMs: performance.now() - t0, ...extra };
    };

    const nodes = this.graph.linear(branch);
    const enabledTotal = nodes.length;
    const steps: RenderStep[] = [];
    const pendingRecords: Record<string, NodeRenderRecord> = {};
    let format = this.sources[fp]!.format;
    let upstreamKey: string | null = null;
    let audio: DecodedAudio | null = null; // decoded current output, loaded lazily on first miss

    const loadCurrent = async (): Promise<DecodedAudio> => {
      if (audio) return audio;
      const bytes = upstreamKey === null ? await readFile(this.sourcePath(fp)) : await this.cache.readObject(upstreamKey);
      audio = decodeWav(bytes);
      return audio;
    };

    try {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]!;
        const op = n.operation;
        await opts.beforeStep?.(op.id);
        signal.throwIfAborted();
        if (isStale()) return finish('superseded');
        const progress = (fraction: number) =>
          opts.onProgress?.({ completed: i, total: enabledTotal, operationId: op.id, fraction: (i + fraction) / Math.max(1, enabledTotal) });
        progress(0);

        if (!op.enabled) {
          steps.push({ operationId: op.id, status: 'bypassed', renderMs: 0, lookupMs: 0, bytes: 0, cacheKey: null, format: { ...format } });
          pendingRecords[n.id] = { status: 'bypassed', cacheKey: null, renderMs: 0, lookupMs: 0, bytes: 0, format: { ...format }, clippedSamples: 0, error: null, at: new Date().toISOString() };
          continue;
        }
        const adapter = getAdapter(op.type);
        const inputs = this.keyInputs(fp, upstreamKey, n, format);
        const key = computeCacheKey(inputs);
        const outFormat = adapter.outputFormat(format, op.params);
        const found = adapter.deterministic ? await this.cache.lookup(key, inputs, outFormat) : null;

        if (found?.hit) {
          steps.push({ operationId: op.id, status: 'hit', renderMs: found.entry.renderMs, lookupMs: found.lookupMs, bytes: found.entry.bytes, cacheKey: key, format: found.entry.format });
          pendingRecords[n.id] = { status: 'cached', cacheKey: key, renderMs: found.entry.renderMs, lookupMs: found.lookupMs, bytes: found.entry.bytes, format: found.entry.format, clippedSamples: found.entry.clippedSamples, error: null, at: new Date().toISOString() };
          audio = null;
        } else {
          const r0 = performance.now();
          const input = await loadCurrent();
          let output: DecodedAudio;
          try {
            output = await adapter.process(input, op.params, { signal, onProgress: progress });
          } catch (e) {
            if ((e as Error).name === 'AbortError') throw e;
            const message = (e as Error).message;
            this.renders[n.id] = { status: 'failed', cacheKey: key, renderMs: performance.now() - r0, lookupMs: found?.lookupMs ?? 0, bytes: 0, format, clippedSamples: 0, error: message, at: new Date().toISOString() };
            return finish('failed', { error: message });
          }
          const { bytes, clippedSamples } = encodeWav(output.format, output.samples);
          signal.throwIfAborted();
          const renderMs = performance.now() - r0;
          const entry = await this.cache.publish(inputs, bytes, output.format, renderMs, clippedSamples);
          steps.push({ operationId: op.id, status: 'miss', renderMs: entry.renderMs, lookupMs: found?.lookupMs ?? 0, bytes: entry.bytes, cacheKey: key, format: entry.format });
          pendingRecords[n.id] = { status: 'rendered', cacheKey: key, renderMs: entry.renderMs, lookupMs: found?.lookupMs ?? 0, bytes: entry.bytes, format: entry.format, clippedSamples: entry.clippedSamples, error: null, at: new Date().toISOString() };
          // Downstream consumes exactly the stored (quantized) bytes, never the unquantized float
          // buffer, so a node's output is identical whether its upstream was a cache hit or a miss.
          audio = decodeWav(bytes);
        }
        upstreamKey = key;
        format = outFormat;
        progress(1);
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return finish(own.signal.aborted && !opts.signal?.aborted ? 'superseded' : 'cancelled');
      throw e;
    }

    if (isStale()) return finish('superseded');

    const outputPath = upstreamKey === null ? this.sourcePath(fp) : this.cache.objectPath(upstreamKey);
    const report: RenderReport = {
      steps,
      sourceBytes: (await stat(this.sourcePath(fp))).size,
      outputBytes: (await stat(outputPath)).size,
      outputFormat: { ...format },
      cacheBytes: await this.cache.totalBytes(),
      projectBytes: await directoryBytes(this.storageRoot),
      wallMs: performance.now() - t0,
    };
    if (isStale()) return finish('superseded');
    Object.assign(this.renders, pendingRecords);
    this.outputs[branch] = { revision: ref.revision, head: ref.head, outputKey: upstreamKey, report };
    return finish('completed', { outputPath, outputKey: upstreamKey, report });
  }

  /** Copy a completed branch output to the disposable temp area (e.g. for Live's importIntoProject). */
  async exportOutput(branch: string, fileName?: string): Promise<string> {
    const out = this.outputs[branch];
    if (!out) throw new GraphError(`Branch '${branch}' has no completed render.`);
    const src = out.outputKey === null ? this.sourcePath(this.branchSources[branch]!) : this.cache.objectPath(out.outputKey);
    const dest = join(this.tempRoot, fileName ?? `${branch.replace(/[^\w.-]/g, '_')}-${(out.outputKey ?? 'source').slice(0, 16)}.wav`);
    await copyFile(src, dest);
    await chmod(dest, 0o644);
    return dest;
  }

  /** Check every recorded cache reference still resolves to a valid entry. */
  async validateCacheReferences(): Promise<{ valid: string[]; invalid: string[] }> {
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const [branch, out] of Object.entries(this.outputs)) {
      for (const s of out.report.steps) {
        if (!s.cacheKey) continue;
        const meta = await readFile(this.cache.metaPath(s.cacheKey), 'utf8').then(JSON.parse).catch(() => null);
        const r = meta ? await this.cache.lookup(s.cacheKey, meta.inputs, s.format) : { hit: false };
        (r.hit ? valid : invalid).push(`${branch}:${s.operationId}:${s.cacheKey}`);
      }
    }
    return { valid, invalid };
  }

  /** Delete cache entries not referenced by any branch's latest completed output. */
  async collectGarbage(): Promise<number> {
    const retain = new Set<string>();
    for (const out of Object.values(this.outputs)) for (const s of out.report.steps) if (s.cacheKey) retain.add(s.cacheKey);
    return this.cache.collectGarbage(retain);
  }

  async footprint(): Promise<{ sourceBytes: number; cacheBytes: number; manifestBytes: number; projectBytes: number }> {
    return {
      sourceBytes: await directoryBytes(join(this.storageRoot, 'sources')),
      cacheBytes: await this.cache.totalBytes(),
      manifestBytes: (await stat(this.manifestPath)).size,
      projectBytes: await directoryBytes(this.storageRoot),
    };
  }

  /** Root node id for a source (exposed for branching tests/diagnostics). */
  static rootNode(fingerprint: string): string {
    return rootId(fingerprint);
  }
}
