# MF Twister Module State Manager

Reusable persistence for **module assignments only**. The package does not save encoder values, mixer values, device parameters, MIDI routing, LED states, or clip/scene state.

## Current status

- Pure state core: implemented.
- Global named presets: persistent JSON adapter implemented.
- Set-specific named presets: implemented when a saved Set path can be read.
- Last-layout startup restore: controller implemented.
- Missing module handling: safe default fallback plus missing-ID report; source preset remains unchanged.
- Corruption recovery: atomic writes and previous-valid-file backup.
- Live surface integration: not yet merged into either Bento. Runtime probe and surface-specific wiring are the next step.

## Minimal standalone use

```python
from MF_Twister_Module_State_Manager import (
    ModuleRegistry, ModuleStateManager, JSONFileStorage,
    LayoutStateController, set_key_from_song,
)

registry = ModuleRegistry()
registry.register("mixer.volume")
registry.register("mixer.pan")
registry.register("clip.launcher")

storage = JSONFileStorage.for_current_user()
manager = ModuleStateManager("mf4track", registry, storage)

# The host surface supplies these callbacks.
controller = LayoutStateController(
    manager=manager,
    read_layout=lambda: {"row1.col1": "clip.launcher", "row2.col1": "mixer.volume"},
    apply_layout=apply_layout_callback,
    default_layout=lambda: {"row1.col1": "mixer.volume"},
    schedule_save=lambda callback: surface.schedule_message(1, callback),
)

# Call after module registration/default initialization.
controller.restore_startup()

# Call after a module assignment changes (not after a parameter turn).
controller.on_layout_changed()

# Named presets:
controller.save_global_preset("Studio")
controller.load_global_preset("Studio")

# Per-Set presets are unavailable for unsaved Sets or runtimes that do not
# expose Song.file_path. Never substitute the Set title.
set_key = set_key_from_song(surface.song())
if set_key is not None:
    controller.save_set_preset(set_key, "Arrangement")
    controller.load_set_preset(set_key, "Arrangement")
```

## Storage

Windows path: `%APPDATA%\\MF_Twister\\ModuleStateManager` (or LOCALAPPDATA fallback). macOS/Linux use their standard per-user application-data directories. Names and Set keys are SHA-256 encoded for filenames; the raw Set path is not written to disk.

Writes use a temporary file in the destination directory, flush/fsync, then `os.replace`. The previous valid primary is retained as `.bak`. If the primary is corrupt, the adapter reads the backup and exposes `storage.last_recovery`; if both are invalid, it raises `StorageError` instead of treating corruption as an empty preset.

## Running tests

From this directory:

```sh
python -m compileall -q .
python -m unittest discover -v -p "test_*.py"
```

## Live integration requirements

1. Probe `surface.song().file_path` in the exact Live 12.5 and Live 13 runtimes; if missing, disable Set-scoped presets for that runtime/session.
2. Wire stable module IDs to each Bento's row/column assignment map.
3. Restore only after module registry/default initialization.
4. Use `surface.schedule_message(1, callback)` as the controller's `schedule_save` callback to keep disk I/O out of MIDI listeners.
5. Add an explicit preset interaction/UI. No control gestures are assigned by this package.
6. Test startup, disconnect, Save As, missing modules, multiple surfaces, and rollback on actual Live hardware before distribution.
