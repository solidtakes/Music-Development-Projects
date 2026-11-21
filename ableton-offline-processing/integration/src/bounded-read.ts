/**
 * Read a whole regular file through one descriptor, with a size cap and identity checks, so the
 * bytes returned are the bytes that were checked. Growth, truncation, replacement and symlink
 * swaps between lstat, open and read are detected. (O_NOFOLLOW is used where the platform has it;
 * the dev/ino comparison covers the rest.)
 */
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';

export type BoundedReadFailure = 'not-regular-file' | 'too-large' | 'changed';

export class BoundedReadError extends Error {
  readonly kind: BoundedReadFailure;
  constructor(kind: BoundedReadFailure, message: string) {
    super(message);
    this.name = 'BoundedReadError';
    this.kind = kind;
  }
}

export interface BoundedRead {
  bytes: Uint8Array;
  size: number;
}

export async function readFileBounded(path: string, maxBytes: number, opts: { prefixBytes?: number; onPrefix?: (prefix: Uint8Array, size: number) => void | Promise<void> } = {}): Promise<BoundedRead> {
  const before = await lstat(path);
  if (!before.isFile()) throw new BoundedReadError('not-regular-file', 'Not a regular file.');
  const fh = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const st = await fh.stat();
    if (!st.isFile()) throw new BoundedReadError('not-regular-file', 'Not a regular file.');
    if (st.dev !== before.dev || st.ino !== before.ino) throw new BoundedReadError('changed', 'The file was replaced while being opened.');
    if (st.size > maxBytes) throw new BoundedReadError('too-large', `The file is ${st.size} bytes; the limit is ${maxBytes}.`);
    const size = st.size;
    if (opts.onPrefix) {
      // Cheap checks (format, frame count, memory budget) run on a prefix before the full allocation.
      const n = Math.min(size, opts.prefixBytes ?? 65_536);
      const prefix = new Uint8Array(n);
      await readExactly(fh, prefix, 0);
      await opts.onPrefix(prefix, size);
    }
    const bytes = new Uint8Array(size);
    await readExactly(fh, bytes, 0);
    const extra = await fh.read(new Uint8Array(1), 0, 1, size);
    if (extra.bytesRead !== 0) throw new BoundedReadError('changed', 'The file grew while being read.');
    const after = await fh.stat();
    if (after.size !== size || after.mtimeMs !== st.mtimeMs) throw new BoundedReadError('changed', 'The file changed while being read.');
    return { bytes, size };
  } finally {
    await fh.close();
  }
}

async function readExactly(fh: import('node:fs/promises').FileHandle, into: Uint8Array, position: number): Promise<void> {
  let done = 0;
  while (done < into.byteLength) {
    const { bytesRead } = await fh.read(into, done, into.byteLength - done, position + done);
    if (bytesRead === 0) throw new BoundedReadError('changed', 'The file shrank while being read.');
    done += bytesRead;
  }
}
