"""Crash-conscious JSON file storage for the MF Twister Module State Manager.

Python standard library only. All writes are atomic within one directory.
This adapter stores module assignment documents only; it never receives Live
parameter values or MIDI/LED state.
"""
import hashlib
import json
import os
import tempfile
import threading

try:\n    from .module_state import validate_document\nexcept (ImportError, ValueError):  # Direct import when this folder is the script root.\n    from module_state import validate_document


FORMAT_VERSION = 1


class StorageError(IOError):
    pass


class JSONFileStorage:
    def __init__(self, base_dir):
        if not isinstance(base_dir, str) or not base_dir.strip():
            raise StorageError("base_dir must be an explicit directory")
        self.base_dir = os.path.abspath(base_dir)
        self._lock = threading.RLock()
        self.last_recovery = None

    @classmethod
    def for_current_user(cls):
        """Use the current user's roaming app-data folder on Windows."""
        if os.name == "nt":
            root = os.environ.get("APPDATA") or os.environ.get("LOCALAPPDATA")
            if not root:
                raise StorageError("Windows APPDATA/LOCALAPPDATA is unavailable")
            return cls(os.path.join(root, "MF_Twister", "ModuleStateManager"))
        if os.name == "posix" and os.uname().sysname == "Darwin":
            root = os.path.expanduser("~/Library/Application Support")
        else:
            root = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
        return cls(os.path.join(root, "MF_Twister", "ModuleStateManager"))

    @staticmethod
    def _digest(value):
        if not isinstance(value, str) or not value:
            raise StorageError("storage keys must be non-empty strings")
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    def _path(self, kind, surface_id, name=None, set_key=None):
        surface_hash = self._digest(surface_id)
        if kind == "last":
            return os.path.join(self.base_dir, "last", surface_hash + ".json")
        name_hash = self._digest(name)
        if kind == "global":
            return os.path.join(self.base_dir, "global", surface_hash, name_hash + ".json")
        if kind == "set":
            set_hash = self._digest(set_key)
            return os.path.join(self.base_dir, "sets", set_hash, surface_hash, name_hash + ".json")
        raise StorageError("unknown storage namespace")

    @staticmethod
    def _envelope(kind, surface_id, document, name=None, set_key=None):
        normalized = validate_document(document)
        if normalized["surface_id"] != surface_id:
            raise StorageError("document surface_id does not match storage key")
        if kind in ("global", "set") and normalized["preset_name"] != name:
            raise StorageError("document preset_name does not match storage key")
        return {
            "format_version": FORMAT_VERSION,
            "kind": kind,
            "surface_id": surface_id,
            "preset_name": name,
            "set_key": set_key,
            "document": normalized,
        }

    @staticmethod
    def _decode(raw, kind, surface_id, name=None, set_key=None):
        try:
            if len(raw) > 1024 * 1024:
                raise StorageError("state file exceeds 1 MiB safety limit")
            value = json.loads(raw.decode("utf-8"))
            if not isinstance(value, dict) or value.get("format_version") != FORMAT_VERSION:
                raise StorageError("unsupported or corrupt storage envelope")
            expected = {
                "kind": kind,
                "surface_id": surface_id,
                "preset_name": name,
                "set_key": set_key,
            }
            for key, expected_value in expected.items():
                if value.get(key) != expected_value:
                    raise StorageError("storage namespace mismatch: " + key)
            document = validate_document(value.get("document"))
            if document["surface_id"] != surface_id:
                raise StorageError("document surface mismatch")
            if document["preset_name"] != name:
                raise StorageError("document preset mismatch")
            return document
        except (UnicodeDecodeError, ValueError, TypeError, KeyError) as exc:
            if isinstance(exc, StorageError):
                raise
            raise StorageError("invalid state JSON: %s" % exc)

    @staticmethod
    def _atomic_bytes(path, data):
        directory = os.path.dirname(path)
        if not os.path.isdir(directory):
            os.makedirs(directory, exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix=".mft-state-", suffix=".tmp", dir=directory)
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, path)
        except Exception:
            try:
                os.unlink(temporary)
            except OSError:
                pass
            raise

    def _read_valid(self, path, kind, surface_id, name=None, set_key=None):
        with open(path, "rb") as handle:
            raw = handle.read(1024 * 1024 + 1)
        document = self._decode(raw, kind, surface_id, name, set_key)
        return document, raw

    def _load(self, path, kind, surface_id, name=None, set_key=None):
        self.last_recovery = None
        backup = path + ".bak"
        primary_error = None
        if os.path.exists(path):
            try:
                document, unused = self._read_valid(path, kind, surface_id, name, set_key)
                return document
            except (OSError, StorageError) as exc:
                primary_error = exc
        if os.path.exists(backup):
            try:
                document, unused = self._read_valid(backup, kind, surface_id, name, set_key)
                self.last_recovery = {"path": path, "source": "backup", "error": str(primary_error or "primary missing")}
                return document
            except (OSError, StorageError) as backup_error:
                raise StorageError("primary and backup are unusable: %s; %s" %
                                   (primary_error or "primary missing", backup_error))
        if primary_error is not None:
            raise StorageError("state file is corrupt and no valid backup exists: %s" % primary_error)
        return None

    def _save(self, path, kind, surface_id, document, name=None, set_key=None):
        envelope = self._envelope(kind, surface_id, document, name, set_key)
        payload = (json.dumps(envelope, sort_keys=True, indent=2) + "\n").encode("utf-8")
        with self._lock:
            if os.path.exists(path):
                try:
                    unused, old_raw = self._read_valid(path, kind, surface_id, name, set_key)
                    self._atomic_bytes(path + ".bak", old_raw)
                except (OSError, StorageError):
                    # Never overwrite a known-good backup with a corrupt primary.
                    pass
            try:
                self._atomic_bytes(path, payload)
            except OSError as exc:
                raise StorageError("atomic state write failed: %s" % exc)

    def _delete(self, path):
        removed = False
        with self._lock:
            for candidate in (path, path + ".bak"):
                try:
                    os.remove(candidate)
                    removed = True
                except OSError:
                    pass
        return removed

    def save_last(self, surface_id, document):
        self._save(self._path("last", surface_id), "last", surface_id, document)

    def load_last(self, surface_id):
        return self._load(self._path("last", surface_id), "last", surface_id)

    def save_global(self, surface_id, name, document):
        self._save(self._path("global", surface_id, name), "global", surface_id, document, name)

    def load_global(self, surface_id, name):
        return self._load(self._path("global", surface_id, name), "global", surface_id, name)

    def delete_global(self, surface_id, name):
        return self._delete(self._path("global", surface_id, name))

    def save_set(self, set_key, surface_id, name, document):
        self._save(self._path("set", surface_id, name, set_key), "set", surface_id, document, name, set_key)

    def load_set(self, set_key, surface_id, name):
        return self._load(self._path("set", surface_id, name, set_key), "set", surface_id, name, set_key)

    def delete_set(self, set_key, surface_id, name):
        return self._delete(self._path("set", surface_id, name, set_key))

    def _list(self, directory, kind, surface_id, set_key=None):
        if not os.path.isdir(directory):
            return []
        results = []
        for filename in os.listdir(directory):
            if not filename.endswith(".json"):
                continue
            path = os.path.join(directory, filename)
            try:
                with open(path, "rb") as handle:
                    raw = handle.read(1024 * 1024 + 1)
                value = json.loads(raw.decode("utf-8"))
                name = value.get("preset_name") if isinstance(value, dict) else None
                document = self._decode(raw, kind, surface_id, name, set_key)
                results.append({"name": name, "assignments": len(document["assignments"])})
            except (OSError, ValueError, TypeError, StorageError):
                continue
        return sorted(results, key=lambda item: item["name"].casefold() if item["name"] else "")

    def list_global(self, surface_id):
        return self._list(os.path.join(self.base_dir, "global", self._digest(surface_id)),
                          "global", surface_id)

    def list_set(self, set_key, surface_id):
        directory = os.path.join(self.base_dir, "sets", self._digest(set_key), self._digest(surface_id))
        return self._list(directory, "set", surface_id, set_key)
