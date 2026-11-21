#pragma once

#include "NuVoCore.h"

#include <algorithm>

namespace lpc
{
enum class VoiceMode { talkBox, nuVo };

// The original core and its parameter tapers are unchanged. Only the selected
// core runs. A mode change clears both histories and ramps from the last sample
// for 10 ms; inactive mode tails cannot reappear on a later selection.
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
    void reset() noexcept
    {
        talkBox.reset(); nuVo.reset(); remaining = 0; last = anchor = 0;
    }
    void setMode (VoiceMode next) noexcept
    {
        if (next == mode) return;
        anchor = last;
        talkBox.reset(); nuVo.reset();
        remaining = rampLength;
        mode = next;
    }
    void setParams (const mdatb::TalkBoxCore::Params& p)
    {
        if (mode == VoiceMode::talkBox) talkBox.setParams (p);
        else nuVo.setParams (p);
    }
    int latencySamples() const noexcept { return talkBox.latencySamples(); }
    void process (const float* voice, const float* carrier,
                  float* left, float* right, int count) noexcept
    {
        if (mode == VoiceMode::talkBox) talkBox.process (voice, carrier, left, right, count);
        else nuVo.process (voice, carrier, left, right, count);
        for (int i = 0; i < count; ++i)
        {
            if (remaining > 0)
            {
                const float amount = (float) --remaining / (float) rampLength;
                left[i] = right[i] = left[i] + amount * (anchor - left[i]);
            }
            last = left[i];
        }
    }
private:
    mdatb::TalkBoxCore talkBox;
    NuVoCore nuVo;
    VoiceMode mode = VoiceMode::talkBox;
    int rampLength = 441, remaining = 0;
    float last = 0, anchor = 0;
};
}
