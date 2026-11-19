"""Audit accepted input dispatch with mutation spies; no Live module is imported.

This demonstrates existing conflicts. It does not implement a mode router.
"""
import ast
import hashlib
from pathlib import Path
import unittest

ROOT = Path(__file__).parents[1]
SOURCE = ROOT.parent / "BETA_2_3_INVESTIGATION_2026_11_13/combined/MF_SEQ/MF_SEQ.py"
if not SOURCE.exists():
    SOURCE = ROOT / "evidence/baseline/MF_SEQ.py"
# Normalize checkout newlines; the source snapshot is a UTF-8 Git blob with LF.
CONTENT = SOURCE.read_text(encoding="utf-8").rstrip("\n") + "\n"
BLOB = hashlib.sha1(b"blob " + str(len(CONTENT.encode())).encode() + b"\0" + CONTENT.encode()).hexdigest()
if BLOB != "cbf94ea1a765d3f02aa94ce844228f40f2c68faa":
    raise RuntimeError("Expected the exact accepted v1.0 MF_SEQ Git blob; got " + BLOB)
TREE = ast.parse(CONTENT)
CLASS = next(n for n in TREE.body if isinstance(n, ast.ClassDef) and n.name == "MF_SEQ")
METHOD = next(n for n in CLASS.body if isinstance(n, ast.FunctionDef) and n.name == "receive_midi")
GLOBALS = {}
for node in TREE.body:
    if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        if node.targets[0].id in ("ROT_CHANNEL", "PUSH_CHANNEL", "FIRST_CC", "STEPS", "MAX_PAGES"):
            GLOBALS[node.targets[0].id] = ast.literal_eval(node.value)
exec(compile(ast.Module(body=[METHOD], type_ignores=[]), str(SOURCE), "exec"), GLOBALS)


class DispatchSpy:
    receive_midi = GLOBALS["receive_midi"]

    def __init__(self, mode="notes"):
        self._pressed = [False] * 16
        self._rotated = [False] * 16
        self._tie_consumed = [False] * 16
        self._pitch_accum = [0] * 16
        self._held_edit_feedback = [False] * 16
        self._press_order = []
        self._ring_reassert_steps = set()
        self._edit_mode = mode
        self._last_edit_mode = "velocity"
        self._page = 0
        self._last_playhead = -1
        self._follow_playback = False
        self._follow_manual_pause = False
        self._bar_turn_accum = self._loop_turn_accum = self._param_turn_accum = 0
        self._dirty = False
        self.actions = []

    def push(self, encoder, down):
        self.receive_midi((0xB0 | GLOBALS["PUSH_CHANNEL"], 31 + encoder, 127 if down else 0))

    def turn(self, encoder, increments):
        for _ in range(abs(increments)):
            self.receive_midi((0xB0 | GLOBALS["ROT_CHANNEL"], 31 + encoder, 65 if increments > 0 else 63))

    def _extend_note(self, start, end):
        self.actions.append(("extend", start, end))

    def _toggle(self, step):
        self.actions.append(("toggle", step))

    def _cycle_probability_preset(self, step):
        self.actions.append(("probability_preset", step))

    def _advance_param(self, direction):
        self.actions.append(("parameter", direction))

    def show_message(self, message):
        pass


class BaselineGestureAudit(unittest.TestCase):
    def test_e1_e4_extends_on_second_press_before_any_release(self):
        spy = DispatchSpy()
        spy.push(1, True)
        self.assertEqual(spy.actions, [])
        spy.push(4, True)
        self.assertEqual(spy.actions, [("extend", 0, 3)])
        spy.push(4, False)
        spy.push(1, False)
        self.assertEqual(spy.actions, [("extend", 0, 3)])

    def test_probability_mode_e1_e4_releases_can_both_edit(self):
        spy = DispatchSpy("probability")
        spy.push(1, True)
        spy.push(4, True)
        spy.push(4, False)
        spy.push(1, False)
        self.assertEqual(spy.actions, [("probability_preset", 3), ("probability_preset", 0)])

    def test_e13_first_retains_page_selection_dispatch(self):
        spy = DispatchSpy()
        spy.push(13, True)
        spy.push(1, True)
        spy.push(4, True)
        self.assertEqual(spy._page, 3)
        self.assertEqual(spy.actions, [])

    def test_e16_first_e1_retains_follow_toggle(self):
        spy = DispatchSpy()
        spy.push(16, True)
        spy.push(1, True)
        self.assertTrue(spy._follow_playback)
        self.assertEqual(spy.actions, [])

    def test_bar_navigation_uses_four_detents(self):
        spy = DispatchSpy()
        spy.push(1, True)
        spy.turn(16, 3)
        self.assertEqual(spy._page, 0)
        spy.turn(16, 1)
        self.assertEqual(spy._page, 1)
        spy.push(1, False)
        self.assertEqual(spy.actions, [])

    def test_parameter_navigation_uses_eight_detents(self):
        spy = DispatchSpy()
        spy.push(1, True)
        spy.turn(13, 7)
        self.assertEqual(spy.actions, [])
        spy.turn(13, 1)
        self.assertEqual(spy.actions, [("parameter", 1)])
        spy.push(1, False)
        self.assertEqual(spy.actions, [("parameter", 1)])


if __name__ == "__main__":
    unittest.main()
