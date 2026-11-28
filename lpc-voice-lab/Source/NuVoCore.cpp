#include "NuVoCore.h"

namespace lpc
{
namespace
{
float bounded (float x, float lo, float hi) noexcept
{
    return std::isfinite (x) ? std::clamp (x, lo, hi) : lo;
}
float input (float x) noexcept { return std::isfinite (x) ? std::clamp (x, -16.0f, 16.0f) : 0.0f; }
}

void NuVoCore::Bandpass::configure (double f, double q, double rate) noexcept
{
    const double w = 6.283185307179586 * f / rate;
    const double alpha = std::sin (w) / (2.0 * q);
    b0 = alpha / (1.0 + alpha);
    b2 = -b0;
    a1 = -2.0 * std::cos (w) / (1.0 + alpha);
    a2 = (1.0 - alpha) / (1.0 + alpha);
    reset();
}

double NuVoCore::Bandpass::process (double x) noexcept
{
    const double y = b0 * x + z1;
    z1 = -a1 * y + z2;
    z2 = b2 * x - a2 * y;
    if (std::abs (z1) < 1.0e-20) z1 = 0;
    if (std::abs (z2) < 1.0e-20) z2 = 0;
    return y;
}

void NuVoCore::prepare (double sampleRate)
{
    // Run at the real rate, exactly like TalkBoxCore's added stages, so the
    // lookahead (and therefore the reported latency) matches it at every rate,
    // and the band filters are tuned for the rate they actually run at.
    sr = std::isfinite (sampleRate) && sampleRate > 0 ? sampleRate : 44100;
    const auto configure = [this] (auto& bank)
    {
        const double top = std::clamp (sr * 0.4, 240.0, 8000.0);
        const double ratio = std::pow (top / 120.0, 1.0 / (bank.size() - 1));
        const double q = std::clamp (1.0 / (ratio - 1.0), 1.0, 12.0);
        double frequency = 120.0;
        for (auto& band : bank)
        {
            band.voice.configure (frequency, q, sr);
            band.carrier.configure (frequency, q, sr);
            frequency *= ratio;
        }
    };
    configure (normal);
    configure (high);
    uv.prepare ((float) sr);
    lowEnd.prepare ((float) sr);
    reset();
    setParams (params);
}

void NuVoCore::reset() noexcept
{
    for (auto& band : normal) band.reset();
    for (auto& band : high) band.reset();
    uv.resetAll();
    lowEnd.reset();
}

void NuVoCore::setParams (const Params& p) noexcept
{
    if (p.orderHigh != params.orderHigh)
    {
        for (auto& band : normal) band.reset();
        for (auto& band : high) band.reset();
    }
    if (p.unvoiced != params.unvoiced) uv.reset();
    params = p;
    params.quality = bounded (p.quality, 0, 1);
    params.fricativeGainDb = bounded (p.fricativeGainDb, -24, 12);
    wet = 0.5f * std::pow (bounded (p.wet, 0, 1), 2.0f);
    dry = 2.0f * std::pow (bounded (p.dry, 0, 1), 2.0f);
    fricativeGain = mdatb::kUvPassRef * std::pow (10.0f, params.fricativeGainDb * 0.05f);
    // Higher Quality follows consonant envelopes faster; Order selects 16/32 bands.
    attack = 1.0 - std::exp (-1.0 / (sr * (0.008 - 0.006 * params.quality)));
    release = 1.0 - std::exp (-1.0 / (sr * (0.060 - 0.040 * params.quality)));
    lowEndOn = lowEnd.setAmount (bounded (p.lowEnd, 0, 1));
}

void NuVoCore::process (const float* voice, const float* carrier,
                        float* left, float* right, int count, float* wetOut) noexcept
{
    for (int i = 0; i < count; ++i)
    {
        const float liveVoice = input (params.swap ? carrier[i] : voice[i]);
        const float liveCarrier = input (params.swap ? voice[i] : carrier[i]);
        float gate = 0;
        if (params.unvoiced)
            gate = uv.detect (liveVoice) * uv.carrierGate (liveCarrier * liveCarrier);
        float v, c;
        uv.delay (liveVoice, liveCarrier, v, c); // same fixed 25 ms host latency
        const auto synthesize = [this, v, c] (auto& bank)
        {
            double sum = 0;
            for (auto& band : bank)
            {
                const double magnitude = std::abs (band.voice.process (v));
                band.envelope += (magnitude > band.envelope ? attack : release)
                               * (magnitude - band.envelope);
                if (band.envelope < 1.0e-20) band.envelope = 0;
                sum += band.carrier.process (c) * band.envelope;
            }
            return (float) (sum * 8.0);
        };
        float effect = params.orderHigh ? synthesize (high) : synthesize (normal);
        if (lowEndOn) effect = lowEnd.process (effect);
        if (params.unvoiced)
            effect = effect * (1.0f - gate * (1.0f - mdatb::kUvDuck))
                   + uv.band (v) * gate * fricativeGain;
        // Bound the new wet path only. Dry keeps the original 2*dry^2 taper.
        effect = std::isfinite (effect) ? 4.0f * std::tanh (effect * 0.25f) : 0.0f;
        left[i] = right[i] = wet * effect + dry * v;
        if (wetOut != nullptr)
            wetOut[i] = wet * effect;
    }
}
}
