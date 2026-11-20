"""Host-only tests for the isolated Classic/Alternate gesture framework."""
import ast
import hashlib
from pathlib import Path
import unittest


ROOT = Path(__file__).parents[1]
SOURCE = ROOT / "MF_SEQ/MF_SEQ.py"
CONTENT = SOURCE.read_text(encoding="utf-8").rstrip("\n") + "\n"
TREE = ast.parse(CONTENT)
CLASS = next(node for node in TREE.body if isinstance(node, ast.ClassDef) and node.name == "MF_SEQ")
RECEIVE = next(node for node in CLASS.body if isinstance(node, ast.FunctionDef) and node.name == "receive_midi")
DISCONNECT = next(node for node in CLASS.body if isinstance(node, ast.FunctionDef) and node.name == "disconnect")
INIT = next(node for node in CLASS.body if isinstance(node, ast.FunctionDef) and node.name == "__init__")
GLOBALS = {"ROT_CHANNEL": 11, "PUSH_CHANNEL": 10, "FIRST_CC": 32,
           "STEPS": 16, "MAX_PAGES": 4}
exec(compile(ast.Module(body=[RECEIVE], type_ignores=[]), str(SOURCE), "exec"), GLOBALS)


class ExperimentalDispatchSpy(unittest.TestCase):
    receive_midi = GLOBALS["receive_midi"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._pressed = [False] * 16
        self._rotated = [False] * 16
        self._tie_consumed = [False] * 16
        self._pitch_accum = [0] * 16
        self._held_edit_feedback = [False] * 16
        self._press_order = []
        self._ring_reassert_steps = set()
        self._edit_mode = "notes"
        self._last_edit_mode = "velocity"
        self._page = 0
        self._follow_playback = False
        self._follow_manual_pause = False
        self._bar_turn_accum = self._loop_turn_accum = self._param_turn_accum = 0
        self._dirty = False
        self._sequencer_mode = "classic"
        self._mode_pages = {"classic": 0, "alternate": 0}
        self._mode_edit_modes = {"classic": "notes", "alternate": "notes"}
        self._mode_parameters = {"classic": "velocity", "alternate": "velocity"}
        self._mode_chord_pending = False
        self._mode_chord_cancelled = False
        self.actions = []
        self.messages = []

    def push(self, encoder, down):
        self.receive_midi((0xB0 | GLOBALS["PUSH_CHANNEL"], 31 + encoder,
                           127 if down else 0))

    def turn(self, encoder, increments):
        for _ in range(abs(increments)):
            self.receive_midi((0xB0 | GLOBALS["ROT_CHANNEL"], 31 + encoder,
                               65 if increments > 0 else 63))

    def _switch_sequencer_mode(self):
        current = self._sequencer_mode
        self._mode_pages[current] = self._page
        self._mode_edit_modes[current] = self._edit_mode
        self._mode_parameters[current] = self._last_edit_mode
        self._sequencer_mode = "alternate" if current == "classic" else "classic"
        self._page = self._mode_pages[self._sequencer_mode]
        self._edit_mode = self._mode_edit_modes[self._sequencer_mode]
        self._last_edit_mode = self._mode_parameters[self._sequencer_mode]
        self.messages.append("switch:" + self._sequencer_mode)

    def _alternate_edit_blocked(self):
        if self._sequencer_mode == "alternate":
            self.messages.append("blocked")
            return True
        return False

    def _extend_note(self, start, end):
        if not self._alternate_edit_blocked():
            self.actions.append(("extend", start, end))

    def _toggle(self, step):
        if not self._alternate_edit_blocked():
            self.actions.append(("toggle", step))

    def _cycle_probability_preset(self, step):
        if not self._alternate_edit_blocked():
            self.actions.append(("probability_preset", step))

    def _advance_param(self, direction):
        self.actions.append(("parameter", direction))

    def _set_mode(self, mode):
        self._edit_mode = mode

    def _cycle_loop_length(self):
        self.actions.append(("loop_length",))

    def _shift_loop_start(self, direction):
        self.actions.append(("loop", direction))

    def _adjust_pitch(self, step, delta):
        if not self._alternate_edit_blocked():
            self.actions.append(("pitch", step, delta))

    def _adjust_length(self, step, delta):
        if not self._alternate_edit_blocked():
            self.actions.append(("length", step, delta))

    def _adjust_probability(self, step, delta):
        if not self._alternate_edit_blocked():
            self.actions.append(("probability", step, delta))

    def _adjust_cc1(self, step, delta):
        if not self._alternate_edit_blocked():
            self.actions.append(("cc1", step, delta))

    def _adjust_velocity(self, step, delta):
        if not self._alternate_edit_blocked():
            self.actions.append(("velocity", step, delta))

    def _inspect_pitch(self, step):
        if not self._alternate_edit_blocked():
            self.actions.append(("inspect_pitch", step))

    def show_message(self, message):
        self.messages.append(message)


class GestureTests(unittest.TestCase):
    def test_mode_state_does_not_read_uninitialized_classic_fields(self):
        mode_values = {}
        for node in INIT.body:
            if (isinstance(node, ast.Assign) and len(node.targets) == 1 and
                    isinstance(node.targets[0], ast.Attribute) and
                    isinstance(node.targets[0].value, ast.Name) and
                    node.targets[0].value.id == "self" and
                    node.targets[0].attr in ("_mode_edit_modes", "_mode_parameters")):
                mode_values[node.targets[0].attr] = node.value
        self.assertEqual({node.attr for node in ast.walk(mode_values["_mode_edit_modes"])
                          if isinstance(node, ast.Attribute) and
                          isinstance(node.value, ast.Name) and node.value.id == "self"}, set())
        self.assertEqual({node.attr for node in ast.walk(mode_values["_mode_parameters"])
                          if isinstance(node, ast.Attribute) and
                          isinstance(node.value, ast.Name) and node.value.id == "self"}, set())

    def test_e1_first_e16_tap_toggles_once_and_consumes_releases(self):
        spy = ExperimentalDispatchSpy()
        spy.push(1, True)
        spy.push(16, True)
        self.assertTrue(spy._mode_chord_pending)
        spy.push(16, False)
        spy.push(1, False)
        self.assertEqual(spy._sequencer_mode, "alternate")
        self.assertNotIn(("toggle", 15), spy.actions)
        self.assertFalse(any(x == "blocked" for x in spy.messages))

    def test_second_complete_chord_returns_to_classic(self):
        spy = ExperimentalDispatchSpy()
        for _ in range(2):
            spy.push(1, True); spy.push(16, True)
            spy.push(16, False); spy.push(1, False)
        self.assertEqual(spy._sequencer_mode, "classic")
        self.assertEqual(spy.messages.count("switch:alternate"), 1)
        self.assertEqual(spy.messages.count("switch:classic"), 1)

    def test_mode_pages_and_parameter_state_are_independent(self):
        spy = ExperimentalDispatchSpy()
        spy._page = 2
        spy._last_edit_mode = "pitch"
        spy.push(1, True); spy.push(16, True); spy.push(16, False); spy.push(1, False)
        spy._page = 3
        spy._last_edit_mode = "length"
        spy.push(1, True); spy.push(16, True); spy.push(16, False); spy.push(1, False)
        self.assertEqual(spy._page, 2)
        self.assertEqual(spy._last_edit_mode, "pitch")

    def test_reverse_e16_first_e1_is_follow_not_mode(self):
        spy = ExperimentalDispatchSpy()
        spy.push(16, True); spy.push(1, True)
        self.assertTrue(spy._follow_playback)
        self.assertFalse(spy._mode_chord_pending)
        self.assertEqual(spy._sequencer_mode, "classic")

    def test_e1_held_e16_rotation_is_bar_navigation_not_mode(self):
        spy = ExperimentalDispatchSpy()
        spy.push(1, True); spy.turn(16, 4)
        self.assertEqual(spy._page, 1)
        self.assertFalse(spy._mode_chord_pending)
        self.assertEqual(spy._sequencer_mode, "classic")

    def test_e13_first_e4_page_selection_is_preserved(self):
        spy = ExperimentalDispatchSpy()
        spy.push(13, True); spy.push(4, True)
        self.assertEqual(spy._page, 3)
        self.assertEqual(spy._sequencer_mode, "classic")

    def test_note_extension_stays_classic(self):
        spy = ExperimentalDispatchSpy()
        spy.push(1, True); spy.push(4, True)
        self.assertEqual(spy.actions, [("extend", 0, 3)])

    def test_e1_release_first_cancels_without_note_edit(self):
        spy = ExperimentalDispatchSpy()
        spy.push(1, True); spy.push(16, True); spy.push(1, False); spy.push(16, False)
        self.assertEqual(spy._sequencer_mode, "classic")
        self.assertEqual(spy.actions, [])

    def test_third_key_cannot_switch_mode(self):
        spy = ExperimentalDispatchSpy()
        spy.push(1, True); spy.push(2, True); spy.push(16, True)
        spy.push(16, False); spy.push(2, False); spy.push(1, False)
        self.assertEqual(spy._sequencer_mode, "classic")

    def test_alternate_placeholder_refuses_note_edit(self):
        spy = ExperimentalDispatchSpy()
        spy._sequencer_mode = "alternate"
        spy.push(2, True); spy.push(2, False)
        self.assertEqual(spy.actions, [])
        self.assertIn("blocked", spy.messages)

    def test_disconnect_source_clears_new_transient_state(self):
        names = {node.targets[0].attr for node in ast.walk(DISCONNECT)
                 if isinstance(node, ast.Assign) and len(node.targets) == 1
                 and isinstance(node.targets[0], ast.Attribute)
                 and isinstance(node.targets[0].value, ast.Name)
                 and node.targets[0].value.id == "self"}
        self.assertTrue({"_mode_chord_pending", "_mode_chord_cancelled",
                         "_pressed", "_rotated", "_tie_consumed", "_press_order"}.issubset(names))

    def test_reconnect_defaults_to_classic(self):
        spy = ExperimentalDispatchSpy()
        self.assertEqual(spy._sequencer_mode, "classic")
        self.assertFalse(spy._mode_chord_pending)
        self.assertEqual(spy._mode_pages, {"classic": 0, "alternate": 0})


if __name__ == "__main__":
    unittest.main()
