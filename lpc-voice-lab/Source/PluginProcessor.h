#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include "AirBand.h"
#include "VoiceEngine.h"
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

    // Optional preset metadata, deliberately not a new automatable parameter.
    using VoiceMode = lpc::VoiceMode;
    VoiceMode getVoiceMode() const noexcept { return voiceMode.load (std::memory_order_relaxed); }

    // notifyHost = true for user-driven changes (the dropdown, presets): the
    // host is told the non-parameter state changed so it can offer to save.
    // A host-driven session restore passes false: the host supplied that
    // state itself, so reporting it as a change would only mark the session
    // dirty on open.
    void setVoiceMode (VoiceMode, bool notifyHost = true);
    std::unique_ptr<juce::XmlElement> captureStateXml();
    bool restoreStateXml (const juce::XmlElement&, bool notifyHost = true);
    void applyFactoryPreset (int index);

    // UI-only: fires (asynchronously, on the message thread) whenever the
    // voice mode changes, including host session restores, so an open editor
    // can refresh its mode display. Independent of host notification.
    juce::ChangeBroadcaster voiceModeChanged;

    juce::AudioProcessorValueTreeState apvts;

    // Read-only, normalized block-peak metering for the UI. Audio thread
    // writes atomics; message thread reads. No added DSP processing.
    std::atomic<float> meterVoice { 0.0f };
    std::atomic<float> meterCarrier { 0.0f };
    std::atomic<float> meterOutput { 0.0f };

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    lpc::VoiceEngine core;
    lpc::AirBand air;
    std::atomic<VoiceMode> voiceMode { VoiceMode::talkBox };

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
    std::atomic<float>* pAirFrequency = nullptr;
    std::atomic<float>* pAirGain = nullptr;

    static constexpr int kChunkSize = 1024;
    std::array<float, kChunkSize> voiceScratch {};
    std::array<float, kChunkSize> carrierScratch {};
    std::array<float, kChunkSize> wetScratch {};
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
