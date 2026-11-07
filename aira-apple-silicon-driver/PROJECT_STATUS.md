# AIRA Modular project status

Updated November 7, 2026. Public-safe coordination snapshot; documentation only.

## Baseline and evidence

Target: native Apple Silicon macOS Core Audio/CoreMIDI for DEMORA, USB
0582:01AF, initially 96 kHz with ten inputs and ten outputs. No other firmware,
sample rate or physical output mapping is implied.

Source checkpoint: `c437e0977e0b9d13ce4dbba39e31fbbc1eba5ed8` in
[PR #1](https://github.com/solidtakes/Music-Development-Projects/pull/1).
PR #1 was left open and unmerged at publication; no current remote-state query
was made for this documentation task. M9P is a separate local branch based on
that commit, not a merge or update of the simulator branch.

| Milestone | Evidence and limitation |
|---|---|
| M9K | 38 CPU-only tests; frozen original count/scheduling model |
| M9N-B | 48 CPU-only tests, 30 design groups and nine mutation checks; separate cursor, stream-offset, shared-ledger, readiness/lease and recovery models |
| Long run | Historical million-request duplex model: 8 million transactions, 96 million frames, 55.8093 s wall / 54.8179 s CPU, peak two packs per direction; not a real-time or USB result |
| M8 Stage 2C | Existing generated bindings and service compile to arm64 objects against DriverKit 24.5, target 24.0; no final linked/signed/loadable driver |
| Separate native audio helpers | Existing compile evidence and inactive source describe 96-kHz ten-channel streams; Start/StartIO refuse operation; not M8 integration |
| Prior standalone transport research | Local status records bounded silent duplex transfers and input captures using a separate IOUSBHost probe; not DriverKit runtime qualification |

The standalone simulator tests are reproducible from each `simulators/m9k/` and
`simulators/m9n_b/` directory with `python3 -B -m unittest discover -v`.
The M9P offline rerun passed 38/38 and 48/48; no driver was built or executed.
Private evidence and proprietary material are deliberately absent from this repo.

## Current capability and blockers

The published code is CPU-only. It has no USB backend, audio payload generation,
HAL device, installer, driver activation or MIDI implementation. Simulator passes
do not prove DMA coherence, framework lifetime, FIFO stability or clock lock.

Ordered blockers: (1) authoritative descriptor packing/coherency and callback/drain
contracts; (2) exact dual-interface provider/ownership architecture and grants;
(3) safe native lifecycle/failure/disconnect implementation; (4) measured clock,
buffer geometry and startup lead; (5) signed host/extension activation and rollback;
(6) physical output mapping and later separately approved playback. M8's failed-init
destruction and lifecycle serialization remain unresolved framework questions.

## Next milestone

M9P prepares the architecture and gates in [NEXT_TASK.md](NEXT_TASK.md),
[M9P_NATIVE_INTEGRATION_DESIGN.md](M9P_NATIVE_INTEGRATION_DESIGN.md) and
[M9P_READINESS_AUDIT.md](M9P_READINESS_AUDIT.md). No native implementation,
publication, installation or runtime approval follows from these documents.
