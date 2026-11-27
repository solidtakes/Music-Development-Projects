#include "PluginEditor.h"

#include <cmath>

namespace
{
    const juce::Colour graphite { 0xff191a1b };
    const juce::Colour ink      { 0xff09090a };
    const juce::Colour metal    { 0xff28292b };
    const juce::Colour rim      { 0xff3b3d40 };
    const juce::Colour paper    { 0xffedebea };
    const juce::Colour muted    { 0xffb7b3b1 };
    const juce::Colour red      { 0xffff503e };
    const juce::Colour darkRed  { 0xff361611 };

    struct Fader
    {
        const char* id;
        const char* caption;
        const char* unit;
        double scale;
        int decimals;
    };

    constexpr std::array<Fader, 10> faders {{
        { "micgain",   "VOICE",     "dB",  1.0, 1 },
        { "cargain",   "CARRIER",   "dB",  1.0, 1 },
        { "outgain",   "OUTPUT",    "dB",  1.0, 1 },
        { "wet",       "WET",        "%", 200.0, 0 },
        { "dry",       "DRY",        "%", 200.0, 0 },
        { "quality",   "QUALITY",     "",   1.0, 0 },
        { "fricative", "FRICATIVE", "dB",   1.0, 1 },
        { "lowend",    "LOW END",    "%", 100.0, 0 },
        { "grit",      "GRIT",       "%", 100.0, 0 },
        { "bandwidth", "BANDWIDTH", "kHz",  0.001, 2 }
    }};

    const juce::Rectangle<int> meterArea { 738, 77, 348, 69 };

    juce::Font font (float size, int style = juce::Font::plain)
    {
        return juce::Font (juce::FontOptions (size, style));
    }

    void label (juce::Graphics& g, const juce::String& s, juce::Rectangle<int> area,
                float size, juce::Colour colour,
                juce::Justification align = juce::Justification::centredLeft,
                int style = juce::Font::plain)
    {
        g.setColour (colour);
        g.setFont (font (size, style));
        g.drawFittedText (s, area, align, 1);
    }

    void buttonFace (juce::Graphics& g, juce::Button& button, bool hovered, bool pressed)
    {
        const auto area = button.getLocalBounds().toFloat().reduced (0.5f);
        const bool selected = button.getToggleState();
        g.setColour (ink);
        g.fillRoundedRectangle (area, 3.0f);
        const auto face = area.withTrimmedBottom (2.0f);
        g.setColour (pressed ? ink : selected ? juce::Colour (0xff3b1c19) : hovered ? rim : metal);
        g.fillRoundedRectangle (face, 3.0f);
        g.setColour (selected ? red.withAlpha (0.75f) : rim);
        g.drawRoundedRectangle (face, 3.0f, 1.0f);
        if (button.hasKeyboardFocus (false))
        {
            g.setColour (paper);
            g.drawRoundedRectangle (face.reduced (2.5f), 2.0f, 1.0f);
        }
    }

    void drawDigits (juce::Graphics& g, const juce::String& text, juce::Rectangle<int> area)
    {
        // Segment order: top, upper-right, lower-right, bottom, lower-left,
        // upper-left and middle.
        constexpr std::array<unsigned, 10> segments { 0x3f, 0x06, 0x5b, 0x4f, 0x66,
                                                      0x6d, 0x7d, 0x07, 0x7f, 0x6f };
        static const std::array<juce::Rectangle<float>, 7> strokes {{
            { 2.5f, 0.0f, 7.0f, 2.1f }, { 9.5f, 2.1f, 2.1f, 7.0f },
            { 9.5f, 11.0f, 2.1f, 7.0f }, { 2.5f, 18.0f, 7.0f, 2.1f },
            { 0.4f, 11.0f, 2.1f, 7.0f }, { 0.4f, 2.1f, 2.1f, 7.0f },
            { 2.5f, 9.0f, 7.0f, 2.1f }
        }};
        float width = 0.0f;
        for (const auto ch : text)
            width += ch == '.' ? 5.0f : 14.0f;
        float x = (float) area.getCentreX() - width * 0.5f + 1.0f;
        const float y = (float) area.getCentreY() - 10.0f;
        for (const auto ch : text)
        {
            if (ch == '.')
            {
                g.setColour (red);
                g.fillRect (x, y + 18.0f, 2.1f, 2.1f);
                x += 5.0f;
                continue;
            }
            const bool numeric = ch >= '0' && ch <= '9';
            const auto mask = numeric ? segments[(size_t) (ch - '0')] : 0x40u;
            for (size_t i = 0; i < strokes.size(); ++i)
            {
                const bool lit = (mask & (1u << i)) != 0;
                if (numeric || lit)
                {
                    g.setColour (lit ? red : darkRed);
                    g.fillRoundedRectangle (strokes[i].translated (x, y), 0.7f);
                }
            }
            x += 14.0f;
        }
    }

    void meter (juce::Graphics& g, const char* name, int y, float peak)
    {
        label (g, name, { 744, y - 3, 60, 15 }, 11.0f, muted);
        const auto db = juce::Decibels::gainToDecibels (peak, -60.0f);
        for (int i = 0; i < 24; ++i)
        {
            const bool lit = db >= -57.5f + 2.5f * (float) i;
            g.setColour (lit ? (i < 20 ? red : juce::Colour (0xffff8273)) : darkRed);
            g.fillRoundedRectangle (803.0f + 11.5f * (float) i, (float) y, 9.5f, 8.0f, 1.0f);
        }
    }
}

GraphiteLook::GraphiteLook()
{
    setColour (juce::ComboBox::backgroundColourId, metal);
    setColour (juce::ComboBox::outlineColourId, rim);
    setColour (juce::ComboBox::textColourId, paper);
    setColour (juce::ComboBox::arrowColourId, muted);
    setColour (juce::PopupMenu::backgroundColourId, graphite);
    setColour (juce::PopupMenu::textColourId, paper);
    setColour (juce::PopupMenu::highlightedBackgroundColourId, darkRed);
    setColour (juce::PopupMenu::highlightedTextColourId, paper);
    setColour (juce::TextButton::textColourOffId, paper);
    setColour (juce::TextButton::textColourOnId, paper);
}

juce::Slider::SliderLayout GraphiteLook::getSliderLayout (juce::Slider& slider)
{
    auto layout = juce::LookAndFeel_V4::getSliderLayout (slider);
    layout.sliderBounds.removeFromTop (34);
    return layout;
}

juce::Label* GraphiteLook::createSliderTextBox (juce::Slider& slider)
{
    auto* display = juce::LookAndFeel_V4::createSliderTextBox (slider);
    display->setComponentID ("fader-readout");
    display->setFont (font (15.0f));
    return display;
}

void GraphiteLook::drawLabel (juce::Graphics& g, juce::Label& display)
{
    if (display.getComponentID() != "fader-readout")
    {
        juce::LookAndFeel_V4::drawLabel (g, display);
        return;
    }

    const auto area = display.getLocalBounds();
    g.setColour (juce::Colour (0xff100b0b));
    g.fillRoundedRectangle (area.toFloat(), 3.0f);
    g.setColour (darkRed);
    g.drawRoundedRectangle (area.toFloat().reduced (0.5f), 3.0f, 1.0f);
    if (! display.isBeingEdited())
        drawDigits (g, display.getText(), area);
}

void GraphiteLook::drawLinearSlider (juce::Graphics& g, int x, int y, int w, int h,
                                     float position, float, float, juce::Slider::SliderStyle,
                                     juce::Slider&)
{
    const float centre = (float) x + (float) w * 0.5f;
    const auto slot = juce::Rectangle<float> (centre - 3.0f, (float) y - 3.0f,
                                              6.0f, (float) h + 6.0f);
    g.setColour (rim);
    g.fillRoundedRectangle (slot.expanded (1.0f), 3.0f);
    g.setColour (ink);
    g.fillRoundedRectangle (slot, 2.5f);

    for (int i = 0; i <= 10; ++i)
    {
        const float lineY = (float) y + (float) h * (float) i / 10.0f;
        const bool major = i % 5 == 0;
        const float extent = major ? 27.0f : 22.0f;
        g.setColour (major ? muted.withAlpha (0.7f) : rim.brighter (0.25f));
        g.drawLine (centre - extent, lineY, centre - 16.0f, lineY);
        g.drawLine (centre + 16.0f, lineY, centre + extent, lineY);
    }

    const juce::Rectangle<float> cap (centre - 21.0f, position - 9.5f, 42.0f, 19.0f);
    g.setColour (ink);
    g.fillRoundedRectangle (cap.translated (0.0f, 2.0f), 3.0f);
    g.setColour (metal);
    g.fillRoundedRectangle (cap, 3.0f);
    g.setColour (rim.brighter (0.18f));
    g.drawRoundedRectangle (cap.reduced (0.5f), 3.0f, 1.0f);
    g.setColour (red.withAlpha (0.20f));
    g.fillRect (centre - 17.0f, position - 2.5f, 34.0f, 5.0f);
    g.setColour (red);
    g.fillRect (centre - 16.0f, position - 0.75f, 32.0f, 1.5f);
}

void GraphiteLook::drawButtonBackground (juce::Graphics& g, juce::Button& button,
                                         const juce::Colour&, bool hovered, bool pressed)
{
    buttonFace (g, button, hovered, pressed);
}

void GraphiteLook::drawToggleButton (juce::Graphics& g, juce::ToggleButton& button,
                                     bool hovered, bool pressed)
{
    buttonFace (g, button, hovered, pressed);
    const auto area = button.getLocalBounds();
    label (g, button.getButtonText(), area.withTrimmedLeft (12).withTrimmedRight (22),
           13.0f, paper, juce::Justification::centredLeft, juce::Font::bold);
    g.setColour (button.getToggleState() ? red : darkRed);
    g.fillRoundedRectangle ((float) area.getRight() - 18.0f,
                            (float) area.getCentreY() - 3.0f, 6.0f, 6.0f, 1.0f);
}

LPCVoiceLabEditor::LPCVoiceLabEditor (LPCVoiceLabProcessor& p)
    : juce::AudioProcessorEditor (&p), processor (p)
{
    setOpaque (true);
    setLookAndFeel (&skin);

    for (size_t i = 0; i < controls.size(); ++i)
    {
        auto& slider = controls[i];
        const auto spec = faders[i];
        slider.setComponentID (spec.id);
        slider.setName (processor.apvts.getParameter (spec.id)->getName (64));
        slider.setTitle (slider.getName());
        slider.setDescription (spec.unit);
        slider.setSliderStyle (juce::Slider::LinearVertical);
        slider.setTextBoxStyle (juce::Slider::TextBoxAbove, false, 70, 34);
        slider.setColour (juce::Slider::textBoxTextColourId, paper);
        slider.setColour (juce::Slider::textBoxBackgroundColourId, ink);
        slider.setColour (juce::Slider::textBoxOutlineColourId, red.withAlpha (0.75f));
        addAndMakeVisible (slider);

        attachments[i] = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>
            (processor.apvts, spec.id, slider);
        if (juce::StringRef (spec.id) == juce::StringRef ("quality"))
        {
            slider.textFromValueFunction = [] (double value)
            {
                return juce::String (juce::roundToInt (5.0 + 95.0 * value * value));
            };
            slider.valueFromTextFunction = [] (const juce::String& input)
            {
                return std::sqrt (juce::jlimit (0.0, 1.0, (input.getDoubleValue() - 5.0) / 95.0));
            };
        }
        else
        {
            slider.textFromValueFunction = [spec] (double value)
            {
                return juce::String (value * spec.scale, spec.decimals);
            };
            slider.valueFromTextFunction = [spec] (const juce::String& input)
            {
                return input.getDoubleValue() / spec.scale;
            };
        }
        slider.updateText();
    }

    orderChoice.setName ("Order");
    orderChoice.setComponentID ("order");
    orderChoice.addItem ("NORMAL", 1);
    orderChoice.addItem ("HIGH", 2);
    addAndMakeVisible (orderChoice);
    orderAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment>
        (processor.apvts, "order", orderChoice);

    for (auto* button : { &talkBoxButton, &nuVoButton })
    {
        button->setClickingTogglesState (true);
        button->setRadioGroupId (1, juce::dontSendNotification);
        addAndMakeVisible (*button);
    }
    talkBoxButton.setTitle ("TalkBox engine");
    nuVoButton.setTitle ("NuVo engine");
    nuVoButton.setDescription ("Experimental filter-bank engine");
    talkBoxButton.onClick = [this]
    {
        processor.setVoiceMode (LPCVoiceLabProcessor::VoiceMode::talkBox);
        refreshVoiceModeDisplay();
    };
    nuVoButton.onClick = [this]
    {
        processor.setVoiceMode (LPCVoiceLabProcessor::VoiceMode::nuVo);
        refreshVoiceModeDisplay();
    };
    processor.voiceModeChanged.addChangeListener (this);
    refreshVoiceModeDisplay();

    for (auto* button : { &unvoicedToggle, &retroToggle, &bypassToggle })
        addAndMakeVisible (*button);

    unvoicedToggle.setComponentID ("unvoiced");
    retroToggle.setComponentID ("retro");
    bypassToggle.setComponentID ("bypass");
    unvoicedAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment>
        (processor.apvts, "unvoiced", unvoicedToggle);
    retroAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment>
        (processor.apvts, "retro", retroToggle);
    bypassAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment>
        (processor.apvts, "bypass", bypassToggle);

    presetChoice.setName ("Preset");
    presetChoice.setTextWhenNothingSelected ("MANUAL / CUSTOM");
    addAndMakeVisible (presetChoice);
    presetChoice.onChange = [this]
    {
        const int id = presetChoice.getSelectedId();
        if (id >= 1 && id <= 3)
            applyFactoryPreset (id - 1);
        else if (id >= 100 && id < 100 + userPresets.size())
            loadPresetFromFile (userPresets.getReference (id - 100));
    };

    for (auto* button : { &savePreset, &openPreset, &programButton })
        addAndMakeVisible (*button);

    savePreset.onClick = [this] { savePresetDialog(); };
    openPreset.onClick = [this] { openPresetDialog(); };
    programButton.onClick = [this]
    {
        const int next = (presetIndex + 1) % 3;
        presetChoice.setSelectedId (next + 1);
    };

    presetMessage.setJustificationType (juce::Justification::centredLeft);
    presetMessage.setColour (juce::Label::textColourId, muted);
    presetMessage.setFont (font (12.0f));
    addAndMakeVisible (presetMessage);

    refreshPresetList();
    setSize (1120, 480);
    startTimerHz (24);
}

LPCVoiceLabEditor::~LPCVoiceLabEditor()
{
    processor.voiceModeChanged.removeChangeListener (this);
    stopTimer();
    setLookAndFeel (nullptr);
}

juce::File LPCVoiceLabEditor::presetFolder() const
{
    return juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
        .getChildFile ("solidtakes").getChildFile ("LPC Voice Lab").getChildFile ("Presets");
}

void LPCVoiceLabEditor::refreshPresetList()
{
    const auto folder = presetFolder();
    userPresets.clear();
    if (folder.isDirectory())
        folder.findChildFiles (userPresets, juce::File::findFiles, false, "*.lpcpreset");

    presetChoice.clear (juce::dontSendNotification);
    presetChoice.addSectionHeading ("FACTORY / BASELINE");
    presetChoice.addItem ("CLASSIC / WORKING REFERENCE", 1);
    presetChoice.addItem ("RETRO / EXPERIMENT", 2);
    presetChoice.addItem ("ARTICULATE / EXPERIMENT", 3);
    if (! userPresets.isEmpty())
    {
        presetChoice.addSeparator();
        presetChoice.addSectionHeading ("USER PATCHES");
        for (int i = 0; i < userPresets.size(); ++i)
            presetChoice.addItem (userPresets.getReference (i).getFileNameWithoutExtension(), i + 100);
    }
}

void LPCVoiceLabEditor::showPresetFile (const juce::File& file)
{
    const int index = userPresets.indexOf (file);
    if (index >= 0)
        presetChoice.setSelectedId (index + 100, juce::dontSendNotification);
    else
        presetChoice.setText (file.getFileNameWithoutExtension(), juce::dontSendNotification);
}

void LPCVoiceLabEditor::showPresetError (const juce::String& message) const
{
    juce::AlertWindow::showMessageBoxAsync (juce::AlertWindow::WarningIcon,
                                             "LPC Voice Lab presets", message);
}

void LPCVoiceLabEditor::savePresetDialog()
{
    const auto folder = presetFolder();
    if (auto result = folder.createDirectory(); result.failed())
    {
        showPresetError ("Cannot create preset directory: " + result.getErrorMessage());
        return;
    }

    presetChooser = std::make_unique<juce::FileChooser> (
        "Save LPC Voice Lab patch", folder.getChildFile ("My Patch.lpcpreset"), "*.lpcpreset");
    juce::Component::SafePointer<LPCVoiceLabEditor> self (this);
    presetChooser->launchAsync (juce::FileBrowserComponent::saveMode
                               | juce::FileBrowserComponent::canSelectFiles
                               | juce::FileBrowserComponent::warnAboutOverwriting,
        [self] (const juce::FileChooser& chooser)
        {
            if (self != nullptr && chooser.getResult() != juce::File())
                self->savePresetToFile (chooser.getResult());
        });
}

void LPCVoiceLabEditor::openPresetDialog()
{
    presetChooser = std::make_unique<juce::FileChooser> (
        "Open LPC Voice Lab patch", presetFolder(), "*.lpcpreset");
    juce::Component::SafePointer<LPCVoiceLabEditor> self (this);
    presetChooser->launchAsync (juce::FileBrowserComponent::openMode
                               | juce::FileBrowserComponent::canSelectFiles,
        [self] (const juce::FileChooser& chooser)
        {
            if (self != nullptr && chooser.getResult() != juce::File())
                self->loadPresetFromFile (chooser.getResult());
        });
}

void LPCVoiceLabEditor::savePresetToFile (juce::File target)
{
    if (! target.hasFileExtension (".lpcpreset"))
        target = target.withFileExtension (".lpcpreset");

    auto xml = processor.captureStateXml();
    if (xml == nullptr)
    {
        showPresetError ("Could not capture current parameter state.");
        return;
    }
    xml->setAttribute ("lpcVoiceLabPresetVersion", 1);
    xml->setAttribute ("presetName", target.getFileNameWithoutExtension());

    // Write to a temporary sibling and replace on success, avoiding half
    // written/invalid presets after a failed write.
    juce::TemporaryFile temporary (target);
    if (! temporary.getFile().replaceWithText (xml->toString())
        || ! temporary.overwriteTargetFileWithTemporary())
    {
        showPresetError ("Could not save preset: " + target.getFullPathName());
        return;
    }
    refreshPresetList();
    showPresetFile (target);
    presetMessage.setText ("SAVED  /  " + target.getFileName(), juce::dontSendNotification);
}

void LPCVoiceLabEditor::loadPresetFromFile (const juce::File& file)
{
    if (! file.existsAsFile() || ! file.hasFileExtension (".lpcpreset"))
    {
        showPresetError ("Please choose a saved .lpcpreset file.");
        return;
    }
    auto xml = juce::XmlDocument::parse (file);
    if (xml == nullptr
        || ! xml->hasTagName (processor.apvts.state.getType().toString())
        || xml->getIntAttribute ("lpcVoiceLabPresetVersion", 0) != 1)
    {
        showPresetError ("This file is not a compatible LPC Voice Lab preset.");
        return;
    }
    if (! processor.restoreStateXml (*xml))
    {
        showPresetError ("The preset contains invalid parameter data.");
        return;
    }
    // This updates all saved parameters, including the wet/dry/gains and
    // every modern processing feature. The DAW's normal state mechanism
    // remains separate and unchanged.
    presetIndex = -1;
    showPresetFile (file);
    presetMessage.setText ("LOADED  /  " + file.getFileName(), juce::dontSendNotification);
    refreshVoiceModeDisplay();
    repaint();
}

void LPCVoiceLabEditor::applyFactoryPreset (int index)
{
    presetIndex = index;
    processor.applyFactoryPreset (index);

    presetMessage.setText ("PRESET CHANGED / GAIN TRIMS PRESERVED",
                            juce::dontSendNotification);
    refreshVoiceModeDisplay();
    repaint();
}


void LPCVoiceLabEditor::refreshVoiceModeDisplay()
{
    const bool isNuVo = processor.getVoiceMode() == LPCVoiceLabProcessor::VoiceMode::nuVo;
    talkBoxButton.setToggleState (! isNuVo, juce::dontSendNotification);
    nuVoButton.setToggleState (isNuVo, juce::dontSendNotification);
}

void LPCVoiceLabEditor::changeListenerCallback (juce::ChangeBroadcaster*)
{
    refreshVoiceModeDisplay();
}

void LPCVoiceLabEditor::timerCallback()
{
    repaint (meterArea);
}

void LPCVoiceLabEditor::paint (juce::Graphics& g)
{
    g.fillAll (graphite);
    for (int y = 61; y < 449; ++y)
    {
        g.setColour (y % 3 == 0 ? juce::Colours::white.withAlpha (0.017f)
                                : juce::Colours::black.withAlpha (0.06f));
        g.drawHorizontalLine (y, 0.0f, (float) getWidth());
    }

    g.setColour (rim);
    g.drawHorizontalLine (57, 0.0f, (float) getWidth());
    g.setColour (red);
    g.fillRoundedRectangle (24.0f, 25.0f, 8.0f, 8.0f, 1.5f);
    label (g, "LPC VOCODER", { 43, 10, 216, 37 }, 27.0f, paper,
           juce::Justification::centredLeft, juce::Font::bold);
    label (g, "PRESET", { 452, 13, 55, 31 }, 12.0f, muted);

    const juce::Rectangle<float> display (22.0f, 72.0f, 1076.0f, 133.0f);
    g.setColour (ink);
    g.fillRoundedRectangle (display, 4.0f);
    g.setColour (rim);
    g.drawRoundedRectangle (display.reduced (0.5f), 4.0f, 1.0f);
    g.setColour (darkRed);
    g.drawHorizontalLine (152, 36.0f, 1084.0f);
    label (g, "ENGINE", { 38, 83, 230, 19 }, 12.0f, muted);
    label (g, "EXPERIMENTAL", { 295, 105, 127, 34 }, 11.0f, muted);
    meter (g, "VOICE", 85, processor.meterVoice.load (std::memory_order_relaxed));
    meter (g, "CARRIER", 103, processor.meterCarrier.load (std::memory_order_relaxed));
    meter (g, "OUTPUT", 121, processor.meterOutput.load (std::memory_order_relaxed));
    label (g, "-60", { 802, 132, 34, 14 }, 10.0f, muted);
    label (g, "-30", { 929, 132, 34, 14 }, 10.0f, muted,
           juce::Justification::centred);
    label (g, "0 dBFS", { 1038, 132, 42, 14 }, 10.0f, muted,
           juce::Justification::centredRight);

    g.setColour (rim);
    g.drawVerticalLine (899, 222.0f, 432.0f);
    for (size_t i = 0; i < faders.size(); ++i)
    {
        const int x = 27 + (int) i * 86;
        label (g, faders[i].caption, { x, 410, 84, 20 }, 13.0f, paper,
               juce::Justification::centred, juce::Font::bold);
        label (g, faders[i].unit, { x, 430, 84, 15 }, 11.0f, muted,
               juce::Justification::centred);
        if (i == 2 || i == 4)
        {
            g.setColour (rim);
            g.drawVerticalLine (x + 85, 232.0f, 440.0f);
        }
    }
    label (g, "ORDER", { 924, 226, 158, 23 }, 12.0f, muted);

    g.setColour (ink);
    g.fillRect (0, 451, getWidth(), getHeight() - 451);
    g.setColour (rim);
    g.drawHorizontalLine (451, 0.0f, (float) getWidth());
    label (g, "ALPHA 0.5.1a", { 929, 452, 158, 27 }, 12.0f, muted,
           juce::Justification::centredRight);
}

void LPCVoiceLabEditor::resized()
{
    presetChoice.setBounds (508, 13, 314, 32);
    savePreset.setBounds (831, 13, 76, 32);
    openPreset.setBounds (915, 13, 60, 32);
    programButton.setBounds (983, 13, 114, 32);
    presetMessage.setBounds (27, 452, 850, 27);

    talkBoxButton.setBounds (38, 105, 124, 34);
    nuVoButton.setBounds (170, 105, 116, 34);

    for (size_t i = 0; i < controls.size(); ++i)
        controls[i].setBounds (27 + (int) i * 86, 162, 84, 239);

    orderChoice.setBounds (923, 249, 158, 33);
    unvoicedToggle.setBounds (923, 298, 158, 33);
    retroToggle.setBounds (923, 339, 158, 33);
    bypassToggle.setBounds (923, 380, 158, 33);
}
