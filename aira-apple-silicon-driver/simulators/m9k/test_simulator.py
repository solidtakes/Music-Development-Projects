import unittest
from simulator import (Simulator, Fallback, Timeline, Violation, pack_frames,
                       input_clock_counts, completion_times)


def engine(**kwargs):
    s = Simulator(**kwargs)
    s.start()
    return s


def input_budget(s, rid, counts, slot=0, statuses=None):
    s.allocate(rid, "IN", slot)
    assert s.submit(rid)
    s.advance(max(s.now, (slot + 8) * 125))
    s.complete(rid, s.generation, counts=counts, transaction_statuses=statuses)
    return s.consume_in(rid) if s.requests[rid].state == "COMPLETED" else None


def resolve(s):
    for r in list(s.requests.values()):
        if r.state == "ACCEPTED":
            s.complete(r.id, s.generation, "CANCELLED")
        if r.state == "ALLOCATED":
            raise AssertionError("test left allocation without submission")
        if r.direction == "IN" and not r.consumed:
            s.discard_in(r.id, "test_teardown")
        if not r.released:
            s.release(r.id)
    for b in s.budgets.values():
        if b.state == "CREATED":
            s.drop(b.id, "test_teardown")
    s.check(final=True)


class BudgetTests(unittest.TestCase):
    def test_nominal_and_threshold(self):
        for count, total, acc in [(480, 96, 0), (240, 48, 0),
                                  (200, 95, 7232), (440, 88, 0), (520, 104, 0)]:
            with self.subTest(bytes=count):
                s = engine()
                bid = input_budget(s, "in", [count] * 8)
                self.assertEqual(s.budgets[bid].frames, total)
                self.assertEqual(s.fallback.accumulator, acc)
                resolve(s)

    def test_239_240_241_strict_and_emulation(self):
        for n in (239, 240, 241):
            with self.subTest(n=n):
                s = engine()
                s.allocate("in", "IN", 0); s.submit("in"); s.advance(1000)
                if n % 40:
                    with self.assertRaisesRegex(Violation, "frame_alignment"):
                        s.complete("in", 1, counts=[n] * 8)
                    self.assertEqual(s.requests["in"].state, "ACCEPTED")
                else:
                    s.complete("in", 1, counts=[n] * 8)
                    self.assertEqual(s.budgets[s.consume_in("in")].frames, 48)
                resolve(s)
                s = engine(strict_alignment=False)
                bid = input_budget(s, "in", [n] * 8)
                self.assertEqual(s.budgets[bid].frames, 95 if n == 239 else 48)
                self.assertEqual(len(s.diagnostics), int(n % 40 != 0))
                resolve(s)

    def test_persistent_alternating_fallback(self):
        s = engine()
        for index, (counts, total, acc) in enumerate([
                ([200] + [480] * 7, 95, 7904),
                ([480] * 8, 96, 7904),
                ([200] + [480] * 7, 96, 7808)]):
            bid = input_budget(s, str(index), counts, index * 8)
            self.assertEqual(s.budgets[bid].frames, total)
            self.assertEqual(s.fallback.accumulator, acc)
        resolve(s)

    def test_alternating_real_and_substituted_transactions(self):
        f = Fallback()
        values = [f.count(n) for n in [5, 13, 5, 11, 5, 6, 5, 12]]
        self.assertEqual(values, [11, 13, 12, 11, 12, 6, 12, 12])
        self.assertEqual(f.accumulator, (4 * 7904) % 8000)

    def test_250_and_8000_substitutions(self):
        for length, total, elevens, twelves in [(250, 2997, 3, 247),
                                                (8000, 95904, 96, 7904)]:
            f = Fallback(); values = [f.count(0) for _ in range(length)]
            self.assertEqual(sum(values), total)
            self.assertEqual(values.count(11), elevens)
            self.assertEqual(values.count(12), twelves)
            self.assertEqual(f.accumulator, 0)

    def test_all_finite_packing_budgets(self):
        for f in range(113):
            packed = pack_frames(f)
            self.assertEqual(sum(packed), f)
            self.assertTrue(all(0 <= n * 40 <= 560 for n in packed))
            for i in range(9):
                self.assertEqual(sum(packed[:i]), i * f // 8)
        self.assertEqual(sorted(pack_frames(95)), [11] + [12] * 7)
        for bad in (-1, 113, 1.0, True):
            with self.assertRaises(Violation): pack_frames(bad)

    def test_input_validation_is_atomic(self):
        for counts in ([480] * 7, [600] * 8, [-40] * 8, [True] * 8):
            s = engine(); s.allocate("in", "IN", 0); s.submit("in"); s.advance(1000)
            with self.assertRaises(Violation): s.complete("in", 1, counts=counts)
            self.assertEqual(s.fallback.accumulator, 0)
            self.assertEqual(len(s.budgets), 0)
            resolve(s)

    def test_failed_input_has_no_budget_or_fallback(self):
        s = engine()
        self.assertIsNone(input_budget(s, "in", [0] * 8, statuses=[1] + [0] * 7))
        self.assertEqual(s.requests["in"].state, "FAILED")
        self.assertEqual(s.fallback.accumulator, 0)
        self.assertFalse(s.budgets)
        resolve(s)


class SchedulingTests(unittest.TestCase):
    def test_fault_drain_stop_and_restart_state_transitions(self):
        s = engine(target=8); s.prefill("OUT"); s.finish_prefill()
        s.fault("injected"); s.begin_drain()
        with self.assertRaises(Violation): s.allocate("blocked", "IN", 64)
        with self.assertRaises(AssertionError): s.stop()
        resolve(s); s.stop()
        self.assertEqual(s.state, "STOPPED")
        s.restart()
        self.assertEqual((s.state, s.generation), ("PREFILL", 2))
        resolve(s)

    def test_m9j_clean_startup_targets_and_steady_state(self):
        for target in (8, 32, 96):
            with self.subTest(target=target):
                s = engine(target=target, capacity=192)
                s.prefill("IN"); s.prefill("OUT"); s.finish_prefill()
                for d in ("IN", "OUT"):
                    x = s.prefill_end["directions"][d]
                    self.assertEqual((x["accepted"], x["completed"], x["outstanding"]),
                                     (target, 0, target))
                for i in range(16):
                    s.advance((i + 1) * 1000)
                    ir = f"g1-IN-prefill-{i}" if i < target else f"in-{i}"
                    out = f"g1-OUT-prefill-{i}" if i < target else f"out-{i}"
                    s.complete(ir, 1, counts=[480] * 8)
                    bid = s.consume_in(ir)
                    s.complete(out, 1)
                    s.release(ir); s.release(out)
                    slot = (target + i) * 8
                    s.allocate(f"in-{target+i}", "IN", slot)
                    s.submit(f"in-{target+i}")
                    s.allocate(f"out-{target+i}", "OUT", slot, bid)
                    s.submit(f"out-{target+i}")
                    s.check()
                for d in ("IN", "OUT"):
                    x = s.snapshot()["directions"][d]
                    self.assertEqual((x["accepted"], x["completed"], x["outstanding"]),
                                     (target + 16, 16, target))
                    self.assertEqual(x["holes"], [])
                self.assertEqual(s.snapshot()["budgets"]["accepted_minus_consumed_frames"], 0)
                resolve(s)

    def test_partial_and_asymmetric_prefill(self):
        s = engine(target=96)
        s.prefill("IN", reject_at=2); s.prefill("OUT", reject_at=3)
        s.finish_prefill()
        a = s.snapshot()["directions"]
        self.assertEqual((a["IN"]["accepted"], a["OUT"]["accepted"]), (2, 3))
        self.assertEqual((a["IN"]["attempts"], a["OUT"]["attempts"]), (3, 4))
        self.assertEqual((a["IN"]["outstanding"], a["OUT"]["outstanding"]), (2, 3))
        self.assertEqual(len(a["OUT"]["holes"]), (96 - 3) * 8)
        resolve(s)

    def test_depth_is_not_accepted_count(self):
        s = engine(target=96); s.prefill("OUT")
        s.advance(20000)
        for i in range(20):
            rid = f"g1-OUT-prefill-{i}"
            s.complete(rid, 1); s.release(rid)
        s.finish_prefill(); x = s.prefill_end["directions"]["OUT"]
        self.assertEqual((x["accepted"], x["completed"], x["outstanding"], x["peak_outstanding"]),
                         (96, 20, 76, 96))
        resolve(s)

    def test_startup_deadline_and_margin_failures(self):
        for now, minimum, reason in [(1001, 0, "missed_bus_slots"),
                                     (901, 100, "insufficient_lead")]:
            s = engine(minimum_lead_us=minimum); s.advance(now)
            s.allocate("out", "OUT", 8, s.budget())
            self.assertFalse(s.submit("out"))
            self.assertEqual(s.diagnostics[-1]["code"], reason)
            self.assertEqual(s.snapshot()["directions"]["OUT"]["holes"], list(range(8, 16)))
            resolve(s)

    def test_single_and_consecutive_out_submission_failures(self):
        for failures in ({1}, {1, 2}):
            s = engine()
            for i in range(4):
                bid = input_budget(s, f"in{i}", [480] * 8, i * 8)
                s.allocate(f"out{i}", "OUT", (i + 4) * 8, bid)
                s.submit(f"out{i}", accept=i not in failures)
            x = s.snapshot()
            self.assertEqual(x["budgets"]["by_state"]["REJECTED"], 96 * len(failures))
            self.assertEqual(x["budgets"]["accepted_minus_consumed_frames"], -96 * len(failures))
            self.assertEqual(len(x["directions"]["OUT"]["holes"]), 8 * len(failures))
            self.assertEqual(len(s.budgets), 4)
            resolve(s)

    def test_input_submission_failure_blocks_later_budget(self):
        s = engine(); s.allocate("first", "IN", 0); s.submit("first", accept=False)
        s.allocate("second", "IN", 8); s.submit("second"); s.advance(2000)
        s.complete("second", 1, counts=[480] * 8)
        self.assertIsNone(s.consume_in("second"))
        self.assertFalse(s.budgets)
        self.assertEqual(s.diagnostics[-1]["code"], "head_of_line_blocked")
        resolve(s)

    def test_missing_completion_blocks_and_retains_ownership(self):
        s = engine()
        for rid, slot in [("missing", 0), ("later", 8)]:
            s.allocate(rid, "IN", slot); s.submit(rid)
        s.advance(3000); s.complete("later", 1, counts=[480] * 8)
        self.assertIsNone(s.consume_in("later")); s.timeout("missing")
        self.assertEqual(s.snapshot()["directions"]["IN"]["outstanding"], 1)
        with self.assertRaises(AssertionError): s.check(final=True)
        with self.assertRaises(Violation): s.release("missing")
        with self.assertRaises(Violation): s.restart()
        resolve(s)

    def test_duplicate_request_submission_budget_and_overlap(self):
        s = engine(); bid = s.budget()
        s.allocate("a", "OUT", 0, bid); s.submit("a")
        for action, reason in [
                (lambda: s.allocate("a", "IN", 8), "duplicate_request"),
                (lambda: s.submit("a"), "duplicate_submission"),
                (lambda: s.allocate("b", "OUT", 8, bid), "duplicate_budget_assignment")]:
            with self.assertRaisesRegex(Violation, reason): action()
        s.allocate("overlap", "OUT", 4, s.budget())
        with self.assertRaisesRegex(Violation, "overlapping_bus_slots"): s.submit("overlap")
        s.abandon("overlap", "overlap_detected")
        self.assertEqual(s.snapshot()["directions"]["OUT"]["attempts"], 1)
        resolve(s)

    def test_duplicate_completion_and_consumption(self):
        s = engine(); bid = input_budget(s, "a", [480] * 8)
        before = s.budgets[bid].frames
        self.assertFalse(s.complete("a", 1, counts=[0] * 8))
        with self.assertRaisesRegex(Violation, "duplicate_input_consumption"): s.consume_in("a")
        self.assertEqual(s.budgets[bid].frames, before)
        resolve(s)

    def test_capacity_allocation_and_ownership(self):
        s = engine(capacity=1); s.allocate("a", "OUT", 0, s.budget())
        with self.assertRaisesRegex(Violation, "allocation_capacity"):
            s.allocate("b", "OUT", 8, s.budget())
        s.submit("a"); s.advance(1000); s.complete("a", 1)
        with self.assertRaises(Violation): s.allocate("b", "OUT", 8, s.budget())
        s.release("a"); s.allocate("b", "OUT", 8, s.budget()); s.submit("b")
        resolve(s)

    def test_completion_failure_cancellation_and_timeout_are_distinct(self):
        s = engine()
        for i in range(3):
            s.allocate(str(i), "OUT", i * 8, s.budget()); s.submit(str(i))
        s.advance(3000); s.complete("0", 1, "FAILED"); s.complete("1", 1, "CANCELLED")
        s.timeout("2")
        x = s.snapshot()["directions"]["OUT"]
        self.assertEqual((x["completed"], x["failed"], x["cancelled"], x["outstanding"]), (0, 1, 1, 1))
        resolve(s)

    def test_recovery_requires_explicit_resolution_and_rejects_stale(self):
        s = engine(target=8); s.prefill("OUT")
        with self.assertRaises(Violation): s.restart()
        resolve(s); s.restart(); s.prefill("OUT")
        before = s.snapshot()
        self.assertFalse(s.complete("g1-OUT-prefill-0", 1))
        self.assertEqual(before, s.snapshot())
        self.assertEqual(s.generation, 2)
        self.assertEqual(s.fallback.accumulator, 0)
        self.assertEqual(s.snapshot()["directions"]["OUT"]["outstanding"], 8)
        resolve(s)

    def test_endpoint_rejection_keeps_budget_for_explicit_drop(self):
        s = engine(); bid = s.budget(113)
        with self.assertRaisesRegex(Violation, "endpoint_capacity"):
            s.allocate("oversize", "OUT", 0, bid)
        self.assertEqual(s.budgets[bid].state, "CREATED")
        with self.assertRaises(AssertionError): s.check(final=True)
        s.drop(bid, "endpoint_capacity"); s.check(final=True)


class TimingTests(unittest.TestCase):
    def test_machine_readable_scenario_evidence(self):
        from scenarios import evidence
        records = evidence()
        self.assertEqual(records["accepted96_completed20_outstanding76"]["directions"]["OUT"]["outstanding"], 76)
        self.assertEqual(records["stall_10000us"]["diagnostics"][-1]["code"], "missed_bus_slots")
        self.assertEqual(records["stall_2000us"]["diagnostics"], [])

    def test_seeded_jitter_and_reordering_are_deterministic(self):
        times = completion_times(32, seed=42, jitter_us=3000)
        self.assertEqual(times, completion_times(32, seed=42, jitter_us=3000))
        self.assertNotEqual(times, completion_times(32, seed=43, jitter_us=3000))
        self.assertNotEqual(times, sorted(times))
        s = engine(target=32); s.prefill("OUT"); timeline = Timeline(s)
        for i, t in enumerate(times):
            timeline.add(t, lambda i=i: s.complete(f"g1-OUT-prefill-{i}", 1))
        timeline.run()
        self.assertEqual(s.snapshot()["directions"]["OUT"]["completed"], 32)
        resolve(s)

    def test_stalls_shorter_and_longer_than_queue_lead(self):
        for stall, accepted in [(2000, True), (10000, False)]:
            s = engine(target=8); s.prefill("OUT")
            times = completion_times(8, stall_at=1000, stall_us=stall)
            s.advance(times[0]); s.complete("g1-OUT-prefill-0", 1)
            s.allocate("replacement", "OUT", 64, s.budget())
            self.assertEqual(s.submit("replacement"), accepted)
            if not accepted:
                self.assertEqual(s.diagnostics[-1]["code"], "missed_bus_slots")
            resolve(s)

    def test_equal_time_event_order_changes_depth_explicitly(self):
        peaks = []
        for completion_first in (True, False):
            s = engine(); s.allocate("a", "OUT", 0, s.budget()); s.submit("a")
            s.allocate("b", "OUT", 8, s.budget())
            q = Timeline(s)
            q.add(1000, lambda: s.complete("a", 1), priority=0 if completion_first else 1)
            q.add(1000, lambda: s.submit("b"), priority=1 if completion_first else 0)
            q.run(); peaks.append(s.peak["OUT"]); resolve(s)
        self.assertEqual(peaks, [1, 2])

    def test_drift_drives_input_budgets_without_global_out_clock(self):
        for ppm, total in [(-1000, 95904), (0, 96000), (1000, 96096)]:
            counts = input_clock_counts(8000, ppm)
            self.assertEqual(sum(counts) // 40, total)
            self.assertTrue(all(n in {440, 480, 520} for n in counts))
            # 100 request-local budgets exercise the actual simulator path.
            s = engine()
            observed = 0
            for i in range(100):
                chunk = counts[i*8:(i+1)*8]
                bid = input_budget(s, f"in{i}", chunk, i*8)
                f = s.budgets[bid].frames; observed += f
                self.assertEqual(f, sum(chunk) // 40)
                s.allocate(f"out{i}", "OUT", (i+2)*8, bid); s.submit(f"out{i}")
                s.release(f"in{i}")
            self.assertEqual(observed, sum(counts[:800]) // 40)
            self.assertEqual(s.fallback.accumulator, 0)
            resolve(s)

    def test_early_completion_time_reversal_and_invalid_events(self):
        s = engine(); s.allocate("a", "OUT", 0, s.budget()); s.submit("a")
        with self.assertRaises(Violation): s.complete("a", 1)
        s.advance(1000)
        with self.assertRaises(Violation): s.advance(999)
        with self.assertRaises(Violation): Timeline(s).add(999, lambda: None)
        resolve(s)


if __name__ == "__main__":
    unittest.main()
