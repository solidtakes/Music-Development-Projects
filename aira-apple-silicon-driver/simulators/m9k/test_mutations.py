"""Independent arithmetic oracles and deliberately broken variants (M9L).

Mutants run only in-process, under scoped patches, never in production files.
"""
import unittest
from fractions import Fraction
from unittest.mock import patch
import simulator
from simulator import Fallback, Simulator, Violation, pack_frames
from test_simulator import engine, input_budget, resolve


def fallback_oracle():
    f = Fallback()
    actual = [f.count(0) for _ in range(8000)]
    # Exact rational cumulative differences, independent of accumulator updates.
    expected = [int(Fraction((k + 1) * 95904, 8000))
                - int(Fraction(k * 95904, 8000)) for k in range(8000)]
    assert actual == expected
    positions = [i + 1 for i, value in enumerate(actual) if value == 11]
    assert positions == [1 + (250 * j) // 3 for j in range(96)]
    assert sum(actual) == 95904
    return positions


def packing_oracle():
    vectors = {
        0: (0, 0, 0, 0, 0, 0, 0, 0),
        1: (0, 0, 0, 0, 0, 0, 0, 1),
        95: (11, 12, 12, 12, 12, 12, 12, 12),
        96: (12, 12, 12, 12, 12, 12, 12, 12),
        97: (12, 12, 12, 12, 12, 12, 12, 13),
        112: (14, 14, 14, 14, 14, 14, 14, 14),
    }
    for frames in (95, 1, 96, 97, 0, 112, 95):
        assert simulator.pack_frames(frames) == vectors[frames]


def duplicate_oracle():
    s = engine(); input_budget(s, "in", [480] * 8)
    try:
        s.consume_in("in")
    except Violation:
        resolve(s)
        return
    raise AssertionError("duplicate consumption accepted")


def stale_oracle():
    s = engine(); s.allocate("old", "OUT", 0, s.budget()); s.submit("old")
    resolve(s); s.restart()
    s.allocate("new", "OUT", 8, s.budget()); s.submit("new")
    s.advance(2000)
    before = s.snapshot()
    result = s.complete("new", 1)
    assert result is False and s.snapshot() == before
    resolve(s)


def alignment_oracle():
    s = engine(); s.allocate("in", "IN", 0); s.submit("in"); s.advance(1000)
    try:
        s.complete("in", 1, counts=[241] * 8)
    except Violation:
        resolve(s)
        return
    raise AssertionError("silent integer truncation accepted")


class IndependentAndMutationTests(unittest.TestCase):
    def test_fb3_exact_eleven_frame_positions(self):
        positions = fallback_oracle()
        self.assertEqual(positions[:6], [1, 84, 167, 251, 334, 417])
        self.assertEqual(positions[-1], 7917)
        self.assertEqual(len(positions), 96)

    def test_independent_floor_difference_vectors(self):
        packing_oracle()

    def test_mutant_incorrect_accumulator_order_is_killed(self):
        def broken(self, received):
            if received >= 6: return received
            extra = self.accumulator // 8000
            self.accumulator = (self.accumulator + 7904) % 8000
            return 11 + extra
        with patch.object(Fallback, "count", broken):
            with self.assertRaises(AssertionError): fallback_oracle()

    def test_mutant_frame_carry_is_killed(self):
        calls = 0
        def broken(frames):
            nonlocal calls
            calls += 1
            return pack_frames(frames + (1 if calls > 1 else 0))
        with patch.object(simulator, "pack_frames", broken):
            with self.assertRaises(AssertionError): packing_oracle()

    def test_mutant_duplicate_consumption_is_killed(self):
        original = Simulator.consume_in
        def broken(self, rid):
            self.requests[rid].consumed = False
            return original(self, rid)
        with patch.object(Simulator, "consume_in", broken):
            with self.assertRaises(AssertionError): duplicate_oracle()

    def test_mutant_stale_completion_acceptance_is_killed(self):
        original = Simulator._owned
        def broken(self, rid, generation):
            return original(self, rid, self.generation)
        with patch.object(Simulator, "_owned", broken):
            with self.assertRaises(AssertionError): stale_oracle()

    def test_mutant_silent_integer_truncation_is_killed(self):
        original = Simulator.complete
        def broken(self, *args, **kwargs):
            self.strict_alignment = False
            return original(self, *args, **kwargs)
        with patch.object(Simulator, "complete", broken):
            with self.assertRaises(AssertionError): alignment_oracle()

    def test_baseline_safety_oracles(self):
        duplicate_oracle(); stale_oracle(); alignment_oracle()

    def test_recovery_overlap_same_generation_and_reuse_new_generation(self):
        s = engine(); s.allocate("old", "OUT", 8, s.budget()); s.submit("old")
        s.complete("old", 1, "CANCELLED"); s.release("old")
        s.allocate("same-generation", "OUT", 8, s.budget())
        with self.assertRaisesRegex(Violation, "overlapping_bus_slots"):
            s.submit("same-generation")
        s.abandon("same-generation", "recovery_overlap"); resolve(s)
        s.restart(); s.allocate("new", "OUT", 8, s.budget())
        self.assertTrue(s.submit("new")); resolve(s)

    def test_invariant_oracle_detects_corrupted_slot_and_budget(self):
        s = engine(); bid = s.budget(); s.allocate("a", "OUT", 0, bid); s.submit("a")
        del s.slots[(1, "OUT", 0)]
        with self.assertRaises(AssertionError): s.check()
        s.slots[(1, "OUT", 0)] = "a"
        s.budgets[bid].frames += 1
        with self.assertRaises(AssertionError): s.check()
        s.budgets[bid].frames -= 1
        resolve(s)
