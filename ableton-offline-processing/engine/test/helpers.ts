import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Project, type ProjectOptions } from '../src/project.ts';
import { makeSignal } from './fixtures.ts';

export async function tempDir(prefix = 'aopx-test-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function newProject(frames = 48000, channels = 2, extra: Partial<ProjectOptions> = {}) {
  const dir = await tempDir();
  const userPath = join(dir, 'user-audio', 'clip.wav');
  await import('node:fs/promises').then((fs) => fs.mkdir(join(dir, 'user-audio')));
  const { bytes } = makeSignal(frames, channels);
  await writeFile(userPath, bytes);
  const opts: ProjectOptions = { storageRoot: join(dir, 'storage'), tempRoot: join(dir, 'temp'), ...extra };
  const project = await Project.create(opts);
  const source = await project.importSource(userPath);
  return { dir, userPath, opts, project, source, fp: source.fingerprint };
}

export const plan = (...operations: import('../src/contract.ts').Operation[]) => ({ version: 1 as const, operations });
export const rev = (id = 'rev', enabled = true) => ({ id, type: 'reverse' as const, enabled });
export const gn = (db: number, id = 'gain', enabled = true) => ({ id, type: 'gain' as const, db, enabled });
export const statuses = (r: { report: { steps: { status: string }[] } | null }) => r.report!.steps.map((s) => s.status);
