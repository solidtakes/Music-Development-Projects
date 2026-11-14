# v0.5.1 — single targeted owner retest

Hardware validation of this version is pending. Keep the already isolated standalone test setup and all saved accepted sources/settings. Do not run v050 and v051 simultaneously, change Utility/firmware, activate Native Mode, or alter shared ownership. If switching candidates would require shared routing changes, stop for cross-bank review.

Select the separately named MF_Bank4_Selected_Device_v051 candidate in that isolated setup and restart Live. Select EQ Eight and confirm its expected blue palette. Then turn E1 one tick clockwise and one tick counterclockwise. Does EQ Eight's band 1 frequency increase then decrease, and does its white ring follow? Report that result and stop; do not test other controls or banks yet.

If startup fails, provide the exact message before further input. "Rebuild Candidate loaded" is a status message, not proof of hardware success. If rotation still fails, incoming byte values/delivery path will need observation before any mapping or scaling change. No widened MIDI interception or shared-bank change is authorized by this test.

Rollback: close Live, deselect/remove only the v051 test folder and restore the previous candidate in the same isolated setup if needed. Never overwrite Banks 1–3 or MF2Bank Beta 1. The old ZIP/source remain unchanged. The broader v0.5.0 hardware queue remains deferred until this targeted input retest passes and is reviewed.
