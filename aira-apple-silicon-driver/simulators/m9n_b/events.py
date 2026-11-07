"""Bounded deterministic event queue and synthetic completion delay policies."""
import heapq
import random
from arithmetic import integer, ModelError


class Timeline:
    def __init__(self, simulator, limit=1024):
        integer(limit, 1, 100000)
        self.simulator, self.limit = simulator, limit
        self.queue = []
        self.sequence = 0

    def add(self, at_us, action, priority=0):
        integer(at_us); integer(priority, -1000, 1000)
        if len(self.queue) >= self.limit: raise ModelError("event_capacity")
        if at_us < self.simulator.now_us: raise ModelError("event_in_past")
        heapq.heappush(self.queue, (at_us, priority, self.sequence, action))
        self.sequence += 1

    def run(self):
        while self.queue:
            at_us, _, _, action = heapq.heappop(self.queue)
            self.simulator.advance(at_us)
            action()
            self.simulator.check()


def completion_delays(count, seed=0, jitter_us=0, stall_start=None, stall_us=0,
                      origin_frame=16):
    integer(count, high=100000); integer(jitter_us); integer(stall_us)
    integer(origin_frame)
    if stall_start is not None: integer(stall_start)
    rng = random.Random(seed)
    for i in range(count):
        time = (origin_frame + i + 1) * 1000 + rng.randrange(jitter_us + 1)
        if stall_start is not None and stall_start <= time < stall_start + stall_us:
            time = stall_start + stall_us
        yield time
