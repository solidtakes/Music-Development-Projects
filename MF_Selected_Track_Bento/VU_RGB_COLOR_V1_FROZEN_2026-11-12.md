# FROZEN — Bento VU Module RGB Color Progression v1

Status: APPROVED / FROZEN by user on 2026-11-12.
Scope: **VU module only**, in both Track VU and Master VU modes. This does NOT authorize changing the separate Track Mixer module or separate Master module.

## Required progression (bottom to top)
1. Low-level signal fills all four encoder RGB VU positions **green**, progressing from bottom E4 upward through E3, E2, E1. All four become green **before any yellow/orange/red**.
2. Yellow stage: E1, E2, E3 yellow; E4 green.
3. Orange stage: E1, E2 orange; E3 yellow; E4 green.
4. Red peak: E1 red; E2 orange; E3 yellow; E4 green.

| Stage | E1 top | E2 | E3 | E4 bottom |
|---|---|---|---|---|
| Fully green | Green | Green | Green | Green |
| Yellow | Yellow | Yellow | Yellow | Green |
| Orange | Orange | Orange | Yellow | Green |
| Peak | Red | Orange | Yellow | Green |

## Change control
- User explicitly confirmed color design was done; **do not redesign, remap, or alter this progression without explicit approval**.
- **White LED meter behavior is a distinct specification, NOT settled by this document.** User rejected several attempted reconstructions. Do not infer white-ring thresholds, note-activity semantics, or encoder distribution from this RGB freeze.
- Numeric level thresholds and timing for RGB transitions are not established by this freeze; don't fabricate approval of exact numbers.
- Preserve existing Track Mixer v1 gesture freeze and other module freezes.
- Regression tests: all-green-before-yellow; only top 3 yellow; only top 2 orange; only top 1 red; bottom stays green at higher stages; Track and Master VU modes match.
