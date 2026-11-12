"""M9N-B CPU-only policy/reference model, not a DriverKit implementation.

Bus origin is a synthetic one-ms RequestFrame coordinate, not a proven historical
provider ABI. Recovery origins and readiness observations are explicit inputs.
Generation and ownership protections apply in both profiles as NEW safety policy.
"""
from collections import Counter, deque
from dataclasses import asdict
from arithmetic import Fallback, ModelError, RequestFrame, TransactionSlot, integer, nominal_budget, pack, slots
from records import (REFERENCE, SAFE, UNDERRUN, ABORTED, Fault, Transaction,
                     Pack, Budget, StageResult, Cycle)

TABLES = {
    "poll": (0x6ff4, 0x7048, 0x6f1b, 0x7048, 0x705a, 0x705a),
    "callback": (0x15f6e, 0x1607e, 0x15e81, 0x1607e, 0x16091, 0x16091),
    "timer": (0xdc01, 0xdc13, 0xd37d, 0xdc13, 0xf2f2, 0xf2f2),
}
DIAGNOSTIC_CODES = frozenset({
    "pack_capacity", "planned_slot_capacity", "bus_overlap", "missed_bus_origin",
    "unknown_or_duplicate_callback", "duplicate_or_unowned_callback",
    "stale_callback_cleanup", "missing_completion", "explicit_stop_input_discard",
    "recovery_input_discard", "stale_input_discard", "scripted", "OTHER",
})


def require(condition, reason):
    if not condition:
        raise ModelError(reason)


class Simulator:
    def __init__(self, profile=SAFE, enabled=(True, True), capacity=192,
                 history_limit=128, stream_bytes=844800, origin=RequestFrame(16)):
        require(profile in {REFERENCE, SAFE}, "profile")
        require(type(enabled) is tuple and len(enabled) == 2 and
                all(type(x) is bool for x in enabled), "direction_flags")
        integer(capacity, 1, 4096); integer(history_limit, 1, 4096)
        integer(stream_bytes, 4480, (1 << 31) - 1)
        require(stream_bytes % 40 == 0, "stream_alignment")
        slots(origin)
        self.profile, self.enabled, self.capacity = profile, enabled, capacity
        self.stream_bytes, self.history_limit = stream_bytes, history_limit
        self.generation, self.state, self.reference_state = 1, "PREQUEUE", 2
        self.now_us = 0
        self.bus = {"IN": origin.value, "OUT": origin.value}
        self.out_offset = 0
        self.shared_frames = 0
        self.shared_attempts = 0
        self.fallback = Fallback()
        self.nominal_phase = self.recovery_phase = 0
        self.packs = {}
        self.rings = {"IN": deque(), "OUT": deque()}
        self.budgets = {}
        self.reservations = {}  # (direction, absolute slot) -> uid; never generation-only
        self.planned = {"IN": set(), "OUT": set()}  # bounded current planned window
        self.trace = deque(maxlen=history_limit)
        self.diagnostics = deque(maxlen=history_limit)
        self.diagnostic_totals = Counter()
        self.trace_total = 0
        self.stats = {d: Counter() for d in ("IN", "OUT")}
        self.budget_totals = Counter()
        self.next_uid = self.next_budget = 1
        self.target = 0
        self.prefill_iterations = 0
        self.restoration = None

    def event(self, kind, **fields):
        self.trace_total += 1
        self.trace.append({"kind": kind, "generation": self.generation,
                           "time_us": self.now_us, **fields})

    def diagnostic(self, reason, **fields):
        code = reason if reason in DIAGNOSTIC_CODES else "OTHER"
        self.diagnostic_totals[code] += 1
        self.diagnostics.append({"reason": code, **fields})

    def _discard_input(self, p, reason):
        if p.direction == "IN" and not p.consumed and (
                p.retirement_code == 0 or p.callback in {"SUCCESS", "ERROR"} and p.saved_status == 0):
            received = sum(t.count // 40 for t in p.transactions)
            self.stats["IN"]["discarded_received_frames"] += received
            self.diagnostic(reason, uid=p.uid, received_frames=received)
            p.consumed = True

    def advance(self, time_us):
        integer(time_us)
        require(time_us >= self.now_us, "time_reversal")
        self.now_us = time_us
        # Past slots cannot be reused: submission rejects past origins. Dropping
        # past reservation metadata does not return a backend lease.
        self.reservations = {k: uid for k, uid in self.reservations.items()
                             if (k[1] + 1) * 125 > time_us}
        for direction in self.planned:
            self.planned[direction] = {slot for slot in self.planned[direction]
                                       if (slot + 1) * 125 > time_us}

    def owned(self, direction=None):
        return sum(p.lease in {"SUBMITTING", "ACCEPTED", "QUARANTINED"}
                   and (direction is None or p.direction == direction)
                   for p in self.packs.values())

    def _new_budget(self, frames, source, source_pack=None):
        pack(frames)
        require(len(self.budgets) < self.capacity * 2, "budget_capacity")
        if source_pack is not None:
            p = self.packs.get(source_pack)
            require(p is not None and p.generation == self.generation and not p.consumed,
                    "duplicate_or_unknown_input_consumption")
            p.consumed = True
        uid = self.next_budget; self.next_budget += 1
        b = Budget(uid, self.generation, frames, source, source_pack)
        self.budgets[uid] = b
        self.budget_totals["created_frames"] += frames
        self.budget_totals["created_count"] += 1
        return b

    def _finish_budget(self, bid, disposition):
        b = self.budgets[bid]
        require(b.disposition in {"PENDING", "SUBMITTED"}, "duplicate_budget_resolution")
        b.disposition = disposition
        self.budget_totals[disposition + "_frames"] += b.frames
        self.budget_totals[disposition + "_count"] += 1
        self.event("budget_terminal", budget=bid, frames=b.frames, outcome=disposition)
        del self.budgets[bid]

    def _acquire(self, direction, bid):
        count = sum(p.direction == direction for p in self.packs.values())
        require(count < self.capacity, "pack_capacity")
        uid = self.next_uid; self.next_uid += 1
        p = Pack(uid, self.generation, direction, self.bus[direction], bid)
        self.packs[uid] = p
        self.rings[direction].append(uid)
        self.stats[direction]["allocated_total"] += 1
        self.stats[direction]["peak_allocated"] = max(self.stats[direction]["peak_allocated"], count + 1)
        self.event("pack_reserved", uid=uid, direction=direction)
        return p

    def _stream_advance(self, frames):
        # Normal-domain reference: one bounded wrap, not silent uint32 overflow.
        self.out_offset = (self.out_offset + frames * 40) % self.stream_bytes

    def send(self, direction, budget, fault=Fault()):
        require(self.state in {"PREQUEUE", "RUNNING", "RESUME_PREPARE"}, "submission_state")
        require(direction in {"IN", "OUT"}, "direction")
        require(type(fault) is Fault, "fault_type")
        require(direction == "OUT" or fault.prepare_ok, "no_in_prepare_stage")
        before, offset = self.bus[direction], self.out_offset
        require(budget.uid in self.budgets and budget.disposition == "PENDING", "budget_assignment")
        if direction == "OUT":
            require(budget.out_pack is None, "duplicate_budget_assignment")
        self.stats[direction]["send_calls"] += 1
        if not fault.pack_available:
            return StageResult(direction, False, "PACK", None, before, before, offset, offset)
        future_slots = {s.value for s in slots(RequestFrame(before))}
        if len(self.planned[direction] | future_slots) > self.capacity * 8:
            # New safety policy: refuse before reservation/offset mutation when
            # the bounded scheduling-evidence window cannot record another call.
            self.diagnostic("planned_slot_capacity")
            return StageResult(direction, False, "PACK", None, before, before, offset, offset)
        try:
            p = self._acquire(direction, budget.uid if direction == "OUT" else None)
        except ModelError as error:
            if str(error) != "pack_capacity": raise
            self.diagnostic("pack_capacity")
            return StageResult(direction, False, "PACK", None, before, before, offset, offset)
        if direction == "OUT":
            budget.out_pack = p.uid
            if not fault.prepare_ok:
                stage = "PREPARATION"
            else:
                self._stream_advance(budget.frames)
                stage = "DESCRIPTOR" if not fault.descriptor_present else "API"
            p.frames = pack(budget.frames)
        else:
            stage = "DESCRIPTOR" if not fault.descriptor_present else "API"
        # Descriptor/preparation/API paths advance cursor; pack failure does not.
        self.bus[direction] += 1
        scheduled = slots(RequestFrame(p.origin))
        self.planned[direction].update(s.value for s in scheduled)
        # A stalled/rejected stream cannot grow the planned-window set forever.
        require(len(self.planned[direction]) <= self.capacity * 8, "planned_slot_capacity")
        ok = False
        if stage == "API":
            self.stats[direction]["api_attempts"] += 1
            p.lease = "SUBMITTING"
            conflict = any((direction, s.value) in self.reservations for s in scheduled)
            late = p.origin * 1000 < self.now_us
            ok = fault.api_accepts and not conflict and not late
            if conflict: self.diagnostic("bus_overlap", uid=p.uid)
            if late: self.diagnostic("missed_bus_origin", uid=p.uid)
            if ok:
                p.lease = "ACCEPTED"
                for s in scheduled: self.reservations[(direction, s.value)] = p.uid
                self.stats[direction]["accepted"] += 1
                self.stats[direction]["peak_owned"] = max(self.stats[direction]["peak_owned"], self.owned(direction))
                if direction == "OUT": budget.disposition = "SUBMITTED"
        if not ok:
            p.lease, p.active, p.saved_status = "RETURNED", False, -2
            self.stats[direction]["rejected_" + stage] += 1
        self.event("submission_stage", uid=p.uid, direction=direction, stage=stage, accepted=ok,
                   bus_before=before, bus_after=self.bus[direction], offset_before=offset,
                   offset_after=self.out_offset)
        return StageResult(direction, ok, stage, p.uid, before, self.bus[direction], offset, self.out_offset)

    def _shared_commit(self, frames):
        self.shared_attempts += 1
        self.shared_frames += frames
        self.event("shared_update_attempt", frames=frames)

    def _cycle(self, b, in_fault=Fault(), out_fault=Fault(), startup=False):
        cycle = Cycle(b.uid, b.frames, b.source, self.enabled)
        if not any(self.enabled):
            self._finish_budget(b.uid, "DROPPED")
            raise ModelError("directions_disabled")
        for enabled, direction, fault in zip(self.enabled, ("IN", "OUT"), (in_fault, out_fault)):
            if not enabled: continue
            result = self.send(direction, b, fault)
            cycle.stages.append(result)
            if not result.ok:
                cycle.failure, cycle.result_code = direction + "_" + result.stage, 5
                self._finish_budget(b.uid, "FAILED")
                self.event("cycle_failed", **asdict(cycle))
                return cycle
        if not self.enabled[1]: self._finish_budget(b.uid, "INPUT_ONLY")
        if not startup:
            self._shared_commit(b.frames)
            cycle.shared_attempted = True
        self.event("cycle_accepted", **asdict(cycle))
        return cycle

    def cycle(self, frames=96, in_fault=Fault(), out_fault=Fault()):
        # Explicit script input, never a fabricated received IN request.
        return self._cycle(self._new_budget(frames, "SCRIPTED"), in_fault, out_fault)

    def prequeue(self, target=96, faults=None):
        integer(target, high=self.capacity)
        require(self.state in {"PREQUEUE", "RESUME_PREPARE"}, "prefill_state")
        self.target, self.prefill_iterations = target, 0
        faults = {} if faults is None else faults
        cycles = []
        for i in range(target):
            frames, self.nominal_phase = nominal_budget(phase=self.nominal_phase)
            cycle = self._cycle(self._new_budget(frames, "PREFILL"),
                                *faults.get(i, (Fault(), Fault())), startup=True)
            cycles.append(cycle)
            if cycle.failure: break
            self.prefill_iterations += 1
        restored = self.prefill_iterations == target
        self.restoration = self.snapshot()
        self.state = "RUNNING" if restored else "RECOVERY_WAIT"
        self.reference_state = 3 if restored else self.reference_state
        return cycles

    def observe(self, uid, transactions, coherent=False):
        p = self.packs.get(uid)
        require(p is not None and p.generation == self.generation, "stale_observation")
        require(p.lease == "ACCEPTED" and p.callback == "NOT_SEEN", "observation_ownership")
        require(len(transactions) == 8 and all(type(t) is Transaction for t in transactions), "transaction_records")
        for t in transactions:
            integer(t.count, high=560); integer(t.timestamp)
            integer(t.status, -(1 << 31), (1 << 32) - 1)
        p.transactions, p.coherent = tuple(transactions), coherent

    def callback(self, uid, generation, status=0, counts=None, effective_cancel=False):
        p = self.packs.get(uid)
        if p is None or p.generation != generation:
            self.diagnostic("unknown_or_duplicate_callback", uid=uid)
            return False
        if p.callback != "NOT_SEEN" or p.lease != "ACCEPTED":
            self.diagnostic("duplicate_or_unowned_callback", uid=uid)
            return False
        integer(status, -(1 << 31), (1 << 32) - 1)
        require(not effective_cancel or status == ABORTED, "effective_cancel_status")
        if status != ABORTED:
            require(self.now_us >= p.end_frame * 1000, "early_callback")
        if counts is not None:
            require(len(counts) == 8, "transaction_count")
            for n in counts: integer(n, high=560)
        stale = generation != self.generation
        p.active, p.lease, p.saved_status = False, "RETURNED", status
        p.callback = "CANCELLED" if status == ABORTED else "SUCCESS" if status == 0 else "ERROR"
        if p.direction == "IN" and status == UNDERRUN:
            p.saved_status = 0  # Recovered IN callback normalization, not all statuses.
        if counts is not None:
            p.transactions = tuple(Transaction(0, n, max(1, self.now_us)) for n in counts)
        p.coherent = True
        if effective_cancel:
            p.cancellation_effective = True
            self.reservations = {k: v for k, v in self.reservations.items() if v != uid}
        self.stats[p.direction]["callbacks"] += 1
        self.stats[p.direction][p.callback] += 1
        if p.budget is not None and p.budget in self.budgets:
            self._finish_budget(p.budget, p.callback)
        if stale:
            self.diagnostic("stale_callback_cleanup", uid=uid)
            self._discard_input(p, "stale_input_discard")
            p.eligible, p.retired = False, True
        elif p.direction == "OUT" and self.enabled[0]:
            # Duplex OUT callback retires its eligibility; IN drives scheduling.
            p.eligible, p.retired = False, True
            try: self.rings["OUT"].remove(uid)
            except ValueError: pass
        self.event("callback", uid=uid, stale=stale, status=status)
        return True

    def get_data(self, direction="IN", now=None):
        require(direction in self.rings, "direction")
        if now is None: now = self.now_us // 1000
        integer(now, high=(1 << 63) - 4)
        ring = self.rings[direction]
        if not ring: return 2, None
        p = self.packs[ring[0]]
        require(p.generation == self.generation, "head_generation")
        if not p.eligible: return 2, p
        if p.active:
            if p.end_frame > now: return 2, p
            last = p.transactions[-1]
            ready = last.status in {0, UNDERRUN} and last.count != 0 and last.timestamp != 0
            if self.profile == SAFE:
                ready = ready and p.coherent and all(t.status == 0 and t.count % 40 == 0 for t in p.transactions)
            if not ready:
                return (3 if p.end_frame + 3 < now else 2), p
            code = 0
        else:
            code = (0 if p.saved_status in {0, UNDERRUN} else
                    4 if p.saved_status == ABORTED else
                    5 if p.saved_status == -2 else 1)
            if self.profile == SAFE and code == 0 and direction == "IN":
                require(all(t.status == 0 and t.count % 40 == 0 for t in p.transactions), "invalid_safe_input")
        p.eligible, p.retired, p.retirement_code = False, True, code
        ring.popleft()
        self.stats[direction]["retired"] += 1
        self.event("head_retired", uid=p.uid, code=code, backend_owned=p.lease == "ACCEPTED")
        return code, p

    def consume(self, uid, in_fault=Fault(), out_fault=Fault()):
        p = self.packs.get(uid)
        require(p is not None and p.direction == "IN" and p.generation == self.generation,
                "input_identity")
        require(p.retired and p.retirement_code == 0 and not p.consumed,
                "duplicate_or_unready_consumption")
        require(len(self.budgets) < self.capacity * 2, "budget_capacity")
        frames = self.fallback.request([t.count for t in p.transactions], self.profile == SAFE)
        b = self._new_budget(frames, "INPUT", p.uid)
        return self._cycle(b, in_fault, out_fault)

    def poll(self, caller="poll", in_fault=Fault(), out_fault=Fault()):
        # Prevent budget exhaustion from consuming a head without an accountable F.
        require(len(self.budgets) < self.capacity * 2, "budget_capacity")
        code, p = self.get_data()
        origin = "GET_DATA"
        cycle = None
        if code == 0:
            cycle = self.consume(p.uid, in_fault, out_fault)
            if cycle.failure: code, origin = 5, "SEND_NEXT"
        target = self.dispatch(code, caller)
        return {"code": code, "origin": origin, "target": target, "cycle": cycle}

    def dispatch(self, code, caller="poll"):
        integer(code, high=5)
        require(caller in TABLES, "caller")
        if self.reference_state == 3 and code in {1, 3}:
            self.reference_state, self.state = 4, "RECOVERY_WAIT"
        elif self.reference_state == 3 and code in {4, 5}:
            self.reference_state, self.state = 5, "RECOVERY_WAIT"
        self.event("dispatch", code=code, caller=caller, target=TABLES[caller][code], state=self.reference_state)
        return TABLES[caller][code]

    def collect(self):
        for uid, p in list(self.packs.items()):
            pending = p.direction == "IN" and p.retirement_code == 0 and not p.consumed
            if p.retired and p.lease == "RETURNED" and not pending:
                require(all(uid not in ring for ring in self.rings.values()), "ring_still_references_pack")
                del self.packs[uid]

    def cancel(self, uid):
        p = self.packs[uid]
        require(p.lease == "ACCEPTED", "cancel_ownership")
        p.cancellation_requested = True
        self.event("cancellation_requested", uid=uid)

    def timeout(self, uid):
        require(uid in self.packs, "request_identity")
        self.diagnostic("missing_completion", uid=uid)

    def stop(self):
        self.state = "DRAINING"
        for p in self.packs.values():
            if p.lease == "ACCEPTED": self.cancel(p.uid)

    def retire_for_stop(self):
        require(self.state == "DRAINING", "stop_state")
        require(self.owned() == 0, "unresolved_backend_ownership")
        for p in self.packs.values():
            p.eligible, p.retired = False, True
            self._discard_input(p, "explicit_stop_input_discard")
        for ring in self.rings.values(): ring.clear()
        self.collect()
        require(not self.budgets and not self.packs, "unresolved_stop_records")
        self.state = "STOPPED"

    def recover(self, kind, origin, allow_old_leases=False):
        require(kind in {"RESUME", "FULL"}, "recovery_kind")
        slots(origin)
        require(self.state in {"RECOVERY_WAIT", "DRAINING", "STOPPED"}, "recovery_state")
        if kind == "RESUME":
            require(self.reference_state == 4, "resume_reference_state")
        require(not self.owned() or allow_old_leases, "unresolved_backend_ownership")
        # allow_old_leases is a fault-injection SAFETY extension, never a claim
        # that Roland resumes with nonzero active counts. Old intervals remain owned.
        before = self.fallback.phase
        self.generation += 1
        self.rings = {"IN": deque(), "OUT": deque()}
        for p in self.packs.values():
            if p.lease == "RETURNED":
                p.eligible, p.retired = False, True
                self._discard_input(p, "recovery_input_discard")
        self.collect()
        self.bus = {"IN": origin.value, "OUT": origin.value}
        if kind == "FULL": self.fallback = Fallback()
        self.nominal_phase = 0
        self.state = "RESUME_PREPARE" if kind == "RESUME" else "PREQUEUE"
        self.event("recovery", kind_name=kind, fallback_before=before, fallback_after=self.fallback.phase,
                   origin=origin.value, old_leases=self.owned())

    def recovery_tick(self, elapsed_frames):
        integer(elapsed_frames, high=1000000)
        # Labeled synthetic elapsed-time helper, distinct from all OUT budgets.
        frames, self.recovery_phase = divmod(96000 * elapsed_frames + self.recovery_phase, 1000)
        self.shared_frames += frames
        self.event("synthetic_recovery_time", frames=frames)
        return frames

    def snapshot(self):
        directions = {}
        for d in self.bus:
            ids = [p for p in self.packs.values() if p.direction == d]
            covered = {s for (direction, s) in self.reservations if direction == d}
            planned = self.planned[d]
            directions[d] = {**dict(self.stats[d]), "allocated_live": len(ids),
                             "backend_owned": self.owned(d), "head": self.rings[d][0] if self.rings[d] else None,
                             "cursor_request_frame": self.bus[d],
                             "future_holes": sorted(planned - covered),
                             "start_lead_us": {p.uid: p.origin * 1000 - self.now_us for p in ids if p.lease == "ACCEPTED"},
                             "furthest_end_lead_us": max([0] + [p.end_frame * 1000 - self.now_us for p in ids if p.lease == "ACCEPTED"])}
        return {"profile": self.profile, "generation": self.generation, "state": self.state,
                "reference_state": self.reference_state, "now_us": self.now_us,
                "target": self.target, "prefill_iterations": self.prefill_iterations,
                "out_offset_bytes": self.out_offset, "shared_frames": self.shared_frames,
                "shared_attempts": self.shared_attempts, "fallback_phase": self.fallback.phase,
                "directions": directions, "budget_totals": dict(self.budget_totals),
                "pending_budgets": len(self.budgets), "diagnostic_totals": dict(self.diagnostic_totals),
                "retained_trace": len(self.trace), "trace_total": self.trace_total}

    def check(self, final=False):
        require(0 <= self.fallback.phase < 8000, "fallback_invariant")
        require(0 <= self.out_offset < self.stream_bytes and self.out_offset % 40 == 0, "offset_invariant")
        for d in self.rings:
            require(sum(p.direction == d for p in self.packs.values()) <= self.capacity, "capacity_invariant")
            require(len(self.planned[d]) <= self.capacity * 8, "planned_bound")
            require(len(self.rings[d]) == len(set(self.rings[d])), "duplicate_ring_entry")
            for uid in self.rings[d]:
                require(uid in self.packs and self.packs[uid].generation == self.generation and
                        not self.packs[uid].retired, "head_identity_invariant")
        terminal = sum(n for key, n in self.budget_totals.items() if key.endswith("_frames") and key != "created_frames")
        require(self.budget_totals["created_frames"] == terminal + sum(b.frames for b in self.budgets.values()), "budget_conservation")
        for p in self.packs.values():
            require(not (p.callback != "NOT_SEEN" and p.lease != "RETURNED"), "callback_lease_invariant")
            if p.frames:
                require(len(p.frames) == 8 and all(type(n) is int and 0 <= n <= 14 for n in p.frames), "packet_limit")
            if p.budget in self.budgets:
                require(sum(p.frames) == self.budgets[p.budget].frames, "packing_conservation")
        require(len(self.budgets) <= self.capacity * 2 and len(self.trace) <= self.history_limit and
                len(self.diagnostics) <= self.history_limit and len(self.reservations) <= self.capacity * 16,
                "resource_bound")
        if final:
            require(not self.packs and not self.budgets and self.owned() == 0, "unresolved_final_state")
        return True
