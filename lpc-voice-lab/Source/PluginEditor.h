#pragma once

#include "PluginProcessor.h"

#include <array>
#include <memory>

class BlueprintLook final : public juce::LookAndFeel_V4
{
public:
    void drawRotarySlider (juce::Graphics&, int, int, int, int, float, float, float,
                           juce::Slider&) override;
    void drawButtonBackground (juce::Graphics&, juce::Button&,
                               const juce::Colour&, bool, bool) override;
    void drawToggleButton (juce::Graphics&, juce::ToggleButton&, bool, bool) override;
};

class LPCVoiceLabEditor final : public juce::AudioProcessorEditor,
                                private juce::Timer,
                                private juce::ChangeListener
{
public:
    explicit LPCVoiceLabEditor (LPCVoiceLabProcessor&);
    ~LPCVoiceLabEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    void changeListenerCallback (juce::ChangeBroadcaster*) override;
    // Syncs the mode dropdown and repaints only the mode status label, and only
    // when the shown mode actually changed.
    void refreshVoiceModeDisplay();
    void applyFactoryPreset (int);
    void refreshPresetList();
    void savePresetDialog();
    void openPresetDialog();
    void savePresetToFile (juce::File);
    void loadPresetFromFile (const juce::File&);
    juce::File presetFolder() const;
    void showPresetError (const juce::String&) const;

    LPCVoiceLabProcessor& processor;
    BlueprintLook skin;
    std::array<juce::Slider, 10> controls;
    std::array<std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment>, 10> attachments;
    juce::ComboBox orderChoice;
    juce::ComboBox voiceModeChoice;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> orderAttachment;
    juce::ToggleButton unvoicedToggle { "UNVOICED" };
    juce::ToggleButton retroToggle { "RETRO" };
    juce::ToggleButton bypassToggle { "BYPASS" };
    std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> unvoicedAttachment;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> retroAttachment;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> bypassAttachment;
    juce::ComboBox presetChoice;
    juce::TextButton savePreset { "SAVE AS" };
    juce::TextButton openPreset { "OPEN" };
    juce::TextButton programButton { "NEXT PROGRAM" };
    juce::Label currentProgram;
    juce::Label presetMessage;
    juce::Array<juce::File> userPresets;
    std::unique_ptr<juce::FileChooser> presetChooser;
    int presetIndex = -1;
    LPCVoiceLabProcessor::VoiceMode shownVoiceMode = LPCVoiceLabProcessor::VoiceMode::talkBox;
    static constexpr int kModeLabelX = 52, kModeLabelY = 704, kModeLabelW = 610, kModeLabelH = 19;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (LPCVoiceLabEditor)
};
