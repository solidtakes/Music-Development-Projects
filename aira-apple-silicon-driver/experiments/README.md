# DEMORA isolated offline artifacts — 2026-11-08

**Branch:** `chatgpt/demora-offline-artifacts-2026-11-08`. Experimental work only; never merge automatically. The stable driver and M9P PR #2 are unchanged.

## Files actually committed here
- `f2/demora_normal_completion_reuse_probe.cpp` — host-only reproduction of immediate slot reuse after a normal completion callback with `ReclaimPolicy::Pin`. The file is 953 bytes in the conversation artifact, SHA-256 `23fd73bde061fe2bfd5676f54aee5ead5642f9c2dc9e7341b7b0db02ae5f77a4`. It **requires the separate v3.1 source** at `core/v3/diag_engine.hpp` to compile; that source is **not** committed in this branch. Run from a workspace containing `core/v3`: `g++ -std=c++17 -Wall -Wextra -Werror -pthread -I. aira-apple-silicon-driver/experiments/f2/demora_normal_completion_reuse_probe.cpp -o /tmp/demora_f2 && /tmp/demora_f2`.

## Verified conversation artifacts NOT yet committed
GitHub's connected text-file writer cannot directly upload binary ZIP archives. Do not mistake these hashes for repository-hosted files:
- `DEMORA_Offline_v3_core.zip`: SHA-256 `4a8a59f26375fa25d3c56f8e46e71ffaf363d7bb34a678397c64a92632b135e1`.
- `DEMORA_Offline_v3.1_pin_scratch.zip`: SHA-256 `c2a6f4f3aa8eb76fa0a5bbd3fc4c9da1d3d02739a99448650a3d3c8660429091`.
- `DEMORA_v3_to_v3.1_pin.patch`: SHA-256 `4101df6ae8d286ebd77502b92c7c72db866d9492030b53ef338620c8405983f9`.
- `DEMORA_NATIVE_PIN_GUARD_OFFLINE_PROBE.zip`: SHA-256 `735622839940ab1a8aa6d12276543f562ed36ed242f86ccf317994670d6d361e`.
- `DEMORA_NATIVE_PIN_GUARD_OFFLINE_REVIEW.md`: SHA-256 `551e2b1e5f8517bb56579032422d4b358b63dcdce1bb1ec5d100b558e4b657a4`.
- `DEMORA_NATIVE_PIN_BYPASS_AUDIT_2026-11-08.md`: SHA-256 `6856792680db71b9a9cf4ccd8daa03ca6e47510df88d04e712f2d3ee10a15578`.
- `DEMORA_F2_NORMAL_COMPLETION_REUSE_REVIEW.md`: SHA-256 `29b33f15c63f56131a04b6476d812d1103cac75e6df65f18a1ff56ea0b044c58`.

## Provenance and limits
Claude 3 reported v3.1 56 C++ tests/298 checks, 61 Python tests, and 42/42 non-equivalent mutants. ChatGPT independently reported `make check`, 56/298/0, 61 Python tests and ASan/UBSan C++ pass; do not relabel the Claude TSan/mutation results as independently rerun. F-2 probe demonstrates *model behavior*, not Apple DriverKit descriptor ownership. USBDriverKit abort, completion, and DMA quiescence remain unverified.

**Coordination:** PR #2 G/H/I assignments are in https://github.com/solidtakes/Music-Development-Projects/pull/2#issuecomment-6717868274. Do not duplicate or overwrite them. Native integration requires a mandatory Pin policy and proof of normal-completion ownership return; no native build or hardware test is authorized.
