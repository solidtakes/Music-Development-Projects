# MF Twister Module State Manager — research and architecture

Status: **persistent core implemented; Live surface integration remains a separate, runtime-verified step.**

## Verified API research

1. Ableton's official Remote Script guidance confirms that custom control surfaces are Python scripts loaded by Live, and that Live 11+ uses Python 3. It documents installation and MIDI configuration, not a built-in durable Control Surface key/value persistence contract. [Ableton: Installing third-party remote scripts](https://help.ableton.com/hc/en-us/articles/209072009-Installing-third-party-Remote-Scripts).
2. Ableton's official custom Control Surface article documents the User Remote Scripts folder and basic configuration, but does not document a Set-scoped storage API. [Ableton: Creating your own Control Surface script](https://help.ableton.com/hc/en-us/articles/206240184-Creating-your-own-Control-Surface-script).
3. The Live Object Model documents `Song.file_path` as a read-only path to the current Set, empty when the Set has not been saved. [Cycling '74 Song LOM reference](https://docs.cycling74.com/apiref/lom/song/).
4. There are community reports that `Song.file_path` is not exposed as a Python attribute in some Remote Script/Max contexts. That is why `set_key_from_song()` probes the attribute defensively and returns `None` on absence or runtime error; it never substitutes a Set title, track names, or object address. [Ableton forum discussion](https://forum.ableton.com/viewtopic.php?t=249763).
5. Community LiveAPI research describes `c_instance` as an opaque bridge and relies on runtime introspection/decompiled shipped scripts. It is useful for investigation, not an Ableton support guarantee. [LiveAPI Remote Scripts reference](https://photonicvelocity.github.io/LiveAPI/remote-scripts/).
6. No evidence found in official Remote Script guidance establishes a built-in `get_data/set_data` persistence contract. The manager therefore owns its storage adapter and does not call undocumented host persistence methods.

## Implemented components

- `module_state.py`: stable module registry, strict assignment-only schema, schema v0-to-v1 migration, validation, missing-module resolution, last-layout and named-preset API.
- `json_file_storage.py`: standard-library JSON file adapter; per-user AppData location on Windows; hashed namespace filenames; atomic same-directory replacement; last-known-good `.bak` recovery; corrupt primary plus missing/corrupt backup fails closed; list/load/save/delete for global and Set-scoped presets.
- `live_set_identity.py`: guarded `Song.file_path` resolver. Saved path becomes a SHA-256 path key. Unsaved Sets or unsupported Python exposure return `None` and remain session-only. Save As/move changes the key by design.
- `layout_controller.py`: host-supplied callbacks for startup restore, assignment-change persistence, named preset load/save/delete, and safe defaults for missing modules. A supplied scheduler defers and coalesces last-layout disk writes so MIDI callbacks need not perform I/O.
- Tests cover the pure core, file storage, identity rules, corruption recovery, missing modules, preset namespaces, schema migration, startup defaults, and deferred writes.

## Storage policy

Windows global storage root: `%APPDATA%\\MF_Twister\\ModuleStateManager` (fallback `%LOCALAPPDATA%` only if APPDATA is unavailable). The path is user-scoped, not inside a Remote Script install directory, so script upgrades do not erase presets.

Global presets are keyed by surface ID and preset name. Set presets are keyed by the hash of the canonical saved-set path, surface ID, and preset name. Raw names and Set paths are not used as filesystem paths. An unsaved Set has no Set-scoped key.

The file adapter validates every document and rejects unknown fields. It only accepts module assignment IDs; it has no API for volume, pan, sends, device parameters, MIDI routing, LED state, or encoder values.

## Set identity limitations

The key is **path-scoped**, not a permanent document UUID. Save As, Save a Copy, or moving a project creates a new key; presets do not silently follow the file. Duplicate Set names at different paths remain separate. Unsaved Sets remain session-only. The target Live 12.5 and Live 13 Remote Script runtimes still need a direct probe to establish whether `song.file_path` is exposed consistently.

## Startup, event ordering, and integration

Each surface must register its stable module catalog and establish defaults before calling `LayoutStateController.restore_startup()`. Apply the returned layout in one controlled surface operation, then refresh LEDs once. On every module-assignment change, call `on_layout_changed()`; in Live, pass a scheduler callback such as `lambda callback: surface.schedule_message(1, callback)` so disk writes are deferred and coalesced. Do not save on rotary parameter turns.

The current prototype is not yet wired into either Bento. The next integration task must:
1. copy/import the shared manager as a versioned package without circular imports;
2. register stable IDs for the surface's module catalog;
3. connect its module-assignment getter/setter;
4. schedule startup restore after module initialization;
5. schedule persistence after assignment changes only;
6. provide an intentional user interaction for listing/loading/saving/deleting presets;
7. verify Live 12.5 and Live 13 path exposure, AppData permissions, disconnect behavior, and startup timing.

## Go / no-go

**GO** for the persistent standard-library storage core and pure callback controller. It is implemented and testable outside Live.

**CONDITIONAL GO** for Set-scoped presets: only when the target Live runtime exposes a valid absolute `Song.file_path`. Otherwise Set-specific saving is disabled for that session; global presets and last-layout restoration remain available.

**NO-GO** for automatic installation or production Bento integration until offline CI is green and the integration branch passes independent code review plus owner hardware testing. PR #35, PR #27, and all accepted rollback builds remain untouched.
