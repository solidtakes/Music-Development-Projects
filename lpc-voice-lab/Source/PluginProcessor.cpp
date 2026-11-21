#include "PluginProcessor.h"

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
    if (voice.getNumChannels() == 0 || carrier.getNumChannels() == 0
        || output.getNumChannels() < 2)
    {
        output.clear();
        return;
    }

    mdatb::TalkBoxCore::Params p;
    p.wet             = pWet->load();
    p.dry             = pDry->load();
    p.swap            = false; // LPC core channel 0 is voice; channel 1 carrier
    p.quality         = pQuality->load();
    p.orderHigh       = pOrder->load() >= 0.5f;
    p.unvoiced        = pUnvoiced->load() >= 0.5f;
    p.fricativeGainDb = pFricGain->load();
    p.lowEnd          = pLowEnd->load();
    core.setParams (p);

    // Fixed 25 ms latency was already declared in prepareToPlay.
    // Do not notify the DAW or allocate while rendering audio.

    const float* modL = voice.getReadPointer (0);
    const float* modR = voice.getReadPointer (voice.getNumChannels() > 1 ? 1 : 0);
    const float* carL = carrier.getReadPointer (0);
    const float* carR = carrier.getReadPointer (carrier.getNumChannels() > 1 ? 1 : 0);
    float* outL = output.getWritePointer (0);
    float* outR = output.getWritePointer (1);

    // No heap allocation in processBlock, and host blocks may exceed kChunkSize.
    // Read input into scratch before writing: the main input aliases the output.
    for (int offset = 0; offset < numSamples; offset += kChunkSize)
    {
        const int count = juce::jmin (kChunkSize, numSamples - offset);
        for (int i = 0; i < count; ++i)
        {
            voiceScratch[(size_t) i] = 0.5f * (modL[offset + i] + modR[offset + i]);
            carrierScratch[(size_t) i] = 0.5f * (carL[offset + i] + carR[offset + i]);
        }
        core.process (voiceScratch.data(), carrierScratch.data(),
                      outL + offset, outR + offset, count);
    }
}

//==============================================================================
juce::AudioProcessorEditor* LPCVoiceLabProcessor::createEditor()
{
    // Upstream had no custom interface and relied on the host's generic panel.
    return new juce::GenericAudioProcessorEditor (*this);
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
