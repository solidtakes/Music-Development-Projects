#include "core/v3/diag_engine.hpp"
#include <cassert>
#include <vector>
#include <cstdio>
using namespace demora;
struct Fake final : IsochInBackend {
  std::vector<unsigned> slots;
  std::vector<int64_t> ids;
  int submit(uint32_t slot, int64_t id) override { slots.push_back(slot); ids.push_back(id); return kOk; }
  int abort_pipe_synchronously() override { return 0; }
};
int main() {
  Fake b;
  DiagConfig cfg; cfg.max_transfers=2; cfg.reclaim_policy=ReclaimPolicy::Pin;
  DiagEngine<1> e(b,cfg);
  assert(e.start(1));
  assert(b.slots.size()==1 && b.slots[0]==0);
  FrameRec fr[kEntries] = {};
  for (auto& f : fr) { f.request_count=560; f.complete_count=560; }
  e.on_completion(0,e.s.generation(),b.ids[0],0,fr,2);
  assert(b.slots.size()==2 && b.slots[1]==0);
  assert(b.ids[0]!=b.ids[1]);
  std::printf("policy=Pin first_slot=%u second_slot=%u first_id=%lld second_id=%lld\n",b.slots[0],b.slots[1],(long long)b.ids[0],(long long)b.ids[1]);
}
