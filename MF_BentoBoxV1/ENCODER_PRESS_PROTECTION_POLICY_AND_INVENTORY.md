# MF BentoBox — Shared Encoder Press-Contamination Policy & Rollout Inventory
Owner-approved experimental behavior: v1.4.25 Bank C, reported hardware working 2026-11-21.
Scope: all three banks / future column modules, as **review candidates**; only Bank C has the complete 30/35 ms experiment so far.

Source inspected: v1.4.25 installable files `Sequencer_Bank3.py`, `Bank1_SelectedTrack.py`, `FourTrack_Bank2.py`, `ThreeBankHost.py`.
Local tested-package name `MF_BentoBoxV1_v1.4.25_BankC_30ms_PrePress_35ms_PostPress_Length_Reset_EXPERIMENTAL_TEST.zip`; SHA256 `1ac69b9eb97806554059c271a30e73cc15c50505c50fb97ec9a99159011a2128`.
This documentation is not a GitHub binary release; local package/source is not uploaded here.

## Observed, agreed behavior
- Press often mechanically generates rotary detents just before/after a push event.
- Bank C parameter-mode **Velocity, Pitch, Nudge (1/512 note), Length** use immediate rotary action, 30ms pre-press reversible same-note/same-clip lookback, and 35ms post-press suppression. Tap resets: velocity 100, pitch MIDI60/C3, nudge grid, length half-step. Do not change these defaults.
- Roll back only when exact original target, edit mode, note identity, current post-edit state, and clip/page still match. Complex multi-note Length mutation must NOT be blindly rolled back.
- Do NOT globally ignore all input for 35ms: intentional modifier combos and true hold+turn must remain usable. Keep guards scoped per physical encoder, action, and binding generation.
- Normal turning must be immediate (no global 30ms commit delay). Only reverse safe, recent accidental pre-press changes.
- Hardware report: owner says Bank C protection works good, not exhaustive per-submode certification.
- Prior accepted releases: frozen Track/Master VU (issue #86), Bank 1 Solo chords both ways, Mute+Send1 stop selected track clips. No change to colors, ring meter, startup, mapping, or presets.

## Inventory: where equivalent protection might be missing
**This is source-audited candidate list, NOT a claim that every knob misbehaves.**

| Priority | Bank/area | Rotation vs push at risk | Source evidence | Candidate treatment / caveat |
|---|---|---|---|---|
| Already pilot | C Sequencer Velocity, Pitch, Nudge, Length | note editing + tap reset | `Sequencer_Bank3.py` `_guarded_parameter_edit`, `_rollback_pre_press`, `receive_midi` | Keep frozen 30ms pre +35ms post; verify for longer sessions |
| P1 | A Selected Track Mixer Pan | pan turn + Mute push/chords | `Bank1_SelectedTrack.py` `_rotate`, `_push`, `_column_param` | Add identity-checked snapshot rollback and post-press guard; do not block Solo or Clip Stop chords |
| P1 | A Selected Track Mixer FX Send 1/2 | send turn + push/chords | `Bank1_SelectedTrack.py` `_nudge` and `_column_param` | per-send rollback, binding generation; preserve Send1 Clip Stop chord |
| P1 | A Device Controls | device parameter turn + device push/toggle | `Bank1_SelectedTrack.py` `_turn_device`, `_column_param` | scoped parameter rollback, handle device/track changes |
| P1 | B Four-Track Pan, Sends | pan/send turns + row buttons | `FourTrack_Bank2.py` `_turn_pan`, `_turn_send`, `_push` | do not copy Volume fix blindly; chord priority and parameter ownership |
| P1 | B Four-Track Device rows | param turn + device utility pushes | `FourTrack_Bank2.py` `_turn_device`, `_rotary` | preserve existing held-utility suppression, window/selection chords |
| Existing partial | A/B Volume | rotary volume with press contamination | A `_nudge_volume_with_press_guard` & `_cancel_press_induced_volume_step`; B `_turn_volume` & `_cancel_press_induced_volume_step` | already pre-press 35ms one-step rollback; first test real behavior and decide whether **post** guard is needed. Do not replace working code blindly |
| P2 | A Track scrolling | E1+E16 held navigation | A `_scroll_track`, `_rotate` | prefer detent accumulator/suppress pre/post accidental navigation; reversing selection is complex |
| P2 | A Clip / scene launch navigation | clip scroll and bank moves | A `_scroll_clips`, `_rotate` | avoid retroactively undoing launch/stop; prevent accidental action at source |
| P2 | B Track/scene scrolling | E1 modifier + E16/E12 | B `_scroll_grid`, `_rotary` | pre-press navigation requires deferral or state snapshot; check intentional hold+twist |
| P2 | A/B Module selection | hold+turn to change column/row module | A `_switch_column`, B `_cycle_module` | preserve 4-detent filters, never rollback persisted assignment without separate transaction |
| P2 | B Device choice/parameter window selection | utility hold+twist | B `_slow_device_select`, `_slow_device_window` | protect selection without swallowing intentional fast control |
| P2 | Shared host transport and clip edit navigation | shuttle/loop/transport modifiers | `ThreeBankHost.py` `_transport_route_rotary`, `_transport_handle_push` | already has specialized `_shuttle_e13_guard_until` / `_loop_e16_guard_until`; audit before adding anything |
| P3 | C probability / sequencer other controls | probability and Notes-mode hold gestures, bar/page / loop navigation | C `receive_midi` and parameter dispatch | probability is **not part** of 30/35ms four-parameter pilot; check actual push action and ownership before extending |

## Policy by action type
1. **Continuous reversible Live parameters:** snapshot before / applied after; eligible 30ms same-encoder pre-press restoration only on identity/unchanged-value match; suppress accidental rotary in first 35ms after a press; avoid global latency.
2. **Notes:** restore only same clip, page, note IDs and exact expected post state; no deletion/overlap or changed multi-note rollback; no speculative reconstruction.
3. **Navigation / module switching / clip launch/stop:** don't use parameter-style undo. Use deliberate detent threshold, press contamination suppression, or buffered navigation tested for responsiveness. Never auto-reverse an executed clip launch/stop.
4. **Buttons and modifiers:** never suppress the intended button tap or held gesture. Release-order tests (A then B and B then A), quick-tap and held-twist tests mandatory.
5. **Feedback:** MIDI RGB/white LED output is not a control input; no VU changes. Prevent stale feedback/undo after track/module/bank changes and disconnect.

## Test matrix before each extension
- rotary 25ms before push: one accidental detent canceled; 40ms before push: intentional move stays
- rotary 10ms after push: accidental edit suppressed; 50ms after push: intentional held turn works
- rapid consecutive normal detents responsive; repeated taps and presses reliable
- parameter target swap, track change, device switch, clip/page switch, bank switch and disconnect between turn and press: no rollback onto new target
- press+turn editing and both release orders remain correct; no stuck buttons/ghost actions; Live Undo history side effects assessed
- compare before/after control feedback and all frozen VU and Bank1 mixer regression tests

## Rollout proposal (NOT AUTHORIZED IMPLEMENTATION)
1. Bank 1 Selected Track Pan and Sends, one control per experimental build, check hardware and Solo/Clip Stop first.
2. Bank 2 Pan/Sends/Device rows, one functional class per build.
3. Bank 1 Device Controls and cross-bank navigation; separate test plans due to non-reversible actions.
4. Assess whether already guarded Volumes need a post-press addition.
5. Future modules must document press-rotation behavior explicitly and ship same threshold regressions where relevant.

No code changes, merges, or existing branches updated by this specification. Explicit owner approval and cross-bank review required for shared input routing changes.
