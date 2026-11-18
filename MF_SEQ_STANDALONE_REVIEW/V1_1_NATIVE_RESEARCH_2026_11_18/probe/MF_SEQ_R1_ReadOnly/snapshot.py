"""Read-only, bounded introspection. Getter failures are evidence, not absence."""
CLIP_PROPS = ("is_midi_clip", "midi_clip_type", "step_sequencer", "playing_position", "is_playing")
SEQ_PROPS = ("rows", "highlighted_row_index", "selected_row", "step_count", "playing_position", "current_step")
ROW_PROPS = ("midi_key", "label", "active_length", "step_size", "play_direction", "swing", "steps", "playing_position", "current_step")
STEP_PROPS = ("is_on", "velocity", "offset", "length", "repeat", "pitch", "chance", "span")


def safe_get(obj, name):
    try:
        return getattr(obj, name), None
    except Exception as error:
        return None, {"error_type": type(error).__name__, "message": str(error)[:180]}


def scalar(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    return {"type": type(value).__name__}


def inspect_object(obj, properties):
    try:
        names = sorted(n for n in dir(obj) if not n.startswith("_"))
    except Exception:
        names = []
    result = {"type": type(obj).__name__, "members": names, "properties": {}}
    for name in properties:
        value, error = safe_get(obj, name)
        entry = error if error else {"value": scalar(value)}
        descriptor, _ = safe_get(obj if isinstance(obj, type) else type(obj), name)
        if descriptor is not None:
            doc, _ = safe_get(descriptor, "__doc__")
            entry["descriptor_doc"] = str(doc or "")[:1200]
        entry["listeners"] = {method: callable(safe_get(obj, method)[0]) for method in
                              ("add_" + name + "_listener", "remove_" + name + "_listener",
                               name + "_has_listener")}
        result["properties"][name] = entry
    return result


def capture(song, live):
    result, targets = [], []
    view = song.view
    targets.append((view, ("detail_clip", "selected_track", "highlighted_clip_slot")))
    result.append(dict(path="song.view", **inspect_object(view, ("detail_clip", "selected_track", "highlighted_clip_slot"))))
    clips = []
    clip, _ = safe_get(view, "detail_clip")
    if clip is not None:
        clips.append(("song.view.detail_clip", clip))
    # Read existing clips without selecting, creating, launching or converting them.
    tracks, _ = safe_get(song, "tracks")
    scanned = 0
    for ti, track in enumerate(tuple(tracks or ())[:64]):
        slots, _ = safe_get(track, "clip_slots")
        for si, slot in enumerate(tuple(slots or ())[:128]):
            scanned += 1
            if scanned > 512:
                break
            value, _ = safe_get(slot, "clip")
            if value is not None and len(clips) < 16:
                clips.append(("song.tracks[%d].clip_slots[%d].clip" % (ti, si), value))
        arrangement, _ = safe_get(track, "arrangement_clips")
        for ci, value in enumerate(tuple(arrangement or ())[:16]):
            if len(clips) < 16:
                clips.append(("song.tracks[%d].arrangement_clips[%d]" % (ti, ci), value))
        if scanned > 512:
            break
    result.append({"scan": {"slots_inspected": min(scanned, 512), "clip_samples": len(clips), "max_clips": 16}})
    for path, clip in clips:
        item = inspect_object(clip, CLIP_PROPS)
        item["path"] = path
        result.append(item)
        targets.append((clip, ("midi_clip_type", "playing_status")))
        clip_view, _ = safe_get(clip, "view")
        if clip_view is not None:
            result.append(dict(path=path + ".view", **inspect_object(clip_view, ("selected_note", "selected_pitch", "selected_lane", "highlighted_row_index"))))
        seq, _ = safe_get(clip, "step_sequencer")
        if seq is None:
            continue
        result.append(dict(path=path + ".step_sequencer", **inspect_object(seq, SEQ_PROPS)))
        targets.append((seq, ("rows", "highlighted_row_index", "step_count", "row_values_changed")))
        rows, _ = safe_get(seq, "rows")
        index, _ = safe_get(seq, "highlighted_row_index")
        try:
            row = rows[index] if rows is not None and isinstance(index, int) and 0 <= index < len(rows) else None
        except Exception:
            row = None
        if row is None:
            continue
        row_path = path + ".step_sequencer.rows[%d]" % index
        result.append(dict(path=row_path, **inspect_object(row, ROW_PROPS)))
        targets.append((row, ("steps", "midi_key", "active_length", "step_size", "play_direction", "swing")))
        steps, _ = safe_get(row, "steps")
        for si, step in enumerate(tuple(steps or ())[:16]):
            result.append(dict(path=row_path + ".steps[%d]" % si, **inspect_object(step, STEP_PROPS)))
    # De-duplicate subscriptions by object identity and property name in the host.
    unique, seen = [], set()
    for obj, props in targets:
        filtered = []
        for prop in props:
            key = (id(obj), prop)
            if key not in seen:
                seen.add(key)
                filtered.append(prop)
        unique.append((obj, tuple(filtered)))
    return result, unique
