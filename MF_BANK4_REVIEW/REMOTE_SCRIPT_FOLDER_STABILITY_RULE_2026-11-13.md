# Owner directive — Stable Ableton Remote Script folder names (2026-11-13)

**MANDATORY FOR ALL MF BUILD 2 BANKS, INTEGRATION, AND CODEX HANDOFFS**

Ableton's Control Surface menu must not accumulate new entries with every test candidate. **Do not rename the internal Remote Script folder when creating a new ZIP or fixing code.** Preserve the existing exact folder name and the same bank number. Keep the directory identity unchanged across patches, alphas, tests and experimental iterations.

- **ZIP filename may change** for build identification and archives; **the top-level installable Remote Script directory inside the ZIP must stay the same** as the currently owner-accepted install folder for that bank.
- **Only change the internal Remote Script folder name when the owner explicitly declares a milestone or the next beta version and authorizes the name change.** Do not infer permission from a patch version, alpha build, new GitHub commit, or candidate ZIP.
- **Owner-approved Bank 4 rename (2026-11-13):** the current and future MF Device Aware install folder is **`MF_Bank4_Selected_Device`** (no version suffix). **Freeze this exact folder name for every subsequent build until the owner explicitly instructs another change.** The historical v0.5.1 archive originally contained `MF_Bank4_Selected_Device_v051`; preserve that archived source for provenance, but future ZIP packages must contain `MF_Bank4_Selected_Device/` as their single install folder. New ZIPs can say MF_Device_Aware_Alpha_1, Alpha_1_test2, etc., while preserving this exact internal folder name.
- When shipping, check the ZIP member paths and explicitly verify there is exactly one expected install folder with `__init__.py` and all dependencies. Report that internal name and any compatibility/rollback instructions.
- Never install another versioned folder alongside the current script or create duplicate Control Surface menu entries. If prior redundant folders exist, advise owner on safe manual cleanup, without deleting active scripts or backups.
- Apply the same rule to Banks 1–3 and combined MF builds: preserve their **existing** internal folder names and bank identities. Do not impose Bank 4's folder name on other scripts.
- No automatic merges, shared MIDI changes or firmware/Native Mode changes. Flag CROSS-BANK REVIEW REQUIRED for shared packaging or routing changes.

**Acceptance gate:** Any future MF ZIP that changes its internal install directory without explicit owner milestone/beta approval is a packaging regression and must be corrected before hardware testing.
