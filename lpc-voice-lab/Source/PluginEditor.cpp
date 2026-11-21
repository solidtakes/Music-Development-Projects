#include "PluginEditor.h"

#include <cmath>

namespace
{
    const auto navy     = juce::Colour::fromRGB (  9, 30, 60);
    const auto lighter  = juce::Colour::fromRGB ( 15, 47, 88);
    const auto cyan     = juce::Colour::fromRGB (109, 215, 238);
    const auto paper    = juce::Colour::fromRGB (228, 245, 240);
    const auto grid     = juce::Colour::fromRGB ( 36, 79,117);
    const auto aqua     = juce::Colour::fromRGB (145, 237, 196);
    const auto muted    = juce::Colour::fromRGB (114, 171,194);
    const std::array<const char*, 10> ids {
        "micgain", "cargain", "outgain", "quality", "fricative",
        "wet", "dry", "lowend", "grit", "bandwidth"
    };
    const std::array<const char*, 10> captions {
        "MIC / VOICE", "SYNTH / CARRIER", "EFFECT OUT", "QUALITY", "FRICATIVE GAIN",
        "WET", "DRY", "LOW END", "GRIT", "BANDWIDTH"
    };

    void label (juce::Graphics& g, const juce::String& s, juce::Rectangle<int> r,
                float size, juce::Colour colour,
                juce::Justification where = juce::Justification::centredLeft)
    {
        g.setColour (colour);
        g.setFont (juce::Font (size));
        g.drawFittedText (s, r, where, 1);
    }

    void panel (juce::Graphics& g, juce::Rectangle<float> r)
    {
        g.setColour (lighter.withAlpha (0.50f));
        g.fillRoundedRectangle (r, 9.0f);
        g.setColour (cyan.withAlpha (0.48f));
        g.drawRoundedRectangle (r, 9.0f, 1.3f);
    }

    void meter (juce::Graphics& g, float x, float y, float level)
    {
        // Linear peak amplitude (0...1); the labels are explicit peak
        // indicators, not uncalibrated LUFS or output-loudness meters.
        const float db = juce::Decibels::gainToDecibels (juce::jmax (level, 0.00001f));
        const float portion = juce::jlimit (0.0f, 1.0f, (db + 60.0f) / 60.0f);
        for (int i = 0; i < 20; ++i)
        {
            const bool lit = portion * 20.0f >= i + 0.25f;
            const auto c = i > 17 ? juce::Colours::orange : i > 14 ? paper : aqua;
            g.setColour (lit ? c : grid);
            g.fillRoundedRectangle (x + 14.0f * i, y, 9.4f, 15.0f, 2.0f);
        }
    }

    void led (juce::Graphics& g, float x, float y, bool on)
    {
        g.setColour (on ? aqua.withAlpha (0.17f) : grid.withAlpha (0.5f));
        g.fillEllipse (x - 11, y - 11, 22, 22);
        g.setColour (on ? aqua : muted.withAlpha (0.4f));
        g.fillEllipse (x - 5, y - 5, 10, 10);
    }
}

void BlueprintLook::drawRotarySlider (juce::Graphics& g, int x, int y, int w, int h,
                                      float position, float start, float end, juce::Slider&)
{
    const float cx = x + w * 0.5f;
    const float cy = y + h * 0.49f;
    const float radius = juce::jmin (w, h) * 0.33f;
    const float tickR = radius * 1.17f;
    for (int i = 0; i <= 24; ++i)
    {
        const float angle = start + (end - start) * i / 24.0f;
        const float inner = tickR;
        const float outer = tickR + ((i % 4 == 0) ? 10.0f : 5.0f);
        g.setColour (i % 4 == 0 ? paper.withAlpha (0.8f) : muted.withAlpha (0.45f));
        g.drawLine (cx + std::sin (angle) * inner,
                    cy - std::cos (angle) * inner,
                    cx + std::sin (angle) * outer,
                    cy - std::cos (angle) * outer, i % 4 == 0 ? 1.5f : 0.8f);
    }

    g.setColour (cyan.withAlpha (0.50f));
    g.drawEllipse (cx - radius * 1.10f, cy - radius * 1.10f,
                   radius * 2.2f, radius * 2.2f, 1.5f);
    g.setColour (paper.withAlpha (0.14f));
    g.fillEllipse (cx - radius * .77f, cy - radius * .77f,
                   radius * 1.54f, radius * 1.54f);

    // Black chicken-head body, with a long tapered pointer. Everything is
    // native vector drawing: no image of a pedal, no unused art backdrop.
    juce::Path chicken;
    chicken.startNewSubPath (0.0f, -radius * 1.03f);
    chicken.lineTo (radius * 0.22f, -radius * 0.20f);
    chicken.cubicTo (radius * 0.88f, radius * 0.00f,
                     radius * 0.82f, radius * 0.65f,
                     0.0f, radius * 0.73f);
    chicken.cubicTo (-radius * 0.82f, radius * 0.65f,
                     -radius * 0.88f, radius * 0.00f,
                     -radius * 0.22f, -radius * 0.20f);
    chicken.closeSubPath();
    const auto rotation = juce::AffineTransform::rotation (start + position * (end - start))
                              .translated (cx, cy);
    g.setColour (juce::Colour::fromRGB (8, 18, 31));
    g.fillPath (chicken, rotation);
    g.setColour (paper.withAlpha (0.92f));
    g.strokePath (chicken, juce::PathStrokeType (2.2f), rotation);
    g.setColour (cyan.withAlpha (0.45f));
    g.drawEllipse (cx - radius * 0.36f, cy - radius * 0.36f,
                   radius * 0.72f, radius * 0.72f, 1.0f);
    juce::Path mark;
    mark.startNewSubPath (0.0f, -radius * 0.85f);
    mark.lineTo (0.0f, -radius * 0.38f);
    g.setColour (aqua);
    g.strokePath (mark, juce::PathStrokeType (3.2f), rotation);
}

void BlueprintLook::drawButtonBackground (juce::Graphics& g, juce::Button& b,
                                          const juce::Colour&, bool hovered, bool pressed)
{
    auto r = b.getLocalBounds().toFloat().reduced (1.0f);
    g.setColour (pressed ? cyan.withAlpha (0.36f) : lighter);
    g.fillRoundedRectangle (r, 6.0f);
    g.setColour (hovered ? paper : cyan.withAlpha (0.72f));
    g.drawRoundedRectangle (r, 6.0f, pressed ? 2.0f : 1.0f);
}

void BlueprintLook::drawToggleButton (juce::Graphics& g, juce::ToggleButton& b,
                                      bool, bool)
{
    const auto r = b.getLocalBounds().toFloat().reduced (1.0f);
    g.setColour (b.getToggleState() ? cyan.withAlpha (0.28f) : navy);
    g.fillRoundedRectangle (r, 5.0f);
    g.setColour (b.getToggleState() ? aqua : muted);
    g.drawRoundedRectangle (r, 5.0f, 1.2f);
    led (g, r.getX() + 17, r.getCentreY(), b.getToggleState());
    label (g, b.getButtonText(),
           juce::Rectangle<int> ((int)r.getX() + 32, (int)r.getY(),
                                 (int)r.getWidth() - 36, (int)r.getHeight()),
           13, paper);
}

LPCVoiceLabEditor::LPCVoiceLabEditor (LPCVoiceLabProcessor& p)
    : juce::AudioProcessorEditor (&p), processor (p)
{
    setSize (1220, 760);
    for (size_t i = 0; i < controls.size(); ++i)
    {
        auto& slider = controls[i];
        slider.setLookAndFeel (&skin);
        slider.setSliderStyle (i < 3 ? juce::Slider::RotaryHorizontalVerticalDrag
                                    : juce::Slider::LinearHorizontal);
        slider.setTextBoxStyle (i < 3 ? juce::Slider::NoTextBox
                                      : juce::Slider::TextBoxRight, false, 73, 23);
        slider.setColour (juce::Slider::trackColourId, aqua);
        slider.setColour (juce::Slider::thumbColourId, cyan);
        slider.setColour (juce::Slider::backgroundColourId, grid);
        slider.setColour (juce::Slider::textBoxTextColourId, paper);
        slider.setColour (juce::Slider::textBoxBackgroundColourId, navy);
        slider.setColour (juce::Slider::textBoxOutlineColourId, muted);
        addAndMakeVisible (slider);
        attachments[i] = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>
            (processor.apvts, ids[i], slider);
    }

    orderChoice.addItem ("NORMAL", 1);
    orderChoice.addItem ("HIGH", 2);
    orderChoice.setColour (juce::ComboBox::backgroundColourId, lighter);
    orderChoice.setColour (juce::ComboBox::textColourId, paper);
    orderChoice.setColour (juce::ComboBox::outlineColourId, muted);
    addAndMakeVisible (orderChoice);
    orderAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment>
        (processor.apvts, "order", orderChoice);

    for (auto* button : { &unvoicedToggle, &retroToggle, &bypassToggle })
    {
        button->setLookAndFeel (&skin);
        addAndMakeVisible (*button);
    }
    unvoicedAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment>
        (processor.apvts, "unvoiced", unvoicedToggle);
    retroAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment>
        (processor.apvts, "retro", retroToggle);
    bypassAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment>
        (processor.apvts, "bypass", bypassToggle);

    presetChoice.setTextWhenNothingSelected ("CURRENT / MANUAL");
    presetChoice.setColour (juce::ComboBox::backgroundColourId, lighter);
    presetChoice.setColour (juce::ComboBox::textColourId, paper);
    presetChoice.setColour (juce::ComboBox::outlineColourId, cyan);
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
    {
        button->setLookAndFeel (&skin);
        button->setColour (juce::TextButton::textColourOffId, paper);
        addAndMakeVisible (*button);
    }
    savePreset.onClick = [this] { savePresetDialog(); };
    openPreset.onClick = [this] { openPresetDialog(); };
    programButton.onClick = [this]
    {
        const int next = (presetIndex + 1) % 3;
        presetChoice.setSelectedId (next + 1);
    };

    currentProgram.setText ("MANUAL / CUSTOM", juce::dontSendNotification);
    currentProgram.setJustificationType (juce::Justification::centredLeft);
    currentProgram.setColour (juce::Label::textColourId, aqua);
    addAndMakeVisible (currentProgram);

    presetMessage.setText ("USER PATCHES  /  .lpcpreset", juce::dontSendNotification);
    presetMessage.setJustificationType (juce::Justification::centredLeft);
    presetMessage.setColour (juce::Label::textColourId, muted);
    addAndMakeVisible (presetMessage);

    refreshPresetList();
    startTimerHz (15);
}

LPCVoiceLabEditor::~LPCVoiceLabEditor()
{
    stopTimer();
    for (auto& item : attachments) item.reset();
    orderAttachment.reset();
    unvoicedAttachment.reset();
    retroAttachment.reset();
    bypassAttachment.reset();
    for (auto& slider : controls) slider.setLookAndFeel (nullptr);
    for (auto* button : { &unvoicedToggle, &retroToggle, &bypassToggle })
        button->setLookAndFeel (nullptr);
    for (auto* button : { &savePreset, &openPreset, &programButton })
        button->setLookAndFeel (nullptr);
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

    auto xml = processor.apvts.copyState().createXml();
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
    currentProgram.setText (target.getFileNameWithoutExtension(), juce::dontSendNotification);
    presetMessage.setText ("SAVED  /  " + target.getFileName(), juce::dontSendNotification);
    for (int i = 0; i < userPresets.size(); ++i)
        if (userPresets.getReference (i) == target)
        {
            presetChoice.setSelectedId (i + 100, juce::dontSendNotification);
            break;
        }
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
    const auto loaded = juce::ValueTree::fromXml (*xml);
    if (! loaded.isValid())
    {
        showPresetError ("The preset contains invalid parameter data.");
        return;
    }
    // This updates all saved parameters, including the wet/dry/gains and
    // every modern processing feature. The DAW's normal state mechanism
    // remains separate and unchanged.
    processor.apvts.replaceState (loaded);
    presetIndex = -1;
    currentProgram.setText (file.getFileNameWithoutExtension(), juce::dontSendNotification);
    presetMessage.setText ("LOADED  /  " + file.getFileName(), juce::dontSendNotification);
    repaint();
}

void LPCVoiceLabEditor::applyFactoryPreset (int index)
{
    presetIndex = index;
    auto set = [this] (const char* id, float value)
    {
        if (auto* parameter = processor.apvts.getParameter (id))
        {
            parameter->beginChangeGesture();
            parameter->setValueNotifyingHost (parameter->convertTo0to1 (value));
            parameter->endChangeGesture();
        }
    };

    // Deterministic DSP parameters. Preserve mic/carrier/output gain and
    // bypass across program changes to avoid resetting safe live-mic trims.
    // Named user patches, by contrast, save/restore ALL parameters.
    const bool classic = index == 0;
    const bool retro = index == 1;
    set ("quality", classic ? 1.0f : retro ? 0.65f : 1.0f);
    set ("order", index == 2 ? 1.0f : 0.0f);
    set ("wet", 0.5f);
    set ("dry", 0.0f);
    set ("lowend", 0.0f);
    set ("unvoiced", 1.0f);
    set ("fricative", index == 2 ? 0.0f : -3.0f);
    set ("retro", retro ? 1.0f : 0.0f);
    set ("grit", retro ? 0.40f : 0.0f);
    set ("bandwidth", retro ? 4800.0f : 18000.0f);

    static const char* names[] { "CLASSIC / WORKING REFERENCE",
                                 "RETRO / EXPERIMENT", "ARTICULATE / EXPERIMENT" };
    currentProgram.setText (names[juce::jlimit (0, 2, index)], juce::dontSendNotification);
    presetMessage.setText ("PRESET CHANGED / GAIN TRIMS PRESERVED",
                            juce::dontSendNotification);
    repaint();
}

void LPCVoiceLabEditor::timerCallback()
{
    repaint (juce::Rectangle<int> (800, 215, 380, 180));
}

void LPCVoiceLabEditor::paint (juce::Graphics& g)
{
    // Full-bleed flat blueprint: the design language IS the plugin,
    // not an illustration of hardware surrounded by wasted margins.
    g.fillAll (navy);
    for (int x = 0; x < getWidth(); x += 20)
    {
        g.setColour (grid.withAlpha (x % 100 == 0 ? 0.55f : 0.19f));
        g.drawVerticalLine (x, 0.0f, (float)getHeight());
    }
    for (int y = 0; y < getHeight(); y += 20)
    {
        g.setColour (grid.withAlpha (y % 100 == 0 ? 0.55f : 0.19f));
        g.drawHorizontalLine (y, 0.0f, (float)getWidth());
    }
    g.setColour (cyan.withAlpha (0.58f));
    g.drawRect (juce::Rectangle<float> (10, 10, 1200, 740), 1.2f);
    // Blueprint registration marks.
    for (const auto& pt : { juce::Point<int>{25,25}, {1195,25}, {25,735}, {1195,735} })
    {
        g.setColour (paper.withAlpha (0.78f));
        g.drawLine ((float)pt.x - 7, (float)pt.y, (float)pt.x + 7, (float)pt.y, 1.0f);
        g.drawLine ((float)pt.x, (float)pt.y - 7, (float)pt.x, (float)pt.y + 7, 1.0f);
    }

    g.setColour (cyan);
    g.drawLine (30.0f, 77.0f, 1190.0f, 77.0f, 1.1f);
    label (g, "LPC", { 35, 17, 125, 49 }, 39, paper);
    label (g, "VOICE LAB", { 141, 29, 320, 32 }, 28, cyan);
    label (g, "ALPHA 0.4  /  SPEECH SYNTHESIS  /  BLUEPRINT SERIES",
           { 522, 25, 650, 36 }, 16, muted, juce::Justification::centredRight);

    panel (g, { 30, 92, 1160, 74 });
    label (g, "PATCH MEMORY", { 48, 111, 156, 34 }, 18, paper);
    label (g, "SAVE / RECALL YOUR OWN SOUNDS", { 186, 130, 310, 21 }, 11, muted);

    // Main controls occupy the full working area, not a pedal illustration.
    panel (g, { 30, 179, 735, 245 });
    label (g, "01 / INPUT + OUTPUT", { 48, 188, 510, 27 }, 15, cyan);
    const std::array<int,3> knobX { 68, 304, 538 };
    for (int i = 0; i < 3; ++i)
    {
        label (g, captions[(size_t)i], { knobX[(size_t)i], 370, 204, 24 }, 15, paper,
               juce::Justification::centred);
        label (g, i == 0 ? "MODULATOR" : i == 1 ? "SIDECHAIN" : "MAIN BUS",
               { knobX[(size_t)i], 392, 204, 18 }, 11, muted,
               juce::Justification::centred);
    }

    panel (g, { 783, 179, 407, 245 });
    label (g, "02 / SIGNAL MONITOR", { 805, 191, 362, 23 }, 15, cyan);
    const float voice = processor.meterVoice.load();
    const float carrier = processor.meterCarrier.load();
    const float output = processor.meterOutput.load();
    label (g, "VOICE  /  PEAK", { 805, 229, 340, 20 }, 13, paper);
    meter (g, 815, 257, voice);
    label (g, "CARRIER  /  PEAK", { 805, 288, 340, 20 }, 13, paper);
    meter (g, 815, 314, carrier);
    label (g, "OUTPUT  /  PEAK", { 805, 346, 340, 20 }, 13, paper);
    meter (g, 815, 375, output);
    label (g, "PEAK ONLY  /  NOT LOUDNESS MATCHING",
           { 803, 399, 375, 20 }, 10, muted);

    panel (g, { 30, 438, 1160, 287 });
    label (g, "03 / DSP PARAMETERS", { 48, 448, 450, 26 }, 15, cyan);
    const std::array<std::pair<const char*, juce::Rectangle<int>>, 7> params {{
        { "QUALITY", { 53, 490, 250, 20 } },
        { "FRICATIVE GAIN", { 344, 490, 250, 20 } },
        { "GRIT", { 636, 490, 255, 20 } },
        { "BANDWIDTH", { 928, 490, 250, 20 } },
        { "WET", { 53, 576, 250, 20 } },
        { "DRY", { 344, 576, 250, 20 } },
        { "LOW END", { 636, 576, 255, 20 } }
    }};
    for (const auto& p : params)
        label (g, p.first, p.second, 13, paper);
    label (g, "ORDER", { 928, 576, 214, 22 }, 13, paper);
    g.setColour (cyan.withAlpha (0.45f));
    g.drawLine (48, 654, 1172, 654, 1.0f);
    label (g, "TALKBOX ENGINE ACTIVE  /  NUVO + TAZMANIA RESEARCH ONLY",
           { 52, 696, 665, 20 }, 12, muted);
}

void LPCVoiceLabEditor::resized()
{
    presetChoice.setBounds (338, 107, 470, 43);
    savePreset.setBounds (822, 107, 103, 43);
    openPreset.setBounds (938, 107, 91, 43);
    programButton.setBounds (1041, 107, 132, 43);
    currentProgram.setBounds (49, 690, 525, 29);
    presetMessage.setBounds (805, 439, 365, 31);

    controls[0].setBounds (74, 216, 190, 157);
    controls[1].setBounds (311, 216, 190, 157);
    controls[2].setBounds (544, 216, 190, 157);
    controls[3].setBounds (49, 515, 258, 38);
    controls[4].setBounds (341, 515, 258, 38);
    controls[8].setBounds (633, 515, 258, 38);
    controls[9].setBounds (925, 515, 258, 38);
    controls[5].setBounds (49, 602, 258, 38);
    controls[6].setBounds (341, 602, 258, 38);
    controls[7].setBounds (633, 602, 258, 38);
    orderChoice.setBounds (926, 601, 242, 38);

    unvoicedToggle.setBounds (51, 665, 174, 32);
    retroToggle.setBounds (238, 665, 146, 32);
    bypassToggle.setBounds (394, 665, 151, 32);
}
