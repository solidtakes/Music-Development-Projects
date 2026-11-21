#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include "TalkBoxCore.h"
#include <array>

//==============================================================================
class LPCVoiceLabProcessor final : public juce::AudioProcessor
{
public:
    LPCVoiceLabProcessor();
    ~LPCVoiceLabProcessor() override = default;

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

    // Read-only, normalized block-peak metering for the UI. Audio thread
    // writes atomics; message thread reads. No added DSP processing.
    std::atomic<float> meterVoice { 0.0f };
    std::atomic<float> meterCarrier { 0.0f };
    std::atomic<float> meterOutput { 0.0f };

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    mdatb::TalkBoxCore core;

    std::atomic<float>* pWet      = nullptr;
    std::atomic<float>* pDry      = nullptr;
    std::atomic<float>* pQuality  = nullptr;
    std::atomic<float>* pOrder    = nullptr;
    std::atomic<float>* pUnvoiced = nullptr;
    std::atomic<float>* pFricGain = nullptr;
    std::atomic<float>* pLowEnd   = nullptr;
    std::atomic<float>* pMicGain  = nullptr;
    std::atomic<float>* pCarGain  = nullptr;
    std::atomic<float>* pOutGain  = nullptr;
    std::atomic<float>* pBypass   = nullptr;
    std::atomic<float>* pRetro    = nullptr;
    std::atomic<float>* pGrit     = nullptr;
    std::atomic<float>* pBandwidth = nullptr;

    static constexpr int kChunkSize = 1024;
    std::array<float, kChunkSize> voiceScratch {};
    std::array<float, kChunkSize> carrierScratch {};
    int reportedLatency = 0;
    float sampleRateHz = 44100.0f;
    float retroLP = 0.0f;
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> micGainSmooth;
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> carGainSmooth;
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> outGainSmooth;
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> retroMixSmooth;
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> lpAlphaSmooth;
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> driveSmooth;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (LPCVoiceLabProcessor)
};
