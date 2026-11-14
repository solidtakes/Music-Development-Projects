# New implementation versus v0.4.1 diagnostic

v0.4.1 archive SHA-256: aa0d3cf8b702c568a9f1b12ad5f6363c25ffefd9510386975fccf0348002b4e9. Its 4684-byte MF_Bank_4_Test.py source hash: 962557197b0ea0c20543ba5d36051c45d81c87985df1c5eff6b09deb7efd0632. User-uploaded diagnostic remains unchanged. Its README install instructions were inspected as archive content, not executed.

| Area | Diagnostic v0.4.1 | New v0.5.1 |
|---|---|---|
| Purpose | Fixed RGB probe, no parameter controls | New selected-device controller prototype |
| Channels | RGB ch2 / rings ch1 | Required RGB ch11 / rings ch12, subject to physical verification |
| RGB | Forced red/yellow/blue/green groups | Approved device-status palettes / unsupported zero |
| Focus | GUI-selected device then appointed fallback; refresh palette suppressed by probe | GUI-selected device only; no fallback |
| Rotation | No parameter implementation | Sixteen explicit named slots, bounded relative steps |
| White rings | Zero-only | Normalized live values, external updates, inactive zero |
| Push | No controller gestures | Deliberately inert; none approved |
| Lifecycle | Track/device listeners, guarded log_message attempt | Owned dynamic listeners, polling fallback, caches, late-callback guard, no log_message dependency |
| Packaging | Diagnostic script folder | Separately named complete package, mapping assumptions, tests and rollback |

A channel edit to the diagnostic cannot supply absent parameter controls. SOURCE.patch therefore records new files rather than suggesting an applicable original-controller patch. All source files here were authored for the rebuild assignment; diagnostic facts informed requirements but its implementation was not treated as a recovered controller baseline. v0.4.2, historical traceback and accepted original Bank 4 mappings are not claimed recovered.
