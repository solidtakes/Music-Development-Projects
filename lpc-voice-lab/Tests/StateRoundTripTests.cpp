/*
 * Preset / DAW state round trips for the optional voiceMode attribute.
 *
 *   - Alpha 0.4 presets and DAW chunks (no voiceMode) restore every parameter
 *     and select TalkBox, whatever mode was active before.
 *   - New presets written in either mode restore that mode and every parameter.
 *   - Unknown or malformed modes fall back to TalkBox; foreign XML is rejected.
 *   - All fourteen Alpha 0.4 parameter IDs are present, unchanged, in order.
 *   - A host session restore never reports nonParameterStateChanged; user
 *     mode changes and preset loads still do.
 */

#include "PluginProcessor.h"

#include <cstdio>
#include <map>
#include <string>

namespace
{

int failures = 0;

void check (bool ok, const std::string& what, const std::string& detail = {})
{
    std::printf ("%-52s %s%s%s\n", what.c_str(), ok ? "ok" : "FAIL",
                 detail.empty() ? "" : "   ", detail.c_str());
    if (! ok) ++failures;
}

using Mode = LPCVoiceLabProcessor::VoiceMode;
using Values = std::map<std::string, float>;

// A preset exactly as Alpha 0.4 wrote it: APVTS XML plus the preset header,
// no voiceMode attribute. Values sit on each parameter's snapping grid.
const char* kLegacyPreset = R"(<?xml version="1.0" encoding="UTF-8"?>
<PARAMS lpcVoiceLabPresetVersion="1" presetName="Alpha04 Legacy">
  <PARAM id="wet" value="0.3"/>
  <PARAM id="dry" value="0.25"/>
  <PARAM id="quality" value="0.65"/>
  <PARAM id="order" value="1.0"/>
  <PARAM id="unvoiced" value="1.0"/>
  <PARAM id="fricative" value="-6.5"/>
  <PARAM id="lowend" value="0.4"/>
  <PARAM id="micgain" value="3.5"/>
  <PARAM id="cargain" value="-2.0"/>
  <PARAM id="outgain" value="1.5"/>
  <PARAM id="bypass" value="0.0"/>
  <PARAM id="retro" value="1.0"/>
  <PARAM id="grit" value="0.4"/>
  <PARAM id="bandwidth" value="4800.0"/>
</PARAMS>
)";

const Values kLegacyValues {
    { "wet", 0.3f }, { "dry", 0.25f }, { "quality", 0.65f }, { "order", 1.0f },
    { "unvoiced", 1.0f }, { "fricative", -6.5f }, { "lowend", 0.4f },
    { "micgain", 3.5f }, { "cargain", -2.0f }, { "outgain", 1.5f },
    { "bypass", 0.0f }, { "retro", 1.0f }, { "grit", 0.4f }, { "bandwidth", 4800.0f } };

const Values kNewValues {
    { "wet", 0.8f }, { "dry", 0.1f }, { "quality", 0.2f }, { "order", 0.0f },
    { "unvoiced", 0.0f }, { "fricative", 4.0f }, { "lowend", 0.9f },
    { "micgain", -12.0f }, { "cargain", 6.0f }, { "outgain", -3.0f },
    { "bypass", 1.0f }, { "retro", 0.0f }, { "grit", 0.75f }, { "bandwidth", 9000.0f } };

void setValues (LPCVoiceLabProcessor& p, const Values& values)
{
    for (const auto& [id, v] : values)
        if (auto* param = p.apvts.getParameter (id))
            param->setValueNotifyingHost (param->convertTo0to1 (v));
}

std::string compareValues (LPCVoiceLabProcessor& p, const Values& expected)
{
    std::string bad;
    for (const auto& [id, v] : expected)
    {
        auto* raw = p.apvts.getRawParameterValue (id);
        if (raw == nullptr) { bad += id + "(missing) "; continue; }
        if (std::abs (raw->load() - v) > 1.0e-4f * std::max (1.0f, std::abs (v)))
            bad += id + "=" + std::to_string (raw->load()) + " ";
    }
    return bad;
}

std::unique_ptr<juce::XmlElement> parse (const char* text)
{
    return juce::parseXML (juce::String (text));
}

//==============================================================================
void parameterIdsUnchanged()
{
    LPCVoiceLabProcessor p;
    const char* ids[] { "wet", "dry", "quality", "order", "unvoiced", "fricative", "lowend",
                        "micgain", "cargain", "outgain", "bypass", "retro", "grit", "bandwidth" };
    const auto& params = p.getParameters();
    bool ok = params.size() == 14;
    std::string detail = std::to_string (params.size()) + " params";
    for (int i = 0; ok && i < params.size(); ++i)
    {
        auto* withId = dynamic_cast<juce::AudioProcessorParameterWithID*> (params[i]);
        ok = withId != nullptr && withId->paramID == ids[i] && withId->getVersionHint() == 1;
        if (! ok) detail += ", mismatch at " + std::to_string (i);
    }
    check (ok, "all 14 Alpha 0.4 parameter IDs unchanged, in order", detail);
}

void legacyPresetDefaultsToTalkBox()
{
    LPCVoiceLabProcessor p;
    p.setVoiceMode (Mode::nuVo);  // a NuVo session loading an old preset
    auto xml = parse (kLegacyPreset);
    const bool restored = xml != nullptr && p.restoreStateXml (*xml);
    const auto bad = compareValues (p, kLegacyValues);
    check (restored && p.getVoiceMode() == Mode::talkBox && bad.empty(),
           "legacy preset restores params, selects TalkBox", bad);
}

void legacyDawChunkDefaultsToTalkBox()
{
    // Alpha 0.4 getStateInformation: copyXmlToBinary (apvts XML).
    auto xml = parse (kLegacyPreset);
    xml->removeAttribute ("lpcVoiceLabPresetVersion");
    xml->removeAttribute ("presetName");
    juce::MemoryBlock chunk;
    juce::AudioProcessor::copyXmlToBinary (*xml, chunk);

    LPCVoiceLabProcessor p;
    p.setVoiceMode (Mode::nuVo);
    p.setStateInformation (chunk.getData(), (int) chunk.getSize());
    const auto bad = compareValues (p, kLegacyValues);
    check (p.getVoiceMode() == Mode::talkBox && bad.empty(),
           "legacy DAW chunk restores params, selects TalkBox", bad);
}

void legacyPresetResavesAsTalkBox()
{
    LPCVoiceLabProcessor a;
    a.restoreStateXml (*parse (kLegacyPreset));
    auto saved = a.captureStateXml();

    LPCVoiceLabProcessor b;
    b.setVoiceMode (Mode::nuVo);
    const bool restored = saved != nullptr && b.restoreStateXml (*saved);
    const auto bad = compareValues (b, kLegacyValues);
    check (restored && saved->getStringAttribute ("voiceMode") == "TalkBox"
               && b.getVoiceMode() == Mode::talkBox && bad.empty(),
           "legacy preset -> save -> load round trip", bad);
}

void newPresetRoundTrips (Mode mode, const char* name, const char* attr)
{
    LPCVoiceLabProcessor a;
    setValues (a, kNewValues);
    a.setVoiceMode (mode);
    auto saved = a.captureStateXml();

    // The editor adds the same header to preset files.
    saved->setAttribute ("lpcVoiceLabPresetVersion", 1);
    saved->setAttribute ("presetName", name);
    const auto text = saved->toString();
    auto reparsed = juce::parseXML (text);

    LPCVoiceLabProcessor b;
    b.setVoiceMode (mode == Mode::nuVo ? Mode::talkBox : Mode::nuVo);  // start opposite
    const bool restored = reparsed != nullptr && b.restoreStateXml (*reparsed);
    const auto bad = compareValues (b, kNewValues);
    check (restored && saved->getStringAttribute ("voiceMode") == attr
               && b.getVoiceMode() == mode && bad.empty(),
           std::string ("new ") + name + " preset round trip (file XML)", bad);
}

void newDawStateRoundTrips (Mode mode, const char* name)
{
    LPCVoiceLabProcessor a;
    setValues (a, kNewValues);
    a.setVoiceMode (mode);
    juce::MemoryBlock chunk;
    a.getStateInformation (chunk);

    LPCVoiceLabProcessor b;
    b.setVoiceMode (mode == Mode::nuVo ? Mode::talkBox : Mode::nuVo);
    b.setStateInformation (chunk.getData(), (int) chunk.getSize());
    const auto bad = compareValues (b, kNewValues);
    check (b.getVoiceMode() == mode && bad.empty(),
           std::string ("new ") + name + " DAW state round trip (binary)", bad);
}

void unknownModesFallBackToTalkBox()
{
    bool ok = true;
    std::string detail;
    for (const char* value : { "Future", "nuvo", "NUVO", "", "1" })
    {
        auto xml = parse (kLegacyPreset);
        xml->setAttribute ("voiceMode", value);
        LPCVoiceLabProcessor p;
        p.setVoiceMode (Mode::nuVo);
        const bool restored = p.restoreStateXml (*xml);
        if (! restored || p.getVoiceMode() != Mode::talkBox)
        {
            ok = false;
            detail += std::string ("'") + value + "' ";
        }
    }
    check (ok, "unknown / malformed voiceMode selects TalkBox", detail);
}

void foreignXmlIsRejected()
{
    LPCVoiceLabProcessor p;
    setValues (p, kNewValues);
    p.setVoiceMode (Mode::nuVo);
    auto xml = parse (R"(<SOMETHING_ELSE voiceMode="TalkBox"><PARAM id="wet" value="0.0"/></SOMETHING_ELSE>)");
    const bool restored = p.restoreStateXml (*xml);
    const auto bad = compareValues (p, kNewValues);
    check (! restored && p.getVoiceMode() == Mode::nuVo && bad.empty(),
           "foreign XML is rejected, state untouched", bad);
}

void voiceModeStaysOutOfParameterTree()
{
    LPCVoiceLabProcessor a;
    a.setVoiceMode (Mode::nuVo);
    auto saved = a.captureStateXml();
    LPCVoiceLabProcessor b;
    b.restoreStateXml (*saved);
    const bool inTree = b.apvts.state.hasProperty ("voiceMode");
    // Changing the mode afterwards must win over anything the tree remembers.
    b.setVoiceMode (Mode::talkBox);
    auto resaved = b.captureStateXml();
    check (! inTree && resaved->getStringAttribute ("voiceMode") == "TalkBox",
           "voiceMode is metadata, not a parameter-tree value");
}

void factoryPresetsSelectTalkBox()
{
    bool ok = true;
    for (int i = 0; i < 3; ++i)
    {
        LPCVoiceLabProcessor p;
        p.setVoiceMode (Mode::nuVo);
        p.applyFactoryPreset (i);
        ok = ok && p.getVoiceMode() == Mode::talkBox;
    }
    check (ok, "factory presets select TalkBox");
}

//==============================================================================
// Host notification: counts audioProcessorChanged calls flagged
// nonParameterStateChanged (what JUCE's VST3 wrapper turns into setDirty).
struct DirtyCounter final : juce::AudioProcessorListener
{
    int count = 0;
    void audioProcessorParameterChanged (juce::AudioProcessor*, int, float) override {}
    void audioProcessorChanged (juce::AudioProcessor*, const ChangeDetails& details) override
    {
        if (details.nonParameterStateChanged) ++count;
    }
};

juce::MemoryBlock chunkFor (Mode mode)
{
    LPCVoiceLabProcessor source;
    setValues (source, kNewValues);
    source.setVoiceMode (mode);
    juce::MemoryBlock chunk;
    source.getStateInformation (chunk);
    return chunk;
}

void hostRestoreDoesNotNotify()
{
    std::string detail;
    bool ok = true;
    // A NuVo session opened into a fresh (TalkBox) instance, and a legacy
    // Alpha 0.4 chunk opened into a NuVo instance: both change the mode.
    {
        LPCVoiceLabProcessor p;
        DirtyCounter dirty;
        p.addListener (&dirty);
        const auto chunk = chunkFor (Mode::nuVo);
        p.setStateInformation (chunk.getData(), (int) chunk.getSize());
        ok = ok && p.getVoiceMode() == Mode::nuVo && dirty.count == 0;
        detail += "nuvo chunk: " + std::to_string (dirty.count);
        p.removeListener (&dirty);
    }
    {
        auto xml = parse (kLegacyPreset);
        juce::MemoryBlock chunk;
        juce::AudioProcessor::copyXmlToBinary (*xml, chunk);
        LPCVoiceLabProcessor p;
        p.setVoiceMode (Mode::nuVo);
        DirtyCounter dirty;
        p.addListener (&dirty);
        p.setStateInformation (chunk.getData(), (int) chunk.getSize());
        ok = ok && p.getVoiceMode() == Mode::talkBox && dirty.count == 0;
        detail += ", legacy chunk: " + std::to_string (dirty.count);
        p.removeListener (&dirty);
    }
    check (ok, "host session restore sends no dirty notification", detail + " (want 0)");
}

void userChangesStillNotify()
{
    LPCVoiceLabProcessor p;
    DirtyCounter dirty;
    p.addListener (&dirty);

    p.setVoiceMode (Mode::nuVo);                    // engine selection changes
    const int afterSelection = dirty.count;
    p.setVoiceMode (Mode::nuVo);                    // same mode, no change
    const int afterSame = dirty.count;

    auto legacy = parse (kLegacyPreset);            // user loads an Alpha 0.4 preset
    p.restoreStateXml (*legacy);
    const int afterPreset = dirty.count;

    p.setVoiceMode (Mode::nuVo);
    const int beforeFactory = dirty.count;
    p.applyFactoryPreset (0);                       // factory preset selects TalkBox
    const int afterFactory = dirty.count;
    p.removeListener (&dirty);

    const bool ok = afterSelection == 1 && afterSame == 1 && afterPreset == 2
                 && afterFactory == beforeFactory + 1 && p.getVoiceMode() == Mode::talkBox;
    char buf[128];
    std::snprintf (buf, sizeof buf, "selection %d, same %d, preset %d, factory +%d",
                   afterSelection, afterSame, afterPreset, afterFactory - beforeFactory);
    check (ok, "user mode changes and presets still notify", buf);
}

void editorFollowsModeChanges()
{
    LPCVoiceLabProcessor p;
    std::unique_ptr<juce::AudioProcessorEditor> editor (p.createEditor());
    juce::TextButton* talkBox = nullptr;
    juce::TextButton* nuVo = nullptr;
    for (auto* child : editor->getChildren())
        if (auto* button = dynamic_cast<juce::TextButton*> (child))
        {
            if (button->getButtonText() == "TALKBOX") talkBox = button;
            if (button->getButtonText() == "NUVO") nuVo = button;
        }
    if (talkBox == nullptr || nuVo == nullptr)
    {
        check (false, "editor mode display follows every change", "engine buttons missing");
        return;
    }

    // Deliver the async change message the way the message loop would.
    const auto shows = [&] (Mode mode)
    {
        p.voiceModeChanged.dispatchPendingMessages();
        return talkBox->getToggleState() == (mode == Mode::talkBox)
            && nuVo->getToggleState() == (mode == Mode::nuVo);
    };

    const auto chunk = chunkFor (Mode::nuVo);
    p.setStateInformation (chunk.getData(), (int) chunk.getSize());    // DAW restore, editor open
    const bool afterRestore = shows (Mode::nuVo);
    p.restoreStateXml (*parse (kLegacyPreset));                       // preset load
    const bool afterPreset = shows (Mode::talkBox);
    p.setVoiceMode (Mode::nuVo);                                       // change from elsewhere
    const bool afterExternal = shows (Mode::nuVo);

    DirtyCounter dirty;
    p.addListener (&dirty);
    talkBox->onClick();
    const bool afterTalkBox = shows (Mode::talkBox) && p.getVoiceMode() == Mode::talkBox;
    nuVo->onClick();
    const bool afterNuVo = shows (Mode::nuVo) && p.getVoiceMode() == Mode::nuVo;
    p.removeListener (&dirty);

    check (afterRestore && afterPreset && afterExternal && afterTalkBox && afterNuVo
           && dirty.count == 2, "editor mode display follows every change");
}

void editorControlsFollowState()
{
    LPCVoiceLabProcessor p;
    std::unique_ptr<juce::AudioProcessorEditor> editor (p.createEditor());
    for (const auto& entry : kLegacyValues)
    {
        const auto& id = entry.first;
        const auto value = entry.second;
        auto* parameter = p.apvts.getParameter (id.c_str());
        auto* control = editor->findChildWithID (id.c_str());
        parameter->setValueNotifyingHost (parameter->convertTo0to1 (value));

        if (auto* slider = dynamic_cast<juce::Slider*> (control))
        {
            const auto text = slider->getTextFromValue (slider->getValue());
            const auto next = slider->getMaximum() - 0.05 * (slider->getMaximum() - slider->getMinimum());
            const auto followsHost = std::abs (slider->getValue() - value) < 0.001;
            const auto editMatches = std::abs (slider->getValueFromText (text) - value)
                                   < (id == "quality" ? 0.01 : 0.001);
            slider->setValue (next, juce::sendNotificationSync);
            const auto sendsHost = std::abs (parameter->convertFrom0to1 (parameter->getValue())
                                            - slider->getValue()) < 0.001;
            check (followsHost && editMatches && sendsHost, "fader automation / readout: " + id);
        }
        else if (auto* box = dynamic_cast<juce::ComboBox*> (control))
        {
            check (box->getSelectedId() == (int) value + 1, "choice automation: " + id);
        }
        else if (auto* button = dynamic_cast<juce::ToggleButton*> (control))
        {
            check (button->getToggleState() == (value != 0.0f), "toggle automation: " + id);
        }
        else
        {
            check (false, "missing editor control: " + id);
        }
    }
}

void captureEditor (const juce::File& directory)
{
    LPCVoiceLabProcessor p;
    std::unique_ptr<juce::AudioProcessorEditor> editor (p.createEditor());
    p.meterVoice.store (0.30f);
    p.meterCarrier.store (0.48f);
    p.meterOutput.store (0.19f);
    check (directory.createDirectory().wasOk(), "create screenshot directory");

    for (const auto mode : { Mode::talkBox, Mode::nuVo })
    {
        p.setVoiceMode (mode, false);
        p.voiceModeChanged.dispatchPendingMessages();
        const auto image = editor->createComponentSnapshot (editor->getLocalBounds());
        const auto filename = mode == Mode::talkBox ? "LPC-Vocoder-TalkBox.png" : "LPC-Vocoder-NuVo.png";
        const auto file = directory.getChildFile (filename);
        juce::TemporaryFile temp (file);
        bool written;
        {
            juce::FileOutputStream output (temp.getFile());
            written = output.openedOk() && juce::PNGImageFormat().writeImageToStream (image, output);
        }
        check (written && temp.overwriteTargetFileWithTemporary(), filename);
    }
}

} // namespace

int main (int argc, char** argv)
{
    juce::ScopedJuceInitialiser_GUI juceInit;
    std::printf ("LPC Voice Lab - preset / state round-trip test\n\n");

    parameterIdsUnchanged();
    legacyPresetDefaultsToTalkBox();
    legacyDawChunkDefaultsToTalkBox();
    legacyPresetResavesAsTalkBox();
    newPresetRoundTrips (Mode::nuVo, "NuVo", "NuVo");
    newPresetRoundTrips (Mode::talkBox, "TalkBox", "TalkBox");
    newDawStateRoundTrips (Mode::nuVo, "NuVo");
    newDawStateRoundTrips (Mode::talkBox, "TalkBox");
    unknownModesFallBackToTalkBox();
    foreignXmlIsRejected();
    voiceModeStaysOutOfParameterTree();
    factoryPresetsSelectTalkBox();
    hostRestoreDoesNotNotify();
    userChangesStillNotify();
    editorFollowsModeChanges();
    editorControlsFollowState();
    if (argc == 3 && juce::String (argv[1]) == "--editor-screenshots")
        captureEditor (juce::File::getCurrentWorkingDirectory().getChildFile (argv[2]));

    std::printf ("\n%s\n", failures == 0 ? "all checks passed" : "FAILURES PRESENT");
    return failures == 0 ? 0 : 1;
}
