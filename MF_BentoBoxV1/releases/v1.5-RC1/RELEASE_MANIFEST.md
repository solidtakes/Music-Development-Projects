# MF BentoBox v1.5 — Release Candidate 1 (owner-tested designation)

## Status
Owner reports the Bank C **hold E1 + tap E4** Melodic↔Drum switch works on real Twister/Live and designates it **v1.5 RC1**, *working so far*. Do not call v1.5 Stable or claim an exhaustive hardware suite.

**RC1 exact source package:** `MF_BentoBoxV1_v1.4.29_BankC_E1_E4_Melodic_Drum_Toggle_EXPERIMENTAL_TEST.zip`
**Verified local SHA-256:** `8e8e43866da23eefb6c76e44da8cfd38c24955a950b765ab7ab0f2b4be7c2787`
Package contains 16 members: `MF_BentoBoxV1/` sources, `qa/` tests, MANIFEST.json, README. Existing package label is v1.4.29; **v1.5 RC1 is the owner-approved designation of those same bytes**, not yet a renamed/repacked release.
Package's offline verification: 223/223 passing per source README. That test result does not independently prove every runtime action.
**The binary/source ZIP is not uploaded in this documentation-only commit.** GitHub is an occasional checkpoint; user's permanent local development folder is `F:\Claude projects\MF BentoBox`, downloads `F:\Downloads`.

## RC1 user-approved behavior
- Bank C Melodic↔Drum: hold E1 and tap E4. Starts in Drum; switching back restores the selected drum lane while Live remains loaded.
- Drum: 16 pitches C1–D#2 (MIDI 36–51), 16 steps on selected pitch, polyphonic multi-lane pattern, E1+rotate E14 (4 detents per lane); Ableton status bar displays General MIDI drum names.
- Drum parameter cycle: Velocity, Probability, Nudge (1/512 per turn), no Pitch or Length editing.
- Original melodic sequencer preserved as separate source; parameter reset protections for Velocity/Pitch/Nudge/Length (30ms pre-press conditional rollback and 35ms post-press guard).
- Frozen Track/Master RGB and four-white-step VU specification: [Issue #86](https://github.com/solidtakes/Music-Development-Projects/issues/86).
- Selected Track Mixer: bidirectional Solo chords; hold Mute + tap Send1 stops selected track's clips; v1.4.26 Pan/Sends same-encoder press protection hardware accepted by owner (tests 1-4 pass).
- Cross-branch press protection inventory: [Issue #90](https://github.com/solidtakes/Music-Development-Projects/issues/90).
- No automatic merge, no silent VU/gesture/color/CC changes, no MIDI Fighter Utility/Native Mode changes.

## Planned follow-up outside RC1
The owner requested General MIDI names by default and detected Drum Rack pad names when available; this is **not part of the exact v1.4.29 RC1 package** and should be an isolated RC2 candidate after API verification.
Do not repurpose v1.5 RC1 to include untested work.

## Backup / recovery
Keep the original v1.4.29 archive unmodified. Archive older builds without overwriting same names, and retain v1.4.26 as earlier owner-tested rollback. To use RC1, install only the package's `MF_BentoBoxV1` folder in Ableton Remote Scripts; keep local development separate from Live installation.
