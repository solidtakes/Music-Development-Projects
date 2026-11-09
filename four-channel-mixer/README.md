# Four-Channel Mixer — experimental Ableton Remote Script

Independent of the stable MIDI Fighter Twister Main Build. Never overwrite the stable script.

## Version history
- v0.2.4: exclusive record arm introduced; intermittent missed presses.
- v0.2.5: exclusive and multi-arm gestures confirmed working in Live, but E13/E15/E16 sometimes need another press. E14 (track 2) consistently reliable.
- v0.2.6: experimental double-click mute/unmute and accidental rotation tolerance; **hardware testing pending**.

## Mapping and tests
E13–E16 rotary = four track volumes. Single push = exclusive record arm/disarm; holding one and pushing another enables multi-arm. E13 push+turn = horizontal track navigation; E15 push+turn = send-pair navigation; E16 push+turn = scene navigation. v0.2.6 double push = toggle corresponding track mute. Preserve clip launches, sends, pan and volume behavior.

## Safety
No auto-merge. Record hardware results before promoting builds. Source ZIP archives are held in the ChatGPT project conversation; **this commit is a status manifest, not a claim that binary ZIP archives have been uploaded**.
