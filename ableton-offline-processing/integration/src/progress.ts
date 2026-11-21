/**
 * Forwards engine progress (fractions 0..1) to beta.1's `ProgressDialog.update(text, progress)`,
 * whose progress is 0..100. Updates are monotonic, clamped, throttled, sent one at a time (each
 * awaited), and the latest pending value wins. A failing update never fails the render.
 */
export function toSdkPercent(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  const f = Math.min(1, Math.max(0, fraction));
  return Math.round(f * 1000) / 10;
}

/** Overall progress bands for the flow's stages, as fractions of the whole operation. */
export const STAGE_BANDS = {
  render: [0, 0.1],
  engine: [0.1, 0.85],
  export: [0.85, 0.9],
  import: [0.9, 0.95],
  create: [0.95, 1],
} as const satisfies Record<string, readonly [number, number]>;

export function inBand(band: readonly [number, number], fraction: number): number {
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  return band[0] + (band[1] - band[0]) * f;
}

export class ProgressForwarder {
  private lastPercent = -1;
  private lastText = '';
  private lastSentAt = -Infinity;
  private pending: { text: string; percent: number } | null = null;
  private inflight: Promise<void> | null = null;
  /** First error thrown by the host's update, if any (reported, never rethrown). */
  error: unknown = null;

  private readonly send: (text: string, percent: number) => Promise<void>;
  private readonly opts: { minIntervalMs?: number; now?: () => number };

  constructor(send: (text: string, percent: number) => Promise<void>, opts: { minIntervalMs?: number; now?: () => number } = {}) {
    this.send = send;
    this.opts = opts;
  }

  private now(): number {
    return this.opts.now ? this.opts.now() : performance.now();
  }

  /** True once a drain timed out: the host's update is hung, so no further updates are sent. */
  detached = false;

  /** Queue an update; returns immediately. Never moves backwards. */
  update(text: string, fraction: number): void {
    if (this.detached) return;
    const percent = Math.max(this.lastPercent, toSdkPercent(fraction), this.pending?.percent ?? -1);
    if (percent === this.lastPercent && text === this.lastText && !this.pending) return;
    this.pending = { text, percent };
    if (this.inflight) return;
    if (percent < 100 && this.now() - this.lastSentAt < (this.opts.minIntervalMs ?? 100)) return;
    this.inflight = this.pump();
  }

  private async pump(): Promise<void> {
    while (this.pending) {
      const next = this.pending;
      this.pending = null;
      this.lastPercent = next.percent;
      this.lastText = next.text;
      this.lastSentAt = this.now();
      try {
        await this.send(next.text, next.percent);
      } catch (e) {
        this.error ??= e;
      }
    }
    this.inflight = null;
  }

  /** Send anything still pending and wait for it. */
  async flush(): Promise<void> {
    if (this.inflight) await this.inflight;
    if (this.pending) {
      this.inflight = this.pump();
      await this.inflight;
    }
  }

  /**
   * Like flush, but never waits longer than `timeoutMs`. If the host's update does not settle in
   * time, the forwarder detaches (stops sending) so a hung progress dialog can never delay the
   * outcome or reconciliation report (review M1). Returns false if it detached.
   */
  async drain(timeoutMs: number): Promise<boolean> {
    if (this.detached) return false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settled = await Promise.race([
      this.flush().then(() => true),
      new Promise<boolean>((r) => {
        timer = setTimeout(() => r(false), timeoutMs);
      }),
    ]);
    clearTimeout(timer);
    if (!settled) {
      this.detached = true;
      this.pending = null;
    }
    return settled;
  }

  /** Last percent actually sent to the host. */
  get sentPercent(): number {
    return this.lastPercent;
  }
}
