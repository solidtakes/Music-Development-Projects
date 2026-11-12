"""Independent oracles reject scoped in-memory mutants, never source changes."""
import unittest
from unittest.mock import patch
import arithmetic
from arithmetic import Fallback, ModelError, RequestFrame
from model import Simulator
from records import Fault, Transaction, REFERENCE, ABORTED
from test_model import running, first_input, cleanup


def fallback_oracle():
    f = Fallback()
    values = [f.effective(0) for _ in range(250)]
    assert values == [(i+1)*2997//250-i*2997//250 for i in range(250)]


def packing_oracle():
    assert arithmetic.pack(95) == (11,12,12,12,12,12,12,12)
    assert arithmetic.pack(1) == (0,0,0,0,0,0,0,1)
    assert arithmetic.pack(97) == (12,12,12,12,12,12,12,13)


def offset_oracle():
    s = running(); c = s.cycle(out_fault=Fault(api_accepts=False))
    assert c.failure == "OUT_API" and s.out_offset == 3840 and s.shared_frames == 0
    cleanup(s)


def ownership_oracle():
    s = running(profile=REFERENCE); uid = s.cycle().stages[0].uid
    s.observe(uid, [Transaction(0,480,1)]*8); s.advance(17000)
    assert s.get_data()[0] == 0
    assert s.packs[uid].lease == "ACCEPTED" and s.packs[uid].callback == "NOT_SEEN"
    cleanup(s)


def order_oracle():
    s = running(); c = s.cycle()
    assert [r.direction for r in c.stages] == ["IN", "OUT"]
    assert [e["direction"] for e in s.trace if e["kind"] == "submission_stage"] == ["IN","OUT"]
    cleanup(s)


def shared_oracle():
    s = running(); s.cycle(in_fault=Fault(api_accepts=False))
    assert s.shared_frames == 0 and s.shared_attempts == 0
    cleanup(s)


def stale_oracle():
    s = running(); old = s.cycle().stages[0].uid
    s.state, s.reference_state = "RECOVERY_WAIT", 4
    s.recover("RESUME", RequestFrame(32), allow_old_leases=True)
    s.prequeue(1)
    current = s.rings["IN"][0]
    assert s.callback(old, 1, ABORTED, effective_cancel=True)
    assert s.packs[old].generation == 1 and s.packs[old].lease == "RETURNED"
    assert s.packs[current].lease == "ACCEPTED"
    cleanup(s)


def duplicate_oracle():
    s = running(); uid = first_input(s); s.get_data(); s.consume(uid)
    try: s.consume(uid)
    except ModelError:
        cleanup(s); return
    raise AssertionError("duplicate input consumption")


def alignment_oracle():
    f = Fallback()
    try: f.request([241]*8)
    except ModelError:
        assert f.phase == 0; return
    raise AssertionError("silent truncation")


class MutationTests(unittest.TestCase):
    def test_M1_baseline_independent_oracles(self):
        for oracle in (fallback_oracle,packing_oracle,offset_oracle,ownership_oracle,
                       order_oracle,shared_oracle,stale_oracle,duplicate_oracle,alignment_oracle): oracle()

    def test_M1_wrong_accumulator_order(self):
        def broken(self, frames):
            if frames >= 6: return frames
            n = 11 + self.phase // 8000
            self.phase = (self.phase+7904) % 8000
            return n
        with patch.object(Fallback,"effective",broken):
            with self.assertRaises(AssertionError): fallback_oracle()

    def test_M1_cross_request_frame_carry(self):
        original = arithmetic.pack; calls = 0
        def broken(frames):
            nonlocal calls
            calls += 1
            return original(frames + (calls > 1))
        with patch.object(arithmetic,"pack",broken):
            with self.assertRaises(AssertionError): packing_oracle()

    def test_M1_early_lease_release(self):
        original = Simulator.get_data
        def broken(self,*args,**kwargs):
            code,p = original(self,*args,**kwargs)
            if code == 0: p.lease = "RETURNED"
            return code,p
        with patch.object(Simulator,"get_data",broken):
            with self.assertRaises(AssertionError): ownership_oracle()

    def test_M1_invented_offset_rollback(self):
        original = Simulator.send
        def broken(self,*args,**kwargs):
            r = original(self,*args,**kwargs)
            if r.direction == "OUT" and not r.ok: self.out_offset = r.offset_before
            return r
        with patch.object(Simulator,"send",broken):
            with self.assertRaises(AssertionError): offset_oracle()

    def test_M1_reversed_submission_order(self):
        original = Simulator.send
        def broken(self,direction,budget,fault=Fault()):
            previous = budget.disposition
            budget.disposition = "PENDING"
            actual = "OUT" if direction == "IN" else "IN"
            r = original(self,actual,budget,fault)
            if actual == "IN": budget.disposition = previous
            return r
        with patch.object(Simulator,"send",broken):
            with self.assertRaises(AssertionError): order_oracle()

    def test_M1_premature_shared_commit(self):
        original = Simulator._cycle
        def broken(self,b,*args,**kwargs):
            self._shared_commit(b.frames)
            return original(self,b,*args,**kwargs)
        with patch.object(Simulator,"_cycle",broken):
            with self.assertRaises(AssertionError): shared_oracle()

    def test_M1_stale_event_redirected_to_current_request(self):
        original = Simulator.callback
        def broken(self,uid,generation,*args,**kwargs):
            if generation != self.generation:
                uid = self.rings["IN"][0]; generation = self.generation
            return original(self,uid,generation,*args,**kwargs)
        with patch.object(Simulator,"callback",broken):
            with self.assertRaises(AssertionError): stale_oracle()

    def test_M1_duplicate_consumption(self):
        original = Simulator.consume
        def broken(self,uid,*args,**kwargs):
            self.packs[uid].consumed = False
            return original(self,uid,*args,**kwargs)
        with patch.object(Simulator,"consume",broken):
            with self.assertRaises(AssertionError): duplicate_oracle()

    def test_M1_silent_integer_truncation(self):
        original = Fallback.request
        def broken(self,counts,strict=True):
            return original(self,[n//40*40 for n in counts],strict)
        with patch.object(Fallback,"request",broken):
            with self.assertRaises(AssertionError): alignment_oracle()
