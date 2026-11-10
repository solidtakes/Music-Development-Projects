# Documentation index (2026-11-09)

## Radikal-specific
- Original SAC-2K manual (36 pages): https://www.manualslib.com/manual/3077021/Radikal-Technologies-Sac-2k.html
- SAC-2K Logic Audio Platinum supplementary manual: https://www.manualslib.com/manual/831464/Radikal-Technologies-Sac-2k.html
- Apple Logic 7 Dedicated Control Surface Support, SAC-2K section: https://htlab.net/computer/protocol/mackie-control/Logic7_DedicatedCntrlSurfaceInfo.pdf
- Apple Logic Pro 9 Control Surfaces Support, SAC-2K section: https://help.apple.com/logicpro/mac/9.1.6/en/logicpro/controlsurfacessupport/Logic%20Pro%209%20Control%20Surfaces%20Support%20%28en%29.pdf
- Third-party SAC-2K/Mackie controller button comparison: https://www.merging.com/uploads/assets/Merging_pdfs/Common/Controllers/ThirdParties/User%20Guide%20EMC%20Controllers.pdf

## MCU protocol / Ableton implementation
- MCU MIDI map PDF: https://htlab.net/computer/protocol/mackie-control/Mackie_Control_MIDI_Map.pdf
- TouchMCU reverse-engineered protocol notes: https://github.com/NicoG60/TouchMCU/blob/main/doc/mackie_control_protocol.md
- Historical Ableton MackieControl Classic source (Live 9 era, **not** proof of modern Live behavior): https://github.com/phs/ableton-live9-remote-scripts/blob/master/MackieControl_Classic/MackieControl.py
- Additional MCU note summary: https://gist.github.com/fellipec/f4ecc45598134f9952f01f8eef588f68

## SAC-2K physical controls reported in third-party mapping
Pan = Pan; Inserts/Sends = Send; EQs = EQ; Dynamics = Instrument; Snd/Ins 1–4 = F1–F4; Low/LowMid/HiMid/High = F5–F8; 1–8 / 9–16 = channel navigation; 17–24 / 25–32 = bank navigation. **These are application-specific mappings, not verified MIDI note transmissions in Mackie emulation.**

## Caution
The SAC-2K can use native integration, Logic Control emulation, and other modes. A manual's DAW-specific control assignment must not be mistaken for a universal hardware MIDI code. Confirm firmware and capture real MIDI before modifying Ableton's mapping.
