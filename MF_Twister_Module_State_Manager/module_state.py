"""Surface-independent module-layout state core.

No Ableton imports and no I/O. Storage is injected so the same logic can be
used by Bento surfaces, tests, and future UI adapters. Python 3.8+.
"""
from copy import deepcopy

SCHEMA_VERSION = 1


class StateError(ValueError):
    pass


class ModuleRegistry:
    """Allow-list of stable module IDs known to one Bento surface."""

    def __init__(self):
        self._modules = {}

    def register(self, module_id, factory=None):
        if not isinstance(module_id, str) or not module_id.strip():
            raise StateError("module_id must be a non-empty string")
        if module_id in self._modules:
            raise StateError("duplicate module_id: " + module_id)
        self._modules[module_id] = factory

    def contains(self, module_id):
        return module_id in self._modules

    def resolve(self, module_id):
        if module_id not in self._modules:
            return False, None
        return True, self._modules[module_id]

    def ids(self):
        return tuple(sorted(self._modules))


def make_document(surface_id, assignments, preset_name=None):
    if not isinstance(surface_id, str) or not surface_id.strip():
        raise StateError("surface_id must be a non-empty string")
    if not isinstance(assignments, dict):
        raise StateError("assignments must be a mapping of slot to module_id")
    if preset_name is not None and (
            not isinstance(preset_name, str) or not preset_name.strip()):
        raise StateError("preset_name must be null or a non-empty string")

    clean = {}
    for slot, module_id in assignments.items():
        if not isinstance(slot, str) or not slot.strip():
            raise StateError("slot keys must be non-empty strings")
        if module_id is not None and (
                not isinstance(module_id, str) or not module_id.strip()):
            raise StateError("module_id must be null or a non-empty string")
        clean[slot] = module_id

    return {
        "schema_version": SCHEMA_VERSION,
        "surface_id": surface_id,
        "preset_name": preset_name,
        "assignments": clean,
    }


def migrate_document(document):
    """Migrate the only defined legacy schema (v0) without guessing fields."""
    if not isinstance(document, dict):
        raise StateError("document must be an object")
    version = document.get("schema_version")
    if version == 0:
        allowed_v0 = {"schema_version", "surface_id", "assignments"}
        if set(document) - allowed_v0:
            raise StateError("legacy document contains unsupported fields")
        return make_document(document.get("surface_id"),
                             document.get("assignments"), None)
    if version == SCHEMA_VERSION:
        allowed = {"schema_version", "surface_id", "preset_name", "assignments"}
        if set(document) - allowed:
            raise StateError("document contains unsupported fields")
        return make_document(
            document.get("surface_id"),
            document.get("assignments"),
            document.get("preset_name"),
        )
    raise StateError("unsupported schema_version: %r" % (version,))


def validate_document(document):
    return deepcopy(migrate_document(document))


def resolve_document(document, surface_id, registry):
    """Resolve available modules while preserving missing IDs in source_document."""
    saved = validate_document(document)
    if saved["surface_id"] != surface_id:
        raise StateError("surface_id mismatch")
    applicable = {}
    missing = []
    for slot, module_id in saved["assignments"].items():
        if module_id is None:
            applicable[slot] = None
        elif registry.contains(module_id):
            applicable[slot] = module_id
        else:
            missing.append({"slot": slot, "module_id": module_id})
    return {
        "assignments": applicable,
        "missing": missing,
        "source_document": saved,
    }


class ModuleStateManager:
    """Coordinates layouts using an injected storage adapter.

    Required adapter methods:
      load_last(surface_id), save_last(surface_id, document)
      load_global(surface_id, name), save_global(surface_id, name, document),
      delete_global(surface_id, name), list_global(surface_id)
      load_set(set_key, surface_id, name), save_set(...), delete_set(...),
      list_set(set_key, surface_id)
    """

    def __init__(self, surface_id, registry, storage):
        if not isinstance(surface_id, str) or not surface_id.strip():
            raise StateError("surface_id is required")
        if not isinstance(registry, ModuleRegistry):
            raise StateError("registry must be a ModuleRegistry")
        self.surface_id = surface_id
        self.registry = registry
        self.storage = storage

    def snapshot(self, assignments, preset_name=None):
        # Validate shape before iterating so malformed inputs fail consistently.
        document = make_document(self.surface_id, assignments, preset_name)
        for module_id in document["assignments"].values():
            if module_id is not None and not self.registry.contains(module_id):
                raise StateError("cannot save unregistered module: " + module_id)
        return document

    def save_last(self, assignments):
        document = self.snapshot(assignments)
        self.storage.save_last(self.surface_id, document)
        return document

    def restore_last(self):
        document = self.storage.load_last(self.surface_id)
        return None if document is None else resolve_document(
            document, self.surface_id, self.registry)

    def save_global(self, name, assignments):
        self._check_name(name)
        document = self.snapshot(assignments, name)
        self.storage.save_global(self.surface_id, name, document)
        return document

    def load_global(self, name):
        self._check_name(name)
        document = self.storage.load_global(self.surface_id, name)
        return None if document is None else resolve_document(
            document, self.surface_id, self.registry)

    def delete_global(self, name):
        self._check_name(name)
        return self.storage.delete_global(self.surface_id, name)

    def list_global(self):
        return self.storage.list_global(self.surface_id)

    def save_set(self, set_key, name, assignments):
        self._check_key(set_key)
        self._check_name(name)
        document = self.snapshot(assignments, name)
        self.storage.save_set(set_key, self.surface_id, name, document)
        return document

    def load_set(self, set_key, name):
        self._check_key(set_key)
        self._check_name(name)
        document = self.storage.load_set(set_key, self.surface_id, name)
        return None if document is None else resolve_document(
            document, self.surface_id, self.registry)

    def delete_set(self, set_key, name):
        self._check_key(set_key)
        self._check_name(name)
        return self.storage.delete_set(set_key, self.surface_id, name)

    def list_set(self, set_key):
        self._check_key(set_key)
        return self.storage.list_set(set_key, self.surface_id)

    @staticmethod
    def _check_name(name):
        if not isinstance(name, str) or not name.strip():
            raise StateError("preset name must be non-empty")

    @staticmethod
    def _check_key(key):
        if not isinstance(key, str) or not key.strip():
            raise StateError("set_key must be a verified non-empty key")
