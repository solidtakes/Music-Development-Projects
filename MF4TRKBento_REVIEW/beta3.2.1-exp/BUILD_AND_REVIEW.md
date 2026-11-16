# MF4TRKBento Beta 3.2.1 EXP — Four-bank Device Control cap

Current owner-designated stable rollback: **Beta 3.1 repair** (ZIP SHA-256 `33ec4287aca915bf4c27518548d8c3f1359a48d6f3ff2f6ed88242a7e94d6d8a`). Experimental Beta 3.2 ZIP is also preserved on PR #47 with SHA-256 `1faec1eba2d485ccd6fe38d643ed784befcdd6e42844dfe3275c436612628b0d`.

## Owner request
E2 on primary Device Control row **must cycle at most four banks** (Bank 1, 2, 3, 4, then back to Bank 1) even if the selected plug-in exposes enough parameters for Bank 9. Preserve four-parameter stride. If only one or two banks are available, wrap at that count. This is not a change to the number of Device Control rows (still 0–4 physical rows), the yellow/blue LED architecture, or parameter ordering.

## Changes
- Add `MAX_DEVICE_BANKS = 4`; apply to E2 bank advance and the scan-time bank clamp.
- Add three mock regressions: long device > 16 params cycles modulo 4; short device wraps at its available bank count; all four Device rows continue to use successive parameter groups after banking.
- All Beta 3.2 Send A-over-B, fallback for one send, no-audio MIDI rings and device 0–4 stack functionality preserved.
- No changes to CC assignments, Native Mode, Utility, Live installations, other banks or accepted archive.

## Known ongoing investigations
1. Owner reports E3/E4 previous/next device doesn't switch on real Ableton hardware; **not fixed in this bank-cap-only patch**.
2. Owner reports no animated white Volume VU on audio tracks (only static volume position); **not fixed in this patch**.

Mock tests/CI do not establish Live or hardware behavior. Do not merge automatically or mark 3.2.1 stable.
