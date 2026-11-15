# Ableton Extensions SDK Compatibility — Initial Findings

Research date: 2026-11-14

## Official documentation found

- Ableton Extensions SDK overview: https://ableton.github.io/extensions-sdk/
- Ableton Extensions FAQ: https://help.ableton.com/hc/en-us/articles/27303428331420-Ableton-Extensions-FAQ
- Ableton Live 12 Beta release notes: https://www.ableton.com/en/release-notes/live-12-beta/

## What official sources currently state

The official SDK overview says the public beta is available with Live 12.4.5 and subsequent beta releases. It instructs developers to join the Ableton Beta Program, install the latest Live 12 Beta, and download the SDK/documentation from Centercode.

The official FAQ currently says:
- Extensions are available in Live 12 Suite Beta 12.4.5 or later.
- Extensions are not available in Standard, Intro or Lite.
- The required SDK is installed separately.
- Node.js 24.16.0 LTS or higher is required.
- Extensions are invoked from context menus and run as discrete tasks.
- Extensions are not intended for continuous real-time audio processing, signal processing, background processing or performance-oriented tasks.

The October 29, 2026 Live 12 beta notes list SDK Node.js 24.22.1.

## Important compatibility status

The user reports having Live 13 and Live 12.5 current-release installations. The official documentation located in this research does NOT explicitly confirm SDK support for either of those exact release versions. It only documents the Live 12 Suite public-beta path beginning at 12.4.5.

Do not tell the user to install an older beta as the default. Do not assume compatibility. Task A must inspect the actual SDK package/docs and verify exact builds. If the SDK remains beta-only or Suite-only, report that clearly and propose a safe fallback.

## Architecture implication

The Extension SDK is a Live-set integration/control surface, not the offline audio engine. The official FAQ explicitly excludes real-time signal processing and describes extensions as discrete tasks that stop after execution.

The product should therefore keep these concerns separate:
- Live adapter: clip context, metadata, handoff and result insertion where supported.
- Companion editor: persistent GUI and user interaction.
- Processing engine: offline audio transforms, history, branches, cache and render diagnostics.

Do not assume arbitrary process launching, unrestricted filesystem access, audio export or audio insertion APIs. Prove each capability from the exact SDK version and a minimal sample.

## References

- https://ableton.github.io/extensions-sdk/
- https://help.ableton.com/hc/en-us/articles/27303428331420-Ableton-Extensions-FAQ
- https://www.ableton.com/en/release-notes/live-12-beta/
