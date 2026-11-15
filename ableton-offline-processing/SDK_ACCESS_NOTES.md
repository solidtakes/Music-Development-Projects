# Ableton Extensions SDK — Access and Compatibility Notes

Last checked: 2026-11-14

## Verified from Ableton's public documentation

- The Extensions SDK is currently described as a public beta.
- Ableton's SDK landing page says it is available with the Live 12.4.5 public beta and subsequent beta releases.
- Ableton's Extensions FAQ says SDK access requires a Live 12 Suite license and access to the Live 12 Suite beta.
- Ableton's FAQ says to access the beta via Centercode and refers users to the Extensions SDK page in the Centercode forum.
- The SDK requires Node.js v24.16.0 LTS or higher.
- The SDK itself is free and is documented as less than 5 MB.
- Extensions are run-once tools invoked from compatible Live context menus; they are not described as a persistent real-time audio-processing/plugin-host environment.

Official references:
- https://ableton.github.io/extensions-sdk/
- https://help.ableton.com/hc/en-us/articles/27303428331420-Ableton-Extensions-FAQ
- https://www.ableton.com/en/live/extensions/
- https://help.ableton.com/hc/en-us/articles/115001663870-Live-Beta-FAQ

## User's available Live versions

User reports having Live 13, Live 12.5 and current release versions installed. These are not, by themselves, proof of SDK compatibility. The currently published SDK docs specifically identify Live 12.4.5 public beta and subsequent beta releases, and the Suite edition requirement.

Do not install an experimental beta over a production installation. Use a side-by-side beta install and a disposable Set.

## Centercode troubleshooting checklist

1. Confirm the user can sign in to the Ableton Beta Test Community at Centercode.
2. Confirm the account is enrolled in the Live 12 Suite beta project, not merely another Live beta or the Live 13 beta.
3. Confirm the user's registered Live 12 license edition is Suite. Live 12 Standard/Intro/Lite are not listed as eligible for Extensions SDK access.
4. Open the relevant Live 12 Suite beta project and look for its Extensions SDK page/resources, not only the installer download area.
5. If the page is missing despite Suite ownership and project enrollment, capture the Centercode project list and ask Ableton beta support/community for the project entitlement. Do not invent a direct download URL.
6. Do not assume that Live 13 or stable Live 12.5 can load SDK Extensions unless Ableton documentation or a reproducible test confirms it.

## Known architectural constraint

An Extension is a Live integration/command layer. The editor's persistent waveform UI, audio DSP, plugin hosting, history graph and cache should be treated as a separate companion application/engine until the SDK's actual UI lifetime, process/file permissions and handoff APIs have been verified.

Do not claim the SDK itself can host arbitrary VST3/AU plugins or perform offline audio rendering.
