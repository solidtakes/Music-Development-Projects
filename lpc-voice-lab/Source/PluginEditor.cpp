#include "PluginEditor.h"

#include <cmath>

namespace
{
    const auto darkBlue = juce::Colour::fromRGB (18, 24, 45);
    const auto lime = juce::Colour::fromRGB (157, 239, 79);
    const auto silver = juce::Colour::fromRGB (204, 209, 215);
    const std::array<const char*, 10> ids {
        "micgain", "cargain", "outgain", "quality", "fricative",
        "wet", "dry", "lowend", "grit", "bandwidth"
    };
    const std::array<const char*, 10> captions {
        "MIC IN", "CARRIER IN", "EFFECT OUT", "QUALITY", "FRICATIVE GAIN",
        "WET", "DRY", "LOW END", "GRIT", "BANDWIDTH"
    };
    void text (juce::Graphics& g, const juce::String& s, float x, float y,
               float w, float h, float size, juce::Colour c,
               juce::Justification just = juce::Justification::centred)
    {
        g.setColour (c);
        g.setFont (juce::Font (size));
        g.drawFittedText (s, juce::Rectangle<int> ((int) x, (int) y, (int) w, (int) h),
                          just, 1);
    }
    void lamp (juce::Graphics& g, float x, float y, bool on, juce::Colour c)
    {
        if (on)
        {
            g.setColour (c.withAlpha (0.22f));
            g.fillEllipse (x - 13, y - 13, 26.0f, 26.0f);
        }
        g.setColour (juce::Colour::fromRGB (51, 61, 72));
        g.fillEllipse (x - 8, y - 8, 16.0f, 16.0f);
        g.setColour (on ? c : juce::Colour::fromRGB (64, 99, 68));
        g.fillEllipse (x - 5, y - 5, 10.0f, 10.0f);
        g.setColour (juce::Colours::white.withAlpha (on ? 0.7f : 0.12f));
        g.fillEllipse (x - 3, y - 4, 3.0f, 3.0f);
    }
}

void VoiceLabLook::drawRotarySlider (juce::Graphics& g, int x, int y, int w, int h,
                                     float pos, float a0, float a1, juce::Slider&)
{
    const auto cx = x + w * 0.5f, cy = y + h * 0.5f;
    const auto radius = 0.34f * (float) juce::jmin (w, h);
    for (int i = 0; i <= 36; ++i)
    {
        const float a = a0 + (a1 - a0) * i / 36.0f;
        const float r0 = radius + 11.0f;
        const float r1 = radius + (i % 3 == 0 ? 25.0f : 19.0f);
        g.setColour (juce::Colour::fromRGB (48, 58, 82).withAlpha (0.9f));
        g.drawLine (cx + std::sin (a) * r0, cy - std::cos (a) * r0,
                    cx + std::sin (a) * r1, cy - std::cos (a) * r1,
                    i % 3 == 0 ? 2.3f : 1.0f);
    }

    const auto ring = juce::Rectangle<float> (cx - radius - 7, cy - radius - 7,
                                               2 * radius + 14, 2 * radius + 14);
    g.setColour (juce::Colours::black.withAlpha (0.4f));
    g.fillEllipse (ring.translated (3.0f, 5.0f));
    g.setColour (juce::Colour::fromRGB (126, 135, 145));
    g.fillEllipse (ring);
    auto knob = ring.reduced (7.0f);
    g.setGradientFill (juce::ColourGradient (juce::Colour::fromRGB (86, 93, 102),
                        knob.getX(), knob.getY(), juce::Colour::fromRGB (12, 15, 24),
                        knob.getRight(), knob.getBottom(), false));
    g.fillEllipse (knob);
    g.setColour (juce::Colours::black.withAlpha (0.6f));
    g.drawEllipse (knob, 1.6f);
    const float a = a0 + (a1 - a0) * pos;
    juce::Path pointer;
    pointer.startNewSubPath (cx, cy);
    pointer.lineTo (cx + std::sin (a) * radius * 0.83f,
                    cy - std::cos (a) * radius * 0.83f);
    g.setColour (juce::Colour::fromRGB (227, 233, 242));
    g.strokePath (pointer, juce::PathStrokeType (4.0f, juce::PathStrokeType::curved,
                                                 juce::PathStrokeType::rounded));
}

void VoiceLabLook::drawButtonBackground (juce::Graphics& g, juce::Button& b,
                                         const juce::Colour&, bool hovered, bool pressed)
{
    auto r = b.getLocalBounds().toFloat().reduced (3.0f);
    g.setColour (juce::Colour::fromRGB (64, 71, 82));
    g.fillEllipse (r);
    r = r.reduced (6.0f);
    g.setGradientFill (juce::ColourGradient (juce::Colour::fromRGB (236, 237, 238),
                        r.getX(), r.getY(), juce::Colour::fromRGB (92, 98, 105),
                        r.getRight(), r.getBottom(), false));
    g.fillEllipse (r);
    g.setColour (pressed ? lime : hovered ? silver.brighter (0.2f) : silver);
    g.fillEllipse (r.reduced (9.0f));
    g.setColour (juce::Colour::fromRGB (53, 60, 73));
    g.drawEllipse (r.reduced (9.0f), 2.0f);
}

void VoiceLabLook::drawToggleButton (juce::Graphics& g, juce::ToggleButton& b,
                                     bool, bool)
{
    auto r = b.getLocalBounds().toFloat();
    const bool on = b.getToggleState();
    const float diam = juce::jmin (r.getWidth() * 0.35f, r.getHeight() - 10.0f);
    const auto led = juce::Rectangle<float> (r.getX()+5, r.getCentreY()-diam/2,
                                             diam, diam);
    g.setColour (juce::Colour::fromRGB (28, 31, 37));
    g.fillEllipse (led.expanded (3.0f));
    g.setColour (on ? lime : juce::Colour::fromRGB (90, 100, 106));
    g.fillEllipse (led);
    g.setColour (on ? juce::Colour::fromRGB (210, 245, 190) : silver);
    g.setFont (juce::Font (15.0f));
    g.drawText (b.getButtonText(), (int)(led.getRight()+11.0f), 0,
                (int)(r.getWidth() - led.getRight()-8), (int)r.getHeight(),
                juce::Justification::centredLeft);
}

LPCVoiceLabEditor::LPCVoiceLabEditor (LPCVoiceLabProcessor& p)
    : juce::AudioProcessorEditor (&p), processor (p)
{
    setSize (1320, 960);
    for (size_t i = 0; i < controls.size(); ++i)
    {
        auto& s = controls[i];
        s.setLookAndFeel (&skin);
        s.setSliderStyle (i < 3 ? juce::Slider::RotaryHorizontalVerticalDrag
                               : juce::Slider::LinearHorizontal);
        s.setTextBoxStyle (i < 3 ? juce::Slider::NoTextBox
                                 : juce::Slider::TextBoxRight,
                           false, 78, 24);
        s.setColour (juce::Slider::trackColourId, lime);
        s.setColour (juce::Slider::thumbColourId, silver);
        s.setColour (juce::Slider::textBoxTextColourId, juce::Colours::white);
        s.setColour (juce::Slider::textBoxBackgroundColourId, darkBlue);
        s.setColour (juce::Slider::textBoxOutlineColourId, juce::Colour::fromRGB(80,90,105));
        addAndMakeVisible (s);
        attachments[i] = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>
            (processor.apvts, ids[i], s);
    }

    orderChoice.addItem ("Normal", 1);
    orderChoice.addItem ("High", 2);
    orderChoice.setColour (juce::ComboBox::backgroundColourId, darkBlue);
    orderChoice.setColour (juce::ComboBox::textColourId, juce::Colours::white);
    addAndMakeVisible (orderChoice);
    orderAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment>
        (processor.apvts, "order", orderChoice);

    for (auto* b : { &unvoicedToggle, &retroToggle, &bypassToggle })
    {
        b->setLookAndFeel (&skin);
        addAndMakeVisible (*b);
    }
    unvoicedAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment>
        (processor.apvts, "unvoiced", unvoicedToggle);
    retroAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment>
        (processor.apvts, "retro", retroToggle);
    bypassAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment>
        (processor.apvts, "bypass", bypassToggle);

    programButton.setLookAndFeel (&skin);
    programButton.setColour (juce::TextButton::textColourOffId, juce::Colours::black);
    programButton.onClick = [this] { applyPreset ((presetIndex + 1) % 3); };
    addAndMakeVisible (programButton);
    currentProgram.setText ("MANUAL", juce::dontSendNotification);
    currentProgram.setJustificationType (juce::Justification::centred);
    currentProgram.setColour (juce::Label::textColourId, darkBlue);
    addAndMakeVisible (currentProgram);

    startTimerHz (8);
}

LPCVoiceLabEditor::~LPCVoiceLabEditor()
{
    stopTimer();
    for (auto& a : attachments) a.reset();
    orderAttachment.reset();
    unvoicedAttachment.reset();
    retroAttachment.reset();
    bypassAttachment.reset();
    for (auto& s : controls) s.setLookAndFeel (nullptr);
    for (auto* b : { &unvoicedToggle, &retroToggle, &bypassToggle }) b->setLookAndFeel (nullptr);
    programButton.setLookAndFeel (nullptr);
}

void LPCVoiceLabEditor::applyPreset (int n)
{
    presetIndex = n;
    // Three proven parameter combinations, not imitations of the six original
    // DigiTech voice algorithms. Each host value remains automatable/undoable.
    auto set = [this] (const char* id, float value)
    {
        if (auto* p = processor.apvts.getParameter (id))
        {
            p->beginChangeGesture();
            p->setValueNotifyingHost (p->convertTo0to1 (value));
            p->endChangeGesture();
        }
    };
    if (n == 0) // existing classic voicing
    {
        set ("quality", 1.0f); set ("order", 0.0f);
        set ("retro", 0.0f); set ("grit", 0.0f);
        set ("unvoiced", 1.0f);
        currentProgram.setText ("CLASSIC", juce::dontSendNotification);
    }
    else if (n == 1)
    {
        set ("quality", 0.65f); set ("order", 0.0f);
        set ("retro", 1.0f); set ("grit", 0.40f);
        set ("bandwidth", 4800.0f);
        currentProgram.setText ("RETRO", juce::dontSendNotification);
    }
    else
    {
        set ("quality", 1.0f); set ("order", 1.0f);
        set ("unvoiced", 1.0f); set ("fricative", 0.0f);
        set ("retro", 0.0f);
        currentProgram.setText ("ARTICULATE", juce::dontSendNotification);
    }
    repaint();
}

void LPCVoiceLabEditor::timerCallback()
{
    // GUI status only; read-only message-thread poll.
    repaint (juce::Rectangle<int>(130, 430, 660, 250));
}

void LPCVoiceLabEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour::fromRGB (13, 17, 26));
    auto bar = juce::Rectangle<float> (0, 0, 1320.0f, 69.0f);
    g.setGradientFill (juce::ColourGradient (juce::Colour::fromRGB (45, 49, 61),
                        0.0f, 0.0f, juce::Colour::fromRGB (16, 19, 29),
                        0.0f, 69.0f, false));
    g.fillRect (bar);
    text (g, "LPC Voice Lab", 40, 17, 260, 42, 25.0f, juce::Colours::white);
    text (g, "VOCODER  /  ALPHA 0.3", 308, 24, 330, 28, 16.0f, silver,
          juce::Justification::centredLeft);
    text (g, "VINTAGE DSP  •  ADVANCED", 940, 21, 345, 32, 14.0f, silver);

    auto pedal = juce::Rectangle<float> (34, 82, 814, 855);
    g.setColour (juce::Colours::black.withAlpha (0.45f));
    g.fillRoundedRectangle (pedal.translated (5, 8), 22);
    g.setGradientFill (juce::ColourGradient (juce::Colour::fromRGB (235, 237, 240),
                        120, 92, juce::Colour::fromRGB (147, 155, 171),
                        793, 929, false));
    g.fillRoundedRectangle (pedal, 21);
    g.setColour (juce::Colour::fromRGB (76, 82, 96));
    g.drawRoundedRectangle (pedal.reduced (1), 21, 4);
    for (int y : { 132, 870 })
        for (int x : { 67, 819 })
        {
            g.setColour (juce::Colour::fromRGB (82, 87, 95));
            g.fillEllipse ((float)x-6, (float)y-6, 12, 12);
            g.setColour (silver);
            g.drawLine ((float)x-3, (float)y+2, (float)x+3, (float)y-2, 1.2f);
        }

    const std::array<float,3> knobCenters { 200.0f, 446.0f, 691.0f };
    for (int i = 0; i < 3; ++i)
        text (g, captions[(size_t)i], knobCenters[(size_t)i] - 90, 365, 180, 34,
              19, juce::Colour::fromRGB (28, 35, 52));

    const std::array<const char*,6> modeNames { "NuVo", "NuWah", "TazMania",
                                                 "TalkBox", "Alien", "AutoTalk" };
    const bool current = true; // only the core MDA TalkBox algorithm exists
    for (int i = 0; i < 6; ++i)
    {
        const float x = 161.0f + 111.0f * (float)i;
        text (g, modeNames[(size_t)i], x-50, 429, 100, 24, 16,
              juce::Colour::fromRGB (28, 38, 53));
        lamp (g, x, 474, current && i == 3, lime);
    }
    text (g, "TALKBOX IS ACTIVE  ·  OTHER MODES PLANNED",
          185, 492, 523, 22, 11.0f, juce::Colour::fromRGB (53, 62, 78));

    auto oval = juce::Rectangle<float> (175, 535, 535, 180);
    g.setColour (juce::Colour::fromRGB (77, 84, 117));
    g.fillEllipse (oval.expanded (8));
    g.setGradientFill (juce::ColourGradient (juce::Colour::fromRGB (55, 67, 137),
                        210, 550, juce::Colour::fromRGB (21, 25, 66),
                        690, 705, false));
    g.fillEllipse (oval);
    g.setColour (silver);
    g.drawEllipse (oval, 2.5f);
    text (g, "LPC", 340, 558, 200, 46, 37, juce::Colours::white);
    text (g, "Voice Lab", 236, 604, 414, 58, 48, juce::Colours::white);
    text (g, "ADVANCED VOCAL SYNTH", 276, 665, 335, 26, 15, silver);
    lamp (g, 289, 551, processor.getBus (true, 1) != nullptr
                              && processor.getBus (true, 1)->isEnabled(), lime);
    lamp (g, 599, 551, retroToggle.getToggleState(), juce::Colours::orange);
    lamp (g, 652, 551, unvoicedToggle.getToggleState(), lime);
    text (g, "SC", 265, 560, 47, 18, 11, silver);
    text (g, "RETRO", 560, 560, 70, 18, 10, silver);
    text (g, "UV", 633, 560, 35, 18, 10, silver);

    text (g, "PROGRAM", 170, 735, 170, 27, 21, darkBlue);
    text (g, "BYPASS", 560, 735, 170, 27, 21, darkBlue);

    auto advanced = juce::Rectangle<float> (865, 100, 426, 840);
    g.setGradientFill (juce::ColourGradient (juce::Colour::fromRGB (58, 62, 76),
                        866, 99, juce::Colour::fromRGB (29, 33, 45),
                        1250, 920, false));
    g.fillRoundedRectangle (advanced, 19.0f);
    g.setColour (juce::Colour::fromRGB (133, 140, 157));
    g.drawRoundedRectangle (advanced, 19, 2);
    g.setColour (juce::Colour::fromRGB (31, 33, 45));
    g.fillRoundedRectangle (juce::Rectangle<float>(900,123,353,58),14);
    text (g, "ADVANCED", 937, 128, 290, 48, 24, silver);

    const std::array<std::pair<const char*, int>, 7> rows {{
        {"QUALITY", 196}, {"FRICATIVE GAIN", 419}, {"GRIT", 582},
        {"BANDWIDTH", 657}, {"WET", 733}, {"DRY", 804}, {"LOW END", 870}
    }};
    for (const auto& pair : rows)
        text (g, pair.first, 909, (float)pair.second-27, 290, 26, 15, silver,
              juce::Justification::centredLeft);
    text (g, "ORDER", 910, 244, 140, 25, 15, silver, juce::Justification::centredLeft);
    text (g, "CONSONANTS", 907, 327, 216, 20, 14, silver,
          juce::Justification::centredLeft);
}

void LPCVoiceLabEditor::resized()
{
    controls[0].setBounds (115, 170, 170, 184);
    controls[1].setBounds (361, 170, 170, 184);
    controls[2].setBounds (606, 170, 170, 184);
    controls[3].setBounds (911, 205, 336, 34); // quality
    controls[4].setBounds (911, 441, 336, 34); // fricative gain
    controls[5].setBounds (911, 759, 336, 34); // wet
    controls[6].setBounds (911, 829, 336, 34); // dry
    controls[7].setBounds (911, 894, 336, 34); // low end
    controls[8].setBounds (911, 603, 336, 34); // grit
    controls[9].setBounds (911, 683, 336, 34); // bandwidth
    orderChoice.setBounds (913, 272, 158, 35);
    unvoicedToggle.setBounds (912, 350, 203, 43);
    retroToggle.setBounds (912, 520, 156, 43);
    programButton.setBounds (178, 772, 150, 104);
    currentProgram.setBounds (185, 875, 138, 31);
    bypassToggle.setBounds (568, 786, 154, 72);
}
