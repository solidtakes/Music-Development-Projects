/*
 * Preset / DAW state round trips for the optional voiceMode attribute.
 *
 *   - Alpha 0.4 presets and DAW chunks (no voiceMode) restore every parameter
 *     and select TalkBox, whatever mode was active before.
 *   - New presets written in either mode restore that mode and every parameter.
 *   - Unknown or malformed modes fall back to TalkBox; foreign XML is rejected.
 *   - All fourteen Alpha 0.4 parameter IDs are present, unchanged, in order.
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

} // namespace

int main()
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

    std::printf ("\n%s\n", failures == 0 ? "all checks passed" : "FAILURES PRESENT");
    return failures == 0 ? 0 : 1;
}
