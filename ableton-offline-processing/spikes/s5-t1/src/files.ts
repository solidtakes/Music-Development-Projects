import { constants } from 'node:fs';
import { lstat, realpath, open, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { digest } from './flow.ts';
import type { Receipt } from './port.ts';

const CAP = 32 * 1024 * 1024;
export async function ownedRoot(root: string | undefined): Promise<string> {
  if (!root || !path.isAbsolute(root)) throw new Error('Owned root unavailable');
  const st = await lstat(root);
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error('Unsafe owned root');
  return realpath(root);
}
export async function readOwned(root: string, candidate: string, maxBytes = CAP): Promise<Uint8Array> {
  const base = await ownedRoot(root);
  const full = path.resolve(candidate);
  const rel = path.relative(base, full);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('File outside owned root');
  // Check each component, including junctions/symlinks; reject rather than following them.
  let cursor = base;
  for (const component of rel.split(path.sep)) {
    cursor = path.join(cursor, component);
    if ((await lstat(cursor)).isSymbolicLink()) throw new Error('Linked path refused');
  }
  const before = await lstat(full);
  if (!before.isFile() || before.size < 12 || before.size > maxBytes) throw new Error('File size/type refused');
  const f = await open(full, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const a = await f.stat();
    if (a.dev !== before.dev || a.ino !== before.ino || a.size !== before.size) throw new Error('File changed');
    const bytes = new Uint8Array(a.size);
    let count = 0;
    while (count < bytes.length) {
      const n = await f.read(bytes, count, bytes.length - count, count);
      if (n.bytesRead === 0) throw new Error('Short read'); count += n.bytesRead;
    }
    const b = await f.stat(), after = await lstat(full);
    if (b.size !== a.size || b.mtimeMs !== a.mtimeMs || b.ctimeMs !== a.ctimeMs ||
        after.isSymbolicLink() || after.dev !== a.dev || after.ino !== a.ino)
      throw new Error('File changed during read');
    return bytes;
  } finally { await f.close(); }
}

export async function writeExclusive(file: string, bytes: Uint8Array | string): Promise<void> {
  const f = await open(file, 'wx', 0o600);
  try { await f.writeFile(bytes); await f.sync(); } finally { await f.close(); }
}

/** Extension-owned only. Permanent exclusive claim prevents restart or multi-process replay.
 * No cleanup/release operation exists. Manual receipt reconciliation is required for another trial.
 */
export function ownedFiles(tempGetter: () => string | undefined, storageGetter: () => string | undefined) {
  let folder: string | undefined; let claimed = false; let sequence = 0;
  async function directory() {
    const root = await ownedRoot(storageGetter());
    const d = path.join(root, 'aopx-s5-t1-receipts');
    try { await mkdir(d, { mode: 0o700 }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
    if ((await lstat(d)).isSymbolicLink() || !(await lstat(d)).isDirectory()) throw new Error('Unsafe receipt root');
    return d;
  }
  return {
    async hasPriorOperation() {
      folder = await directory();
      return (await readdir(folder)).length > 0; // Unknown/residual receipt also blocks, not only CLAIM.
    },
    async journal(record: Receipt) {
      folder ??= await directory();
      if (!claimed) {
        await writeExclusive(path.join(folder, 'CLAIM'), JSON.stringify({ schema: 1, id: record.id }));
        claimed = true;
      }
      const body = JSON.stringify(record);
      if (body.length > 128 * 1024) throw new Error('Receipt too large');
      await writeExclusive(path.join(folder, `${String(sequence++).padStart(3, '0')}-${record.stage}-${record.state}.json`),
        JSON.stringify({ body: record, sha256: digest(body) }));
    },
    async exportOwned(id: string, bytes: Uint8Array, sha: string) {
      if (!/^[0-9a-f-]{36}$/.test(id) || bytes.length > CAP || digest(bytes) !== sha) throw new Error('Invalid export');
      const root = await ownedRoot(tempGetter()); const file = path.join(root, `aopx-t1-${id}.wav`);
      await writeExclusive(file, bytes); return file;
    },
    async verifyOwned(file: string, sha: string) {
      const root = await ownedRoot(tempGetter());
      if (digest(await readOwned(root, file)) !== sha) throw new Error('Export hash changed');
    },
  };
}

export async function inspectReceipt(file: string): Promise<'reconcile-only'> {
  // Offline utility only, called with an owner-selected extension receipt in tests/tools.
  const st = await lstat(file); if (!st.isFile() || st.isSymbolicLink() || st.size > 128 * 1024) throw new Error('Bad receipt');
  const x = JSON.parse(await readFile(file, 'utf8'));
  if (!x || x.sha256 !== digest(JSON.stringify(x.body))) throw new Error('Receipt checksum');
  return 'reconcile-only'; // Never replay or resolve serialized Live handles.
}
