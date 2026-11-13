# Codex Handoff — MF Sequencer Beta 2.3 Performance and Future Features
Date: 2026-11-13
Owner-approved assignment: investigation and isolated fixes; NO merge or change to accepted freeze.
Frozen milestone: mf-seq/beta2.3-freeze-20261113, commit 33cb440328c6226bf26c09fc60eac33f0530c7d3.
Frozen manifest: MF_SEQ_STANDALONE_REVIEW/BETA_2_3_TEST18_ACCEPTED_FREEZE_2026-11-13.md
Accepted ZIP: MF_SEQ_BETA_V2_2_TEST18_BAR_SELECT_FOLLOW_TEST.zip (also shared as MF_SEQ_BETA_2_3_FROZEN_TEST18.zip).
Important: GitHub freeze branch currently contains MANIFEST ONLY, not executable source. Do not reconstruct source from prose. Request/locate the exact ZIP from owner or local workspace and verify against manifest before touching code.

## Phase 0 — Provenance and access
- Check the GitHub shared rulebook, all-thread handoff and bank-specific freeze; inspect current branches and owner-approved baseline. Do not overwrite any existing working artifact.
- Locate the exact Beta 2.3 Test 18 ZIP and compare its SHA256 to the manifest. Verify Python syntax, ZIP integrity, package layout, Live version compatibility and the active Bank 3 standalone CC mapping.
- If source is missing or hash differs, STOP and report blocker; do not synthesize an alternative baseline.

## Phase 1 — Read-only audit and profiling
- Trace update_display, clip.playing_position, LED send/cache paths, note reads, clip listeners, _dirty flags, page selection, Follow Playback, start/stop, loop wrapping, and clip replacement.
- Quantify per-second counts: Live API reads, note-vector reads, MIDI sends (total and duplicates), full redraws, missed playhead positions, refresh latency. Test 90/120/160/200 BPM and 1/2/4-bar loops. Report observed vs expected, including limitations of display polling.
- Identify redundant work: full note read/redraw on playhead change, repeated identical LED messages, unbounded refresh after Follow page switch, duplicate listeners and expensive clip polling.
- Check chord press-order correctness: E13-first + E1–E4 direct bar selection; E16-first + E1 toggles Follow; E1-first + E13/E14/E15/E16 frozen controls. Check release handling and accidental note/tie edits.
- Distinguish measured findings from hypotheses. Do not claim zero latency or sample-accurate visual tracking.

## Phase 2 — Isolated performance prototype
- Only after Phase 1 evidence, branch from exact frozen source and add minimal change-only LED update path, page-boundary-only follow changes, cache invalidation on reconnect/clip/page/transport changes, and dirty-note refresh separation.
- Preserve current blue playhead color, step ring semantics, accepted note colors and all frozen gesture definitions.
- No additional timer/thread; use Ableton scheduler/update_display safely. Avoid floods of MIDI and excessive Live API reads.
- Unit/integration fixtures for 1/2/4 bar loops, nonzero loop start, stop/restart, clip change, fast tempo, held modifiers, page changes. Report before/after metrics and CPU/MIDI cost.
- Deliver separate experimental ZIP and source diff; owner tests on hardware. Do not label stable until accepted.

## Phase 3 — Research/prototype only: automation and modulation
- Inspect Live 12 MIDI clip envelope APIs and CC Control device parameter accessibility. Prior CC1 attempt failed and CC1 is intentionally quarantined from parameter cycle.
- Compare (A) native Live clip envelope targeting CC Control parameter with (B) a separate Max for Live CC/modulation device. Verify actual target mapping, save/reload persistence, editing, clip switching, MIDI routing, transport sync, smoothing and parameter ownership.
- Prototype only one CC lane (e.g. CC1) on disposable clip with four breakpoints; document failure modes and alternatives. Do NOT modify frozen production sequencer for speculative API support.
- Identify reusable existing Live modulation components before designing redundant LFO/smoothing functionality.

## Phase 4 — Research/prototype only: note nudge
- Specify discrete timing increments, gesture conflict audit, step and bar boundary policy, loop-start behavior, tied notes, monophonic collision and undo semantics.
- Preserve pitch, velocity, length, probability and content. Test nudging earlier/later, negative bounds, overlapping notes, cross-bar movement and clip persistence.
- Recommend a gesture only after mapping conflicts checked; no frozen remaps without owner approval.

## Reporting and guardrails
- Deliver: baseline verification table; source audit findings; ranked optimizations with evidence; proposed patch/diff; test plan and benchmark results; CC/modulation feasibility matrix; nudge behavior/gesture proposal; exact Git commit(s) and rollback.
- Keep Bank 3 standalone sequencer distinct from combined project's Bank 3 Session View. CROSS-BANK REVIEW REQUIRED for shared MIDI mapping, Native Mode, LED protocol or bank integration.
- Do not modify frozen Beta 2.3 manifest or merge automatically. No hardware validation claims without owner testing.
- Use GitHub handoff branch and link findings for Experimental Integration; avoid unauthorized changes to other banks.
