# MIDI Fighter Twister — Single Channel Mixer v0.5.12 Layout
**Visual diagram:** Two-page PDF is available as a ChatGPT download; this GitHub text diagram provides the same control map without RGB numbers.

## Physical grid
| E1 | E2 | E3 | E4 |
|---|---|---|---|
| E5 | E6 | E7 | E8 |
| E9 | E10 | E11 | E12 |
| E13 | E14 | E15 | E16 |

## FX / Sends
- Rotary Sends: E1=A, E5=B, E2=C, E6=D, E10=E, E14=F (purple centers; unavailable off).
- E1 push = Send bank up; E5 push = Send bank down.
- E9 rotary Pan; hold+rotate Monitor IN/AUTO/OFF; double-push exclusive Solo.
- E13 rotary Volume with white VU/value ring; single-push exclusive Arm; double-push Mute.
- E15 push FX ↔ Device; E16 rotary track scroll; E8 push Master; E12 push FX Returns; E16 push regular Tracks.
- Four-bar beat column and VU/MIDI indicators retain stable assignments.

## Device
- E1–E8 rotary = device parameters of selected 8-wide bank; unmapped LEDs and rings off.
- E1 push Device On/Off; E2 previous device; E3 next device.
- **E5 push** advances bank and wraps at last bank; E5 rotary still controls the parameter in its current bank.
- E9 Pan / Monitor / Solo, E13 Volume / Arm / Mute, E15 mode toggle, E16 track scroll.
- E13 LED priority: Solo > Mute (off) > Arm > Normal. White VU ring unaffected.
- 400 ms post-push rotation suppression for mapped push encoders except E9 hold+turn.
- No color-code numbers in the diagram legend.
