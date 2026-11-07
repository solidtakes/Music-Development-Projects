# Offline simulator validation summary

M9N-B: 48 CPU-only unit tests passed, zero failures/errors, covering 30 design case
groups with nine targeted mutation checks. Includes separate long tests of eight
million fallback substitutions and one million normal input arithmetic requests.

The full duplex pipeline benchmark processed 1,000,000 completed input requests,
8,000,000 transactions and 96,000,000 frames. Wall time: 55.8093 s; process CPU
time: 54.8179 s. Peak allocated packs: two per direction. One nominal seed pair
preceded measurement; the final accepted replacement pair was explicitly cancelled
and drained. Fallback phase remained zero. This is not a physical-time qualification.

M9K's original local checkpoint remains 38 passing tests, preserved unchanged and
not rerun as part of the new checkpoint. No native driver or hardware was used.

These results establish consistency with the explicit CPU model. They do not
establish hardware clock lock, FIFO stability, DMA visibility, lifecycle ordering,
installation readiness, physical routing or audio safety.
