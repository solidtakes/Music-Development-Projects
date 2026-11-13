# Codex Standing Authorization — MF Sequencer Beta 2.3 Investigation
Owner authorization: 2026-11-13
Status: AUTHORIZED for investigation, debugging, optimization, tests and experimental builds only.

## Scope and autonomy
Codex may proceed without requesting approval at each routine step to:
- Inspect the verified frozen Beta 2.3 Test 18 source and ZIP, check hashes and compare relevant prior working builds.
- Investigate, reproduce, debug and fix regressions, prioritizing dynamic Ableton Scale Awareness ON/OFF, root and scale type changes.
- Profile and optimize playhead/Follow animation, MIDI LED traffic, redundant note reads and event handling, while preserving behavior.
- Run automated tests, add regression tests, iterate on failures, and prepare isolated experimental ZIPs/branches with diffs, changelogs and rollback instructions.
- Research and propose sequencer-owned swing, note nudging, CC automation/modulation, note property resets and non-destructive ties with automatic restoration. Do not treat design-roadmap items as approval to change mappings or ship features.
- Continue through routine internal investigation/test iterations without waiting for owner replies.

## Guardrails
- Frozen accepted Beta 2.3 Test 18 is immutable; preserve its exact ZIP/source/hash as rollback.
- Work only on isolated experimental branches/artifacts. Do not auto-merge, force push, overwrite accepted versions, change releases, or deploy into the user's Ableton setup.
- Do not alter approved gestures, CC assignments, bank routing, LEDs/colors or other frozen functionality without owner review.
- Flag CROSS-BANK REVIEW REQUIRED before anything affecting other banks, shared rules or combined build.
- No destructive modifications or irreversible cleanup. Avoid altering the user's clips/project data.
- Do not claim hardware validation from simulation; user must test in Live/MFT.
- Stop and report blockers when verified source/API/access is missing, and do not fabricate test outcomes.

## Priority and workflow
1. Read latest branch commits and all handoffs/addendums, including dynamic Scale Awareness regression and listener requirements.
2. Verify source; establish tests and baseline measurements.
3. Implement isolated Scale Awareness regression fix where supported by verified Live APIs; test ON/OFF, root/type changes, selection changes and listener lifecycle.
4. Optimize playback and LED updates, with before/after metrics and behavior regression tests.
5. Investigate swing, nudge, CC/modulation and future reset/tie features, proposing designs and controller gestures for owner approval.
6. Publish concise status, tested experimental ZIPs, evidence, open blockers and next steps to GitHub. No automatic merge or stable promotion.

## Authorization interpretation
Owner authorizes routine engineering execution and experimental artifacts, not release/merge decisions, destructive actions or control-map changes. Continue within these limits unless blocked.
