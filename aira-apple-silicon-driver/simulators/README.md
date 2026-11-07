# AIRA Modular offline scheduling simulators

CPU-only mathematical/control-flow research models for the DEMORA 96-kHz,
ten-channel USB audio scheduling investigation. No USB/device/CoreAudio/DriverKit
backend, audio payloads, playback, installer, signing or activation is included.

- `m9k/`: preserved original simulator source and tests; its original local
  checkpoint passed 38 tests. The source is copied only after export approval.
- `m9n_b/`: staged submission and head/lease reconciliation, separate bus/stream/
  shared progress, explicit reference and conservative profiles, bounded recovery,
  deterministic tests and a CPU-only pipeline benchmark.

From either simulator directory, use Python 3.10+ and the standard-library test discovery command:

```sh
python3 -B -m unittest discover -v
```

For the new simulator's separate benchmark, from `m9n_b/`:

```sh
python3 -B -c 'from benchmark import benchmark; import json; print(json.dumps(benchmark(1000000), indent=2))'
```

The local evidence runners and preservation snapshots are deliberately omitted
from the proposed public source list. Those runners depend on private local manifests.
Standalone unittest discovery and the benchmark module do not need those files.

The new suite has 48 passing tests, all 30 accepted design case groups, and nine
mutation checks. The million-request full-duplex CPU model completed 8,000,000
transactions and 96,000,000 frames in 55.81 s wall / 54.82 s process CPU time on
the development host. These are CPU-model results, not physical device timing.
The last pending replacement pair was explicitly cancelled and drained.

Historical ABI, exact stream rebase and real framework coherence/cancellation
contracts remain unresolved. Reference early-readiness observations and effective
cancellation are scripted assumptions. Strict safety checks and generation isolation
are new model policies, not claims about the original Roland driver's implementation.

No proprietary binary, raw disassembly, USB capture, private review archive,
credentials or full local history accompanies this proposed source-only publication.
