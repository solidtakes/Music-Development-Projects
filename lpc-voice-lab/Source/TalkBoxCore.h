/*
 * MDA Talkbox Plus - DSP core.
 *
 * The LPC talkbox algorithm is Paul Kellett's mda TalkBox, taken from the
 * MIT-licensed source at https://github.com/pluginguru/mda-effects. The
 * unvoiced-passthrough and low-end-restoration stages are additions; see
 * README.md for what they do and why.
 *
 * This file is deliberately framework-free: plain C++ with <cmath> and
 * <vector>, no JUCE, so the signal path can be compiled and tested on its own.
 */

#pragma once

#include <algorithm>
#include <cmath>
#include <cstring>
#include <vector>

namespace mdatb
{

//==============================================================================
// Original mda TalkBox bounds. Both are load-bearing: every scratch array in
// the LPC routines is sized for ORD_MAX, and the analysis window for BUF_MAX.
static constexpr int  kBufMax = 1600;
static constexpr int  kOrdMax = 50;
static constexpr float kTwoPi = 6.28318530717958647692528676655901f;

//==============================================================================
// LPC analysis order. The mda algorithm derives it from the sample rate, which
// gives 4 to 22 coefficients across the Quality range at 44.1 kHz, or about 11
// resonances to cover the whole band. The high span roughly doubles that for a
// finer spectral envelope at the cost of proportional CPU: synthesis is
// O(order) per processed sample. Both stay under kOrdMax, which every scratch
// array in the LPC routines is sized for.
static constexpr float kOrderSpanNormal = 0.0004f;  // 22 at 44.1 kHz, the original
static constexpr float kOrderSpanHigh   = 0.0009f;  // 44 at 44.1 kHz

//==============================================================================
// Low end restoration.
//
// Before analysis the modulator is pre-emphasised by a first-order difference
// (the "x = o - e" below), a zero at DC worth about -41 dB at 30 Hz. That is
// ordinary LPC practice and is normally paired with a matching de-emphasis on
// the output, which this algorithm does not have: the two h0/h1 allpass
// networks around it are the decimation and interpolation pair for the
// half-rate processing, not a tilt correction. The wet path therefore carries a
// permanent +6 dB/octave tilt, which is why a talkbox sounds bright and thin.
//
// A strict inverse would be an integrator, unbounded at DC. This uses a bounded
// approximation instead: a low shelf that puts back the bottom octaves by a
// controllable amount, followed by a subsonic blocker so that boosting cannot
// pump DC or inaudible rumble into the output. At zero the whole stage is
// bypassed and the signal path is untouched.
static constexpr float kLowEndHz      = 250.0f;  // shelf corner
static constexpr float kLowEndMaxGain = 5.6f;    // ~ +15 dB at lowEnd = 1
static constexpr float kLowEndDcHz    = 18.0f;   // subsonic guard

//==============================================================================
// Unvoiced passthrough.
//
// Sibilants and stops (s, sh, f, t, k) carry almost all of their energy well
// above the range an LPC talkbox can reproduce from a pitched carrier, so the
// vocoder turns them into a dull rasp. Detecting them in the modulator and
// routing the modulator's own high band straight to the output restores the
// consonants, in the spirit of the Electrix Warp Factory.
//
// Detection compares energy in a high band against energy in a voiced band.
// Vowels put 25-35 dB more energy below 1 kHz than above 3 kHz; fricatives
// invert that, so an equal-energy crossing separates them with wide margin.
//
// Detection is not instant. After a loud vowel the low band has to decay before
// the ratio can cross, and an energy average sheds only 8.7 dB per time
// constant, so worst-case latency scales with kUvBandMs. Measured against
// synthetic speech, a loud vowel running straight into a fricative 30 dB below
// it takes about 18 ms to detect. That is why the signal path is delayed by
// kUvLookaheadMs: the gate is derived from the live signal but applied to the
// delayed one, so it leads the audio by the lookahead and the onset of a
// fricative is never clipped.
//
// The band average is short enough that the gaps between glottal pulses could
// in principle read as unvoiced; a sustained 85 Hz vowel (11.8 ms between
// pulses) was checked and the gate stays shut, since even a dip in the low band
// leaves the high band far below it.
//
// Hold must exceed the lookahead, otherwise release would start eating the
// consonant's own tail; release is kept short so the gate is out of the way
// again by the time the following vowel gets going.
//
// The gate is additionally conditioned on the carrier: the passthrough only
// ever replaces vocoder output, so with no carrier sounding there is nothing to
// replace and letting the modulator's high band through on its own would just
// be an open channel. Both conditions must hold, and while they do the vocoder
// is muted outright rather than merely ducked, so none of the consonant's
// energy reaches the output through the LPC path.
//
// Nothing switches instantaneously. One envelope with a short attack, a hold,
// and a short release drives the passthrough and the mute together, so the
// crossover between the two paths is always a ramp.
//
// Thresholds are fixed by design. The only controls are on/off and the level
// the passthrough is substituted at (Fricative Gain).
static constexpr float kUvLookaheadMs = 25.0f;
static constexpr float kUvHighHz      = 3000.0f;  // sibilant band, 4th-order Butterworth
static constexpr float kUvLowHz       = 1000.0f;  // voiced band, 2nd-order Butterworth
static constexpr float kUvBandMs      = 2.0f;     // band energy averaging
static constexpr float kUvAttackMs    = 1.5f;
static constexpr float kUvHoldMs      = 28.0f;    // must exceed the lookahead
static constexpr float kUvReleaseMs   = 6.0f;
static constexpr float kUvOnRatio     = 1.0f;     // high band energy exceeds low band
static constexpr float kUvOffRatio    = 0.4f;     // hysteresis, prevents chatter
static constexpr float kUvFloor       = 1.6e-5f;  // ~ -48 dBFS, keeps hiss out
static constexpr float kUvDuck        = 0.0f;     // vocoder level while unvoiced: muted

// Passthrough level at Fricative Gain = 0 dB, referred to the node the vocoder
// output arrives at. Chosen so 0 dB is a level-matched swap for the vocoder
// output it replaces; the default of -3 dB sits just under that.
static constexpr float kUvPassRef = 6.0f;

static constexpr float kUvCarFloor      = 1.0e-6f;  // ~ -60 dBFS, carrier counts as sounding
static constexpr float kUvCarLevelMs    = 5.0f;     // carrier level averaging
static constexpr float kUvCarAttackMs   = 1.0f;
static constexpr float kUvCarReleaseMs  = 30.0f;    // rides over note gaps and decays

static constexpr float kButterQ0 = 0.54120f;  // cascade Qs for 4th-order Butterworth
static constexpr float kButterQ1 = 1.30656f;

//==============================================================================
/** RBJ cookbook biquad, coefficients normalised to a0. */
struct Biquad
{
    float b0 = 1.0f, b1 = 0.0f, b2 = 0.0f, a1 = 0.0f, a2 = 0.0f;
    float z1 = 0.0f, z2 = 0.0f;

    void reset() noexcept { z1 = z2 = 0.0f; }

    void copyCoeffs (const Biquad& o) noexcept
    {
        b0 = o.b0; b1 = o.b1; b2 = o.b2; a1 = o.a1; a2 = o.a2;
    }

    void setLowpass  (float freq, float q, float sr) noexcept;
    void setHighpass (float freq, float q, float sr) noexcept;

    /** Low shelf, S = 1. Takes linear amplitude gain rather than decibels, so
        that the Low End taper matches the reference implementation exactly. */
    void setLowShelf (float freq, float gain, float sr) noexcept;

    /** Transposed direct form II. */
    float process (float x) noexcept
    {
        const float y = b0 * x + z1;
        z1 = b1 * x - a1 * y + z2;
        z2 = b2 * x - a2 * y;
        if (std::fabs (z1) < 1.0e-20f) z1 = 0.0f;
        if (std::fabs (z2) < 1.0e-20f) z2 = 0.0f;
        return y;
    }
};

//==============================================================================
/** Shelf followed by a first-order subsonic blocker. The blocker is the plain
    y = x - x1 + r*y1 form rather than a biquad, which stays well conditioned in
    single precision at a corner this low. */
class LowEnd
{
public:
    void prepare (float sampleRate) noexcept;
    void reset() noexcept;

    /** Recomputes coefficients if the amount changed. Returns true if the stage
        is active at all; at zero it is bypassed and the path is untouched. */
    bool setAmount (float amount) noexcept;

    float process (float x) noexcept;

private:
    Biquad shelf;
    float sr = 44100.0f;
    float dcX1 = 0.0f, dcY1 = 0.0f, dcR = 0.0f;
    float current = -1.0f;  // forces a first update
};

//==============================================================================
/** Detector and gate for the unvoiced passthrough. Modulator and carrier are
    both single channel here, matching the mda TalkBox topology. */
class Unvoiced
{
public:
    void prepare (float sampleRate);

    /** Clears detection state without discarding delay history, so toggling the
        feature on mid-signal resumes from live audio rather than a stale burst. */
    void reset() noexcept;

    /** Clears everything including the delay lines. */
    void resetAll() noexcept;

    int lookaheadSamples() const noexcept { return (int) delayLen; }

    /** Smoothed gate for the incoming (undelayed) modulator sample. */
    float detect (float mono) noexcept;

    /** Is the carrier sounding? Release is slow enough to ride over note gaps
        and decay tails, which keeps the passthrough from dropping out in the
        middle of a phrase. */
    float carrierGate (float energy) noexcept;

    /** Reads the lookahead tap, then stores the current sample. Always called so
        the delay stays current whether or not the feature is engaged. */
    void delay (float modIn, float carIn, float& modOut, float& carOut) noexcept;

    /** The passthrough band itself, filtered from the delayed modulator. */
    float band (float x) noexcept;

    bool running = false;  // feature state the audio thread last saw

private:
    Biquad low;                 // voiced band lowpass, detector
    Biquad high[2];             // sibilant band highpass sections, detector
    Biquad pass[2];             // the same cascade, passthrough path
    float lowEnergy = 0.0f, highEnergy = 0.0f;
    float bandCoef = 0.0f, attackCoef = 0.0f, releaseCoef = 0.0f;
    float gate = 0.0f;
    unsigned int holdSamples = 0, holdCounter = 0;
    bool latched = false;

    float carrierEnergy = 0.0f;
    float carrierCoef = 0.0f, carrierAttackCoef = 0.0f, carrierReleaseCoef = 0.0f;
    float carrierGateValue = 0.0f;
    bool carrierLatched = false;

    std::vector<float> delayMod, delayCar;
    unsigned int delayLen = 1, delayPos = 0;
};

//==============================================================================
/** The mda TalkBox algorithm plus the two added stages.

    Input topology is the original's: one channel carries the modulator (voice),
    the other the carrier (synth), selected by @c swap. Output is mono, written
    to both channels, exactly as upstream. */
class TalkBoxCore
{
public:
    struct Params
    {
        float wet = 0.5f;              // 0..1, upstream taper applied internally
        float dry = 0.0f;              // 0..1, upstream taper applied internally
        bool  swap = false;            // false: carrier is right, true: carrier is left
        float quality = 1.0f;          // 0..1
        bool  orderHigh = false;       // doubles the LPC analysis order
        bool  unvoiced = false;
        float fricativeGainDb = -3.0f; // only in effect while unvoiced is on
        float lowEnd = 0.0f;           // 0..1
    };

    void prepare (double sampleRate);
    void reset();

    /** Host wrapper option: apply the existing lookahead to both modes, so
        reported PDC never changes inside the audio callback. Off by default
        to preserve the upstream DSP's zero-latency original mode. */
    void useFixedLookahead (bool enabled) noexcept { fixedLookahead = enabled; }

    /** Cheap enough to call every block; only recomputes what changed. */
    void setParams (const Params& p);

    /** Samples of lookahead currently in the signal path: the unvoiced
        lookahead while that feature is on, zero otherwise. */
    int latencySamples() const noexcept;

    /** Number of LPC coefficients currently in use. */
    int analysisOrder() const noexcept { return O; }

    /** Processes in place or out of place; in/out may alias. */
    void process (const float* inL, const float* inR,
                  float* outL, float* outR, int numSamples, float* wetOut = nullptr) noexcept;

private:
    void lpc (float* buf, float* car, int n, int o) noexcept;
    static void lpcDurbin (const float* r, int p, float* k, float* g) noexcept;
    void rebuildWindow (int n);

    // Upstream clamps the rate to 8-96 kHz before sizing the analysis window
    // and the LPC order, so that stays as it was. The added stages need the
    // real rate instead, or their corner frequencies and the lookahead length
    // would come out wrong in a 176.4 or 192 kHz session.
    float sr = 44100.0f;
    float srTrue = 44100.0f;

    // Upstream state, names kept so the algorithm stays recognisable.
    std::vector<float> car0, car1, window, buf0, buf1;
    float emphasis = 0.0f, fx = 0.0f;
    int K = 0, N = 0, O = 0, pos = 0;
    float d0 = 0, d1 = 0, d2 = 0, d3 = 0, d4 = 0;
    float u0 = 0, u1 = 0, u2 = 0, u3 = 0, u4 = 0;

    // Derived per-block from Params.
    float wet = 0.125f, dry = 0.0f;
    bool swap = false;
    bool unvoicedOn = false;
    bool fixedLookahead = false;
    bool lowEndOn = false;
    float passGain = 0.0f;

    Unvoiced uv;
    LowEnd lowEnd;
};

} // namespace mdatb
