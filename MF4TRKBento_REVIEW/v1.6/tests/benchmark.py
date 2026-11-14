"""Use identical simulated time, state changes and events for both sources."""
import argparse
from collections import Counter
from pathlib import Path
from statistics import median
from time import perf_counter_ns
import mock_live as mock

CANDIDATE = Path(__file__).resolve().parents[1] / "MF4TRKBento" / "MF4TRKBento.py"
TICKS = 800
TRIALS = 9
LAYOUTS = {
    "idle_mixer": ("Pan", "Pan", "Sends", "Sends"),
    "inactive_midi": ("Pan", "Pan", "Sends", "Sends"),
    "availability": ("Pan", "Pan", "Sends", "Sends"),
    "stopped_grid": ("RClip",) * 4,
    "animated_grid": ("RClip",) * 4,
    "events": ("RClip", "Pan", "Mute", "RClip"),
}
READS = ("visible_tracks", "clip_slots", "mixer_device", "panning", "sends",
         "is_playing", "current_song_time", "playing_position", "has_audio_output", "min", "max", "value")


def run(module, name):
    song = mock.SONG = mock.Song()
    song.tracks.extend(mock.Track() for _ in range(56))
    clock = [0.0]
    module.time = type("Clock", (), {"monotonic": staticmethod(lambda: clock[0])})
    surface = module.create_instance(None)
    surface._alt_mode = True
    surface._row_modules[:] = LAYOUTS[name]
    clips = []
    for track in song.tracks:
        for row, slot in enumerate(track.clip_slots[:4]):
            slot.has_clip = True
            slot.clip = mock.Clip()
            if name == "animated_grid" and row in (0, 1, 2):
                slot.clip.is_playing = row != 1
                slot.clip.is_recording = row == 1
                clips.append(slot.clip)
    if name == "inactive_midi":
        for track in song.tracks[:2]:
            track.has_audio_output = False
    sends = song.tracks[0].mixer_device.sends
    sends[1].value = 0.5
    surface._refresh_all()
    surface.sent.clear()
    mock.READS.clear()
    callback_counts = Counter()
    duration = 0
    for tick in range(1, TICKS + 1):
        clock[0] = tick * 0.1
        song.current_song_time = tick * 0.2
        for clip in clips:
            clip.playing_position = (tick * 0.11) % 8
        if name == "availability" and tick % 40 == 2:
            track = song.tracks[0]
            track.has_audio_output = not track.has_audio_output
        if name == "availability" and tick % 40 in (12, 32):
            song.tracks[0].mixer_device.sends = sends[:1] if tick % 40 == 12 else sends
        start = perf_counter_ns()
        if name == "events" and tick % 10 == 0:
            # Mute push/release and Master Pan detent, through registered callbacks.
            for index, value in ((17, 127), (17, 0), (14, 65)):
                surface._elements[index][1](value)
                callback_counts["input"] += 1
        delay, callback = surface.scheduled.pop(0)
        assert delay == 1
        callback()
        callback_counts["tick"] += 1
        duration += perf_counter_ns() - start
    reads = tuple(mock.READS[key] for key in READS)
    listeners = [element for element, _ in surface._elements]
    messages = tuple(surface.sent)
    before = sum(len(element.listeners) for element in listeners)
    scheduled = len(surface.scheduled)
    surface.disconnect()
    after = sum(len(element.listeners) for element in listeners)
    assert scheduled == 1
    assert before == 32 and after == 0
    return duration / TICKS / 1000, messages, reads, callback_counts, (before, after)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("baseline", type=Path, help="Exact ZIP's MF4TRKBento.py")
    args = parser.parse_args()
    baseline, candidate = mock.load(args.baseline), mock.load(CANDIDATE)
    print(f"{TRIALS} interleaved trials x {TICKS} ticks, 64 tracks, simulated 100 ms/tick")
    print("Median microseconds/tick (events includes input dispatch), script MIDI attempts")
    for name in LAYOUTS:
        run(baseline, name)
        run(candidate, name)
        left, right = [], []
        for trial in range(TRIALS):
            pair = ((baseline, left), (candidate, right))
            for module, results in pair[::1 if trial % 2 == 0 else -1]:
                results.append(run(module, name))
        a, b = left[0], right[0]
        if name != "availability":
            assert a[1] == b[1], f"changed MIDI stream in {name}"
        else:
            assert len(a[1]) == 80 and len(b[1]) == 180
            assert (0xBA, 8, 48) in b[1]
        assert a[3:] == b[3:], f"changed dispatch or listener count in {name}"
        if name in ("idle_mixer", "inactive_midi", "stopped_grid"):
            assert not a[1]
        before = median(r[0] for r in left)
        after = median(r[0] for r in right)
        print(f"{name}: {before:.2f} -> {after:.2f} us/tick "
              f"({(after / before - 1) * 100:+.1f}%), MIDI {len(a[1])} -> {len(b[1])}, "
              f"tick/input {a[3]['tick']}/{a[3]['input']}, listeners {a[4][0]} -> {a[4][1]} on disconnect in both")
        print("  Reads: " + ", ".join(f"{k} {x}->{y}" for k, x, y in zip(READS, a[2], b[2])))
    print("PASS: identical MIDI streams except for intended availability transitions.")


if __name__ == "__main__":
    main()
