# MF Sel Track v1.6 — module extraction plan

Status: design/reference documentation only. No extracted module code is claimed here.

## Verified milestone reference
MF Sel Track v1.6 is the user-designated hardware-tested baseline. Preserve it unchanged while developing subsequent versions. Confirmed: Purple FX sends, Red record arm, E3 VU/Beat toggle, device bank controls in the current version. The proposed E1–E4 device-navigation reorder and yellow-on-press feedback remain untested and belong to a later build.

## Modules
- **MF Mixer Column (4 controls)**: derive from the working Column 1 behavior in MF Sel Track v1.6. Preserve all existing actions and LED feedback; inspect source before finalizing detailed mappings.
- **MF VU / Beat Column (4 controls)**: derive from working Column 3 (E3, E7, E11, E15). VU default; first control's push toggles Beat Counter. Include colored VU and white stepped MIDI velocity rings. Preserve beat animation and switching behavior. Future state-color revisions must be separately tested.
- **MF Device 8 (8 controls)**: derive from working E1–E8 device section, logically organized as two columns. Navigation standard proposed: control 1 device On/Off; control 2 parameter bank; control 3 previous device; control 4 next device. Blue rest / Yellow pressed for navigation, pending hardware test.
- **MF Device 4 (4 controls)**: one-column device controls, same logical navigation convention as MF Device 8, pending extraction and hardware test.
- **MF Device Slots (4 controls)**: toggles device-chain slots 1–4 On/Off, Yellow On / Blue Off / dark empty; proposed, not yet implemented.

## Placement and engineering rules
Module code uses logical controls; host assigns physical encoder positions and orientation (row or column). No duplicated source modules just for orientation. Isolate LED ownership, polling, listener lifecycle, and navigation feedback. Extract from verified source; preserve milestone rollback; separately validate each module on hardware before marking implemented.
