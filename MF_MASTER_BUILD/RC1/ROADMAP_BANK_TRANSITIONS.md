# Master Build roadmap — bank transition indication

Status is proposed for a future candidate after RC1. The owner requested a short, polished transition that identifies each bank and uses the moment to prepare its Live state. The working RC1 archive remains the reference build.

## Requested identity

| Physical bank | Ableton status text | White-ring visual cue |
| --- | --- | --- |
| 1, Selected Track Bento | `Sel` | A left-to-right sweep across the four columns |
| 2, Four-Track Bento | `4` | Four columns fill in sequence |
| 3, Sequencer | `SeQ` | A stepped chase across the 4 × 4 grid |

The Twister has white LED indicator rings around its encoders and no character display. Exact `Sel`, `4`, and `SeQ` text should appear in Live's status bar. The white rings can convey the same identity through distinct motion. A gradual 0–127 ring-value sweep is a candidate visual treatment, subject to a short physical preview for readability and MIDI load. [DJ TechTools Twister guide](https://media.justmusic.de/shop/assets/handbuch/DJ%20Techtools%20Midi-Fighter-Twister-User-Guide-2016.pdf)

## Transition sequence

1. Detect the incoming physical bank. Verify whether the current `222.mfs` profile emits a reliable bank-change message. RC1 currently infers Bank 1 or 2 from the next bank-specific CC and routes Bank 3 through its own CC range, so a transition before the first encoder action is not established by RC1.
2. Show the bank label in Live's status bar as soon as the bank is known. Start a cancellable animation lasting about one second at most.
3. During that interval, suspend outgoing parameter LED refreshes for the departing bank. Reconcile current track, device, clip, send and sequencer state for the incoming bank in bounded scheduled steps. Keep Live input and the audio thread responsive. Retain each module's required listeners and clean them up through its normal lifecycle.
4. Sweep the incoming bank's white rings through a small number of 0–127 steps, staggered across encoders. Use changed-value MIDI writes and an explicit transition owner so normal VU, clip and sequencer renderers cannot overwrite the cue.
5. At the end, light the incoming bank's normal colors, flash them once, and render current ring and RGB state from fresh Live values. Clear any temporary animation state and return LED ownership to the bank.
6. If another bank is selected during the cue, cancel the old cue and start the new one. On disconnect, cancel queued callbacks and avoid further MIDI output.

## Optimization and acceptance

- Use scheduled callbacks with a generation token. Avoid a blocking one-second sleep.
- Read only the incoming bank's required Live properties. Defer optional meter, clip-position and animation polling during the cue, then resume each active module once.
- Keep parameter input responsive throughout the transition. Define which temporary LED writes are allowed while controls are moving.
- Bound the number of MIDI messages and verify that the final display matches the bank's actual parameters after rapid switches, device changes and track deletion.
- Confirm bank-change detection, 0–127 sweep behavior, RGB flash behavior and timing on the owner's current firmware and `222.mfs` before implementation. Keep Utility settings, Native Mode and CC assignments unchanged.
- Compare transition latency, Live property reads, scheduled callback count and MIDI message count against RC1. Run offline lifecycle tests and a controlled hardware check before promotion.

The existing host's bank detection and LED writers require an integration design before code changes. This roadmap adds no runtime behavior to RC1. [DJ TechTools channel guide](https://techtools.zendesk.com/hc/en-us/articles/16809770523917-Midi-Fighter-Twister-channel-settings)
