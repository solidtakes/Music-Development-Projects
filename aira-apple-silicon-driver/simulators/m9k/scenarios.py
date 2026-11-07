"""Representative machine-readable evidence; no file or device operations."""
from simulator import Simulator, completion_times


def evidence():
    records = {}
    for target in (8, 32, 96):
        s = Simulator(target=target)
        s.start(); s.prefill("IN"); s.prefill("OUT"); s.finish_prefill()
        records[f"nominal_prefill_T{target}"] = s.snapshot()
        s.check()
    s = Simulator(target=96)
    s.start(); s.prefill("OUT"); s.advance(20000)
    for i in range(20):
        s.complete(f"g1-OUT-prefill-{i}", 1)
        s.release(f"g1-OUT-prefill-{i}")
    s.finish_prefill(); s.check()
    records["accepted96_completed20_outstanding76"] = s.snapshot()
    s = Simulator(target=96)
    s.start(); s.prefill("IN", reject_at=2); s.prefill("OUT", reject_at=3)
    s.finish_prefill(); s.check()
    records["partial_asymmetric_prefill"] = s.snapshot()
    for stall in (2000, 10000):
        s = Simulator(target=8)
        s.start(); s.prefill("OUT")
        due = completion_times(8, stall_at=1000, stall_us=stall)[0]
        s.advance(due); s.complete("g1-OUT-prefill-0", 1)
        s.allocate("replacement", "OUT", 64, s.budget())
        s.submit("replacement"); s.check()
        records[f"stall_{stall}us"] = {"snapshot": s.snapshot(),
                                      "diagnostics": s.diagnostics}
    return records
