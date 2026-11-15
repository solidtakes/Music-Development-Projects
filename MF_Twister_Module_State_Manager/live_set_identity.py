"""Conservative Ableton Live Set identity helpers.

A Set title is never used as an identity. Unsaved Sets and runtimes that do not
expose Song.file_path return None and must remain session-only.
"""
import hashlib
import ntpath
import os


def set_key_from_path(path):
    """Return a stable path-scoped key, or None for empty/non-absolute paths.

    Save As or moving a Set intentionally creates a different key. This is a
    path identity, not a claim that the underlying document has a permanent UUID.
    """
    if not isinstance(path, str) or not path.strip():
        return None
    value = path.strip()
    if ntpath.isabs(value):
        normalized = ntpath.normcase(ntpath.normpath(value))
    elif os.path.isabs(value):
        normalized = os.path.normcase(os.path.realpath(os.path.abspath(value)))
    else:
        return None
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return "live-set-path-v1:" + digest


def set_key_from_song(song):
    """Read Song.file_path if this Live runtime exposes it; never guess.

    The LOM documents file_path, but some Python Remote Script runtimes may not
    expose every LOM property. Attribute/runtime failures safely return None.
    """
    if song is None:
        return None
    try:
        path = getattr(song, "file_path")
    except (AttributeError, RuntimeError, TypeError):
        return None
    return set_key_from_path(path)
