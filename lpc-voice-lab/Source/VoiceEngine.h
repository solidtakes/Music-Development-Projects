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
// cleared history (inactive-mode tails cannot reappear), so its wet output is
// not ready until it has warmed up; the outgoing core keeps running at full
// level for that whole time, then the two are crossfaded linearly over 10 ms.
//
// Readiness is per core, measured from a reset against a continuously running
// core on sustained input (see VoiceEngineTests):
//   TalkBox: fixed lookahead + 3 N, where N = (int) (0.01633 * min (sr, 96 k))
//            is its half-rate analysis buffer (one frame = 2 N input samples).
//            A reset core is silent until about lookahead + 2 N and within
//            1 dB by about lookahead + 2.5 N; lookahead + 3 N is the first
//            point at which a frame made entirely of post-lookahead input has
//            completed. About 74 ms at 48 kHz.
//   NuVo:    fixed lookahead + 40 ms. Envelope followers settle with Quality:
//            within 1 dB by about +18 ms at Quality 1, but only within 3.7 dB
//            at +20 ms and 1.7 dB at +40 ms at Quality 0.
// Both cores have the same fixed latency, so the crossfade is time-aligned and
// host PDC never changes. Switching back mid-transition reverses the fade from
// where it is, using the outgoing core, which is still live.
class VoiceEngine
{
public:
    void prepare (double sr)
    {
        talkBox.prepare (sr);
        talkBox.useFixedLookahead (true);
        nuVo.prepare (sr);
        rampLength = std::max (1, (int) (0.010 * sr));

        // Mirrors TalkBoxCore::prepare exactly (float arithmetic, 8-96 kHz
        // clamp, kBufMax bound); TalkBoxCore itself is left untouched.
        float fs = sr > 0.0 ? (float) sr : 44100.0f;
        fs = std::min (std::max (fs, 8000.0f), 96000.0f);
        const int frameHalf = std::min (std::max ((int) (0.01633f * fs), 1), mdatb::kBufMax);
        const int lookahead = talkBox.latencySamples();
        ready[0] = lookahead + 3 * frameHalf;
        ready[1] = lookahead + (int) (0.040 * (sr > 0.0 ? sr : 44100.0));
        reset();
    }

    /** Samples from a switch until the output is purely the incoming core,
        when that core starts from reset. */
    int transitionSamples (VoiceMode to) const noexcept { return ready[(size_t) to] + rampLength; }

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
                  float* left, float* right, int count, float* wetOut = nullptr) noexcept
    {
        if (! (running[0] && running[1]))
        {
            // Steady state: exactly one core, written straight to the output.
            if (running[0]) talkBox.process (voice, carrier, left, right, count, wetOut);
            else            nuVo.process (voice, carrier, left, right, count, wetOut);
            advancePrimed ((size_t) (running[0] ? 0 : 1), count);
            return;
        }

        const int target = (int) mode;
        const int readyAt = ready[(size_t) target];
        for (int done = 0; done < count;)
        {
            const int n = std::min (kSubBlock, count - done);
            talkBox.process (voice + done, carrier + done, tbL.data(), tbR.data(), n,
                             wetOut != nullptr ? tbWet.data() : nullptr);
            nuVo.process (voice + done, carrier + done, nvL.data(), nvR.data(), n,
                          wetOut != nullptr ? nvWet.data() : nullptr);
            for (int i = 0; i < n; ++i)
            {
                // Hold the mix until the incoming core's wet path is ready.
                if (primed[(size_t) target] >= readyAt)
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
                if (wetOut != nullptr)
                    wetOut[done + i] = (1.0f - g) * tbWet[(size_t) i] + g * nvWet[(size_t) i];
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
    std::array<int, 2> ready { 0, 0 };   // samples after reset until wet output is ready
    int rampLength = 441, position = 0;
    // Scratch for the crossfade only; no allocation on the audio thread.
    std::array<float, kSubBlock> tbL {}, tbR {}, nvL {}, nvR {};
    std::array<float, kSubBlock> tbWet {}, nvWet {};
};
}
