#pragma once

#include "PluginProcessor.h"

#include <array>
#include <memory>

class VoiceLabLook final : public juce::LookAndFeel_V4
{
public:
    void drawRotarySlider (juce::Graphics&, int x, int y, int width, int height,
                           float pos, float startAngle, float endAngle, juce::Slider&) override;
    void drawButtonBackground (juce::Graphics&, juce::Button&, const juce::Colour&,
                               bool hovered, bool pressed) override;
    void drawToggleButton (juce::Graphics&, juce::ToggleButton&, bool hovered,
                           bool pressed) override;
};

class LPCVoiceLabEditor final : public juce::AudioProcessorEditor,
                                private juce::Timer
{
public:
    explicit LPCVoiceLabEditor (LPCVoiceLabProcessor&);
    ~LPCVoiceLabEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    void applyPreset (int index);

    LPCVoiceLabProcessor& processor;
    VoiceLabLook skin;
    std::array<juce::Slider, 10> controls;
    std::array<std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment>, 10> attachments;
    juce::ComboBox orderChoice;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> orderAttachment;
    juce::ToggleButton unvoicedToggle { "UNVOICED" };
    juce::ToggleButton retroToggle { "RETRO" };
    juce::ToggleButton bypassToggle { "BYPASS" };
    std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> unvoicedAttachment;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> retroAttachment;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> bypassAttachment;
    juce::TextButton programButton { "PROGRAM" };
    juce::Label currentProgram;
    int presetIndex = -1; // do not overwrite loaded DAW state just to display UI

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (LPCVoiceLabEditor)
};
