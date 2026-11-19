"""Metadata and whitelisted note getters only. No private imports or writers."""
import importlib.util
import sys

TERMS = ("flip", "step", "sequenc", "row", "lane", "model")
CLIP_CANDIDATES = ("step_sequencer", "get_step_sequencer", "_flip_object", "flip_object")


def read(obj, name):
    try:
        value = getattr(obj, name)
        if value is None or isinstance(value, (bool, int, float, str)):
            return {"ok": True, "value": value}
        return {"ok": True, "type": type(value).__name__, "callable": callable(value)}
    except Exception as error:
        return {"ok": False, "error": type(error).__name__, "message": str(error)[:180]}


def members(obj):
    try:
        names = [n for n in dir(obj) if any(t in n.lower() for t in TERMS)]
        return {"matching_members": sorted(names)[:64], "matching_count": len(names), "truncated": len(names) > 64}
    except Exception as error:
        return {"error": type(error).__name__}


def discover(name):
    # For a top-level module find_spec does not import its package initializer.
    try:
        spec = importlib.util.find_spec(name)
        return {"loaded": name in sys.modules, "discoverable": spec is not None,
                "loader_type": type(spec.loader).__name__ if spec is not None else None}
    except Exception as error:
        return {"loaded": name in sys.modules, "error": type(error).__name__, "message": str(error)[:180]}


def inspect_root(c_instance):
    """Push2 uses c_instance.root() as a getter; never construct a Flip root."""
    records = []
    try:
        getter = getattr(c_instance, "root")
        if not callable(getter):
            return [{"path": "c_instance.root()", "result": {"callable": False}}]
        obj = getter()
        path = "c_instance.root()"
        records.append({"path": path, "result": {"type": type(obj).__name__}, "metadata": members(obj)})
        for name in ("song", "view", "detail_clip", "step_sequencer"):
            path += "." + name
            result = read(obj, name)
            records.append({"path": path, "result": result})
            if not result["ok"]:
                return records
            obj = getattr(obj, name)
            if obj is None:
                return records
        for name in ("highlighted_row_index", "step_count"):
            records.append({"path": path + "." + name, "result": read(obj, name)})
        rows = getattr(obj, "rows")
        index = getattr(obj, "highlighted_row_index")
        if not isinstance(index, int) or not 0 <= index < len(rows):
            return records
        row = rows[index]
        path += ".rows[%d]" % index
        for name in ("midi_key", "active_length", "step_size", "play_direction", "swing"):
            records.append({"path": path + "." + name, "result": read(row, name)})
        steps = getattr(row, "steps")
        if len(steps):
            for name in ("velocity", "offset", "length", "repeat", "pitch", "chance", "span"):
                records.append({"path": path + ".steps[0]." + name, "result": read(steps[0], name)})
    except Exception as error:
        records.append({"path": "c_instance.root() native read route", "result": {
            "error": type(error).__name__, "message": str(error)[:180]}})
    return records


def capture(song, live, c_instance, module_lookup=discover):
    records = []
    for name in ("LiveFlip", "live_model", "Push2"):
        records.append({"path": name, "kind": "module_discovery", "result": module_lookup(name)})
    records.append({"path": "Live.StepSequencer", "result": read(live, "StepSequencer")})
    for path, obj in (("Live", live), ("Live.Clip", live.Clip),
                      ("Live.Clip.Clip", live.Clip.Clip), ("c_instance", c_instance)):
        records.append({"path": path, "kind": "metadata", "result": members(obj)})
    for name in ("flip_document", "_flip_document", "live_model", "root"):
        records.append({"path": "c_instance." + name, "result": read(c_instance, name)})
    records.extend(inspect_root(c_instance))
    enum = getattr(live.Clip, "MidiClipType", None)
    for name in ("piano_roll", "step_sequencer"):
        records.append({"path": "Live.Clip.MidiClipType." + name, "result": read(enum, name)})
    clip = song.view.detail_clip
    records.append({"path": "song.view.detail_clip", "result": {"type": type(clip).__name__, "present": clip is not None}})
    if clip is None:
        return records
    for name in ("is_midi_clip", "midi_clip_type") + CLIP_CANDIDATES:
        records.append({"path": "song.view.detail_clip." + name, "result": read(clip, name)})
    # Conventional note counts are not native step reads. Do not log musical content.
    try:
        notes = clip.get_notes_extended(0, 128, 0.0, 4.0)
        info = {"note_count": len(notes), "range_beats": [0.0, 4.0],
                "representation": "conventional_note_API_not_verified_native_steps"}
        if len(notes):
            sample = notes[0]
            info["first_note_field_presence"] = {
                name: read(sample, name)["ok"] for name in
                ("note_id", "start_time", "duration", "velocity", "pitch", "probability", "offset", "repeat", "chance", "span")}
        records.append({"path": "song.view.detail_clip.get_notes_extended(0,128,0.0,4.0)", "result": info})
    except Exception as error:
        records.append({"path": "song.view.detail_clip.get_notes_extended(0,128,0.0,4.0)",
                        "result": {"error": type(error).__name__, "message": str(error)[:180]}})
    return records
