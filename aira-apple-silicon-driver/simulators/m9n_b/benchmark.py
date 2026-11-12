"""Full CPU-only duplex completion -> consumption -> replacement benchmark."""
import time
from arithmetic import RequestFrame, integer
from model import Simulator, require
from records import ABORTED


def benchmark(requests=1000000, progress=None):
    integer(requests, 1, 10000000)
    s = Simulator(capacity=2, history_limit=32, origin=RequestFrame(16))
    s.prequeue(1)  # One nominal seed, no shared-position update.
    in_uid, out_uid = s.rings["IN"][0], s.rings["OUT"][0]
    wall, cpu = time.perf_counter(), time.process_time()
    for i in range(requests):
        s.advance(s.packs[in_uid].end_frame * 1000)
        s.callback(in_uid, s.generation, counts=(480,)*8)
        s.callback(out_uid, s.generation)
        result = s.poll()
        require(result["code"] == 0 and result["cycle"].frames == 96, "benchmark_cycle")
        in_uid, out_uid = (r.uid for r in result["cycle"].stages)
        s.collect()
        if i % 10000 == 0: s.check()
        if progress is not None and (i + 1) % 100000 == 0:
            progress(i + 1)
    cpu_seconds, wall_seconds = time.process_time()-cpu, time.perf_counter()-wall
    require(s.shared_frames == requests*96 and s.shared_attempts == requests, "benchmark_shared")
    require(s.fallback.phase == 0 and s.owned("IN") == s.owned("OUT") == 1, "benchmark_depth")
    before_drain = s.snapshot()
    s.stop()
    for p in list(s.packs.values()):
        if p.lease == "ACCEPTED": s.callback(p.uid,p.generation,ABORTED,effective_cancel=True)
    s.retire_for_stop(); s.check(final=True)
    return {"status":"PASS","requests_consumed":requests,
            "transactions_consumed":requests*8,"input_frames":requests*96,
            "shared_frames":s.shared_frames,"nominal_seed_requests_per_direction":1,
            "final_pending_pair_explicitly_cancelled":True,
            "wall_seconds":wall_seconds,"process_cpu_seconds":cpu_seconds,
            "requests_per_wall_second":requests/wall_seconds,
            "before_drain":before_drain,"after_drain":s.snapshot(),
            "qualifier":"CPU model throughput; no physical timing, clock-lock or device performance claim"}
