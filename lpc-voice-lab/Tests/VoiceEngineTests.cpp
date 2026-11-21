/*
 * Offline checks for the Alpha 0.5 engine wrapper (VoiceEngine) and the
 * experimental NuVo core.
 *
 * The guarantees that matter:
 *   - TalkBox mode is bit-identical to the Alpha 0.4 path (TalkBoxCore with
 *     fixed lookahead), across rates, block sizes and parameter sets.
 *   - Both modes report the same fixed latency, so host PDC never changes.
 *   - Switching modes is a crossfade with no dropout: the outgoing core plays
 *     on while the incoming one warms up (lookahead plus its own analysis
 *     warm-up), then a 10 ms fade, after which the output is exactly the
 *     incoming core. An aborted or reversed switch leaves TalkBox
 *     bit-identical. Wet-only RMS checks (5 ms and 20 ms windows) catch
 *     near-silence and loudness collapse, with a negative control.
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
#include <utility>
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
    // Includes rates above 192 kHz, which NuVo once clamped to 44.1 kHz.
    for (double sr : { 8000.0, 44100.0, 48000.0, 96000.0, 192000.0, 352800.0, 384000.0 })
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

//==============================================================================
// Mode-switch behaviour. A reference "core" is either the Alpha 0.4 TalkBox
// (fixed lookahead) or NuVo, started fresh at a given sample.
struct Reference
{
    VoiceMode mode;
    int start;
    mdatb::TalkBoxCore talkBox;
    lpc::NuVoCore nuVo;
    std::vector<float> out, scratch;

    Reference (VoiceMode m, int s, double sr, int n) : mode (m), start (s),
        out ((size_t) n, 0.0f), scratch ((size_t) n, 0.0f)
    {
        talkBox.prepare (sr);
        talkBox.useFixedLookahead (true);
        nuVo.prepare (sr);
    }

    void run (const Material& m, const Params& p, int off, int count)
    {
        if (off < start) return;
        if (mode == VoiceMode::talkBox)
        {
            talkBox.setParams (p);
            talkBox.process (m.voice.data() + off, m.carrier.data() + off,
                             out.data() + off, scratch.data() + off, count);
        }
        else
        {
            nuVo.setParams (p);
            nuVo.process (m.voice.data() + off, m.carrier.data() + off,
                          out.data() + off, scratch.data() + off, count);
        }
    }
};

double worstDiff (const std::vector<float>& a, const std::vector<float>& b, int from, int to)
{
    double worst = 0;
    for (int i = from; i < to; ++i)
        worst = std::max (worst, (double) std::fabs (a[(size_t) i] - b[(size_t) i]));
    return worst;
}

int longestZeroRun (const std::vector<float>& x, int from, int to)
{
    int longest = 0, run = 0;
    for (int i = from; i < to; ++i)
    {
        run = x[(size_t) i] == 0.0f ? run + 1 : 0;
        longest = std::max (longest, run);
    }
    return longest;
}

// Runs the engine with mode changes at the given sample offsets (multiples of
// the block size), feeding the references alongside.
std::vector<float> runEngine (const Material& m, const Params& p, double sr, int block,
                              const std::vector<std::pair<int, VoiceMode>>& switches,
                              std::vector<Reference*> refs)
{
    const int n = (int) m.voice.size();
    VoiceEngine engine;
    engine.prepare (sr);
    std::vector<float> l ((size_t) n), r ((size_t) n);
    for (int off = 0; off < n; off += block)
    {
        const int count = std::min (block, n - off);
        for (const auto& [at, mode] : switches)
            if (at == off) engine.setMode (mode);
        engine.setParams (p);
        engine.process (m.voice.data() + off, m.carrier.data() + off,
                        l.data() + off, r.data() + off, count);
        for (auto* ref : refs) ref->run (m, p, off, count);
    }
    if (worstDiff (l, r, 0, n) != 0.0)
        check (false, "engine output stays mono through switches");
    return l;
}

void modeSwitchCrossfadesWithoutDropout()
{
    const double sr = 48000.0;
    const auto m = makeMaterial (sr, 1.5);
    const int n = (int) m.voice.size();
    const int block = 256;
    const int toNuVo = 96 * block, toTalkBox = 192 * block;
    const int ramp = (int) (0.010 * sr);
    VoiceEngine timing;
    timing.prepare (sr);
    const int toNvAll = timing.transitionSamples (VoiceMode::nuVo);     // ready + ramp
    const int toTbAll = timing.transitionSamples (VoiceMode::talkBox);
    Params p; p.unvoiced = true; p.dry = 0.3f;  // dry voice exposes any gap

    Reference talkBoxAll (VoiceMode::talkBox, 0, sr, n);           // never switched
    Reference nuVoFresh (VoiceMode::nuVo, toNuVo, sr, n);           // incoming at switch 1
    Reference talkBoxFresh (VoiceMode::talkBox, toTalkBox, sr, n);  // incoming at switch 2
    const auto out = runEngine (m, p, sr, block,
                                { { toNuVo, VoiceMode::nuVo }, { toTalkBox, VoiceMode::talkBox } },
                                { &talkBoxAll, &nuVoFresh, &talkBoxFresh });

    char buf[128];
    // 1. While the incoming core warms up, the outgoing one plays on untouched.
    const double heldTb = worstDiff (out, talkBoxAll.out, 0, toNuVo + toNvAll - ramp);
    const double heldNv = worstDiff (out, nuVoFresh.out, toTalkBox, toTalkBox + toTbAll - ramp);
    std::snprintf (buf, sizeof buf, "tb->nv %.3g, nv->tb %.3g", heldTb, heldNv);
    check (heldTb == 0.0 && heldNv == 0.0, "outgoing core plays on while incoming primes", buf);

    // 2. No dropout anywhere around either switch (old engine: 15 ms of zeros).
    const int z1 = longestZeroRun (out, toNuVo, toNuVo + 4800);
    const int z2 = longestZeroRun (out, toTalkBox, toTalkBox + 4800);
    std::snprintf (buf, sizeof buf, "longest zero run %d / %d samples", z1, z2);
    check (z1 < 48 && z2 < 48, "mode switch has no dropout", buf);

    // 3. After warm-up + 10 ms, the output is exactly the incoming core.
    const int settle1 = toNuVo + toNvAll, settle2 = toTalkBox + toTbAll;
    const double nv = worstDiff (out, nuVoFresh.out, settle1, toTalkBox);
    const double tb = worstDiff (out, talkBoxFresh.out, settle2, n);
    std::snprintf (buf, sizeof buf, "nuvo %.3g, talkbox %.3g", nv, tb);
    check (nv == 0.0 && tb == 0.0, "switch settles exactly on the incoming core", buf);

    // 4. The crossfade itself stays between the two cores' outputs.
    bool between = true;
    for (int i = settle1 - ramp; i < settle1; ++i)
    {
        const float a = talkBoxAll.out[(size_t) i], b = nuVoFresh.out[(size_t) i];
        between = between && out[(size_t) i] >= std::min (a, b) - 1.0e-6f
                          && out[(size_t) i] <= std::max (a, b) + 1.0e-6f;
    }
    check (between, "crossfade is a blend of the two cores");
}

void abortedSwitchLeavesTalkBoxUntouched()
{
    // Switch to NuVo and back 5 ms later, before NuVo has primed: TalkBox never
    // stopped, so the output must be the uninterrupted Alpha 0.4 core exactly.
    const double sr = 48000.0;
    const auto m = makeMaterial (sr, 1.0);
    const int n = (int) m.voice.size();
    const int block = 240;  // 5 ms
    Params p; p.unvoiced = true;
    Reference talkBoxAll (VoiceMode::talkBox, 0, sr, n);
    const auto out = runEngine (m, p, sr, block,
                                { { 100 * block, VoiceMode::nuVo }, { 101 * block, VoiceMode::talkBox } },
                                { &talkBoxAll });
    const double worst = worstDiff (out, talkBoxAll.out, 0, n);
    char buf[64];
    std::snprintf (buf, sizeof buf, "worst diff %.3g", worst);
    check (worst == 0.0, "aborted switch leaves talkbox bit-identical", buf);
}

void rapidSwitchingStaysContinuous()
{
    // Toggle every 70 ms: each NuVo fade starts once NuVo is ready (25 ms
    // lookahead + 40 ms) and is reversed 5 ms in, mid-crossfade. Output stays
    // finite, never drops out, and settles exactly on TalkBox, which never
    // fully faded out so never reset.
    const double sr = 48000.0;
    const auto m = makeMaterial (sr, 2.0);
    const int n = (int) m.voice.size();
    const int block = 240;  // 5 ms
    Params p; p.dry = 0.3f;
    std::vector<std::pair<int, VoiceMode>> switches;
    for (int k = 0; k < 20; ++k)
        switches.push_back ({ (50 + 14 * k) * block, k % 2 ? VoiceMode::talkBox : VoiceMode::nuVo });
    Reference talkBoxAll (VoiceMode::talkBox, 0, sr, n);
    const auto out = runEngine (m, p, sr, block, switches, { &talkBoxAll });
    bool finite = true;
    for (float x : out) finite = finite && std::isfinite (x);
    const int zeros = longestZeroRun (out, 50 * block, n);
    const double mixed = worstDiff (out, talkBoxAll.out, 50 * block, 330 * block);
    const double settled = worstDiff (out, talkBoxAll.out, 330 * block, n);
    char buf[96];
    std::snprintf (buf, sizeof buf, "zero run %d, mid-fade diff %.3g, settled diff %.3g",
                   zeros, mixed, settled);
    // mixed > 0 proves the reversals really happened mid-crossfade.
    check (finite && zeros < 48 && mixed > 0.0 && settled == 0.0,
           "rapid mid-fade reversals stay continuous", buf);
}

//==============================================================================
// Wet-only switch loudness (dry = 0). Exact-zero checks miss a wet path that is
// merely near-silent, so these measure short-window RMS against steady-state
// levels of the outgoing and incoming cores.

// Sustained, never-silent material: two-formant vowel buzz and a saw carrier.
Material makeSustained (double sr, double seconds)
{
    const int n = (int) (sr * seconds);
    Material m;
    m.voice.resize ((size_t) n);
    m.carrier.resize ((size_t) n);
    double cp = 0, vp = 0, a1 = 0, a2 = 0, b1 = 0, b2 = 0;
    const auto coef = [sr] (double f, double bw, double& k, double& rr)
    {
        const double r = std::exp (-kTwoPi * bw / sr);
        k = 2.0 * r * std::cos (kTwoPi * f / sr);
        rr = r * r;
        return 1.0 - r;
    };
    double ka, ra, kb, rb;
    const double ga = coef (700, 90, ka, ra), gb = coef (1200, 110, kb, rb);
    for (int i = 0; i < n; ++i)
    {
        cp += 110.0 / sr; if (cp >= 1.0) cp -= 1.0;
        m.carrier[(size_t) i] = (float) (0.5 * (2.0 * cp - 1.0));
        vp += 130.0 / sr; double pulse = 0; if (vp >= 1.0) { vp -= 1.0; pulse = 1.0; }
        const double y = pulse + ka * a1 - ra * a2; a2 = a1; a1 = y;
        const double z = pulse + kb * b1 - rb * b2; b2 = b1; b1 = z;
        m.voice[(size_t) i] = (float) (4.0 * (y * ga + z * gb));
    }
    return m;
}

double rmsDb (const std::vector<float>& x, int from, int length)
{
    double s = 0;
    for (int i = from; i < from + length; ++i) s += (double) x[(size_t) i] * x[(size_t) i];
    return 10.0 * std::log10 (s / std::max (1, length) + 1.0e-24);
}

// Lowest RMS over sliding windows (w samples, hop h) across [from, to).
double minWindowDb (const std::vector<float>& x, int from, int to, int w, int h)
{
    double lowest = 1.0e9;
    for (int a = from; a + w <= to; a += h) lowest = std::min (lowest, rmsDb (x, a, w));
    return lowest;
}

struct WetCase
{
    double margin5, margin20, absolute5;   // dB; margins are relative to the floor
    std::string name;
};

// Steady-state reference for one window size: the quietest window each core
// produces on its own (this material's 5 ms windows swing 7-10 dB below the
// mean even with no switch, so a mean-based floor would flag normal signal).
struct Steady { double min5, min20; };

Steady steadyLevels (const std::vector<float>& x, int from, int to, double sr)
{
    const int hop = (int) (0.001 * sr);
    return { minWindowDb (x, from, to, (int) (0.005 * sr), hop),
             minWindowDb (x, from, to, (int) (0.020 * sr), hop) };
}

// Margin of the quietest 5 ms / 20 ms window around the switch above the
// floor: the quieter core's own quietest steady-state window, minus 3 dB.
WetCase scanSwitch (const std::vector<float>& out, double sr, int sw, int settle,
                    const Steady& outgoing, const Steady& incoming, const std::string& name)
{
    const double floor5 = std::min (outgoing.min5, incoming.min5) - 3.0;
    const double floor20 = std::min (outgoing.min20, incoming.min20) - 3.0;
    const int from = sw - (int) (0.050 * sr), to = settle + (int) (0.050 * sr);
    const int hop = (int) (0.001 * sr);
    const double m5 = minWindowDb (out, from, to, (int) (0.005 * sr), hop);
    const double m20 = minWindowDb (out, from, to, (int) (0.020 * sr), hop);
    return { m5 - floor5, m20 - floor20, m5, name };
}

void wetSwitchKeepsLoudness()
{
    WetCase worst[2] { { 1e9, 1e9, 0, "" }, { 1e9, 1e9, 0, "" } };
    WetCase control[2] { { 1e9, 1e9, 0, "" }, { 1e9, 1e9, 0, "" } };
    int cases = 0, failed = 0, controlCaught = 0, controlCases = 0;

    for (double sr : { 44100.0, 48000.0, 96000.0, 192000.0 })
    {
        const auto m = makeSustained (sr, 1.4);
        const int n = (int) m.voice.size();
        const int block = 256;
        const int sw = ((int) (0.7 * sr) / block) * block;
        const int lookahead = (int) (0.025 * sr);
        const int ramp = (int) (0.010 * sr);
        VoiceEngine timing;
        timing.prepare (sr);

        for (bool high : { false, true })
            for (float quality : { 1.0f, 0.0f })
                for (int dir = 0; dir < 2; ++dir)
                {
                    const VoiceMode from = dir == 0 ? VoiceMode::talkBox : VoiceMode::nuVo;
                    const VoiceMode to   = dir == 0 ? VoiceMode::nuVo : VoiceMode::talkBox;
                    Params p;
                    p.dry = 0.0f; p.orderHigh = high; p.quality = quality;

                    Reference outgoing (from, 0, sr, n), incoming (to, sw, sr, n);
                    const auto out = runEngine (m, p, sr, block, { { 0, from }, { sw, to } },
                                                { &outgoing, &incoming });
                    const int settle = sw + timing.transitionSamples (to);
                    const auto steadyOut = steadyLevels (outgoing.out, sw - (int) (0.3 * sr), sw, sr);
                    const auto steadyIn = steadyLevels (incoming.out, settle + (int) (0.05 * sr),
                                                        settle + (int) (0.35 * sr), sr);

                    char name[96];
                    std::snprintf (name, sizeof name, "%.0f Hz, order %s, quality %.0f",
                                   sr, high ? "high" : "normal", quality);
                    const auto r = scanSwitch (out, sr, sw, settle, steadyOut, steadyIn, name);
                    ++cases;
                    if (r.margin5 < 0.0 || r.margin20 < 0.0 || r.absolute5 < -60.0) ++failed;
                    if (r.margin5 < worst[dir].margin5) worst[dir] = r;

                    // Negative control: the eecbec8 timing, rebuilt from the same
                    // references (outgoing at full until the lookahead only, then
                    // a 10 ms fade into the fresh incoming core).
                    std::vector<float> old ((size_t) n);
                    for (int i = 0; i < n; ++i)
                    {
                        const int pos = std::clamp (i - (sw + lookahead), 0, ramp);
                        const float g = i < sw ? 0.0f : (float) pos / (float) ramp;
                        old[(size_t) i] = (1.0f - g) * outgoing.out[(size_t) i] + g * incoming.out[(size_t) i];
                    }
                    const auto c = scanSwitch (old, sr, sw, settle, steadyOut, steadyIn, name);
                    if (c.margin5 < control[dir].margin5) control[dir] = c;
                    if (dir == 1)
                    {
                        ++controlCases;
                        if (c.margin5 < 0.0 && c.absolute5 < -60.0) ++controlCaught;
                    }
                }
    }

    char buf[200];
    std::snprintf (buf, sizeof buf, "%d cases; worst 5 ms margin tb->nv %+.1f dB (%s), nv->tb %+.1f dB (%s)",
                   cases, worst[0].margin5, worst[0].name.c_str(), worst[1].margin5, worst[1].name.c_str());
    check (failed == 0, "wet-only switch never collapses in loudness", buf);
    std::snprintf (buf, sizeof buf, "quietest 5 ms window tb->nv %.1f dBFS, nv->tb %.1f dBFS",
                   worst[0].absolute5, worst[1].absolute5);
    check (worst[0].absolute5 > -60.0 && worst[1].absolute5 > -60.0, "wet-only switch never near-silent", buf);
    std::snprintf (buf, sizeof buf, "old timing nv->tb: %d/%d cases caught, worst %.1f dBFS (margin %+.1f dB)",
                   controlCaught, controlCases, control[1].absolute5, control[1].margin5);
    check (controlCases > 0 && controlCaught == controlCases,
           "negative control: old timing fails this metric", buf);
}

void warmUpConstantsMatchTheCores()
{
    // A reset core, measured from the point the engine starts its fade, is
    // within 3 dB of a continuously running core in every 5 ms window after.
    double worstDb = 1e9;
    std::string where;
    for (double sr : { 44100.0, 48000.0, 96000.0, 192000.0 })
    {
        const auto m = makeSustained (sr, 1.0);
        const int n = (int) m.voice.size();
        const int start = ((int) (0.5 * sr) / 256) * 256;
        VoiceEngine timing;
        timing.prepare (sr);
        const int ramp = (int) (0.010 * sr);
        for (int core = 0; core < 2; ++core)
            for (bool high : { false, true })
                for (float quality : { 1.0f, 0.0f })
                {
                    const VoiceMode mode = core == 0 ? VoiceMode::talkBox : VoiceMode::nuVo;
                    Params p; p.dry = 0.0f; p.orderHigh = high; p.quality = quality;
                    Reference always (mode, 0, sr, n), fresh (mode, start, sr, n);
                    for (int off = 0; off < n; off += 256)
                    {
                        const int count = std::min (256, n - off);
                        always.run (m, p, off, count);
                        fresh.run (m, p, off, count);
                    }
                    const int readyAt = start + timing.transitionSamples (mode) - ramp;
                    const int w = (int) (0.005 * sr);
                    for (int a = readyAt; a + w <= readyAt + (int) (0.1 * sr); a += w)
                    {
                        const double d = rmsDb (fresh.out, a, w) - rmsDb (always.out, a, w);
                        if (d < worstDb)
                        {
                            worstDb = d;
                            char buf[96];
                            std::snprintf (buf, sizeof buf, "%s %.0f Hz %s q%.0f",
                                           core ? "nuvo" : "talkbox", sr, high ? "high" : "normal", quality);
                            where = buf;
                        }
                    }
                }
    }
    char buf[160];
    std::snprintf (buf, sizeof buf, "worst %.2f dB vs continuous core (%s)", worstDb, where.c_str());
    check (worstDb > -3.0, "warm-up constants match measured core readiness", buf);
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
    modeSwitchCrossfadesWithoutDropout();
    abortedSwitchLeavesTalkBoxUntouched();
    rapidSwitchingStaysContinuous();
    warmUpConstantsMatchTheCores();
    wetSwitchKeepsLoudness();

    std::printf ("\n%s\n", failures == 0 ? "all checks passed" : "FAILURES PRESENT");
    return failures == 0 ? 0 : 1;
}
