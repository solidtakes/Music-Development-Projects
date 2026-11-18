import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { isDeepStrictEqual } from 'node:util';
import { branchAt, createHistory, digest, linearHistory, normalizeHistory, validateManifest } from './history.ts';
import { processAudio, processorIdentity } from './processors.ts';
import {
  cacheFootprint, cacheRender, lookup, MANIFEST_FILE, readWavFile, SOURCE_FILE, writeManifest,
} from './storage.ts';
import { parseWav, waveformPeaks } from './wav.ts';
import type { AudioMetadata, Operation, RenderProgress, RenderReport, RenderStep, SourceInfo } from './contract.ts';
import type { Manifest, RenderReceipt } from './history.ts';

export * from './contract.ts';

const ENGINE_VERSION = 1;

export interface RenderOptions {
  branch?: string;
  signal?: AbortSignal;
  onProgress?: (progress: RenderProgress) => void;
}

export interface RenderResult {
  outputPath: string;
  report: RenderReport;
}

/** One open editor session owns mutations to a project directory. */
export class AudioProject {
  readonly #root: string;
  #manifest: Manifest;
  #writes = Promise.resolve();
  #jobs = new Map<string, AbortController>();

  private constructor(root: string, manifest: Manifest) {
    this.#root = root;
    this.#manifest = manifest;
  }

  static async create(storageRoot: string, sourcePath: string): Promise<AudioProject> {
    const root = resolve(storageRoot);
    const original = await readWavFile(sourcePath);
    const { format } = parseWav(original);
    const source: SourceInfo = {
      name: basename(sourcePath), fingerprint: digest(original), bytes: original.length, format,
    };
    const manifest: Manifest = { version: 1, source, nodes: {}, branches: { main: { tip: null, render: null } } };
    await mkdir(root, { recursive: true });
    const destination = join(root, SOURCE_FILE);
    await writeFile(destination, original, { flag: 'wx' });
    try {
      await writeFile(join(root, MANIFEST_FILE), serialize(manifest), { flag: 'wx' });
    } catch (error) {
      await rm(destination, { force: true });
      throw error;
    }
    return new AudioProject(root, manifest);
  }

  static async open(storageRoot: string): Promise<AudioProject> {
    const root = resolve(storageRoot);
    const manifest = JSON.parse(await readFile(join(root, MANIFEST_FILE), 'utf8')) as Manifest;
    validateManifest(manifest);
    const project = new AudioProject(root, manifest);
    const { format } = parseWav(await project.#verifiedSource());
    if (!isDeepStrictEqual(format, manifest.source.format)) throw new Error('Project source metadata does not match WAV');
    return project;
  }

  get source(): SourceInfo {
    return structuredClone(this.#manifest.source);
  }

  get sourcePath(): string {
    return join(this.#root, SOURCE_FILE);
  }

  async waveform(columns: number) {
    return waveformPeaks(parseWav(await this.#verifiedSource()), columns);
  }

  history(branch = 'main'): Operation[] {
    const { tip } = branchAt(this.#manifest, branch);
    return linearHistory(this.#manifest, tip).map(({ operation }) => ({ ...operation }));
  }

  async setHistory(operations: readonly Operation[], branch = 'main'): Promise<void> {
    const normalized = normalizeHistory(operations);
    this.#supersede(branch);
    return this.#edit(async () => {
      const previous = branchAt(this.#manifest, branch);
      const { nodes, tip } = createHistory(this.#manifest.nodes, normalized);
      if (previous.tip === tip) return;
      const branches = { ...this.#manifest.branches, [branch]: { tip, render: null } };
      await this.#publish({ ...this.#manifest, nodes, branches });
    });
  }

  /** Fork from a branch's tip or from the first `operationCount` operations on it. */
  async fork(name: string, from = 'main', operationCount?: number): Promise<void> {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(name)) throw new Error('Invalid branch name');
    return this.#edit(async () => {
      if (Object.hasOwn(this.#manifest.branches, name)) throw new Error(`Branch already exists: ${name}`);
      const previous = branchAt(this.#manifest, from);
      const operations = this.history(from);
      const count = operationCount ?? operations.length;
      if (!Number.isInteger(count) || count < 0 || count > operations.length) {
        throw new RangeError('Invalid number of operations to fork');
      }
      const { tip } = createHistory(this.#manifest.nodes, operations.slice(0, count));
      const render = tip === previous.tip ? previous.render : null;
      const branches = { ...this.#manifest.branches, [name]: { tip, render } };
      await this.#publish({ ...this.#manifest, branches });
    });
  }

  async lastRender(branch = 'main'): Promise<RenderResult | null> {
    await this.#writes;
    const { render } = branchAt(this.#manifest, branch);
    if (!render) return null;
    const output = render.outputKey === null ? undefined : await lookup(this.#root, render.outputKey);
    if (render.outputKey !== null && !output) return null;
    const outputPath = output?.path ?? this.sourcePath;
    if (!output) await this.#verifiedSource();
    const report = await this.#report(render, outputPath, output?.wav.format ?? this.source.format);
    return { outputPath, report: structuredClone(report) };
  }

  async render({ branch = 'main', signal, onProgress }: RenderOptions = {}): Promise<RenderResult> {
    this.#supersede(branch);
    const job = new AbortController();
    this.#jobs.set(branch, job);
    const cancellation = signal ? AbortSignal.any([job.signal, signal]) : job.signal;
    try {
      await this.#writes;
      cancellation.throwIfAborted();
      const { tip } = branchAt(this.#manifest, branch);
      const history = linearHistory(this.#manifest, tip);
      const { source } = this.#manifest;
      const steps: RenderStep[] = [];
      const total = history.length;
      const progress = (completed: number, operationId: string | null, stepFraction = 0) => {
        onProgress?.({ completed, total, operationId, fraction: total ? (completed + stepFraction) / total : 1 });
        cancellation.throwIfAborted();
      };
      let wav = parseWav(await this.#verifiedSource(cancellation));
      let outputPath = this.sourcePath;
      let outputKey: string | null = null;
      let outputBytes = source.bytes;
      progress(0, history[0]?.operation.id ?? null);

      for (const [index, node] of history.entries()) {
        const { operation, schemaVersion } = node;
        if (!operation.enabled) {
          steps.push({
            operationId: operation.id, status: 'bypassed', renderMs: 0, lookupMs: 0,
            cacheKey: null, bytes: outputBytes, format: wav.format,
          });
        } else {
          const startedLookup = performance.now();
          const key: string = digest(JSON.stringify([
            ENGINE_VERSION, process.arch, process.versions.v8, source.fingerprint,
            outputKey ?? source.fingerprint, schemaVersion, wav.format.encoding, wav.format.bitDepth,
            wav.format.channels, wav.format.sampleRate, ...processorIdentity(operation),
          ]));
          const cached = await lookup(this.#root, key, cancellation);
          const lookupMs = performance.now() - startedLookup;
          cancellation.throwIfAborted();
          const startedRender = performance.now();
          const entry = cached ?? await cacheRender(this.#root, key, await processAudio(wav, operation, {
            signal: cancellation,
            onProgress: (fraction) => progress(index, operation.id, fraction),
          }), startedRender, cancellation);
          wav = entry.wav;
          outputKey = key;
          outputPath = entry.path;
          outputBytes = (await stat(outputPath)).size;
          steps.push({
            operationId: operation.id, status: cached ? 'hit' : 'miss', renderMs: entry.renderMs, lookupMs,
            cacheKey: key, bytes: outputBytes, format: wav.format,
          });
        }
        progress(index + 1, history[index + 1]?.operation.id ?? null);
      }

      const receipt = { outputKey, steps };
      const report = await this.#edit(async () => {
        const branches = { ...this.#manifest.branches, [branch]: { tip, render: receipt } };
        const next = { ...this.#manifest, branches };
        const footprint = await this.#report(receipt, outputPath, wav.format, next);
        await this.#publish(next, () => cancellation.throwIfAborted());
        return footprint;
      });
      cancellation.throwIfAborted();
      return { outputPath, report: structuredClone(report) };
    } finally {
      if (this.#jobs.get(branch) === job) this.#jobs.delete(branch);
    }
  }

  async #verifiedSource(signal?: AbortSignal): Promise<Buffer> {
    const file = await readWavFile(this.sourcePath, signal);
    const { source } = this.#manifest;
    if (file.length !== source.bytes || digest(file) !== source.fingerprint) {
      throw new Error('Project source failed its integrity check');
    }
    return file;
  }

  async #report(receipt: RenderReceipt, outputPath: string, format: AudioMetadata, next?: Manifest) {
    const [source, output, cacheBytes] = await Promise.all([
      stat(this.sourcePath),
      stat(outputPath),
      cacheFootprint(this.#root),
    ]);
    const manifestBytes = next
      ? Buffer.byteLength(serialize(next))
      : (await stat(join(this.#root, MANIFEST_FILE))).size;
    return {
      steps: receipt.steps, outputFormat: format, sourceBytes: source.size, outputBytes: output.size,
      cacheBytes, projectBytes: source.size + cacheBytes + manifestBytes,
    };
  }

  #supersede(branch: string) {
    this.#jobs.get(branch)?.abort(new DOMException('Render superseded by a newer request or edit', 'AbortError'));
  }

  #edit<T>(update: () => Promise<T>): Promise<T> {
    const pending = this.#writes.then(update);
    this.#writes = pending.then(() => {}, () => {});
    return pending;
  }

  async #publish(next: Manifest, guard = () => {}) {
    await writeManifest(this.#root, serialize(next), guard);
    this.#manifest = next;
  }
}

function serialize(manifest: Manifest) {
  return JSON.stringify(manifest, null, 2) + '\n';
}
