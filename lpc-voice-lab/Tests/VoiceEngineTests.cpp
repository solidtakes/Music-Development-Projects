/*
 * Offline checks for the Alpha 0.5 engine wrapper (VoiceEngine) and the
 * experimental NuVo core.
 *
 * The guarantees that matter:
 *   - TalkBox mode is bit-identical to the Alpha 0.4 path (TalkBoxCore with
 *     fixed lookahead), across rates, block sizes and parameter sets.
 *   - Both modes report the same fixed latency, so host PDC never changes.
 *   - Switching modes is ramped, and returning to TalkBox resumes the original
 *     DSP exactly once the ramp has finished.
 *   - NuVo output is finite and bounded, and silent without a carrier.
 *
 * These are engineering invariants only. Nothing here compares NuVo against
 * reference audio from the original hardware; that match is unverified.
 *
 * No test framework, no JUCE.
 */

#include "VoiceEngine.h"

#include <cstdint>
#include <cstdio>
#include <limits>
#include <string>
#include <vector>

using lpc::VoiceEngine;
using lpc::VoiceMode;
using Params = mdatb::TalkBoxCore::Params;

namespace
{

int failures = 0;

void check (bool ok, const std::string& what, const std::string& detail = {})
{
    std::printf ("%-50s %s%s%s\n", what.c_str(), ok ? "ok" : "FAIL",
                 detail.empty() ? "" : "   ", detail.c_str());
    if (! ok) ++failures;
}

constexpr double kTwoPi = 6.283185307179586;

// Deterministic test material: a saw carrier and a "speech-like" modulator
// made of a pitched pulse buzz through two formant resonators, interleaved with
// noise bursts standing in for fricatives.
struct Material
{
    std::vector<float> voice, carrier;
};

Material makeMaterial (double sr, double seconds)
{
    const int n = (int) (sr * seconds);
    Material m;
    m.voice.resize ((size_t) n);
    m.carrier.resize ((size_t) n);

    double carPhase = 0, voicePhase = 0;
    double f1z1 = 0, f1z2 = 0, f2z1 = 0, f2z2 = 0;
    std::uint32_t lcg = 22222u;

    const auto resonator = [sr] (double f, double bw, double& z1, double& z2, double x)
    {
        const double r = std::exp (-kTwoPi * bw / sr);
        const double y = x + 2.0 * r * std::cos (kTwoPi * f / sr) * z1 - r * r * z2;
        z2 = z1; z1 = y;
        return y * (1.0 - r);
    };

    for (int i = 0; i < n; ++i)
    {
        carPhase += 110.0 / sr;
        if (carPhase >= 1.0) carPhase -= 1.0;
        m.carrier[(size_t) i] = (float) (0.5 * (2.0 * carPhase - 1.0));

        voicePhase += 130.0 / sr;
        double pulse = 0;
        if (voicePhase >= 1.0) { voicePhase -= 1.0; pulse = 1.0; }

        lcg = lcg * 1664525u + 1013904223u;
        const double noise = ((double) (lcg >> 8) / 8388608.0) - 1.0;

        // 300 ms cycle: 220 ms vowel, 80 ms fricative.
        const bool fricative = std::fmod ((double) i / sr, 0.3) > 0.22;
        const double vowel = resonator (700, 90, f1z1, f1z2, pulse)
                           + resonator (1200, 110, f2z1, f2z2, pulse);
        m.voice[(size_t) i] = (float) (fricative ? 0.05 * noise : 4.0 * vowel);
    }
    return m;
}

std::vector<Params> parameterSets()
{
    std::vector<Params> sets;
    Params p;
    sets.push_back (p);                                       // defaults
    p.unvoiced = true;               sets.push_back (p);      // factory-style
    p.orderHigh = true;              sets.push_back (p);
    p.lowEnd = 0.6f;                 sets.push_back (p);
    p.quality = 0.3f; p.dry = 0.4f;  sets.push_back (p);
    p.fricativeGainDb = 6.0f;        sets.push_back (p);
    p = Params(); p.wet = 0.0f; p.dry = 0.70710678118f; sets.push_back (p); // bypass
    return sets;
}

//==============================================================================
void talkBoxModeIsTheAlpha04Core()
{
    double worst = 0;
    int cases = 0;
    for (double sr : { 44100.0, 48000.0, 96000.0 })
    {
        const auto m = makeMaterial (sr, 1.0);
        const int n = (int) m.voice.size();
        for (const auto& p : parameterSets())
            for (int block : { 37, 512 })
            {
                mdatb::TalkBoxCore reference;
                reference.prepare (sr);
                reference.useFixedLookahead (true);   // Alpha 0.4 prepareToPlay

                VoiceEngine engine;
                engine.prepare (sr);
                engine.setMode (VoiceMode::talkBox);

                std::vector<float> rl ((size_t) n), rr ((size_t) n), el ((size_t) n), er ((size_t) n);
                for (int off = 0; off < n; off += block)
                {
                    const int count = std::min (block, n - off);
                    reference.setParams (p);
                    reference.process (m.voice.data() + off, m.carrier.data() + off,
                                       rl.data() + off, rr.data() + off, count);
                    engine.setParams (p);
                    engine.process (m.voice.data() + off, m.carrier.data() + off,
                                    el.data() + off, er.data() + off, count);
                }
                for (int i = 0; i < n; ++i)
                {
                    worst = std::max (worst, (double) std::fabs (rl[(size_t) i] - el[(size_t) i]));
                    worst = std::max (worst, (double) std::fabs (rr[(size_t) i] - er[(size_t) i]));
                }
                ++cases;
            }
    }
    char buf[96];
    std::snprintf (buf, sizeof buf, "%d cases, worst diff %.3g", cases, worst);
    check (worst == 0.0, "talkbox mode is bit-identical to Alpha 0.4", buf);
}

void latencyIsTheSameInBothModes()
{
    bool ok = true;
    std::string detail;
    for (double sr : { 44100.0, 48000.0, 96000.0, 192000.0 })
    {
        mdatb::TalkBoxCore reference;
        reference.prepare (sr);
        reference.useFixedLookahead (true);
        lpc::NuVoCore nuvo;
        nuvo.prepare (sr);
        VoiceEngine engine;
        engine.prepare (sr);
        const int a = engine.latencySamples();
        engine.setMode (VoiceMode::nuVo);
        const int b = engine.latencySamples();
        ok = ok && a == reference.latencySamples() && b == a && nuvo.latencySamples() == a && a > 0;
        detail += std::to_string ((int) sr) + ":" + std::to_string (a) + " ";
    }
    check (ok, "fixed latency is identical in both modes", detail);
}

void nuVoIsBoundedAndActive()
{
    bool finite = true;
    double peak = 0, sumSq = 0;
    long count = 0;
    for (const auto& base : parameterSets())
    {
        Params p = base;
        p.wet = 1.0f; p.dry = 0.0f;  // worst case for the wet bound
        const double sr = 48000.0;
        auto m = makeMaterial (sr, 1.0);
        for (auto& x : m.voice) x *= 4.0f;  // drive it hard
        const int n = (int) m.voice.size();
        lpc::NuVoCore core;
        core.prepare (sr);
        core.setParams (p);
        std::vector<float> l ((size_t) n), r ((size_t) n);
        core.process (m.voice.data(), m.carrier.data(), l.data(), r.data(), n);
        for (int i = 0; i < n; ++i)
        {
            finite = finite && std::isfinite (l[(size_t) i]) && l[(size_t) i] == r[(size_t) i];
            peak = std::max (peak, (double) std::fabs (l[(size_t) i]));
            sumSq += (double) l[(size_t) i] * l[(size_t) i];
            ++count;
        }
    }
    const double rms = std::sqrt (sumSq / (double) count);
    char buf[96];
    std::snprintf (buf, sizeof buf, "peak %.3f, rms %.4f", peak, rms);
    // Wet is bounded by 0.5 * 4 = 2 at full wet with dry at zero.
    check (finite && peak <= 2.0 + 1.0e-6 && rms > 1.0e-3, "nuvo output is finite, bounded, active", buf);
}

void nuVoSurvivesNonFiniteInput()
{
    lpc::NuVoCore core;
    core.prepare (44100.0);
    Params p; p.unvoiced = true; p.dry = 0.5f;
    core.setParams (p);
    std::vector<float> v (4096, 0.1f), c (4096, 0.2f), l (4096), r (4096);
    v[100] = std::numeric_limits<float>::quiet_NaN();
    c[200] = std::numeric_limits<float>::infinity();
    v[300] = -std::numeric_limits<float>::infinity();
    core.process (v.data(), c.data(), l.data(), r.data(), 4096);
    bool finite = true;
    for (float x : l) finite = finite && std::isfinite (x);
    check (finite, "nuvo output stays finite on NaN/Inf input");
}

void nuVoSilentWithoutCarrier()
{
    const double sr = 44100.0;
    const auto m = makeMaterial (sr, 1.0);
    const int n = (int) m.voice.size();
    std::vector<float> silence ((size_t) n, 0.0f), l ((size_t) n), r ((size_t) n);
    lpc::NuVoCore core;
    core.prepare (sr);
    Params p; p.unvoiced = true; p.lowEnd = 0.5f;
    core.setParams (p);
    core.process (m.voice.data(), silence.data(), l.data(), r.data(), n);
    double peak = 0;
    for (float x : l) peak = std::max (peak, (double) std::fabs (x));
    char buf[64];
    std::snprintf (buf, sizeof buf, "peak %.3g", peak);
    check (peak < 1.0e-6, "nuvo is silent with no carrier, dry off", buf);
}

void modeSwitchIsRampedAndReversible()
{
    const double sr = 48000.0;
    const auto m = makeMaterial (sr, 1.5);
    const int n = (int) m.voice.size();
    const int block = 256;
    const int toNuVo = 96 * block, toTalkBox = 192 * block;
    const int ramp = (int) (0.010 * sr);
    Params p; p.unvoiced = true;

    VoiceEngine engine;
    engine.prepare (sr);
    std::vector<float> el ((size_t) n), er ((size_t) n);

    // Reference for the return leg: a freshly prepared Alpha 0.4 core fed the
    // same input starting at the switch back.
    mdatb::TalkBoxCore reference;
    reference.prepare (sr);
    reference.useFixedLookahead (true);
    std::vector<float> rl ((size_t) n, 0.0f), rr ((size_t) n, 0.0f);

    double worstJump = 0;
    for (int off = 0; off < n; off += block)
    {
        const int count = std::min (block, n - off);
        if (off == toNuVo || off == toTalkBox)
        {
            const float before = el[(size_t) off - 1];
            engine.setMode (off == toNuVo ? VoiceMode::nuVo : VoiceMode::talkBox);
            engine.setParams (p);
            engine.process (m.voice.data() + off, m.carrier.data() + off,
                            el.data() + off, er.data() + off, count);
            worstJump = std::max (worstJump, (double) std::fabs (el[(size_t) off] - before));
        }
        else
        {
            engine.setParams (p);
            engine.process (m.voice.data() + off, m.carrier.data() + off,
                            el.data() + off, er.data() + off, count);
        }
        if (off >= toTalkBox)
        {
            reference.setParams (p);
            reference.process (m.voice.data() + off, m.carrier.data() + off,
                               rl.data() + off, rr.data() + off, count);
        }
    }

    double worstAfter = 0;
    for (int i = toTalkBox + ramp; i < n; ++i)
        worstAfter = std::max (worstAfter, (double) std::fabs (el[(size_t) i] - rl[(size_t) i]));

    char buf[96];
    std::snprintf (buf, sizeof buf, "first-sample jump %.4f", worstJump);
    check (worstJump < 0.01, "mode switch starts from the last sample", buf);
    std::snprintf (buf, sizeof buf, "worst diff after ramp %.3g", worstAfter);
    check (worstAfter == 0.0, "returning to talkbox resumes Alpha 0.4 exactly", buf);
}

} // namespace

int main()
{
    std::printf ("LPC Voice Lab - VoiceEngine / NuVo (experimental) offline test\n\n");

    talkBoxModeIsTheAlpha04Core();
    latencyIsTheSameInBothModes();
    nuVoIsBoundedAndActive();
    nuVoSurvivesNonFiniteInput();
    nuVoSilentWithoutCarrier();
    modeSwitchIsRampedAndReversible();

    std::printf ("\n%s\n", failures == 0 ? "all checks passed" : "FAILURES PRESENT");
    return failures == 0 ? 0 : 1;
}
