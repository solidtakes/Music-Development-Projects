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
MDATalkboxPlusProcessor::createParameterLayout()
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

    // Which input channel carries the carrier (the synth). The other channel is
    // the modulator (the voice). Index order matches upstream's swap flag.
    layout.add (std::make_unique<AudioParameterChoice> (
        ParameterID { "carrier", 1 }, "Carrier", StringArray { "Right", "Left" }, 0));

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
MDATalkboxPlusProcessor::MDATalkboxPlusProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "PARAMS", createParameterLayout())
{
    pWet      = apvts.getRawParameterValue ("wet");
    pDry      = apvts.getRawParameterValue ("dry");
    pCarrier  = apvts.getRawParameterValue ("carrier");
    pQuality  = apvts.getRawParameterValue ("quality");
    pOrder    = apvts.getRawParameterValue ("order");
    pUnvoiced = apvts.getRawParameterValue ("unvoiced");
    pFricGain = apvts.getRawParameterValue ("fricative");
    pLowEnd   = apvts.getRawParameterValue ("lowend");
}

//==============================================================================
void MDATalkboxPlusProcessor::prepareToPlay (double sampleRate, int)
{
    core.prepare (sampleRate);
    reportedLatency = 0;
    setLatencySamples (0);
}

void MDATalkboxPlusProcessor::releaseResources()
{
}

bool MDATalkboxPlusProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    // The algorithm needs two distinct input channels: one modulator, one
    // carrier. Stereo in, stereo out, exactly as upstream.
    return layouts.getMainInputChannelSet()  == juce::AudioChannelSet::stereo()
        && layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo();
}

void MDATalkboxPlusProcessor::processBlock (juce::AudioBuffer<float>& buffer,
                                            juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;

    const int numSamples = buffer.getNumSamples();

    for (int ch = getTotalNumInputChannels(); ch < getTotalNumOutputChannels(); ++ch)
        buffer.clear (ch, 0, numSamples);

    if (buffer.getNumChannels() < 2 || numSamples <= 0)
        return;

    mdatb::TalkBoxCore::Params p;
    p.wet             = pWet->load();
    p.dry             = pDry->load();
    p.swap            = pCarrier->load() >= 0.5f;   // index 1 == carrier on the left
    p.quality         = pQuality->load();
    p.orderHigh       = pOrder->load() >= 0.5f;
    p.unvoiced        = pUnvoiced->load() >= 0.5f;
    p.fricativeGainDb = pFricGain->load();
    p.lowEnd          = pLowEnd->load();

    core.setParams (p);

    // Enabling the passthrough puts a lookahead delay in the signal path. The
    // host is told about it so the wet output lands back on the timeline; with
    // the feature off the latency is zero and the path is the original one.
    const int latency = core.latencySamples();
    if (latency != reportedLatency)
    {
        reportedLatency = latency;
        setLatencySamples (latency);
    }

    const float* inL = buffer.getReadPointer (0);
    const float* inR = buffer.getReadPointer (1);
    float* outL = buffer.getWritePointer (0);
    float* outR = buffer.getWritePointer (1);

    core.process (inL, inR, outL, outR, numSamples);
}

//==============================================================================
juce::AudioProcessorEditor* MDATalkboxPlusProcessor::createEditor()
{
    // Upstream had no custom interface and relied on the host's generic panel.
    return new juce::GenericAudioProcessorEditor (*this);
}

void MDATalkboxPlusProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (auto xml = apvts.copyState().createXml())
        copyXmlToBinary (*xml, destData);
}

void MDATalkboxPlusProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (apvts.state.getType()))
            apvts.replaceState (juce::ValueTree::fromXml (*xml));
}

//==============================================================================
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new MDATalkboxPlusProcessor();
}
