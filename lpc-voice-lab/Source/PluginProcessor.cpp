#include "PluginProcessor.h"
#include "PluginEditor.h"

#include <cmath>

namespace
{
    juce::String percentString (float value, int)
    {
        // Upstream displays wet and dry as 200% of the raw parameter.
        return juce::String (juce::roundToInt (200.0f * value)) + " %";
    }
}

//==============================================================================
juce::AudioProcessorValueTreeState::ParameterLayout
LPCVoiceLabProcessor::createParameterLayout()
{
    using namespace juce;

    AudioProcessorValueTreeState::ParameterLayout layout;

    const NormalisableRange<float> unitRange { 0.0f, 1.0f };

    // -- original mda TalkBox parameters, order and defaults unchanged --------

    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "wet", 1 }, "Wet", unitRange, 0.5f,
        AudioParameterFloatAttributes().withStringFromValueFunction (percentString)));

    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "dry", 1 }, "Dry", unitRange, 0.0f,
        AudioParameterFloatAttributes().withStringFromValueFunction (percentString)));

    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "quality", 1 }, "Quality", unitRange, 1.0f,
        AudioParameterFloatAttributes().withStringFromValueFunction (
            [] (float v, int) { return String (roundToInt (5.0f + 95.0f * v * v)); })));

    // -- additions -----------------------------------------------------------

    // Sits next to Quality because it rescales what Quality means: it doubles
    // the number of LPC coefficients the same knob sweep produces.
    layout.add (std::make_unique<AudioParameterChoice> (
        ParameterID { "order", 1 }, "Order", StringArray { "Normal", "High" }, 0));

    layout.add (std::make_unique<AudioParameterBool> (
        ParameterID { "unvoiced", 1 }, "Unvoiced", false));

    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "fricative", 1 }, "Fricative Gain",
        NormalisableRange<float> { -24.0f, 12.0f, 0.1f }, -3.0f,
        AudioParameterFloatAttributes()
            .withLabel ("dB")
            .withStringFromValueFunction ([] (float v, int) { return String (v, 1) + " dB"; })));

    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "lowend", 1 }, "Low End", unitRange, 0.0f,
        AudioParameterFloatAttributes().withStringFromValueFunction (
            [] (float v, int) { return String (roundToInt (100.0f * v)) + " %"; })));

    // New parameters are appended. Original Alpha 0.2 parameter IDs unchanged.
    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "micgain", 1 }, "Mic In",
        NormalisableRange<float> { -24.0f, 18.0f, 0.1f }, 0.0f));
    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "cargain", 1 }, "Carrier In",
        NormalisableRange<float> { -24.0f, 18.0f, 0.1f }, 0.0f));
    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "outgain", 1 }, "Effect Out",
        NormalisableRange<float> { -24.0f, 18.0f, 0.1f }, 0.0f));
    layout.add (std::make_unique<AudioParameterBool> (
        ParameterID { "bypass", 1 }, "Bypass", false));
    layout.add (std::make_unique<AudioParameterBool> (
        ParameterID { "retro", 1 }, "Retro", false));
    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "grit", 1 }, "Grit", unitRange, 0.0f));
    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { "bandwidth", 1 }, "Bandwidth",
        NormalisableRange<float> { 1800.0f, 18000.0f, 50.0f, 0.5f }, 18000.0f));

    return layout;
}

//==============================================================================
LPCVoiceLabProcessor::LPCVoiceLabProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput  ("Voice",     juce::AudioChannelSet::stereo(), true)
                          .withInput  ("Sidechain", juce::AudioChannelSet::stereo(), false)
                          .withOutput ("Output",    juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "PARAMS", createParameterLayout())
{
    pWet      = apvts.getRawParameterValue ("wet");
    pDry      = apvts.getRawParameterValue ("dry");
    pQuality  = apvts.getRawParameterValue ("quality");
    pOrder    = apvts.getRawParameterValue ("order");
    pUnvoiced = apvts.getRawParameterValue ("unvoiced");
    pFricGain = apvts.getRawParameterValue ("fricative");
    pLowEnd   = apvts.getRawParameterValue ("lowend");
    pMicGain  = apvts.getRawParameterValue ("micgain");
    pCarGain  = apvts.getRawParameterValue ("cargain");
    pOutGain  = apvts.getRawParameterValue ("outgain");
    pBypass   = apvts.getRawParameterValue ("bypass");
    pRetro    = apvts.getRawParameterValue ("retro");
    pGrit     = apvts.getRawParameterValue ("grit");
    pBandwidth= apvts.getRawParameterValue ("bandwidth");
}

//==============================================================================
void LPCVoiceLabProcessor::prepareToPlay (double sampleRate, int)
{
    core.prepare (sampleRate);
    core.useFixedLookahead (true);
    // Constant, declared before processing starts. Never change host PDC
    // from the audio callback when Unvoiced is toggled.
    reportedLatency = core.latencySamples();
    setLatencySamples (reportedLatency);

    sampleRateHz = (float) juce::jmax (1.0, sampleRate);
    retroLP = 0.0f;
    micGainSmooth.reset (sampleRate, 0.020);
    carGainSmooth.reset (sampleRate, 0.020);
    outGainSmooth.reset (sampleRate, 0.020);
    retroMixSmooth.reset (sampleRate, 0.025);
    lpAlphaSmooth.reset (sampleRate, 0.020);
    driveSmooth.reset (sampleRate, 0.020);

    micGainSmooth.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (pMicGain->load()));
    carGainSmooth.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (pCarGain->load()));
    outGainSmooth.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (pOutGain->load()));
    retroMixSmooth.setCurrentAndTargetValue (pRetro->load() >= 0.5f ? 1.0f : 0.0f);
    driveSmooth.setCurrentAndTargetValue (1.0f + 8.0f * pGrit->load());
    const float cutoff = pBandwidth->load();
    const float alpha = 1.0f - std::exp (-juce::MathConstants<float>::twoPi * cutoff / sampleRateHz);
    lpAlphaSmooth.setCurrentAndTargetValue (alpha);
}

void LPCVoiceLabProcessor::releaseResources()
{
}


bool LPCVoiceLabProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto voice = layouts.getMainInputChannelSet();
    const auto sidechain = layouts.getChannelSet (true, 1);
    const auto output = layouts.getMainOutputChannelSet();
    return voice == juce::AudioChannelSet::stereo()
        && output == juce::AudioChannelSet::stereo()
        && (sidechain.isDisabled() || sidechain == juce::AudioChannelSet::mono()
                                    || sidechain == juce::AudioChannelSet::stereo());
}

void LPCVoiceLabProcessor::processBlock (juce::AudioBuffer<float>& buffer,
                                        juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;
    const int numSamples = buffer.getNumSamples();
    if (numSamples <= 0)
        return;

    // Voice is the main input; carrier comes from the external sidechain.
    // No carrier bus = silence, so a live microphone never accidentally leaks.
    auto voice = getBusBuffer (buffer, true, 0);
    auto carrier = getBusBuffer (buffer, true, 1);
    auto output = getBusBuffer (buffer, false, 0);
    const bool bypassed = pBypass->load() >= 0.5f;
    if (voice.getNumChannels() == 0 || output.getNumChannels() < 2
        || (carrier.getNumChannels() == 0 && ! bypassed))
    {
        output.clear();
        meterVoice.store (0.0f, std::memory_order_relaxed);
        meterCarrier.store (0.0f, std::memory_order_relaxed);
        meterOutput.store (0.0f, std::memory_order_relaxed);
        return;
    }

    // Smoothing is updated outside sample loops; sample iteration itself
    // is allocation-free. New gain defaults are exactly unity.
    micGainSmooth.setTargetValue (juce::Decibels::decibelsToGain (pMicGain->load()));
    carGainSmooth.setTargetValue (juce::Decibels::decibelsToGain (pCarGain->load()));
    outGainSmooth.setTargetValue (juce::Decibels::decibelsToGain (pOutGain->load()));
    retroMixSmooth.setTargetValue (pRetro->load() >= 0.5f ? 1.0f : 0.0f);
    driveSmooth.setTargetValue (1.0f + 8.0f * pGrit->load());
    const float cutoff = juce::jmin (pBandwidth->load(), sampleRateHz * 0.45f);
    lpAlphaSmooth.setTargetValue (
        1.0f - std::exp (-juce::MathConstants<float>::twoPi * cutoff / sampleRateHz));

    mdatb::TalkBoxCore::Params p;
    p.wet             = pWet->load();
    p.dry             = pDry->load();
    p.swap            = false; // LPC core channel 0 is voice; channel 1 carrier
    p.quality         = pQuality->load();
    p.orderHigh       = pOrder->load() >= 0.5f;
    p.unvoiced        = pUnvoiced->load() >= 0.5f;
    p.fricativeGainDb = pFricGain->load();
    p.lowEnd          = pLowEnd->load();
    if (bypassed)
    {
        // MDA raw Dry is 2 * dry^2; sqrt(0.5) gives unity voice.
        p.wet = 0.0f;
        p.dry = 0.70710678118f;
    }
    core.setParams (p);

    // Fixed 25 ms latency was already declared in prepareToPlay.
    // Do not notify the DAW or allocate while rendering audio.

    const float* modL = voice.getReadPointer (0);
    const float* modR = voice.getReadPointer (voice.getNumChannels() > 1 ? 1 : 0);
    const bool hasCarrier = carrier.getNumChannels() > 0;
    const float* carL = hasCarrier ? carrier.getReadPointer (0) : nullptr;
    const float* carR = hasCarrier ? carrier.getReadPointer (carrier.getNumChannels() > 1 ? 1 : 0) : nullptr;
    float* outL = output.getWritePointer (0);
    float* outR = output.getWritePointer (1);

    // No heap allocation in processBlock, and host blocks may exceed kChunkSize.
    // Read input into scratch before writing: the main input aliases the output.
    float voicePeak = 0.0f;
    float carrierPeak = 0.0f;
    float outputPeak = 0.0f;
    for (int offset = 0; offset < numSamples; offset += kChunkSize)
    {
        const int count = juce::jmin (kChunkSize, numSamples - offset);
        for (int i = 0; i < count; ++i)
        {
            const float inputGain = micGainSmooth.getNextValue();
            const float carrierGain = carGainSmooth.getNextValue();
            voiceScratch[(size_t) i] = 0.5f * (modL[offset + i] + modR[offset + i]) * inputGain;
            carrierScratch[(size_t) i] = hasCarrier
                ? 0.5f * (carL[offset + i] + carR[offset + i]) * carrierGain : 0.0f;
            voicePeak = juce::jmax (voicePeak, std::abs (voiceScratch[(size_t) i]));
            carrierPeak = juce::jmax (carrierPeak, std::abs (carrierScratch[(size_t) i]));
        }
        core.process (voiceScratch.data(), carrierScratch.data(),
                      outL + offset, outR + offset, count);

        // Opt-in first-pass lo-fi colouring. Zero retro mix reproduces
        // the Alpha 0.2 wet+dry signal (with new gains at their unity defaults).
        for (int i = 0; i < count; ++i)
        {
            const float clean = outL[offset + i];
            const float alpha = lpAlphaSmooth.getNextValue();
            retroLP += alpha * (clean - retroLP);
            const float drive = driveSmooth.getNextValue();
            const float saturated = std::tanh (retroLP * drive) / std::tanh (drive);
            const float amount = bypassed ? 0.0f : retroMixSmooth.getNextValue();
            const float mixed = clean + amount * (saturated - clean);
            const float y = mixed * outGainSmooth.getNextValue();
            outL[offset + i] = y;
            outR[offset + i] = y;
            outputPeak = juce::jmax (outputPeak, std::abs (y));
        }
    }
    meterVoice.store (voicePeak, std::memory_order_relaxed);
    meterCarrier.store (carrierPeak, std::memory_order_relaxed);
    meterOutput.store (outputPeak, std::memory_order_relaxed);
}

//==============================================================================
juce::AudioProcessorEditor* LPCVoiceLabProcessor::createEditor()
{
    return new LPCVoiceLabEditor (*this);
}

void LPCVoiceLabProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (auto xml = apvts.copyState().createXml())
        copyXmlToBinary (*xml, destData);
}

void LPCVoiceLabProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (apvts.state.getType()))
            apvts.replaceState (juce::ValueTree::fromXml (*xml));
}

//==============================================================================
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new LPCVoiceLabProcessor();
}
