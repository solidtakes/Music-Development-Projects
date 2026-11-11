# MIDI Fighter Twister — Unified Development Index

This is the coordination home for **four hardware banks and one shared Experimental Lab**. Each bank has its own script/build status and must retain its own versioning and rollback baseline.

| Area | Status document | Purpose |
| --- | --- | --- |
| Bank 1 | [Bank 1](bank-1/PROJECT_STATUS.md) | Main Mixer / Macros / Device controls |
| Bank 2 | [Bank 2](bank-2/PROJECT_STATUS.md) | Selected Channel and 4-Track Mixer |
| Bank 3 | [Bank 3](bank-3/PROJECT_STATUS.md) | MF Clips n Scenes, including three launcher pages |
| Bank 4 | [Bank 4](bank-4/PROJECT_STATUS.md) | Mono Melodic Sequencer |
| Experimental | [Shared Lab](experimental/PROJECT_STATUS.md) | LED calibration, prototype circuits/controls, cross-bank feature research |

## Governance
- Do not merge distinct Ableton Remote Scripts or overwrite a known-good build.
- Keep Bank 1's historical `mft-main-python/` project and Bank 2–4's historical `mft-alternate-python/` references intact until the exact source ownership is verified.
- The five areas are **logical development tracks**. They are not proof that all scripts have been committed or installed.
- Shared changes start as isolated experiments. Record MIDI input/output channel, CC mapping, Twister Utility configuration, color-map mode, Ableton version, hardware observations, and regression tests.
- Promote experimental changes only after explicit bank-by-bank compatibility review. Never propagate a shared patch automatically to all banks.
- No automatic merges, overwrites, or silent code migrations.
- All build handoffs should include version, tested/unverified features, archive/commit SHA, rollback and outstanding issues.
- Use one ChatGPT conversation per Bank plus one Experimental conversation. GitHub cannot itself create/move ChatGPT threads.

## Start here for cross-thread recovery
- [Cross-thread Ableton/Python handoff](CROSS_THREAD_PYTHON_ABLETON_HANDOFF_2026-11-11.md): consolidated Main/Alternate, MF, MIDI Remote Script, LED Diagnostics, bank mappings, confirmed tests, unresolved source gaps and recovery rules. Read before changing any build.
- [Historical chronology](CONSOLIDATED_CHRONOLOGY_2026-11-11.md) and [build register](experimental/SIGNED_OFF_BUILD_REGISTER.md) provide inventory and approval provenance.
