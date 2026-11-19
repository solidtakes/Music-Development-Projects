# MF Sequencer v1.1 research — PASS / BLOCKERS

Build assessed: **Live 13.0b24, Windows**. Runtime capture: 2026-11-18;
source/lifecycle follow-up review: 2026-11-19.
Evidence-bearing runtime commit: `2bea6fc118a75bed4ea461d07346e589a1326e2d`.

| Deliverable / gate | Verdict | Evidence and limit |
|---|---|---|
| R1 API inventory | **PASS — investigation complete** | `R1_REPORT.md` separates real reads/listener registration, Push static bindings, inference and blocked writes. All ten requested controls are listed. |
| Native clip identification | **PASS — read-only runtime** | Actual selected clip: `is_midi_clip=True`, `midi_clip_type=1`; type listener attaches. Ordinary-clip control sample and conversion callback remain untested. |
| Selected lane / native steps / row controls | **BLOCKERS for integration** | Public `clip.step_sequencer` is absent in b24; tested selection getters are absent. Push-only bindings do not satisfy the public API gate. |
| R2 isolated read-only diagnostic | **PASS — tested scope** | Probe ran with no MIDI ports, three snapshots, safe unsupported getters, selection callbacks and disconnect. 42 extracted runtime records. Known duplicate-proxy registration rejections and lifecycle limits are disclosed. |
| Diagnostic listener lifecycle | **PASS — bounded/offline checks**, live stress pending | Mock subscription ownership, duplicate rejection, burst coalescing and inert late callbacks pass. Runtime disconnect reports zero tracked registrations; independent host-registry and Set-reload stress tests are not claimed. |
| R3 source review / architecture proposal | **PASS — proposal** | Exact accepted source blobs reviewed; E1/E4 tie and probability-release collisions demonstrated with source dispatch spies. Ownership/state/chord/manual-override design documented. No router or engine is implemented. |
| Native editing engine | **BLOCKERS — do not implement/activate yet** | Need supported reachable row/step objects, selected-lane observation, validated units/ranges, authorized disposable-clip write/readback and feedback/lifecycle tests in a named build. No writes were attempted. |
| Cross-bank integration | **BLOCKERS — review required** | Shared MIDI/output/scheduler changes require CROSS-BANK REVIEW. Three-bank baseline is untouched. |
| Mode-chord specification | **PASS — resolved by Issue #72** | The owner now explicitly selects hold E1 + tap E16, preserving reverse-order Follow, E1 + rotate E16 navigation, and E13 + E4 bar 4. The older E1/E4 source audit is historical. No gesture is implemented or activated. |
| Publication | **PASS — isolated research branch** | `mf-seq/v1.1-native-research-20261118`; no automatic merge or Stable update. |

**Overall:** research and the read-only diagnostic PASS within their documented
scope. Native Alternate editing and shared-controller integration remain BLOCKED.
The public documentation gap alone was not the blocker: actual b24 getters were
tested and failed. This result does not generalize to untested interfaces or betas.

All 12 offline checks pass. Six audit the exact accepted input-dispatch method,
three cover diagnostic callback ownership, and three cover snapshot safety.
See `evidence/followup_verification.json` for hashes, scope and test names.
Mocks establish neither native API availability nor hardware timing.

The existing installed diagnostic remains disconnected, with Control Surface
slot 4 restored to None. Stable files, clip content, firmware, MIDI mappings and
the three-bank baseline were not changed. No Native Mode was activated.
