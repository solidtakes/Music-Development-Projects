#include "TalkBoxCore.h"

namespace mdatb
{

//==============================================================================
void Biquad::setLowpass (float freq, float q, float srate) noexcept
{
    const float w0 = kTwoPi * freq / srate;
    const float cw = std::cos (w0);
    const float alpha = std::sin (w0) / (2.0f * q);
    const float a0 = 1.0f + alpha;
    b0 = ((1.0f - cw) * 0.5f) / a0;
    b1 = (1.0f - cw) / a0;
    b2 = b0;
    a1 = (-2.0f * cw) / a0;
    a2 = (1.0f - alpha) / a0;
}

void Biquad::setHighpass (float freq, float q, float srate) noexcept
{
    const float w0 = kTwoPi * freq / srate;
    const float cw = std::cos (w0);
    const float alpha = std::sin (w0) / (2.0f * q);
    const float a0 = 1.0f + alpha;
    b0 = ((1.0f + cw) * 0.5f) / a0;
    b1 = -(1.0f + cw) / a0;
    b2 = b0;
    a1 = (-2.0f * cw) / a0;
    a2 = (1.0f - alpha) / a0;
}

void Biquad::setLowShelf (float freq, float gain, float srate) noexcept
{
    const float a = std::sqrt (gain);
    const float w0 = kTwoPi * freq / srate;
    const float cw = std::cos (w0);
    const float alpha = std::sin (w0) * 0.70710678f;
    const float beta = 2.0f * std::sqrt (a) * alpha;
    const float ap1 = a + 1.0f;
    const float am1 = a - 1.0f;
    const float a0 = ap1 + am1 * cw + beta;
    b0 = (a * (ap1 - am1 * cw + beta)) / a0;
    b1 = (2.0f * a * (am1 - ap1 * cw)) / a0;
    b2 = (a * (ap1 - am1 * cw - beta)) / a0;
    a1 = (-2.0f * (am1 + ap1 * cw)) / a0;
    a2 = (ap1 + am1 * cw - beta) / a0;
}

//==============================================================================
/** Coefficient for a one-pole smoother with the given time constant. */
static float onePoleCoef (float ms, float sampleRate) noexcept
{
    const float samples = ms * 0.001f * sampleRate;
    if (samples < 1.0f)
        return 1.0f;
    return 1.0f - std::exp (-1.0f / samples);
}

static float dbToGain (float db) noexcept
{
    return std::pow (10.0f, db * 0.05f);
}

//==============================================================================
void LowEnd::prepare (float sampleRate) noexcept
{
    sr = sampleRate > 0.0f ? sampleRate : 44100.0f;
    dcR = 1.0f - kTwoPi * kLowEndDcHz / sr;
    current = -1.0f;
    reset();
}

void LowEnd::reset() noexcept
{
    shelf.reset();
    dcX1 = dcY1 = 0.0f;
}

bool LowEnd::setAmount (float amount) noexcept
{
    if (amount < 0.0f) amount = 0.0f;
    if (amount > 1.0f) amount = 1.0f;

    if (amount != current)
    {
        const bool wasActive = current > 0.0f;

        // Linear in amplitude rather than in decibels. That was originally a
        // constraint of the embedded target this stage came from, but it is
        // kept here so the knob taper and the published response table still
        // describe the same filter.
        const float gain = 1.0f + amount * (kLowEndMaxGain - 1.0f);
        shelf.setLowShelf (kLowEndHz, gain, sr);
        current = amount;

        if (! wasActive)
            reset();
    }

    return current > 0.0f;
}

float LowEnd::process (float x) noexcept
{
    const float s = shelf.process (x);
    const float y = s - dcX1 + dcR * dcY1;

    dcX1 = s;
    dcY1 = y;
    if (std::fabs (dcX1) < 1.0e-20f) dcX1 = 0.0f;
    if (std::fabs (dcY1) < 1.0e-20f) dcY1 = 0.0f;

    return y;
}

//==============================================================================
void Unvoiced::prepare (float sampleRate)
{
    const float srate = sampleRate > 0.0f ? sampleRate : 44100.0f;

    unsigned int len = (unsigned int) (kUvLookaheadMs * 0.001f * srate);
    if (len < 1) len = 1;

    low.setLowpass (kUvLowHz, 0.70711f, srate);
    high[0].setHighpass (kUvHighHz, kButterQ0, srate);
    high[1].setHighpass (kUvHighHz, kButterQ1, srate);
    pass[0].copyCoeffs (high[0]);
    pass[1].copyCoeffs (high[1]);

    bandCoef = onePoleCoef (kUvBandMs, srate);
    attackCoef = onePoleCoef (kUvAttackMs, srate);
    releaseCoef = onePoleCoef (kUvReleaseMs, srate);
    holdSamples = (unsigned int) (kUvHoldMs * 0.001f * srate);
    carrierCoef = onePoleCoef (kUvCarLevelMs, srate);
    carrierAttackCoef = onePoleCoef (kUvCarAttackMs, srate);
    carrierReleaseCoef = onePoleCoef (kUvCarReleaseMs, srate);

    delayLen = len;
    delayMod.assign (len, 0.0f);
    delayCar.assign (len, 0.0f);
    delayPos = 0;
    running = false;

    reset();
}

void Unvoiced::reset() noexcept
{
    low.reset();
    high[0].reset();
    high[1].reset();
    pass[0].reset();
    pass[1].reset();

    lowEnergy = highEnergy = 0.0f;
    gate = 0.0f;
    holdCounter = 0;
    latched = false;

    carrierEnergy = 0.0f;
    carrierGateValue = 0.0f;
    carrierLatched = false;
}

void Unvoiced::resetAll() noexcept
{
    std::fill (delayMod.begin(), delayMod.end(), 0.0f);
    std::fill (delayCar.begin(), delayCar.end(), 0.0f);
    delayPos = 0;
    reset();
}

float Unvoiced::detect (float mono) noexcept
{
    const float lowBand = low.process (mono);
    const float highBand = high[1].process (high[0].process (mono));

    lowEnergy += bandCoef * (lowBand * lowBand - lowEnergy);
    highEnergy += bandCoef * (highBand * highBand - highEnergy);

    if (latched)
    {
        if (highEnergy < kUvFloor * 0.5f || highEnergy < kUvOffRatio * lowEnergy)
            latched = false;
    }
    else if (highEnergy > kUvFloor && highEnergy > kUvOnRatio * lowEnergy)
    {
        latched = true;
    }

    if (latched)
    {
        holdCounter = holdSamples;
        gate += attackCoef * (1.0f - gate);
    }
    else if (holdCounter > 0)
    {
        --holdCounter;
    }
    else
    {
        gate -= releaseCoef * gate;
        if (gate < 1.0e-20f) gate = 0.0f;
    }

    return gate;
}

float Unvoiced::carrierGate (float energy) noexcept
{
    carrierEnergy += carrierCoef * (energy - carrierEnergy);

    if (carrierLatched)
    {
        if (carrierEnergy < kUvCarFloor * 0.5f) carrierLatched = false;
    }
    else if (carrierEnergy > kUvCarFloor)
    {
        carrierLatched = true;
    }

    if (carrierLatched)
    {
        carrierGateValue += carrierAttackCoef * (1.0f - carrierGateValue);
    }
    else
    {
        carrierGateValue -= carrierReleaseCoef * carrierGateValue;
        if (carrierGateValue < 1.0e-20f) carrierGateValue = 0.0f;
    }

    return carrierGateValue;
}

void Unvoiced::delay (float modIn, float carIn, float& modOut, float& carOut) noexcept
{
    const unsigned int p = delayPos;

    modOut = delayMod[p];
    carOut = delayCar[p];

    delayMod[p] = modIn;
    delayCar[p] = carIn;

    delayPos = (p + 1u) % delayLen;
}

float Unvoiced::band (float x) noexcept
{
    return pass[1].process (pass[0].process (x));
}

//==============================================================================
void TalkBoxCore::prepare (double sampleRate)
{
    srTrue = sampleRate > 0.0 ? (float) sampleRate : 44100.0f;

    float fs = srTrue;
    if (fs < 8000.0f)  fs = 8000.0f;
    if (fs > 96000.0f) fs = 96000.0f;
    sr = fs;

    car0.assign (kBufMax, 0.0f);
    car1.assign (kBufMax, 0.0f);
    buf0.assign (kBufMax, 0.0f);
    buf1.assign (kBufMax, 0.0f);
    window.assign (kBufMax, 0.0f);

    int n = (int) (0.01633f * fs);
    if (n > kBufMax) n = kBufMax;
    if (n < 1) n = 1;
    N = 0;             // force the window to be built
    rebuildWindow (n);

    uv.prepare (srTrue);
    lowEnd.prepare (srTrue);

    reset();
}

void TalkBoxCore::rebuildWindow (int n)
{
    if (n == N)
        return;

    N = n;
    const float dp = kTwoPi / (float) N;
    float p = 0.0f;
    for (int i = 0; i < N; ++i)
    {
        window[(size_t) i] = 0.5f - 0.5f * std::cos (p);
        p += dp;
    }
}

void TalkBoxCore::reset()
{
    pos = K = 0;
    emphasis = 0.0f;
    fx = 0.0f;

    u0 = u1 = u2 = u3 = u4 = 0.0f;
    d0 = d1 = d2 = d3 = d4 = 0.0f;

    std::fill (buf0.begin(), buf0.end(), 0.0f);
    std::fill (buf1.begin(), buf1.end(), 0.0f);
    std::fill (car0.begin(), car0.end(), 0.0f);
    std::fill (car1.begin(), car1.end(), 0.0f);

    uv.resetAll();
    lowEnd.reset();
}

void TalkBoxCore::setParams (const Params& p)
{
    // Upstream tapers, unchanged.
    wet = 0.5f * p.wet * p.wet;
    dry = 2.0f * p.dry * p.dry;
    swap = p.swap;

    // Recomputed every block, as upstream recomputes it on every parameter
    // change. The clamp is what keeps High inside the scratch arrays: 44
    // coefficients at 44.1 kHz against a bound of 49, and above roughly 48 kHz
    // the clamp is what caps it rather than the span.
    const float span = p.orderHigh ? kOrderSpanHigh : kOrderSpanNormal;
    O = (int) ((0.0001f + span * p.quality) * sr);
    if (O >= kOrdMax) O = kOrdMax - 1;
    if (O < 1) O = 1;

    const bool wantUnvoiced = p.unvoiced;
    if (wantUnvoiced != uv.running)
    {
        uv.reset();
        uv.running = wantUnvoiced;
    }
    unvoicedOn = wantUnvoiced;

    // Fricative Gain is only in effect while the passthrough is enabled; with
    // the feature off the passthrough term is not evaluated at all.
    passGain = kUvPassRef * dbToGain (p.fricativeGainDb);

    lowEndOn = lowEnd.setAmount (p.lowEnd);
}

int TalkBoxCore::latencySamples() const noexcept
{
    return (unvoicedOn || fixedLookahead) ? uv.lookaheadSamples() : 0;
}

void TalkBoxCore::process (const float* inL, const float* inR,
                           float* outL, float* outR, int numSamples, float* wetOut) noexcept
{
    int p0 = pos;
    int p1 = (pos + N / 2) % N;
    float e = emphasis;
    float localFx = fx;
    const float h0 = 0.3f, h1 = 0.77f;

    for (int i = 0; i < numSamples; ++i)
    {
        const float modLive = swap ? inR[i] : inL[i];
        const float carLive = swap ? inL[i] : inR[i];

        // Both conditions gate the passthrough: an unvoiced sound in the
        // modulator, and a carrier actually sounding to be replaced. Both are
        // measured on the live signal, so the gate leads the delayed audio it
        // is applied to by the lookahead.
        float gate = 0.0f;
        if (unvoicedOn)
            gate = uv.detect (modLive) * uv.carrierGate (carLive * carLive);

        float modDelayed, carDelayed;
        uv.delay (modLive, carLive, modDelayed, carDelayed);

        // Carrier and modulator are delayed together so the two stay aligned,
        // and the host is told about the latency so the output lands back on
        // the timeline. With the feature off nothing is delayed at all.
        // The host wrapper opts into fixed lookahead for both modes so toggling
        // Unvoiced cannot request a real-time DAW latency reconfiguration.
        // The library reference path retains its original zero-latency default.
        const float o = (unvoicedOn || fixedLookahead) ? modDelayed : modLive;
        float x = (unvoicedOn || fixedLookahead) ? carDelayed : carLive;
        const float dr = o;

        float passSample = 0.0f;
        float duck = 1.0f;
        if (unvoicedOn)
        {
            passSample = uv.band (o) * gate * passGain;
            duck = 1.0f - gate * (1.0f - kUvDuck);
        }

        float p = d0 + h0 * x;  d0 = d1;  d1 = x - h0 * p;
        float q = d2 + h1 * d4; d2 = d3;  d3 = d4 - h1 * q;
        d4 = x;
        x = p + q;

        if (K++)
        {
            K = 0;

            car0[(size_t) p0] = car1[(size_t) p1] = x;  // carrier input

            x = o - e;  e = o;  // 6 dB/oct pre-emphasis

            float w = window[(size_t) p0];
            localFx = buf0[(size_t) p0] * w;  buf0[(size_t) p0] = x * w;  // 50% overlapping hanning windows
            if (++p0 >= N) { lpc (buf0.data(), car0.data(), N, O);  p0 = 0; }

            w = 1.0f - w;
            localFx += buf1[(size_t) p1] * w;  buf1[(size_t) p1] = x * w;
            if (++p1 >= N) { lpc (buf1.data(), car1.data(), N, O);  p1 = 0; }
        }

        p = u0 + h0 * localFx; u0 = u1;  u1 = localFx - h0 * p;
        q = u2 + h1 * u4;      u2 = u3;  u3 = u4 - h1 * q;
        u4 = localFx;
        float lpcOut = p + q;

        // Restore the low end before the unvoiced mute, never after: a filter
        // downstream of the mute would ring on past it and leak vocoder tail
        // into the passage the mute is supposed to clear.
        if (lowEndOn)
            lpcOut = lowEnd.process (lpcOut);

        const float out = wet * (lpcOut * duck + passSample) + dry * dr;
        if (wetOut != nullptr)
            wetOut[i] = wet * (lpcOut * duck + passSample);
        outL[i] = out;
        outR[i] = out;
    }

    emphasis = e;
    pos = p0;
    fx = localFx;

    const float den = 1.0e-10f;  // anti-denormal
    if (std::fabs (d0) < den) d0 = 0.0f;
    if (std::fabs (d1) < den) d1 = 0.0f;
    if (std::fabs (d2) < den) d2 = 0.0f;
    if (std::fabs (d3) < den) d3 = 0.0f;
    if (std::fabs (u0) < den) u0 = 0.0f;
    if (std::fabs (u1) < den) u1 = 0.0f;
    if (std::fabs (u2) < den) u2 = 0.0f;
    if (std::fabs (u3) < den) u3 = 0.0f;
}

//==============================================================================
void TalkBoxCore::lpc (float* buf, float* car, int n, int o) noexcept
{
    float z[kOrdMax], r[kOrdMax], k[kOrdMax];
    float G, x;
    int i, j, nn = n;

    for (j = 0; j <= o; j++, nn--)  // buf[] is already emphasized and windowed
    {
        z[j] = r[j] = 0.0f;
        for (i = 0; i < nn; i++) r[j] += buf[i] * buf[i + j];  // autocorrelation
    }
    r[0] *= 1.001f;  // stability fix

    const float minimum = 0.00001f;
    if (r[0] < minimum) { for (i = 0; i < n; i++) buf[i] = 0.0f; return; }

    lpcDurbin (r, o, k, &G);  // calc reflection coeffs

    // k[0] is never written by lpcDurbin and never read by the lattice below,
    // so the clamp starts at 1 rather than 0.
    for (i = 1; i <= o; i++)
    {
        if (k[i] > 0.995f) k[i] = 0.995f; else if (k[i] < -0.995f) k[i] = -0.995f;
    }

    for (i = 0; i < n; i++)
    {
        x = G * car[i];
        for (j = o; j > 0; j--)  // lattice filter
        {
            x -= k[j] * z[j - 1];
            z[j] = z[j - 1] + k[j] * x;
        }
        buf[i] = z[0] = x;  // output buf[] will be windowed elsewhere
    }
}

void TalkBoxCore::lpcDurbin (const float* r, int p, float* k, float* g) noexcept
{
    int i, j;
    float a[kOrdMax], at[kOrdMax], e = r[0];

    for (i = 0; i <= p; i++) a[i] = at[i] = 0.0f;

    for (i = 1; i <= p; i++)
    {
        k[i] = -r[i];

        for (j = 1; j < i; j++)
        {
            at[j] = a[j];
            k[i] -= a[j] * r[i - j];
        }
        if (std::fabs (e) < 1.0e-20f) { e = 0.0f;  break; }
        k[i] /= e;

        a[i] = k[i];
        for (j = 1; j < i; j++) a[j] = at[j] + k[i] * at[i - j];

        e *= 1.0f - k[i] * k[i];
    }

    if (e < 1.0e-20f) e = 0.0f;
    *g = std::sqrt (e);
}

} // namespace mdatb
