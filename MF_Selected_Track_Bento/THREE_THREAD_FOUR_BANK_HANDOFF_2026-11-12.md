# MIDI Fighter Twister — three-thread / four-bank development handoff

Date: 2026-11-12. Owner-defined project organization.

## Active threads
1. **Selected Track Bento / Bank 1** — THIS thread: develop/test Bento modules, keep frozen Track Mixer v1, Device Controls v1, FX Sends v1; Clip Launcher beta; VU beta until hardware acceptance; transport experimental.
2. **Step Sequencer / Bank 2** — SEPARATE thread: develop/test sequencer note creation, pitch, velocity, note lengths, paging and LEDs. Do not alter Bank 1 without integration review.
3. **Experimental Integration** — SEPARATE thread: copy/paste and combine accepted modules from Bank 1 and Bank 2; build single installable multi-bank ZIP; compare module behavior, test bank switching and LED/MIDI isolation; preserve versioned archives and hashes.

## Reserved, NOT building yet
- **Bank 3: Session View** — future clip/scene/session navigation.
- **Bank 4: Device Specific** — future device-focused mappings.

## Current source of truth
- Owner reports a two-bank combined experimental build tested working; actual combined ZIP/hash still needs to be captured and verified before declaring it canonical.
- Bank 1 Bento v2.2 experimental test ZIP is separately documented in BENTO_V22_EXPERIMENTAL_BUILD_MANIFEST_2026-11-12.md.
- Frozen: Track Mixer v1, Device Controls v1, FX Sends v1.
- Beta: VU module (selected-track and Master design approved but implementation unaccepted), Clip Launcher (close to acceptance).
- Transport experimental. Do not claim future banks are implemented.

## Integration protocol
1. Each development thread publishes a source ZIP/patch, version, SHA-256, changelog, and exact changed files/modules.
2. Experimental Integration starts from the latest verified combined baseline; imports only intended changes, and compares unaffected bank source/mappings.
3. Run frozen-module regressions and two-bank switch/held-button/LED tests; record pass/fail.
4. Store build manifests and, when possible, source ZIPs in GitHub. Never report a ZIP uploaded unless binary bytes are actually verified in the repo.
5. No automatic merge or overwrite of accepted working source.

## Thread handoff: Bank 2
'Work only on MIDI Fighter Twister Bank 2 Step Sequencer. Bank 1 Selected Track Bento is maintained separately; Experimental Integration owns combined ZIP builds. Preserve Bank 1 behavior. Send each sequencer change with exact version, source ZIP, changed files, test instructions and regression notes. Bank 3 Session View and Bank 4 Device Specific are reserved, not being built.'

## Thread handoff: Experimental Integration
'Own the combined MIDI Fighter Twister build with Bank 1 Selected Track Bento and Bank 2 Step Sequencer. Treat frozen Track Mixer/Device/FX v1 as immutable; Clip Launcher and VU remain beta. Import tested changes from their dedicated threads; verify both banks and bank-switch isolation. Capture the user-tested combined ZIP and hash before promoting it to baseline. Bank 3 Session View and Bank 4 Device Specific are reserved. Never silently overwrite a module or claim unverified GitHub ZIP upload.'
