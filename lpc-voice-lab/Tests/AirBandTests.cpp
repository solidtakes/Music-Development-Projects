#include "PluginProcessor.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <vector>

namespace
{
constexpr double twoPi = juce::MathConstants<double>::twoPi;
using Mode = LPCVoiceLabProcessor::VoiceMode;

double responseDb (int rate, int band, double frequency)
{
    lpc::AirBand air;
    air.prepare (rate, band, 12.0f);
    double before = 0.0, after = 0.0;
    for (int i = 0; i < rate * 5 / 4; ++i)
    {
        const auto x = (float) (0.20 * std::sin (twoPi * frequency * i / rate));
        const auto y = x + air.extra (x);
        if (i >= rate / 4)
        {
            before += (double) x * x;
            after += (double) y * y;
        }
    }
    return 10.0 * std::log10 (after / before);
}

bool shelvesAreBroadAndDistinct()
{
    bool ok = true;
    for (int rate : { 44100, 48000, 96000 })
    {
        std::array<double, 3> at8k {};
        for (size_t band = 0; band < at8k.size(); ++band)
        {
            const int b = (int) band;
            const double low = responseDb (rate, b, 1000.0);
            const double mid = responseDb (rate, b, 8000.0);
            const double high = responseDb (rate, b, 18000.0);
            const double top = responseDb (rate, b, rate * 0.49);
            at8k[band] = mid;
            ok = ok && low >= 0.0 && low < 0.75 && mid > low && high > mid
                    && top > 11.95 && top <= 12.001;
            std::printf ("Air %5d Hz, %2d kHz: +%.2f / +%.2f / +%.2f dB at 1 / 8 / 18 kHz\n",
                         rate, lpc::AirBand::frequenciesKHz[band], low, mid, high);
        }
        ok = ok && at8k[0] - at8k[1] > 2.0 && at8k[1] - at8k[2] > 1.5;
    }
    return ok;
}

bool smoothChangesAndHeadroom()
{
    constexpr int rate = 48000;
    constexpr int ramp = rate / 50;
    lpc::AirBand air, reference;
    air.prepare (rate, 0, 0.0f);
    reference.prepare (rate, 0, 0.0f);
    bool ok = ! air.isActive();
    air.setParameters (0, 12.0f);
    const float first = air.extra (0.2f);
    ok = ok && first > 0.0f && first < 0.001f;
    float peak = 0.0f;
    for (int i = 1; i < 2 * ramp; ++i)
    {
        const auto x = (float) (0.2 * std::sin (twoPi * 22000.0 * i / rate));
        peak = std::max (peak, std::abs (x + air.extra (x)));
    }
    ok = ok && peak > 0.77f && peak < 0.81f;

    reference = air;
    air.setParameters (2, 12.0f);
    const float changed = air.extra (0.2f) - reference.extra (0.2f);
    ok = ok && std::abs (changed) < 0.005f;
    for (int i = 1; i < ramp; ++i)
    {
        const auto x = (float) (0.2 * std::sin (twoPi * 8000.0 * i / rate));
        (void) air.extra (x);
        (void) reference.extra (x);
    }
    ok = ok && std::abs (air.extra (0.2f) - reference.extra (0.2f)) > 0.05f;
    air.setParameters (2, 0.0f);
    for (int i = 0; i < ramp; ++i)
        (void) air.extra (0.2f);
    std::printf ("Air pre-master peak: %.3f for a 0.200 near-Nyquist sine at +12 dB\n", peak);
    return ok && ! air.isActive() && air.extra (0.2f) == 0.0f;
}

void set (LPCVoiceLabProcessor& processor, const char* id, float value)
{
    auto& parameter = *processor.apvts.getParameter (id);
    parameter.setValueNotifyingHost (parameter.convertTo0to1 (value));
}

struct Fixture
{
    static constexpr int block = 1537; // Crosses the processor's internal chunk boundary.
    explicit Fixture (int rate) : voice ((size_t) rate), carrier ((size_t) rate)
    {
        uint32_t random = 37;
        for (int i = 0; i < rate; ++i)
        {
            const double t = twoPi * i / rate;
            random = random * 1664525u + 1013904223u;
            const double noise = (double) (random >> 8) / 8388608.0 - 1.0;
            voice[(size_t) i] = (float) (0.15 * (std::sin (440.0 * t) + std::sin (1220.0 * t))
                                        + 0.07 * noise);
            carrier[(size_t) i] = (float) (0.38 * noise + 0.18 * std::sin (557.0 * t));
        }
    }
    std::vector<float> voice, carrier;
};

struct Render
{
    std::vector<float> samples;
    double ms = 0.0;
    int latency = 0;
};

Render renderProcessor (const Fixture& input, int rate, Mode mode, float wet, float gain,
                        bool bypass = false, float trimDb = 0.0f)
{
    LPCVoiceLabProcessor processor;
    processor.enableAllBuses();
    processor.setVoiceMode (mode, false);
    set (processor, "wet", wet);
    set (processor, "dry", 0.20f);
    set (processor, "airgain", gain);
    set (processor, "outgain", trimDb);
    set (processor, "bypass", bypass ? 1.0f : 0.0f);
    processor.prepareToPlay (rate, Fixture::block);
    Render result { std::vector<float> ((size_t) rate), 0.0, processor.getLatencySamples() };
    juce::AudioBuffer<float> buffer (4, Fixture::block);
    juce::MidiBuffer midi;

    for (int offset = 0; offset < rate; offset += Fixture::block)
    {
        const int count = std::min (Fixture::block, rate - offset);
        buffer.setSize (4, count, false, false, true);
        for (int side = 0; side < 2; ++side)
        {
            buffer.copyFrom (side, 0, input.voice.data() + offset, count);
            buffer.copyFrom (side + 2, 0, input.carrier.data() + offset, count);
        }
        const auto start = std::chrono::steady_clock::now();
        processor.processBlock (buffer, midi);
        result.ms += std::chrono::duration<double, std::milli> (std::chrono::steady_clock::now() - start).count();
        std::copy_n (buffer.getReadPointer (0), count, result.samples.data() + offset);
    }
    return result;
}

std::vector<float> referenceWithoutAir (const Fixture& input, int rate, Mode mode)
{
    juce::ScopedNoDenormals noDenormals;
    lpc::VoiceEngine engine;
    engine.prepare (rate);
    engine.setMode (mode);
    mdatb::TalkBoxCore::Params params;
    params.wet = 0.5f;
    params.dry = 0.20f;
    std::vector<float> out ((size_t) rate);
    std::array<float, 1024> right {};
    for (int start = 0; start < rate; start += Fixture::block)
    {
        const int count = std::min (Fixture::block, rate - start);
        engine.setParams (params);
        for (int offset = 0; offset < count; offset += 1024)
        {
            const int position = start + offset;
            engine.process (input.voice.data() + position, input.carrier.data() + position,
                            out.data() + position, right.data(), std::min (1024, count - offset));
        }
    }
    // The 0.5.1a unity-trim, zero-retro mix adds a zero and multiplies by one.
    for (auto& sample : out)
        sample += 0.0f;
    return out;
}

bool samplesMatch (const std::vector<float>& a, const std::vector<float>& b)
{
    return std::memcmp (a.data(), b.data(), a.size() * sizeof (float)) == 0;
}

bool processorRouting()
{
    bool ok = true;
    for (int rate : { 44100, 48000, 96000 })
    {
        const Fixture input (rate);
        for (auto mode : { Mode::talkBox, Mode::nuVo })
        {
            const auto dry = renderProcessor (input, rate, mode, 0.0f, 0.0f);
            const auto dryWithAir = renderProcessor (input, rate, mode, 0.0f, 12.0f);
            const auto off = renderProcessor (input, rate, mode, 0.5f, 0.0f);
            const auto on = renderProcessor (input, rate, mode, 0.5f, 12.0f);
            const auto trimmed = renderProcessor (input, rate, mode, 0.5f, 12.0f, false, -6.0f);
            const auto bypass = renderProcessor (input, rate, mode, 0.5f, 0.0f, true);
            const auto bypassWithAir = renderProcessor (input, rate, mode, 0.5f, 12.0f, true);
            const bool exact = samplesMatch (off.samples, referenceWithoutAir (input, rate, mode));
            const bool dryUnchanged = samplesMatch (dry.samples, dryWithAir.samples);
            const bool bypassUnchanged = samplesMatch (bypass.samples, bypassWithAir.samples);
            float peak = 0.0f, trimmedPeak = 0.0f;
            double deltaPower = 0.0;
            for (size_t i = 0; i < on.samples.size(); ++i)
            {
                const auto y = on.samples[i];
                ok = ok && std::isfinite (y);
                peak = std::max (peak, std::abs (y));
                trimmedPeak = std::max (trimmedPeak, std::abs (trimmed.samples[i]));
                const double delta = y - off.samples[i];
                deltaPower += delta * delta;
            }
            const auto expectedTrimmedPeak = peak * juce::Decibels::decibelsToGain (-6.0f);
            ok = ok && exact && dryUnchanged && bypassUnchanged && deltaPower > 1.0e-6
                    && trimmedPeak < 1.0f && std::abs (trimmedPeak - expectedTrimmedPeak) < 1.0e-5f
                    && on.latency == off.latency && on.latency > 0;
            std::printf ("Air %s %d Hz: exact off=%d dry=%d bypass=%d, latency %d, peak %.3f, "
                         "trimmed peak %.3f, CPU %.2f/%.2f ms off/on per second\n",
                         mode == Mode::talkBox ? "TalkBox" : "NuVo", rate, exact, dryUnchanged,
                         bypassUnchanged, on.latency, peak, trimmedPeak, off.ms, on.ms);
        }
    }
    return ok;
}
}

int runAirBandTests()
{
    const bool response = shelvesAreBroadAndDistinct();
    const bool smoothing = smoothChangesAndHeadroom();
    const bool routing = processorRouting();
    std::printf ("Air response: %s; smoothing/headroom: %s; processor routing: %s\n",
                 response ? "ok" : "FAIL", smoothing ? "ok" : "FAIL", routing ? "ok" : "FAIL");
    return response && smoothing && routing ? 0 : 1;
}
