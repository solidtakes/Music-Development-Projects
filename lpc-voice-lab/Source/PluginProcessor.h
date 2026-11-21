#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include "TalkBoxCore.h"

//==============================================================================
class MDATalkboxPlusProcessor final : public juce::AudioProcessor
{
public:
    MDATalkboxPlusProcessor();
    ~MDATalkboxPlusProcessor() override = default;

    //==========================================================================
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    //==========================================================================
    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }

    bool acceptsMidi() const override  { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return "Talkbox"; }
    void changeProgramName (int, const juce::String&) override {}

    //==========================================================================
    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState apvts;

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    mdatb::TalkBoxCore core;

    std::atomic<float>* pWet      = nullptr;
    std::atomic<float>* pDry      = nullptr;
    std::atomic<float>* pCarrier  = nullptr;
    std::atomic<float>* pQuality  = nullptr;
    std::atomic<float>* pOrder    = nullptr;
    std::atomic<float>* pUnvoiced = nullptr;
    std::atomic<float>* pFricGain = nullptr;
    std::atomic<float>* pLowEnd   = nullptr;

    int reportedLatency = 0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MDATalkboxPlusProcessor)
};
