"""CPU-only, count-only M9K model. No device or audio APIs.

Recovery, strict alignment, ordered IN consumption and packing phase are model
policies, not claims about Roland runtime behavior. Time is integer microseconds.
"""
from dataclasses import dataclass
import heapq
import random

FRAME_BYTES = 40
TRANSACTIONS = 8
SLOT_US = 125
TERMINAL = {"COMPLETED", "FAILED", "CANCELLED", "REJECTED"}


class Violation(ValueError):
    pass


def invariant(condition, message="invariant violation"):
    if not condition:
        raise AssertionError(message)


def pack_frames(frames):
    if type(frames) is not int or not 0 <= frames <= 112:
        raise Violation("endpoint_capacity")
    return tuple((i + 1) * frames // 8 - i * frames // 8 for i in range(8))


@dataclass
class Fallback:
    accumulator: int = 0

    def count(self, received_frames):
        if received_frames >= 6:
            return received_frames
        self.accumulator += 7904
        extra, self.accumulator = divmod(self.accumulator, 8000)
        return 11 + extra


@dataclass
class Budget:
    id: int
    generation: int
    frames: int
    source: str
    state: str = "CREATED"
    request: str | None = None
    reason: str | None = None


@dataclass
class Request:
    id: str
    generation: int
    direction: str
    start_slot: int
    budget: int | None = None
    state: str = "ALLOCATED"
    released: bool = False
    accepted: bool = False
    attempted: bool = False
    consumed: bool = False
    counts: tuple = ()
    output_frames: tuple = ()

    @property
    def end_us(self):
        return (self.start_slot + TRANSACTIONS) * SLOT_US


class Simulator:
    """Explicit allocation, submission, ownership and historical bus ledgers.

    Capacity is per direction. Rejected submissions are terminal allocations,
    requiring explicit release. Timeout does not return ownership. Default
    failure policy records holes and continues; it never retries or repays debt.
    IN processing is ordered by scheduled request origin within a generation.
    """
    def __init__(self, capacity=192, target=96, strict_alignment=True,
                 minimum_lead_us=0):
        if type(capacity) is not int or capacity <= 0:
            raise Violation("capacity")
        if type(target) is not int or target < 0:
            raise Violation("target")
        if type(minimum_lead_us) is not int or minimum_lead_us < 0:
            raise Violation("minimum_lead")
        self.capacity, self.target = capacity, target
        self.strict_alignment = strict_alignment
        self.minimum_lead_us = minimum_lead_us
        self.generation = 1
        self.now = 0
        self.state = "STOPPED"
        self.fallback = Fallback()
        self.requests = {}
        self.budgets = {}
        self.slots = {}
        self.expected_slots = set()
        self.diagnostics = []
        self.history = []
        self.prefill_iterations = {"IN": 0, "OUT": 0}
        self.prefill_end = {}
        self.peak = {"IN": 0, "OUT": 0}
        self.cursors = {"IN": 0, "OUT": 0}

    def start(self):
        if self.state != "STOPPED":
            raise Violation("engine_state")
        self.state = "PREFILL"

    def advance(self, time_us):
        if type(time_us) is not int or time_us < self.now:
            raise Violation("time_reversal")
        self.now = time_us

    def diagnostic(self, code, request=None):
        self.diagnostics.append({"time_us": self.now, "code": code,
                                 "request": request})

    def budget(self, frames=96, source="PREFILL"):
        if type(frames) is not int or frames < 0:
            raise Violation("budget")
        bid = len(self.budgets) + 1
        self.budgets[bid] = Budget(bid, self.generation, frames, source)
        return bid

    def drop(self, bid, reason):
        b = self.budgets[bid]
        if b.generation != self.generation or b.state != "CREATED":
            raise Violation("budget_ownership")
        b.state, b.reason = "DROPPED", reason

    def allocate(self, rid, direction, start_slot, bid=None):
        if self.state not in {"PREFILL", "RUNNING"}:
            raise Violation("engine_state")
        if rid in self.requests:
            raise Violation("duplicate_request")
        if direction not in {"IN", "OUT"} or type(start_slot) is not int or start_slot < 0:
            raise Violation("request_geometry")
        active = sum(not r.released and r.direction == direction
                     for r in self.requests.values())
        if active >= self.capacity:
            raise Violation("allocation_capacity")
        if direction == "OUT":
            if bid not in self.budgets:
                raise Violation("missing_budget")
            b = self.budgets[bid]
            if b.generation != self.generation or b.state != "CREATED":
                raise Violation("duplicate_budget_assignment")
            packed = pack_frames(b.frames)
            b.state, b.request = "ASSIGNED", rid
        else:
            if bid is not None:
                raise Violation("input_budget")
            packed = ()
        r = Request(rid, self.generation, direction, start_slot, bid,
                    output_frames=packed)
        self.requests[rid] = r
        return r

    def submit(self, rid, accept=True):
        r = self.requests[rid]
        if self.state not in {"PREFILL", "RUNNING"} or r.generation != self.generation:
            raise Violation("engine_state")
        if r.state != "ALLOCATED":
            raise Violation("duplicate_submission")
        keys = [(r.generation, r.direction, s)
                for s in range(r.start_slot, r.start_slot + 8)]
        if any(k in self.slots for k in keys):
            raise Violation("overlapping_bus_slots")
        r.attempted = True
        self.expected_slots.update(keys)
        self.cursors[r.direction] = max(self.cursors[r.direction], r.start_slot + 8)
        lead = r.start_slot * SLOT_US - self.now
        reason = ("missed_bus_slots" if lead < 0 else
                  "insufficient_lead" if lead < self.minimum_lead_us else
                  "submission_rejected" if not accept else None)
        if reason:
            r.state = "REJECTED"
            if r.budget is not None:
                b = self.budgets[r.budget]
                b.state, b.reason = "REJECTED", reason
            self.diagnostic(reason, rid)
            self._record()
            return False
        for k in keys:
            self.slots[k] = rid
        r.state, r.accepted = "ACCEPTED", True
        if r.budget is not None:
            self.budgets[r.budget].state = "SUBMITTED"
        self._record()
        return True

    def abandon(self, rid, reason):
        """Resolve an unsubmitted allocation without claiming a submission attempt."""
        r = self.requests[rid]
        if r.state != "ALLOCATED" or r.generation != self.generation:
            raise Violation("allocation_ownership")
        r.state = "CANCELLED"
        if r.budget is not None:
            b = self.budgets[r.budget]
            b.state, b.reason = "CANCELLED", reason
        self.diagnostic("allocation_abandoned:" + reason, rid)
        self._record()

    def _owned(self, rid, generation):
        if generation != self.generation:
            self.diagnostic("stale_generation", rid)
            return None
        r = self.requests.get(rid)
        if r is None or r.generation != generation:
            self.diagnostic("unknown_request", rid)
            return None
        if r.state != "ACCEPTED":
            self.diagnostic("duplicate_or_unowned_completion", rid)
            return None
        return r

    def complete(self, rid, generation, outcome="COMPLETED", counts=None,
                 transaction_statuses=None):
        r = self._owned(rid, generation)
        if r is None:
            return False
        if outcome not in {"COMPLETED", "FAILED", "CANCELLED"}:
            raise Violation("terminal_outcome")
        if outcome != "CANCELLED" and self.now < r.end_us:
            raise Violation("completion_before_bus_end")
        if r.direction == "IN" and outcome == "COMPLETED":
            if counts is None or len(counts) != 8:
                raise Violation("transaction_count")
            if any(type(n) is not int or not 0 <= n <= 560 for n in counts):
                raise Violation("input_packet_limit")
            if self.strict_alignment and any(n % 40 for n in counts):
                raise Violation("frame_alignment")
            if any(n % 40 for n in counts):
                self.diagnostic("unaligned_floor_emulation", rid)
            statuses = (0,) * 8 if transaction_statuses is None else transaction_statuses
            if len(statuses) != 8 or any(type(n) is not int for n in statuses):
                raise Violation("transaction_statuses")
            if any(statuses):
                outcome = "FAILED"
            else:
                r.counts = tuple(counts)
        r.state = outcome
        if r.budget is not None:
            self.budgets[r.budget].state = outcome
        self._record()
        return True

    def consume_in(self, rid):
        r = self.requests[rid]
        if r.generation != self.generation or r.direction != "IN":
            raise Violation("input_ownership")
        if r.consumed:
            raise Violation("duplicate_input_consumption")
        if r.state != "COMPLETED":
            raise Violation("input_not_complete")
        earlier = [p for p in self.requests.values()
                   if p.generation == r.generation and p.direction == "IN"
                   and p.start_slot < r.start_slot and not p.consumed]
        if earlier:
            self.diagnostic("head_of_line_blocked", rid)
            return None
        frames = sum(self.fallback.count(n // FRAME_BYTES) for n in r.counts)
        r.consumed = True
        return self.budget(frames, rid)

    def timeout(self, rid):
        r = self.requests[rid]
        if r.state == "ACCEPTED":
            self.diagnostic("missing_completion", rid)
        self._record()

    def discard_in(self, rid, reason):
        r = self.requests[rid]
        if r.direction != "IN" or r.state not in TERMINAL or r.consumed:
            raise Violation("input_discard_ownership")
        r.consumed = True
        self.diagnostic("input_discarded:" + reason, rid)

    def release(self, rid):
        r = self.requests[rid]
        if r.state not in TERMINAL or r.released:
            raise Violation("release_without_ownership_return")
        r.released = True

    def finish_prefill(self):
        if self.state != "PREFILL":
            raise Violation("engine_state")
        self.prefill_end = self.snapshot()
        self.state = "RUNNING"

    def begin_drain(self):
        if self.state not in {"PREFILL", "RUNNING", "FAULTED"}:
            raise Violation("engine_state")
        self.state = "DRAINING"

    def fault(self, reason):
        if self.state not in {"PREFILL", "RUNNING"}:
            raise Violation("engine_state")
        self.state = "FAULTED"
        self.diagnostic("fault:" + reason)

    def stop(self):
        if self.state != "DRAINING":
            raise Violation("engine_state")
        self.check(final=True)
        self.state = "STOPPED"

    def prefill(self, direction, start_slot=0, reject_at=None):
        self.expected_slots.update((self.generation, direction, s)
                                   for s in range(start_slot, start_slot + 8 * self.target))
        for i in range(self.target):
            rid = f"g{self.generation}-{direction}-prefill-{i}"
            bid = self.budget() if direction == "OUT" else None
            self.allocate(rid, direction, start_slot + 8 * i, bid)
            accepted = self.submit(rid, accept=i != reject_at)
            if not accepted:
                break
            self.prefill_iterations[direction] += 1

    def restart(self):
        if any(not r.released for r in self.requests.values()):
            raise Violation("unresolved_allocations")
        if any(b.state in {"CREATED", "ASSIGNED", "SUBMITTED"}
               for b in self.budgets.values()):
            raise Violation("unresolved_budgets")
        self.generation += 1
        self.fallback = Fallback()
        self.state = "STOPPED"
        self.peak = {"IN": 0, "OUT": 0}
        self.prefill_iterations = {"IN": 0, "OUT": 0}
        self.prefill_end = {}
        self.cursors = {"IN": 0, "OUT": 0}
        self.start()

    def snapshot(self):
        result = {"time_us": self.now, "generation": self.generation,
                  "state": self.state, "target": self.target, "directions": {}}
        for d in ("IN", "OUT"):
            rs = [r for r in self.requests.values()
                  if r.generation == self.generation and r.direction == d]
            outstanding = [r for r in rs if r.state == "ACCEPTED"]
            keys = {k for k in self.expected_slots
                    if k[:2] == (self.generation, d)}
            slots = sorted(k[2] for k in keys)
            # Include unattempted gaps between scheduled requests, as well as
            # attempted-but-rejected slots. Historical holes stay visible.
            span = range(slots[0], slots[-1] + 1) if slots else ()
            holes = [s for s in span if (self.generation, d, s) not in self.slots]
            result["directions"][d] = {
                "allocated_total": len(rs),
                "allocated_live": sum(not r.released for r in rs),
                "attempts": sum(r.attempted for r in rs),
                "accepted": sum(r.accepted for r in rs),
                "completed": sum(r.state == "COMPLETED" for r in rs),
                "failed": sum(r.state == "FAILED" for r in rs),
                "cancelled": sum(r.accepted and r.state == "CANCELLED" for r in rs),
                "abandoned_allocations": sum(not r.attempted and r.state == "CANCELLED" for r in rs),
                "rejected": sum(r.state == "REJECTED" for r in rs),
                "outstanding": len(outstanding), "peak_outstanding": self.peak[d],
                "prefill_iterations": self.prefill_iterations[d],
                "cursor_slot": self.cursors[d], "holes": holes,
                "start_lead_us": {r.id: r.start_slot * 125 - self.now
                                  for r in outstanding},
                "furthest_end_lead_us": max(
                    [0] + [r.end_us - self.now for r in outstanding]),
            }
        bs = [b for b in self.budgets.values() if b.generation == self.generation]
        derived = [b for b in bs if b.source != "PREFILL"]
        result["budgets"] = {
            "by_state": {s: sum(b.frames for b in bs if b.state == s)
                         for s in {"CREATED", "ASSIGNED", "SUBMITTED", "COMPLETED",
                                   "REJECTED", "FAILED", "CANCELLED", "DROPPED"}},
            "input_consumed_frames": sum(b.frames for b in derived),
            "derived_output_accepted_frames": sum(
                b.frames for b in derived if b.request is not None
                and self.requests[b.request].accepted),
        }
        result["budgets"]["accepted_minus_consumed_frames"] = (
            result["budgets"]["derived_output_accepted_frames"]
            - result["budgets"]["input_consumed_frames"])
        return result

    def _record(self):
        for d in self.peak:
            depth = sum(r.generation == self.generation and r.direction == d
                        and r.state == "ACCEPTED" for r in self.requests.values())
            self.peak[d] = max(self.peak[d], depth)
        self.history.append(self.snapshot())

    def check(self, final=False):
        invariant(0 <= self.fallback.accumulator < 8000, "fallback bounds")
        for d, x in self.snapshot()["directions"].items():
            invariant(x["allocated_live"] <= self.capacity, "allocation capacity")
            invariant(x["outstanding"] <= self.capacity, "outstanding capacity")
            invariant(x["accepted"] == sum(x[k] for k in
                      ("outstanding", "completed", "failed", "cancelled")), "ownership accounting")
        sources = []
        for b in self.budgets.values():
            if b.source != "PREFILL":
                key = (b.generation, b.source)
                invariant(key not in sources, "duplicate input budget")
                sources.append(key)
            if b.request is not None:
                r = self.requests[b.request]
                invariant(r.budget == b.id and r.generation == b.generation, "budget ownership")
                invariant(sum(r.output_frames) == b.frames, "frame conservation")
                invariant(len(r.output_frames) == 8, "OUT transaction count")
                invariant(all(type(n) is int and 0 <= n * 40 <= 560
                              for n in r.output_frames), "OUT packet limits")
            if final:
                invariant(b.state not in {"CREATED", "ASSIGNED", "SUBMITTED"}, "unresolved budget")
        for key, rid in self.slots.items():
            r = self.requests[rid]
            invariant(r.accepted and key[:2] == (r.generation, r.direction), "slot owner")
            invariant(r.start_slot <= key[2] < r.start_slot + 8, "slot interval")
        for r in self.requests.values():
            if r.accepted:
                invariant(all(self.slots.get((r.generation, r.direction, slot)) == r.id
                              for slot in range(r.start_slot, r.start_slot + 8)), "missing slot reservation")
            if r.budget is not None:
                b = self.budgets[r.budget]
                expected = {"ALLOCATED": "ASSIGNED", "ACCEPTED": "SUBMITTED"}.get(r.state, r.state)
                invariant(b.state == expected, "budget lifecycle")
        if final:
            invariant(not any(r.direction == "IN" and r.state == "COMPLETED"
                              and not r.consumed for r in self.requests.values()), "unconsumed input")
            invariant(not any(r.state == "ACCEPTED" or not r.released
                              for r in self.requests.values()), "unresolved request")
        return True


class Timeline:
    """Stable, integer-time event queue; priority explicitly resolves ties."""
    def __init__(self, simulator):
        self.simulator = simulator
        self.events = []
        self.sequence = 0

    def add(self, time_us, action, priority=0):
        if type(time_us) is not int or time_us < self.simulator.now:
            raise Violation("event_in_past")
        heapq.heappush(self.events, (time_us, priority, self.sequence, action))
        self.sequence += 1

    def run(self):
        while self.events:
            time_us, _, _, action = heapq.heappop(self.events)
            self.simulator.advance(time_us)
            action()
            self.simulator.check()


def input_clock_counts(transactions, ppm=0):
    """Synthetic input source only; never an OUT-budget generator."""
    if type(transactions) is not int or transactions < 0 or type(ppm) is not int or abs(ppm) > 10000:
        raise Violation("clock_parameters")
    phase = 0
    result = []
    for _ in range(transactions):
        frames, phase = divmod(phase + 12 * (1_000_000 + ppm), 1_000_000)
        result.append(frames * 40)
    return result


def completion_times(requests, seed=0, jitter_us=0, stall_at=None, stall_us=0):
    """Seeded delay jitter. A stall holds affected completions until its end."""
    if min(requests, jitter_us, stall_us) < 0:
        raise Violation("timing_parameters")
    rng = random.Random(seed)
    result = []
    for i in range(requests):
        due = (i + 1) * 1000 + rng.randrange(jitter_us + 1)
        if stall_at is not None and stall_at <= due < stall_at + stall_us:
            due = stall_at + stall_us
        result.append(due)
    return result
