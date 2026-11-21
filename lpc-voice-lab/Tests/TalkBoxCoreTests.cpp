/*
 * DSP smoke test for MDA Talkbox Plus.
 *
 * The important one is `bypassMatchesOriginal`: it runs the ported core with
 * both additions inactive against a transcription of the stock mda TalkBox
 * process loop and requires the outputs to be bit-identical. That is the
 * guarantee that the plugin is unchanged when the new features are off.
 *
 * No test framework, no JUCE: builds and runs on its own.
 */

#include "TalkBoxCore.h"

#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

#ifndef M_PI
 #define M_PI 3.14159265358979323846
#endif

using namespace mdatb;

namespace
{

int failures = 0;

void check (bool ok, const std::string& what, const std::string& detail = {})
{
    std::printf ("%-46s %s%s%s\n", what.c_str(), ok ? "ok" : "FAIL",
                 detail.empty() ? "" : "   ", detail.c_str());
    if (! ok) ++failures;
}

//==============================================================================
// A direct transcription of mdaTalkBox.cpp (processReplacing + resume +
// suspend + lpc + lpc_durbin) from github.com/pluginguru/mda-effects, used only
// as the reference for the bypass test.
struct Reference
{
    static constexpr int BUF_MAX = 1600;
    static constexpr int ORD_MAX = 50;
    static constexpr float TWO_PI = 6.28318530717958647692528676655901f;

    std::vector<float> buf0 { std::vector<float> ((size_t) BUF_MAX) };
    std::vector<float> buf1 { std::vector<float> ((size_t) BUF_MAX) };
    std::vector<float> window { std::vector<float> ((size_t) BUF_MAX) };
    std::vector<float> car0 { std::vector<float> ((size_t) BUF_MAX) };
    std::vector<float> car1 { std::vector<float> ((size_t) BUF_MAX) };

    float emphasis = 0, wet = 0, dry = 0, FX = 0;
    int K = 0, N = 1, O = 0, pos = 0, swap = 0;
    float d0 = 0, d1 = 0, d2 = 0, d3 = 0, d4 = 0;
    float u0 = 0, u1 = 0, u2 = 0, u3 = 0, u4 = 0;

    void suspend()
    {
        pos = K = 0;
        emphasis = 0.0f;
        FX = 0;
        u0 = u1 = u2 = u3 = u4 = 0.0f;
        d0 = d1 = d2 = d3 = d4 = 0.0f;
        std::fill (buf0.begin(), buf0.end(), 0.0f);
        std::fill (buf1.begin(), buf1.end(), 0.0f);
        std::fill (car0.begin(), car0.end(), 0.0f);
        std::fill (car1.begin(), car1.end(), 0.0f);
    }

    void resume (float fs, float p0v, float p1v, float p2v, float p3v)
    {
        if (fs < 8000.0f) fs = 8000.0f;
        if (fs > 96000.0f) fs = 96000.0f;

        swap = (p2v > 0.5f) ? 1 : 0;

        int n = (int) (0.01633f * fs);
        if (n > BUF_MAX) n = BUF_MAX;

        O = (int) ((0.0001f + 0.0004f * p3v) * fs);

        if (n != N)
        {
            N = n;
            const float dp = TWO_PI / (float) N;
            float p = 0.0f;
            for (n = 0; n < N; n++)
            {
                window[(size_t) n] = 0.5f - 0.5f * std::cos (p);
                p += dp;
            }
        }
        wet = 0.5f * p0v * p0v;
        dry = 2.0f * p1v * p1v;
    }

    void lpcDurbin (const float* r, int p, float* k, float* g)
    {
        float a[ORD_MAX], at[ORD_MAX], e = r[0];
        for (int i = 0; i <= p; i++) a[i] = at[i] = 0.0f;
        for (int i = 1; i <= p; i++)
        {
            k[i] = -r[i];
            for (int j = 1; j < i; j++) { at[j] = a[j]; k[i] -= a[j] * r[i - j]; }
            if (std::fabs (e) < 1.0e-20f) { e = 0.0f; break; }
            k[i] /= e;
            a[i] = k[i];
            for (int j = 1; j < i; j++) a[j] = at[j] + k[i] * at[i - j];
            e *= 1.0f - k[i] * k[i];
        }
        if (e < 1.0e-20f) e = 0.0f;
        *g = std::sqrt (e);
    }

    void lpc (float* buf, float* car, int n, int o)
    {
        float z[ORD_MAX], r[ORD_MAX], k[ORD_MAX], G, x;
        int nn = n;
        for (int j = 0; j <= o; j++, nn--)
        {
            z[j] = r[j] = 0.0f;
            for (int i = 0; i < nn; i++) r[j] += buf[i] * buf[i + j];
        }
        r[0] *= 1.001f;
        if (r[0] < 0.00001f) { for (int i = 0; i < n; i++) buf[i] = 0.0f; return; }
        lpcDurbin (r, o, k, &G);
        for (int i = 1; i <= o; i++)
        {
            if (k[i] > 0.995f) k[i] = 0.995f; else if (k[i] < -0.995f) k[i] = -0.995f;
        }
        for (int i = 0; i < n; i++)
        {
            x = G * car[i];
            for (int j = o; j > 0; j--) { x -= k[j] * z[j - 1]; z[j] = z[j - 1] + k[j] * x; }
            buf[i] = z[0] = x;
        }
    }

    void process (const float* inL, const float* inR, float* outL, float* outR, int frames)
    {
        const float* in1 = swap ? inR : inL;
        const float* in2 = swap ? inL : inR;
        int p0 = pos, p1 = (pos + N / 2) % N;
        float e = emphasis, w, o, x, dr, fx = FX;
        float p, q, h0 = 0.3f, h1 = 0.77f;

        for (int i = 0; i < frames; ++i)
        {
            o = in1[i];
            x = in2[i];
            dr = o;

            p = d0 + h0 * x; d0 = d1; d1 = x - h0 * p;
            q = d2 + h1 * d4; d2 = d3; d3 = d4 - h1 * q;
            d4 = x;
            x = p + q;

            if (K++)
            {
                K = 0;
                car0[(size_t) p0] = car1[(size_t) p1] = x;
                x = o - e; e = o;
                w = window[(size_t) p0]; fx = buf0[(size_t) p0] * w; buf0[(size_t) p0] = x * w;
                if (++p0 >= N) { lpc (buf0.data(), car0.data(), N, O); p0 = 0; }
                w = 1.0f - w; fx += buf1[(size_t) p1] * w; buf1[(size_t) p1] = x * w;
                if (++p1 >= N) { lpc (buf1.data(), car1.data(), N, O); p1 = 0; }
            }

            p = u0 + h0 * fx; u0 = u1; u1 = fx - h0 * p;
            q = u2 + h1 * u4; u2 = u3; u3 = u4 - h1 * q;
            u4 = fx;
            x = p + q;

            o = wet * x + dry * dr;
            outL[i] = o;
            outR[i] = o;
        }
        emphasis = e; pos = p0; FX = fx;

        const float den = 1.0e-10f;
        if (std::fabs (d0) < den) d0 = 0.0f;
        if (std::fabs (d1) < den) d1 = 0.0f;
        if (std::fabs (d2) < den) d2 = 0.0f;
        if (std::fabs (d3) < den) d3 = 0.0f;
        if (std::fabs (u0) < den) u0 = 0.0f;
        if (std::fabs (u1) < den) u1 = 0.0f;
        if (std::fabs (u2) < den) u2 = 0.0f;
        if (std::fabs (u3) < den) u3 = 0.0f;
    }
};

//==============================================================================
struct Rng
{
    unsigned int s = 12345u;
    float next() { s = s * 1664525u + 1013904223u; return (float) ((s >> 8) & 0xffffu) / 32768.0f - 1.0f; }
};

constexpr double kSr = 44100.0;

/** A sawtooth, which is what a talkbox is normally fed. */
void makeSaw (std::vector<float>& out, float hz, float amp)
{
    double phase = 0.0;
    const double inc = hz / kSr;
    for (auto& s : out)
    {
        s = amp * (float) (2.0 * phase - 1.0);
        phase += inc;
        if (phase >= 1.0) phase -= 1.0;
    }
}

/** Crude formant-ish voiced sound: a buzz with a couple of low resonances. */
void makeVoiced (std::vector<float>& out, float f0, float amp)
{
    double phase = 0.0;
    const double inc = f0 / kSr;
    for (size_t i = 0; i < out.size(); ++i)
    {
        const double t = 2.0 * M_PI * phase;
        out[i] = amp * (float) (std::sin (t) + 0.6 * std::sin (3.0 * t) + 0.3 * std::sin (7.0 * t));
        phase += inc;
        if (phase >= 1.0) phase -= 1.0;
    }
}

double rms (const std::vector<float>& v, size_t from, size_t to)
{
    double acc = 0.0;
    for (size_t i = from; i < to && i < v.size(); ++i) acc += (double) v[i] * v[i];
    return std::sqrt (acc / (double) (to - from));
}

double peak (const std::vector<float>& v, size_t from, size_t to)
{
    double m = 0.0;
    for (size_t i = from; i < to && i < v.size(); ++i) m = std::max (m, (double) std::fabs (v[i]));
    return m;
}

/** Runs the core over a whole signal in one go and returns the left output. */
std::vector<float> run (const TalkBoxCore::Params& p,
                        const std::vector<float>& inL,
                        const std::vector<float>& inR,
                        int blockSize = 512)
{
    TalkBoxCore core;
    core.prepare (kSr);
    core.setParams (p);

    std::vector<float> outL (inL.size()), outR (inL.size());

    for (size_t i = 0; i < inL.size(); i += (size_t) blockSize)
    {
        const int n = (int) std::min ((size_t) blockSize, inL.size() - i);
        core.setParams (p);
        core.process (inL.data() + i, inR.data() + i, outL.data() + i, outR.data() + i, n);
    }
    return outL;
}

//==============================================================================
void bypassMatchesOriginal()
{
    const size_t len = (size_t) (kSr * 2.0);
    std::vector<float> mod (len), car (len);

    // Modulator: voiced buzz with a noisy tail, so the LPC envelope moves.
    makeVoiced (mod, 120.0f, 0.4f);
    Rng rng;
    for (size_t i = len / 2; i < len; ++i) mod[i] = 0.3f * rng.next();
    makeSaw (car, 110.0f, 0.5f);

    for (float quality : { 0.0f, 0.5f, 1.0f })
    {
        for (int swap : { 0, 1 })
        {
            TalkBoxCore::Params p;
            p.wet = 0.5f; p.dry = 0.35f; p.quality = quality;
            p.swap = swap != 0;
            p.unvoiced = false; p.lowEnd = 0.0f;

            const auto got = run (p, mod, car);

            Reference ref;
            ref.suspend();
            ref.resume ((float) kSr, p.wet, p.dry, swap ? 1.0f : 0.0f, quality);
            std::vector<float> refL (len), refR (len);
            ref.process (mod.data(), car.data(), refL.data(), refR.data(), (int) len);

            double worst = 0.0;
            for (size_t i = 0; i < len; ++i)
                worst = std::max (worst, (double) std::fabs (got[i] - refL[i]));

            char buf[96];
            std::snprintf (buf, sizeof (buf), "quality=%.1f swap=%d maxdiff=%g", quality, swap, worst);
            check (worst == 0.0, "bypass is bit-identical to mda TalkBox", buf);
        }
    }
}

void latencyFollowsUnvoiced()
{
    TalkBoxCore core;
    core.prepare (kSr);

    TalkBoxCore::Params p;
    p.unvoiced = false;
    core.setParams (p);
    const int off = core.latencySamples();

    p.unvoiced = true;
    core.setParams (p);
    const int on = core.latencySamples();

    const int expected = (int) (kUvLookaheadMs * 0.001f * (float) kSr);

    char buf[96];
    std::snprintf (buf, sizeof (buf), "off=%d on=%d expected=%d", off, on, expected);
    check (off == 0 && on == expected, "latency is zero off, lookahead on", buf);

    // Upstream clamps its own rate to 96 kHz, but the lookahead has to track
    // the real one or it would be half as long in a 192 kHz session.
    bool allRates = true;
    std::string detail;
    for (double rate : { 44100.0, 48000.0, 96000.0, 176400.0, 192000.0 })
    {
        TalkBoxCore hi;
        hi.prepare (rate);
        TalkBoxCore::Params q;
        q.unvoiced = true;
        hi.setParams (q);

        const int want = (int) (kUvLookaheadMs * 0.001f * (float) rate);
        if (hi.latencySamples() != want) allRates = false;

        char one[48];
        std::snprintf (one, sizeof (one), "%gk=%d ", rate / 1000.0, hi.latencySamples());
        detail += one;
    }
    check (allRates, "lookahead tracks the real sample rate", detail);
}

void orderModeDoublesTheCoefficients()
{
    TalkBoxCore core;
    core.prepare (kSr);

    TalkBoxCore::Params p;
    p.quality = 1.0f;

    p.orderHigh = false;
    core.setParams (p);
    const int normal = core.analysisOrder();

    p.orderHigh = true;
    core.setParams (p);
    const int high = core.analysisOrder();

    // Both must stay inside the scratch arrays the LPC routines declare.
    bool bounded = true;
    for (double rate : { 44100.0, 48000.0, 96000.0, 192000.0 })
    {
        TalkBoxCore c2;
        c2.prepare (rate);
        for (float q : { 0.0f, 0.5f, 1.0f })
        {
            TalkBoxCore::Params r;
            r.quality = q;
            r.orderHigh = true;
            c2.setParams (r);
            if (c2.analysisOrder() < 1 || c2.analysisOrder() >= kOrdMax) bounded = false;
        }
    }

    char buf[96];
    std::snprintf (buf, sizeof (buf), "normal=%d high=%d bound=%d", normal, high, kOrdMax);
    check (normal == 22 && high == 44 && bounded, "order high doubles the LPC order", buf);
}

void orderNormalIsTheOriginal()
{
    // The default must still be the stock order, so Order is inert until asked
    // for. Bit-identical against the reference, which has no such control.
    const size_t len = (size_t) (kSr * 1.0);
    std::vector<float> mod (len), car (len);
    makeVoiced (mod, 120.0f, 0.4f);
    makeSaw (car, 110.0f, 0.5f);

    TalkBoxCore::Params p;
    p.wet = 0.5f; p.dry = 0.0f; p.quality = 1.0f; p.orderHigh = false;
    const auto normal = run (p, mod, car);

    Reference ref;
    ref.suspend();
    ref.resume ((float) kSr, p.wet, p.dry, 0.0f, p.quality);
    std::vector<float> refL (len), refR (len);
    ref.process (mod.data(), car.data(), refL.data(), refR.data(), (int) len);

    double worst = 0.0;
    for (size_t i = 0; i < len; ++i)
        worst = std::max (worst, (double) std::fabs (normal[i] - refL[i]));

    p.orderHigh = true;
    const auto high = run (p, mod, car);
    double changed = 0.0;
    for (size_t i = 0; i < len; ++i)
        changed = std::max (changed, (double) std::fabs (high[i] - normal[i]));

    char buf[96];
    std::snprintf (buf, sizeof (buf), "normal maxdiff=%g, high differs by %g", worst, changed);
    check (worst == 0.0 && changed > 1.0e-6, "order normal is the original, high is not", buf);
}


void fixedLookaheadDryOnlyKeepsSpeech()
{
    // Regression for Live: Unvoiced ON + Wet=0 + Dry=100 must never
    // be silent when the voice bus has audio. Output is the delayed voice.
    const size_t len = (size_t) (kSr * 0.25);
    std::vector<float> mod (len), car (len), outL (len), outR (len);
    for (size_t i = 0; i < len; ++i)
        mod[i] = (i % 2 == 0) ? 0.1f : 0.3f;
    makeSaw (car, 110.0f, 0.5f);

    TalkBoxCore core;
    core.prepare (kSr);
    core.useFixedLookahead (true);

    TalkBoxCore::Params p;
    p.unvoiced = true; p.wet = 0.0f; p.dry = 1.0f;
    core.setParams (p);

    const int latency = core.latencySamples();
    core.process (mod.data(), car.data(), outL.data(), outR.data(), (int) len);

    double maxError = 0.0;
    double outputPeak = 0.0;
    for (size_t i = 0; i < len; ++i)
    {
        const double expected = (i < (size_t) latency)
            ? 0.0 : 2.0 * (double) mod[i - (size_t) latency];
        maxError = std::max (maxError, std::fabs ((double) outL[i] - expected));
        outputPeak = std::max (outputPeak, std::fabs ((double) outL[i]));
    }

    char buf[128];
    std::snprintf (buf, sizeof (buf), "delay=%d maxerr=%.9g peak=%.4g",
                   latency, maxError, outputPeak);
    check (latency > 0 && maxError < 1.0e-6 && outputPeak > 0.1,
           "fixed-lookahead dry-only Unvoiced ON passes speech", buf);

    p.unvoiced = false;
    core.setParams (p);
    check (core.latencySamples() == latency,
           "fixed-lookahead latency does not change with Unvoiced toggle", "");
}

void unvoicedNeedsACarrier()
{
    // Broadband modulator that will latch the detector, with nothing to
    // modulate. The mic must not leak through on its own.
    const size_t len = (size_t) (kSr * 1.0);
    std::vector<float> mod (len), car (len, 0.0f);
    Rng rng;
    for (auto& s : mod) s = 0.4f * rng.next();

    TalkBoxCore::Params p;
    p.wet = 1.0f; p.dry = 0.0f; p.unvoiced = true; p.fricativeGainDb = 0.0f;

    const auto out = run (p, mod, car);
    const double pk = peak (out, len / 2, len);

    char buf[64];
    std::snprintf (buf, sizeof (buf), "peak=%g", pk);
    check (pk < 1.0e-6, "silent carrier keeps the passthrough shut", buf);
}

void fricativeGainScalesThePassthrough()
{
    // Sustained broadband modulator plus a real carrier: the gate saturates,
    // the vocoder is muted, and the output is the passthrough alone.
    const size_t len = (size_t) (kSr * 1.0);
    std::vector<float> mod (len), car (len);
    Rng rng;
    for (auto& s : mod) s = 0.4f * rng.next();
    makeSaw (car, 110.0f, 0.5f);

    TalkBoxCore::Params p;
    p.wet = 1.0f; p.dry = 0.0f; p.unvoiced = true;

    p.fricativeGainDb = 0.0f;
    const double at0 = rms (run (p, mod, car), len / 2, len);

    p.fricativeGainDb = -6.0f;
    const double atMinus6 = rms (run (p, mod, car), len / 2, len);

    p.fricativeGainDb = -3.0f;
    const double atMinus3 = rms (run (p, mod, car), len / 2, len);

    const double ratio6 = atMinus6 / at0;
    const double ratio3 = atMinus3 / at0;

    char buf[128];
    std::snprintf (buf, sizeof (buf), "-6dB=%.4f (want 0.5012)  -3dB=%.4f (want 0.7079)", ratio6, ratio3);
    check (std::fabs (ratio6 - 0.50119) < 0.01 && std::fabs (ratio3 - 0.70795) < 0.01,
           "fricative gain scales the passthrough", buf);
}

void unvoicedOffChangesNothing()
{
    // Fricative Gain must be inert while the passthrough is disabled.
    const size_t len = (size_t) (kSr * 0.5);
    std::vector<float> mod (len), car (len);
    Rng rng;
    for (auto& s : mod) s = 0.4f * rng.next();
    makeSaw (car, 110.0f, 0.5f);

    TalkBoxCore::Params p;
    p.wet = 1.0f; p.unvoiced = false;

    p.fricativeGainDb = -3.0f;
    const auto a = run (p, mod, car);
    p.fricativeGainDb = 12.0f;
    const auto b = run (p, mod, car);

    double worst = 0.0;
    for (size_t i = 0; i < len; ++i) worst = std::max (worst, (double) std::fabs (a[i] - b[i]));

    char buf[64];
    std::snprintf (buf, sizeof (buf), "maxdiff=%g", worst);
    check (worst == 0.0, "fricative gain is inert when unvoiced is off", buf);
}

void lowEndRestoresBottom()
{
    // A low carrier with a broadband modulator: the shelf should lift it.
    const size_t len = (size_t) (kSr * 2.0);
    std::vector<float> mod (len), car (len);
    Rng rng;
    for (auto& s : mod) s = 0.3f * rng.next();

    double phase = 0.0;
    for (auto& s : car)
    {
        s = 0.5f * (float) std::sin (2.0 * M_PI * phase);
        phase += 40.0 / kSr;
        if (phase >= 1.0) phase -= 1.0;
    }

    TalkBoxCore::Params p;
    p.wet = 1.0f; p.dry = 0.0f; p.unvoiced = false;

    p.lowEnd = 0.0f;
    const double flat = rms (run (p, mod, car), len / 2, len);
    p.lowEnd = 1.0f;
    const double lifted = rms (run (p, mod, car), len / 2, len);

    const double db = 20.0 * std::log10 (lifted / (flat > 0.0 ? flat : 1.0e-30));

    char buf[96];
    std::snprintf (buf, sizeof (buf), "+%.1f dB at 40 Hz", db);
    check (db > 9.0, "low end lifts a 40 Hz carrier", buf);
}

} // namespace

int main()
{
    std::printf ("MDA Talkbox Plus - DSP smoke test\n\n");

    bypassMatchesOriginal();
    orderModeDoublesTheCoefficients();
    orderNormalIsTheOriginal();
    latencyFollowsUnvoiced();
    fixedLookaheadDryOnlyKeepsSpeech();
    unvoicedOffChangesNothing();
    unvoicedNeedsACarrier();
    fricativeGainScalesThePassthrough();
    lowEndRestoresBottom();

    std::printf ("\n%s\n", failures == 0 ? "all checks passed" : "FAILURES PRESENT");
    return failures == 0 ? 0 : 1;
}
