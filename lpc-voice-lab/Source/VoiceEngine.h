#pragma once

#include "NuVoCore.h"

#include <algorithm>
#include <array>
#include <climits>

namespace lpc
{
enum class VoiceMode { talkBox, nuVo };

// The original core and its parameter tapers are unchanged. In steady state
// only the selected core runs, and TalkBox output passes through untouched.
//
// A mode change is a crossfade, never a dropout. The incoming core starts from
// cleared history (inactive-mode tails cannot reappear), so it is silent until
// its fixed lookahead has filled; the outgoing core keeps running at full level
// for that time, then the two are crossfaded linearly over 10 ms. A transition
// therefore completes one lookahead (25 ms) plus 10 ms after the switch. Both
// cores have the same fixed latency, so the crossfade is time-aligned and host
// PDC never changes. Switching back mid-transition reverses the fade from where
// it is, using the outgoing core, which is still live.
class VoiceEngine
{
public:
    void prepare (double sr)
    {
        talkBox.prepare (sr);
        talkBox.useFixedLookahead (true);
        nuVo.prepare (sr);
        rampLength = std::max (1, (int) (0.010 * sr));
        reset();
    }

    // Snaps to the current mode with no transition in progress.
    void reset() noexcept
    {
        talkBox.reset(); nuVo.reset();
        const int active = (int) mode;
        running = { active == 0, active == 1 };
        primed = { INT_MAX, INT_MAX };   // nothing to fade from after a reset
        position = active == 1 ? rampLength : 0;
    }

    void setMode (VoiceMode next) noexcept
    {
        if (next == mode) return;
        mode = next;
        const int index = (int) next;
        if (! running[(size_t) index])
        {
            // Fresh start for the incoming core: clear any stale history.
            if (index == 0) talkBox.reset(); else nuVo.reset();
            running[(size_t) index] = true;
            primed[(size_t) index] = 0;
        }
    }

    void setParams (const mdatb::TalkBoxCore::Params& p)
    {
        if (running[0]) talkBox.setParams (p);
        if (running[1]) nuVo.setParams (p);
    }

    int latencySamples() const noexcept { return talkBox.latencySamples(); }

    void process (const float* voice, const float* carrier,
                  float* left, float* right, int count) noexcept
    {
        if (! (running[0] && running[1]))
        {
            // Steady state: exactly one core, written straight to the output.
            if (running[0]) talkBox.process (voice, carrier, left, right, count);
            else            nuVo.process (voice, carrier, left, right, count);
            advancePrimed ((size_t) (running[0] ? 0 : 1), count);
            return;
        }

        const int target = (int) mode;
        const int lookahead = latencySamples();
        for (int done = 0; done < count;)
        {
            const int n = std::min (kSubBlock, count - done);
            talkBox.process (voice + done, carrier + done, tbL.data(), tbR.data(), n);
            nuVo.process (voice + done, carrier + done, nvL.data(), nvR.data(), n);
            for (int i = 0; i < n; ++i)
            {
                // Hold the mix until the incoming core's lookahead is full.
                if (primed[(size_t) target] >= lookahead)
                {
                    if (target == 1 && position < rampLength) ++position;
                    else if (target == 0 && position > 0) --position;
                }
                advancePrimed (0, 1);
                advancePrimed (1, 1);
                // Exactly one core's output at either end of the fade.
                const float g = (float) position / (float) rampLength;
                left[done + i] = right[done + i]
                    = (1.0f - g) * tbL[(size_t) i] + g * nvL[(size_t) i];
            }
            done += n;
        }
        // Only the core being faded out stops, and only once it is fully out;
        // the incoming core keeps running while it primes at zero weight.
        if (target == 0 && position == 0)          running[1] = false;
        if (target == 1 && position == rampLength) running[0] = false;
    }

private:
    static constexpr int kSubBlock = 256;

    void advancePrimed (size_t index, int n) noexcept
    {
        primed[index] = primed[index] > INT_MAX - n ? INT_MAX : primed[index] + n;
    }

    mdatb::TalkBoxCore talkBox;
    NuVoCore nuVo;
    VoiceMode mode = VoiceMode::talkBox;
    std::array<bool, 2> running { true, false };
    std::array<int, 2> primed { INT_MAX, INT_MAX };
    int rampLength = 441, position = 0;
    // Scratch for the crossfade only; no allocation on the audio thread.
    std::array<float, kSubBlock> tbL {}, tbR {}, nvL {}, nvR {};
};
}
