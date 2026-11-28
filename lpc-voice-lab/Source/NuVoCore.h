#pragma once

#include "TalkBoxCore.h"
#include <array>

namespace lpc
{
// Experimental intelligibility-oriented filter-bank vocoder. This is an
// independent hypothesis, not IVL DSP or a measured match to the Talker NuVo.
// No allocation after prepare(), including parameter changes and reset().
class NuVoCore
{
public:
    using Params = mdatb::TalkBoxCore::Params;
    void prepare (double sampleRate);
    void reset() noexcept;
    void setParams (const Params&) noexcept;
    int latencySamples() const noexcept { return uv.lookaheadSamples(); }
    void process (const float* voice, const float* carrier,
                  float* left, float* right, int count, float* wetOut = nullptr) noexcept;

private:
    struct Bandpass
    {
        double b0 = 0, b2 = 0, a1 = 0, a2 = 0, z1 = 0, z2 = 0;
        void configure (double frequency, double q, double sampleRate) noexcept;
        double process (double x) noexcept;
        void reset() noexcept { z1 = z2 = 0; }
    };
    struct Band
    {
        Bandpass voice, carrier;
        double envelope = 0;
        void reset() noexcept { voice.reset(); carrier.reset(); envelope = 0; }
    };
    std::array<Band, 16> normal;
    std::array<Band, 32> high;
    mdatb::Unvoiced uv;
    mdatb::LowEnd lowEnd;
    Params params;
    double sr = 44100, attack = 0, release = 0;
    float wet = 0.125f, dry = 0, fricativeGain = 0;
    bool lowEndOn = false;
};
}
