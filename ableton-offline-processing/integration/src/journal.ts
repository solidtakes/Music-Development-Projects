/**
 * Durable intent/ack journal for host effects (review H2; the #78 receipt pattern).
 *
 * Before importIntoProject or createAudioClip is requested, an intent record is written and synced.
 * After the host answers, the ack is written. A record is closed only when every effect it
 * describes is known. Any record that is not closed (an intent without an ack, a crash, an
 * unreadable file) blocks every later invocation with 'reconciliation-required' until someone has
 * checked the Set and called acknowledgeReconciliation. Nothing is ever retried or undone.
 */
import { mkdir, open, readdir, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

export type JournalState = 'import-intent' | 'import-acked' | 'create-intent' | 'create-acked' | 'closed';

export interface JournalRecord {
  schema: 1;
  invocation: string;
  state: JournalState;
  updatedAt: string;
  exportSha256?: string;
  importedPath?: string;
  clipId?: string;
  selection?: { clipId: string; trackId: string; resultTrackId: string; startBeat: number; endBeat: number };
  /** Set when closed: how the invocation ended. */
  outcome?: string;
}

export function journalDir(storageDirectory: string): string {
  return join(storageDirectory, 'aopx-journal');
}

async function syncDir(dir: string): Promise<void> {
  // Directory fsync makes the rename durable on POSIX; Windows does not allow opening a directory.
  try {
    const fh = await open(dir, 'r');
    try {
      await fh.sync();
    } finally {
      await fh.close();
    }
  } catch {
    /* best effort */
  }
}

/** Write a record durably: exclusive temp file, fsync, rename over the previous version, sync dir. */
export async function writeRecord(storageDirectory: string, record: JournalRecord): Promise<void> {
  const dir = journalDir(storageDirectory);
  await mkdir(dir, { recursive: true });
  const final = join(dir, `${record.invocation}.json`);
  const tmp = join(dir, `${record.invocation}.${record.state}.${process.pid}.tmp`);
  const fh = await open(tmp, 'wx');
  try {
    await fh.writeFile(JSON.stringify({ ...record, updatedAt: new Date().toISOString() }));
    await fh.sync();
  } finally {
    await fh.close();
  }
  await rename(tmp, final);
  await syncDir(dir);
}

/** Invocation IDs whose effects are not all known. Unreadable or unparsable entries count (fail closed). */
export async function pendingReconciliation(storageDirectory: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(journalDir(storageDirectory));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  const pending: string[] = [];
  for (const name of names.sort()) {
    if (name.endsWith('.tmp')) {
      pending.push(name.split('.')[0]!); // an interrupted write: the effect may have been requested
      continue;
    }
    if (!name.endsWith('.json')) continue;
    try {
      const rec = JSON.parse(await readFile(join(journalDir(storageDirectory), name), 'utf8')) as JournalRecord;
      if (rec.schema !== 1 || rec.state !== 'closed') pending.push(name.slice(0, -'.json'.length));
    } catch {
      pending.push(name.slice(0, -'.json'.length));
    }
  }
  return [...new Set(pending)];
}

/**
 * Called by the adapter only after the user has confirmed they checked the Set. It closes the
 * record and removes interrupted temp files for that invocation. It never touches Live.
 */
export async function acknowledgeReconciliation(storageDirectory: string, invocation: string, note = 'reconciled-by-user'): Promise<void> {
  const dir = journalDir(storageDirectory);
  let rec: Partial<JournalRecord> = {};
  try {
    rec = JSON.parse(await readFile(join(dir, `${invocation}.json`), 'utf8'));
  } catch {
    /* unreadable or only a temp file existed: write a fresh closed record */
  }
  await writeRecord(storageDirectory, { ...rec, schema: 1, invocation, state: 'closed', outcome: note, updatedAt: '' });
  for (const name of await readdir(dir)) {
    if (name.startsWith(`${invocation}.`) && name.endsWith('.tmp')) await rm(join(dir, name), { force: true });
  }
}
