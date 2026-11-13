# Step 2 — API feasibility review
Research date: 2026-11-12 (America/Los_Angeles). Issue: [#11](https://github.com/solidtakes/Music-Development-Projects/issues/11).
Status: documentation research only; no implementation authorization.

## Baseline verification gate — BLOCKED
Read [frozen manifest](https://github.com/solidtakes/Music-Development-Projects/blob/bab116f498457251dee46183bb5ec7cd3160c4b9/MF_Selected_Track_Bento/BETA_V2_FREEZE_AND_HANDOFF.md) at freeze commit `bab116f498457251dee46183bb5ec7cd3160c4b9`.
Required artifact: `Bento_v0.1.32_REDOWNLOAD.zip`.
Expected SHA-256: `a1d377fdacb40629bc8454ab48d4ebee984588f933568c02543900ed516ad4fd`.

No matching ZIP was found in accessible workspace files. The complete recursive frozen Git tree contains no ZIP and only the manifest under MF_Selected_Track_Bento; repository releases returned an empty list. Issue #11 contains no artifact attachment and had zero comments when read. The manifest explicitly identifies the package as a local artifact not uploaded to GitHub. No actual ZIP bytes were obtained, so there is **no computed digest and no verification pass**. This establishes unavailability in the checked locations, not absence from the user's computer or other storage.

No baseline source was inspected, substituted, reconstructed, or audited. Do not treat historical scripts or documentation elsewhere in this repository as v0.1.32. Resume source work only after hashing the original ZIP bytes with SHA-256 and matching the value above, then inspecting the expected package file list before extraction. Hash extracted source files separately for audit provenance; a repository-generated ZIP is not an equivalent artifact.

## Evidence and confidence
- **D:** documented Cycling '74 public Max for Live LOM surface. These docs describe M4L; Python parity is a candidate to verify, not a public Python compatibility guarantee.
- **P:** observed call sites in historical, decompiled Ableton-authored Remote Scripts mirrored by a third party. Evidence of a Python pattern only, not a test on 12.4.16.
- **W:** explicit workaround requiring a prepared Set, optional M4L device, or custom module.
- **U:** unavailable or unverified on target; disable rather than guess.

[Ableton release notes](https://www.ableton.com/en/release-notes/live-12/) confirm Live 12.4.16, released October 30, 2026. No installed Live executable, Twister hardware, or target-version Python stubs were available for this research. All target-runtime checks below remain NOT RUN. Current web API docs may evolve; use stated introduction versions and actual runtime probes rather than treating current docs as a frozen 12.4.16 SDK.

## Feasibility matrix
| Capability | Evidence / route | Target recommendation and limits |
|---|---|---|
| Rack Variation selection | D: RackDevice.selected_variation_index; variation_count | Feasible candidate. Guard Rack identity, nonzero count, index range and no-selection state. Selection and recall are separate actions. |
| Rack Variation recall / capture | D: recall_selected_variation(), recall_last_used_variation(), store_variation(), since 11.0 | Feasible candidate. Capture stores a new variation of mapped Macros; do not promise overwrite, rename, named-list access or full plug-in snapshots. Explicit capture action only. |
| Native Effects A/B compare | D: Device.can_compare_ab, is_using_compare_preset_b, save_preset_to_compare_ab_slot(), since 12.3 | Feasible for capable devices. Read capability first; unsupported devices can error. Saving copies current state into the other slot, so require deliberate confirmation gesture. Do not assume every plug-in supports it. |
| Continuous A/B crossfade | No native compare interpolation documented; W: prepared parallel Rack chains or A/B-assigned tracks | Separate design. Native compare is discrete. Rack chain zones/fades or gain Macros must be prepared and tested; no automatic routing changes. Master crossfader is global and can affect unrelated tracks. |
| Main Browser hierarchy / audition / load | P: application.browser, item.children, browser.load_item(item), preview_item(item), stop_preview() | Conditional Python experiment. Build a bounded script-owned cursor; this does not establish control of the desktop Browser's highlighted item, search field, tags or sort order. |
| Browser context / hot-swap | P: browser.hotswap_target and filter_type in historical Push code | Conditional, higher risk. Context is not the new Contextual Browser. Verify read/write access separately; bind destination explicitly and recheck before load. Exact insertion/replacement semantics remain untested. |
| Live Contextual Browser UI | U for 12.4.16: Ableton introduces it in Live 13 beta | Defer. No supported target-version API established for opening/navigating that popup. A custom context-filtered Browser module is a different feature and should be named accordingly. |
| Transport 1 | D: Song playback, tempo, metronome and recording controls | Feasible candidate. Module name is a Bento design label, not an API class. Distinguish Arrangement record from Session record. |
| Transport 2 | D: Song loop, playback position, cue navigation and quantization controls | Feasible candidate. Exact four-control layout requires review; avoid hidden reset or destructive press behavior. |
| Device Slots as Bento device shortcuts | D: Track.devices, Track.View.select_device(), Device.parameters | Feasible custom abstraction over existing devices. Start with select and validated activator parameter; treat missing/deleted slots as disabled. Define top-level versus nested devices explicitly. |
| Native mixer Device Slots UI | U: new Live 13 feature in official beta notes | Do not promise native mixer slots or popup control in 12.4.16. Historical similarly named UI options are not proof of the Live 13 feature/API. |
| Scene Launcher | D: Song.scenes, Song.View.selected_scene, Scene.fire(), is_triggered, clip_slots | Feasible candidate. Scene launch can record into armed empty slots depending on Live preferences; test that interaction. There is no documented Scene.is_playing here; derive any playing indication from clip slots. |
| Dedicated VU / beat / bar | P: Python track.output_meter_level in historical Mackie script; D: Song beat-position access | Candidate after baseline recovery. Meter semantics/rate are unverified. Beat/bar display is musical position, not an audio meter; no M4L public track-meter parity established by the docs consulted. |

Sources for the matrix:
1. [RackDevice LOM](https://docs.cycling74.com/apiref/lom/rackdevice/) — variation selection/count and storage/recall methods.
2. [Device LOM](https://docs.cycling74.com/apiref/lom/device/) — native compare capability and methods; parameters and read-only active state.
3. [MixerDevice LOM](https://docs.cycling74.com/apiref/lom/mixerdevice/) — master crossfader parameter and per-track A/none/B assignment.
4. [Track LOM](https://docs.cycling74.com/apiref/lom/track/), [Track.View](https://docs.cycling74.com/apiref/lom/track_view/), [Song.View](https://docs.cycling74.com/apiref/lom/song_view/).
5. [Song LOM](https://docs.cycling74.com/apiref/lom/song/) — transport, position and scene collection.
6. [Scene LOM](https://docs.cycling74.com/apiref/lom/scene/) — launching and triggered state.
7. [DeviceParameter LOM](https://docs.cycling74.com/apiref/lom/deviceparameter/) — value bounds, quantization, enabled/automation state.
8. [Application LOM](https://docs.cycling74.com/apiref/lom/application/) — version introspection; consulted public surface does not expose Browser.
9. [Live 12 device manual](https://www.ableton.com/en/live-manual/12/working-with-instruments-and-effects/) — device comparison and hot-swap workflow.
10. [Live 13 beta notes](https://www.ableton.com/en/release-notes/live-13-beta/) — Contextual Browsing and mixer Device Slots are introduced there.

## Historical Python observations (not a target-runtime certification)
The [Push Browser component](https://github.com/gluon/AbletonLive12_MIDIRemoteScripts/blob/main/Push/browser_component.py) blob `b7995ebbb34c53fc894716cea67e17d817eff2b6` accesses the application Browser, listens for hot-swap/filter/refresh changes and stops preview when disabled. [Push Browser model](https://github.com/gluon/AbletonLive12_MIDIRemoteScripts/blob/main/Push/browser_model.py) blob `d9394031466abdd4446a7da3ff366a8f423f66cf` calls load_item/preview_item on content and traverses children. Both headers identify a March 2024 build, not 12.4.16. Decompiled text contains malformed constructs; do not copy it as executable code.

[Mackie ChannelStrip](https://github.com/gluon/AbletonLive12_MIDIRemoteScripts/blob/main/MackieControl/ChannelStrip.py) blob `7da5977a87e1386f5dbb82f74ac93c97ea3ebaee` reads output_meter_level. This supports a Python meter hypothesis only. No claim is made that stereo meter names, listener support, scaling, or refresh cadence were validated.

## Safe four-encoder sketches — proposals, no mapping changes
Rows below mean top to bottom within a newly assigned module. Reserve hold-top + bottom-turn globally for the existing module chooser. That chord consumes the bottom turn and suppresses top-press actions; a standalone top press must wait until the gesture is resolved. No sketch authorizes changing existing modules.

| New module | E1 | E2 | E3 | E4 |
|---|---|---|---|---|
| Variations | turn select variation; press recall | press recall last | hold/confirm store new variation | status / reserved |
| FX Compare | turn choose device | press select A | press select B | hold/confirm copy current into other slot |
| Browser experiment | root/category | item cursor; press enter folder | press parent; preview toggle | press confirm load; hold cancel |
| Transport 1 | turn tempo; press tap | press play/stop with explicit resume policy | press metronome | press Arrangement record |
| Transport 2 | turn loop start | turn loop length; press loop enable | turn position | turn cue selection; press jump |
| Device shortcuts | one device slot per encoder; press selects; optional held press toggles validated Device On parameter | same | same | same |
| Scenes | one scene per encoder in a four-scene bank; press launches; turn navigates bank under an explicit shared-bank policy | same | same | same |

Transport sketches are functional candidates, not a recovered product specification. Keep Session recording, capture, scene creation/deletion and route editing out of these initial layouts. Feedback should come from Live readback; don't show a successful toggle merely because MIDI was received.

## Runtime verification required before implementing a module
1. Record actual version string, edition, OS, framework availability and module capability results on Live 12.4.16. Probe attributes read-only first. Never infer support from a matching method name alone.
2. In a disposable Set, test each approved mutation with undo and inspect resulting state. Catch known capability/invalid-object errors at the feature boundary; log once and disable that action. Do not swallow every exception and claim success.
3. Variations: zero/one/many variations, nested/non-Rack selection, selection versus recall, count changes, store, last-used behavior and Undo.
4. Compare: capable native effect and instrument, unsupported plug-in/M4L device, A/B readback, copy direction and Undo; listen for mouse-driven changes.
5. Browser: small and large folders, empty/unloadable item, unavailable pack/plugin, preview stop, selection changed before confirmation, audio/MIDI/return/master destination and hot-swap cancellation. Never load while turning. No recursive library crawl in the refresh callback.
6. Transport/scenes/shortcuts: playback stopped/running, quantization, armed tracks, deleted/reordered targets, external GUI changes and missing slots. Revalidate object identity on action.
7. M4L is a supported alternative for documented Rack/Device/Song/Scene LOM operations, subject to edition/license. It does not grant undocumented Browser or Live 13 UI access. Optional custom M4L crossfade processing needs a separate signal-flow design. Any MIDI/OSC bridge is new scope and must not reuse working mappings silently.
