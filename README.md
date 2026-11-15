# Music Development Projects

Shared GitHub workspace for ChatGPT, Codex Web, and Codex Desktop.

## Unified MIDI Fighter Twister development

The two historical MIDI Fighter Twister Python project records remain separate for compatibility, while their work is coordinated in the [MIDI Fighter Twister Master Development](midi-fighter-twister/README.md) index: **Bank 1**, **Bank 2**, **Bank 3**, **Bank 4**, and a fifth **Experimental Lab** for shared LED, animation, meter and device prototypes. Each Bank retains its own tested versions and rollback paths; experiments are never automatically merged into working scripts.

## Four separate projects

1. [MIDI Fighter Twister — Main Python Script](mft-main-python/PROJECT_STATUS.md)
2. [MIDI Fighter Twister — Alternate MF Build 2 Python Script](mft-alternate-python/PROJECT_STATUS.md)
3. [Roland AIRA Modular — Apple Silicon macOS Driver](aira-apple-silicon-driver/PROJECT_STATUS.md)
4. [Matrix MIDI Router — Max for Live](matrix-midi-router/PROJECT_STATUS.md)

These are distinct projects. Do not merge the two Python scripts or mix their version numbers.

## Five separate projects

5. [Ableton Offline Processing Extension](ABLETON_OFFLINE_PROCESSING/README.md) — Alpha 0.1 proof of editable offline processing history, incremental rendering, cache diagnostics, and Ableton Live handoff. Development is isolated on `ableton-offline-processing/alpha-0.1-foundation`; no automatic merge.

## Sync workflow

- At the start of each session, pull/fetch current GitHub files and read the project's PROJECT_STATUS.md.
- Before changing code, check for uncommitted local work and avoid overwriting it.
- Make changes on a branch where appropriate, test, then commit and push. Record commit SHA, version, tests, and next steps in PROJECT_STATUS.md.
- Other sessions should pull latest changes before continuing. Chat histories and uncommitted local changes do **not** automatically sync.
- Never commit secrets, private data, NDA-covered software, large USB packet captures, binary drivers, or backups.
- The status notes are coordination summaries, not proof that project source files have been uploaded.
