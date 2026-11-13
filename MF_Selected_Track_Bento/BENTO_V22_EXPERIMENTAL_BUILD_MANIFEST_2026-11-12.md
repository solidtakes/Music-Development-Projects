# Bento v2.2 experimental build manifest — 2026-11-12

**Local test ZIP:** Bento_v2.2_EXP_VU_Master_Clip_Stop_TEST.zip
**SHA-256:** 59fc6d6f732a8e4f7ee969caa1224bbf10bf03b9a3acb79c85ec07655be07a4b
**Source:** Bento_v2.1.1_EXP_Transport_VU_LED_Test.zip (SHA-256 ba5988018885c161a03b46a2b800e72bae3f0e927d9c8367811dc2e0ccd5cea5).
**GitHub status:** Manifest only; ZIP bytes are NOT uploaded. Preserve original and new ZIP externally until binary Git upload is completed.

## Implemented in experimental ZIP
- VU RGB stages: all green before top-three yellow, top-two orange, top-one red. Master VU white ladder binary 0/127 driven by master audio.
- Selected Track VU white ladder is **still audio proxy**, not true MIDI note activity; this is an explicit known gap, not user-approved implementation.
- Clip Launcher hold E3 + tap E4 to stop assigned clip track, consume both releases; old E1/E4 combo retained for compatibility.
- No intentional changes to Track Mixer v1, Device v1 or FX v1.
- Python syntax compile passed; hardware and Live API regression tests are pending.

## Required test
1. Backup currently installed stable script; install experimental as a separate test.
2. Verify Track Mixer E3 mute, E4 arm, hold E4+tap E3 pan reset, hold E3+tap E4 solo.
3. Verify Device E2 next bank, E3 previous device, E4 next device, power yellow; FX startup light purple, banking and track switches.
4. Master VU: all four green before yellow, then top three yellow, top two orange, top one red; white 0/127 bottom-to-top as master audio rises, clear at silence.
5. Clip Launcher: hold E3 then tap E4 stops assigned clip track, neither release launches; reverse order does not invoke new stop; singles still launch; repeat after switching track/module while held.
6. Selected Track VU: RGB staging test only. Do not sign off MIDI white ladder until genuine MIDI activity source is implemented and verified.
7. Check stale LEDs after mode changes and listen for audio/MIDI latency.

## Pending
- Real selected-track MIDI activity source and correct 0-4 ladder mapping.
- Measured LED traffic optimization and complete regression suite.
- GitHub binary ZIP upload, if authenticated upload mechanism becomes available.
