import unittest
from arithmetic import (Fallback, ModelError, RequestFrame, TransactionSlot, input_clock,
                        nominal_budget, pack, slots)
from records import REFERENCE, SAFE, ABORTED, UNDERRUN, Fault, Transaction
from model import Simulator, TABLES
from events import Timeline, completion_delays


def running(**kwargs):
    s = Simulator(**kwargs)
    s.prequeue(0)
    return s


def cleanup(s):
    s.stop()
    for p in list(s.packs.values()):
        if p.lease == "ACCEPTED":
            s.callback(p.uid, p.generation, ABORTED, effective_cancel=True)
    s.retire_for_stop()
    s.check(final=True)


def first_input(s, counts=(480,) * 8, status=0):
    c = s.cycle()
    uid = c.stages[0].uid
    s.advance(s.packs[uid].end_frame * 1000)
    s.callback(uid, s.generation, status, counts=counts)
    return uid


class DirectionTests(unittest.TestCase):
    def test_D1_targets_and_paired_order(self):
        for target in (8, 32, 96):
            with self.subTest(target=target):
                s = Simulator(history_limit=1024)
                cycles = s.prequeue(target)
                self.assertEqual(len(cycles), target)
                self.assertEqual(s.state, "RUNNING")
                self.assertEqual(s.shared_attempts, 0)
                self.assertTrue(all([r.direction for r in c.stages] == ["IN", "OUT"] for c in cycles))
                for d in ("IN", "OUT"):
                    self.assertEqual(s.stats[d]["api_attempts"], target)
                    self.assertEqual(s.stats[d]["accepted"], target)
                    self.assertEqual(s.owned(d), target)
                s.check(); cleanup(s)

    def test_D2_input_only(self):
        s = running(enabled=(True, False)); uid = first_input(s)
        prior = s.shared_frames
        result = s.poll()
        self.assertEqual(result["cycle"].frames, 96)
        self.assertEqual(s.shared_frames - prior, 96)
        self.assertEqual(s.stats["OUT"]["send_calls"], 0)
        self.assertEqual(s.out_offset, 0)
        cleanup(s)

    def test_D3_output_only_and_disabled(self):
        s = running(enabled=(False, True)); cycle = s.cycle()
        self.assertEqual([x.direction for x in cycle.stages], ["OUT"])
        self.assertEqual((s.shared_frames, s.out_offset), (96, 3840))
        self.assertEqual(s.stats["IN"]["allocated_total"], 0)
        cleanup(s)
        s = running(enabled=(False, False))
        with self.assertRaisesRegex(ModelError, "directions_disabled"): s.cycle()
        self.assertEqual((s.shared_frames, s.out_offset), (0, 0))
        cleanup(s)

    def test_D4_replacement_input_api_failure_skips_output(self):
        s = running(); uid = first_input(s)
        bus = dict(s.bus); offset = s.out_offset; shared = s.shared_frames
        r = s.poll(in_fault=Fault(api_accepts=False))
        self.assertEqual((r["code"], r["origin"]), (5, "SEND_NEXT"))
        self.assertEqual(len(r["cycle"].stages), 1)
        self.assertEqual(s.bus, {"IN": bus["IN"] + 1, "OUT": bus["OUT"]})
        self.assertEqual((s.out_offset, s.shared_frames), (offset, shared))
        self.assertTrue(s.packs[uid].consumed)
        self.assertEqual(s.budget_totals["FAILED_frames"], 96)
        cleanup(s)

    def test_D5_input_pack_failure_no_cursor_advance(self):
        s = running(); before = dict(s.bus)
        c = s.cycle(in_fault=Fault(pack_available=False))
        self.assertEqual(c.failure, "IN_PACK")
        self.assertEqual(s.bus, before)
        self.assertEqual(s.shared_attempts, 0)
        self.assertEqual(s.stats["OUT"]["send_calls"], 0)
        cleanup(s)

    def test_D6_output_pack_failure_retains_input(self):
        s = running(); c = s.cycle(out_fault=Fault(pack_available=False))
        self.assertEqual(c.failure, "OUT_PACK")
        self.assertEqual((s.owned("IN"), s.owned("OUT")), (1, 0))
        self.assertEqual((s.bus["IN"], s.bus["OUT"], s.out_offset, s.shared_frames), (17, 16, 0, 0))
        cleanup(s)

    def test_D7_output_preparation_failure(self):
        s = running(); c = s.cycle(out_fault=Fault(prepare_ok=False))
        self.assertEqual(c.failure, "OUT_PREPARATION")
        self.assertEqual((s.bus["OUT"], s.out_offset, s.shared_frames), (17, 0, 0))
        self.assertEqual(s.stats["OUT"]["api_attempts"], 0)
        self.assertEqual(s.packs[c.stages[-1].uid].saved_status, -2)
        cleanup(s)

    def test_D8_output_api_failure_no_offset_rollback(self):
        s = running(); c = s.cycle(out_fault=Fault(api_accepts=False))
        self.assertEqual(c.failure, "OUT_API")
        self.assertEqual((s.bus["OUT"], s.out_offset, s.shared_frames), (17, 3840, 0))
        self.assertEqual(s.owned("IN"), 1)
        self.assertEqual(s.budget_totals["FAILED_frames"], 96)
        cleanup(s)

    def test_D8_descriptor_failures_and_offset_wrap(self):
        for direction in ("IN", "OUT"):
            s = running(stream_bytes=4480)
            s.out_offset = 4000
            kwargs = {"in_fault" if direction == "IN" else "out_fault": Fault(descriptor_present=False)}
            c = s.cycle(**kwargs)
            self.assertEqual(c.failure, direction + "_DESCRIPTOR")
            self.assertEqual(s.bus[direction], 17)
            self.assertEqual(s.out_offset, 4000 if direction == "IN" else 3360)
            self.assertEqual(s.shared_frames, 0)
            cleanup(s)

    def test_D9_completion_failure_does_not_undo_shared_commit(self):
        s = running(); c = s.cycle(); uid = c.stages[-1].uid
        s.advance(17000); s.callback(uid, 1, 123)
        self.assertEqual((s.shared_frames, s.out_offset), (96, 3840))
        self.assertEqual(s.budget_totals["ERROR_frames"], 96)
        cleanup(s)


class HeadTests(unittest.TestCase):
    def test_H1_strict_head_not_completion_order(self):
        s = running(); a = s.cycle(); b = s.cycle()
        first, later = a.stages[0].uid, b.stages[0].uid
        s.advance(18000); s.callback(later, 1, counts=[480] * 8)
        self.assertEqual(s.get_data()[0], 2)
        self.assertEqual(s.rings["IN"][0], first)
        self.assertFalse(s.packs[later].consumed)
        cleanup(s)

    def test_H2_early_readiness_retains_backend_lease(self):
        for profile, coherent, expected in [(REFERENCE, False, 0), (SAFE, False, 2), (SAFE, True, 0)]:
            s = running(profile=profile); c = s.cycle(); uid = c.stages[0].uid
            s.observe(uid, [Transaction(0, 480, 1)] * 8, coherent=coherent)
            s.advance(17000)
            code, p = s.get_data()
            self.assertEqual(code, expected)
            self.assertEqual(p.lease, "ACCEPTED")
            self.assertEqual(p.callback, "NOT_SEEN")
            s.collect(); self.assertIn(uid, s.packs)
            if code == 0:
                before = s.owned("IN")
                cycle = s.consume(uid)
                self.assertEqual(cycle.frames, 96)
                self.assertEqual(s.owned("IN"), before + 1)
                self.assertIn(uid, s.packs)
            cleanup(s)

    def test_H2_reference_checks_only_last_transaction(self):
        s = running(profile=REFERENCE); c = s.cycle(); uid = c.stages[0].uid
        s.observe(uid, [Transaction(-1, 0, 0)] * 7 + [Transaction(UNDERRUN, 480, 1)])
        s.advance(17000)
        self.assertEqual(s.get_data()[0], 0)
        cleanup(s)

    def test_H3_wait_boundary_and_overdue(self):
        s = running(profile=REFERENCE); c = s.cycle(); uid = c.stages[0].uid
        for now, code in [(16, 2), (17, 2), (20, 2), (21, 3)]:
            self.assertEqual(s.get_data(now=now)[0], code)
            self.assertEqual(s.rings["IN"][0], uid)
        self.assertEqual(s.dispatch(3), 0x7048)
        self.assertEqual(s.reference_state, 4)
        cleanup(s)

    def test_H4_all_six_codes_and_retirement(self):
        for status, expected in [(0, 0), (UNDERRUN, 0), (123, 1), (-1, 1), (ABORTED, 4)]:
            s = running(profile=REFERENCE); uid = first_input(s, status=status)
            code, p = s.get_data()
            self.assertEqual(code, expected)
            self.assertEqual(len(s.rings["IN"]), 0)
            self.assertTrue(p.retired)
            cleanup(s)
        s = running(); c = s.cycle(in_fault=Fault(api_accepts=False))
        self.assertEqual(s.get_data()[0], 5)
        cleanup(s)

    def test_H5_dispatch_targets_and_conditional_states(self):
        expected = {
            "poll": [0x6ff4, 0x7048, 0x6f1b, 0x7048, 0x705a, 0x705a],
            "callback": [0x15f6e, 0x1607e, 0x15e81, 0x1607e, 0x16091, 0x16091],
            "timer": [0xdc01, 0xdc13, 0xd37d, 0xdc13, 0xf2f2, 0xf2f2],
        }
        for caller, targets in expected.items():
            for state in (2, 3, 4, 5):
                for code in range(6):
                    s = running(); s.reference_state = state
                    self.assertEqual(s.dispatch(code, caller), targets[code])
                    expected_state = (4 if code in (1, 3) else 5 if code in (4, 5) else 3) if state == 3 else state
                    self.assertEqual(s.reference_state, expected_state)

    def test_H6_duplicate_callback_and_consumption(self):
        s = running(); uid = first_input(s)
        self.assertFalse(s.callback(uid, 1, counts=[0] * 8))
        code, _ = s.get_data(); self.assertEqual(code, 0)
        s.consume(uid)
        phase, shared = s.fallback.phase, s.shared_frames
        with self.assertRaises(ModelError): s.consume(uid)
        self.assertEqual((s.fallback.phase, s.shared_frames), (phase, shared))
        cleanup(s)


class RecoveryTests(unittest.TestCase):
    def test_R3_completed_unconsumed_input_discard_is_explicit(self):
        for recovery in (False, True):
            s = running(); first_input(s)
            if recovery:
                s.state, s.reference_state = "RECOVERY_WAIT", 5
                # Close the separate OUT lease; input remains unconsumed.
                for p in list(s.packs.values()):
                    if p.lease == "ACCEPTED": s.callback(p.uid, 1, ABORTED, effective_cancel=True)
                s.recover("FULL", RequestFrame(32))
                self.assertEqual(s.diagnostic_totals["recovery_input_discard"], 1)
                cleanup(s)
            else:
                cleanup(s)
                self.assertEqual(s.diagnostic_totals["explicit_stop_input_discard"], 1)
            self.assertEqual(s.stats["IN"]["discarded_received_frames"], 96)
            self.assertEqual(s.fallback.phase, 0)

    def test_R4_late_success_discard_does_not_create_current_budget(self):
        s = running(); old = s.cycle().stages[0].uid
        s.state, s.reference_state = "RECOVERY_WAIT", 4
        s.recover("RESUME", RequestFrame(32), allow_old_leases=True)
        s.prequeue(1); current = tuple(s.rings["IN"])
        total = s.budget_totals["created_frames"]
        s.advance(17000); s.callback(old, 1, counts=[480]*8)
        self.assertEqual(tuple(s.rings["IN"]), current)
        self.assertEqual(s.budget_totals["created_frames"], total)
        self.assertEqual(s.diagnostic_totals["stale_input_discard"], 1)
        self.assertEqual(s.stats["IN"]["discarded_received_frames"], 96)
        cleanup(s)

    def test_R3_bounded_failed_submission_window_is_atomic(self):
        s = running(enabled=(False, True), capacity=1)
        s.cycle(out_fault=Fault(prepare_ok=False))
        self.assertEqual(s.get_data("OUT")[0], 5)
        s.collect()
        before = (dict(s.bus), s.out_offset)
        c = s.cycle(out_fault=Fault(prepare_ok=False))
        self.assertEqual(c.failure, "OUT_PACK")
        self.assertEqual(before, (dict(s.bus), s.out_offset))
        self.assertFalse(s.packs)
        self.assertEqual(s.diagnostic_totals["planned_slot_capacity"], 1)
        s.check(); cleanup(s)

    def test_R1_resume_preserves_nonzero_fallback(self):
        s = running(); self.assertEqual(s.fallback.effective(5), 11)
        s.state, s.reference_state = "RECOVERY_WAIT", 4
        s.recover("RESUME", RequestFrame(32))
        self.assertEqual(s.fallback.phase, 7904)
        self.assertEqual(s.fallback.effective(5), 12)
        self.assertEqual(s.fallback.phase, 7808)
        s.prequeue(8); self.assertEqual(s.state, "RUNNING")
        cleanup(s)

    def test_R2_full_reset_separates_accumulators(self):
        s = running(); s.fallback.effective(5); s.nominal_phase = 456; s.recovery_phase = 321
        s.state, s.reference_state = "RECOVERY_WAIT", 5
        s.recover("FULL", RequestFrame(32))
        self.assertEqual(s.fallback.phase, 0)
        self.assertEqual(s.nominal_phase, 0)
        self.assertEqual(s.fallback.effective(5), 11)
        self.assertEqual(s.fallback.phase, 7904)
        # Elapsed recovery time is a separate, explicitly assumed helper.
        before = s.fallback.phase; s.recovery_tick(5)
        self.assertEqual(s.fallback.phase, before)
        cleanup(s)

    def test_R3_stop_missing_callback_cannot_release(self):
        s = running(); c = s.cycle(); s.stop()
        uid = c.stages[0].uid; s.timeout(uid)
        self.assertTrue(s.packs[uid].cancellation_requested)
        self.assertEqual(s.owned(), 2)
        with self.assertRaisesRegex(ModelError, "unresolved_backend"): s.retire_for_stop()
        with self.assertRaisesRegex(ModelError, "unresolved_backend"): s.recover("FULL", RequestFrame(32))
        cleanup(s)

    def test_R4_stale_callback_only_resolves_old_lease(self):
        s = running(); c = s.cycle(); old = c.stages[0].uid
        s.state, s.reference_state = "RECOVERY_WAIT", 4
        s.recover("RESUME", RequestFrame(32), allow_old_leases=True)
        s.prequeue(1)
        before = (s.fallback.phase, s.shared_frames, dict(s.bus), tuple(s.rings["IN"]))
        self.assertTrue(s.callback(old, 1, ABORTED, effective_cancel=True))
        self.assertEqual(before, (s.fallback.phase, s.shared_frames, dict(s.bus), tuple(s.rings["IN"])))
        self.assertFalse(s.callback(old, 1, ABORTED))
        cleanup(s)

    def test_R5_partial_asymmetric_restoration_no_retry(self):
        for failed_index in (0, 2):
            s = running(); s.state, s.reference_state = "RECOVERY_WAIT", 4
            s.recover("RESUME", RequestFrame(32))
            cycles = s.prequeue(8, {failed_index: (Fault(), Fault(api_accepts=False))})
            self.assertEqual(len(cycles), failed_index + 1)
            self.assertEqual(s.owned("IN"), failed_index + 1)
            self.assertEqual(s.owned("OUT"), failed_index)
            self.assertEqual(s.prefill_iterations, failed_index)
            self.assertEqual(s.state, "RECOVERY_WAIT")
            self.assertEqual(s.out_offset, 3840 * (failed_index + 1))
            self.assertEqual(s.shared_frames, 0)
            cleanup(s)

    def test_R6_cross_generation_overlap_and_effective_cancel(self):
        s = running(); c = s.cycle(); old_out = c.stages[-1].uid
        s.state, s.reference_state = "RECOVERY_WAIT", 4
        s.recover("RESUME", RequestFrame(16), allow_old_leases=True)
        result = s.prequeue(1)
        self.assertEqual(result[0].failure, "IN_API")
        self.assertGreater(s.diagnostic_totals["bus_overlap"], 0)
        # Cancellation request alone does not remove future reservations.
        s.cancel(old_out)
        self.assertIn(("OUT", 128), s.reservations)
        s.callback(old_out, 1, ABORTED, effective_cancel=True)
        self.assertNotIn(("OUT", 128), s.reservations)
        cleanup(s)


class TimingAndArithmeticTests(unittest.TestCase):
    def test_T2_full_duplex_benchmark_smoke(self):
        from benchmark import benchmark
        result = benchmark(1000)
        self.assertEqual(result["shared_frames"], 96000)
        self.assertEqual(result["after_drain"]["pending_budgets"], 0)
        self.assertEqual(result["before_drain"]["directions"]["IN"]["backend_owned"], 1)

    def test_T1_typed_units_and_cursor_grid(self):
        self.assertEqual([x.value for x in slots(RequestFrame(3))], list(range(24, 32)))
        with self.assertRaisesRegex(ModelError, "request_frame_unit"): slots(TransactionSlot(3))
        s = running(); s.cycle()
        self.assertEqual(s.bus, {"IN": 17, "OUT": 17})
        self.assertEqual(sorted(k[1] for k in s.reservations if k[0] == "OUT"), list(range(128, 136)))
        cleanup(s)

    def test_T2_accepted96_returned20_depth76(self):
        s = Simulator(history_limit=16); s.prequeue(96); s.advance(36000)
        inputs = list(s.rings["IN"])
        for uid in inputs[:20]: s.callback(uid, 1, counts=[480] * 8)
        self.assertEqual(s.stats["IN"]["accepted"], 96)
        self.assertEqual(s.stats["IN"]["callbacks"], 20)
        self.assertEqual(s.owned("IN"), 76)
        self.assertEqual(s.stats["IN"]["retired"], 0)
        cleanup(s)

    def test_T3_submission_lead_holes_and_seeded_stalls(self):
        for now, succeeds in [(15000, True), (16000, True), (16001, False)]:
            s = running(enabled=(False, True)); s.advance(now)
            c = s.cycle()
            self.assertEqual(c.failure is None, succeeds)
            if not succeeds:
                self.assertEqual(s.snapshot()["directions"]["OUT"]["future_holes"], list(range(128, 136)))
            cleanup(s)
        a = list(completion_delays(32, seed=7, jitter_us=3000))
        self.assertEqual(a, list(completion_delays(32, seed=7, jitter_us=3000)))
        self.assertNotEqual(a, list(completion_delays(32, seed=8, jitter_us=3000)))
        for stall, accepts in [(2000, True), (10000, False)]:
            s = Simulator(enabled=(False, True)); s.prequeue(8)
            due = next(completion_delays(8, stall_start=17000, stall_us=stall))
            s.advance(due); s.callback(s.rings["OUT"][0], 1)
            self.assertEqual(s.cycle().failure is None, accepts)
            cleanup(s)

    def test_T3_bounded_events_and_tie_order(self):
        s = running(); events = Timeline(s, limit=2); order = []
        events.add(1000, lambda: order.append("later"), priority=1)
        events.add(1000, lambda: order.append("first"), priority=0)
        with self.assertRaises(ModelError): events.add(1000, lambda: None)
        events.run(); self.assertEqual(order, ["first", "later"])
        cleanup(s)

    def test_F1_threshold_real_11_13_and_persistence(self):
        f = Fallback()
        self.assertEqual([f.effective(n) for n in [5, 6, 11, 13, 5]], [11, 6, 11, 13, 12])
        self.assertEqual(f.phase, 7808)
        f = Fallback(); self.assertEqual(f.request([200] + [480]*7), 95)
        self.assertEqual(f.phase, 7904)
        self.assertEqual(f.request([480]*8), 96); self.assertEqual(f.phase, 7904)

    def test_F2_reference_floor_and_safe_alignment_atomicity(self):
        for n, expected in [(239, 95), (240, 48), (241, 48)]:
            f = Fallback(); self.assertEqual(f.request([n] * 8, strict=False), expected)
            f = Fallback()
            if n % 40:
                with self.assertRaises(ModelError): f.request([480]*7+[n])
                self.assertEqual(f.phase, 0)
            else: self.assertEqual(f.request([n]*8), expected)

    def test_F3_all_packet_vectors_and_invalid_values(self):
        expected = {0:(0,)*8, 1:(0,)*7+(1,), 95:(11,)+(12,)*7,
                    96:(12,)*8, 97:(12,)*7+(13,), 112:(14,)*8}
        for n in range(113):
            values = pack(n)
            self.assertEqual(sum(values), n)
            self.assertTrue(all(0 <= v*40 <= 560 for v in values))
            if n in expected: self.assertEqual(values, expected[n])
        for n in (-1, 113, True, 12.5):
            with self.assertRaises(ModelError): pack(n)

    def test_F4_8000_and_eight_million_substitutions(self):
        # Independent exact cumulative oracle and event positions for one period.
        f = Fallback(); values = [f.effective(0) for _ in range(8000)]
        self.assertEqual(values, [(k+1)*95904//8000-k*95904//8000 for k in range(8000)])
        self.assertEqual([i+1 for i,n in enumerate(values) if n==11], [1+250*j//3 for j in range(96)])
        self.assertEqual((values.count(11), values.count(12), sum(values), f.phase), (96,7904,95904,0))
        total = elevens = 0
        for _ in range(8000000):
            n = f.effective(0); total += n; elevens += n == 11
        self.assertEqual((total, elevens, f.phase), (95904000, 96000, 0))

    def test_F5_million_normal_input_requests(self):
        f = Fallback(); total = 0
        for _ in range(1000000): total += f.request((480,)*8)
        self.assertEqual((total, f.phase), (96000000, 0))

    def test_F5_bounded_recycling_and_diagnostics(self):
        s = running(enabled=(False, True), capacity=2, history_limit=4)
        for _ in range(10000):
            c = s.cycle(); uid = c.stages[0].uid
            s.advance(s.packs[uid].end_frame * 1000)
            s.callback(uid, 1); self.assertEqual(s.get_data("OUT")[0], 0)
            s.collect(); s.check()
        self.assertEqual(s.shared_frames, 960000)
        self.assertEqual(len(s.packs), 0)
        self.assertLessEqual(len(s.trace), 4)
        for _ in range(100): s.diagnostic("scripted")
        self.assertEqual((len(s.diagnostics), s.diagnostic_totals["scripted"]), (4,100))
        for i in range(1000): s.diagnostic("external_" + str(i))
        self.assertEqual(s.diagnostic_totals["OTHER"], 1000)
        self.assertLessEqual(len(s.diagnostic_totals), 13)
        cleanup(s)

    def test_F5_synthetic_drift_only_affects_input(self):
        for ppm, frames in [(-1000,95904),(0,96000),(1000,96096)]:
            counts = list(input_clock(8000, ppm))
            self.assertEqual(sum(counts)//40, frames)
            f = Fallback(); total = sum(f.request(counts[i:i+8]) for i in range(0,8000,8))
            self.assertEqual(total, frames); self.assertEqual(f.phase, 0)


if __name__ == "__main__": unittest.main()
