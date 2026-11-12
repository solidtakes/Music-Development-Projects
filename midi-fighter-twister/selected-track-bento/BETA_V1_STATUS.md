# MF Selected Track Bento — Beta v1

Status: hardware-tested baseline, not final release. Date: 2026-11-12.

Beta v1 is the existing v0.1.18 build, not a newly modified script.

Local release archive: `MF_Selected_Track_Bento_v0.1.18_Extended_ClipBox_Stop_Magenta_Test.zip`
SHA-256: `81c25a7a7131250a597afbf270911dd0fcb93a1bfe33b13d66f1694fe5522d44`

Confirmed in hardware: Session highlight clip box works; clicking a playing clip retriggers it; Device Controls colors work.

Open defects / planned Beta v1.1: FX Sends pink code 52 appears yellow in Expanded mode; replace track-stop gesture with same-column second-from-bottom hold + bottom press; simplify Master VU to bottom encoder only; Beat/Bar green playing, orange queued, red recording with 1/8-note flashing; conservatively optimize VU tick and LED refresh.

Expanded color note: The 2026 firmware provides an MF64/Expanded palette and separate RGB brightness/animation feedback. The exact dim color codes are not yet hardware-verified; do not assume classic color values match Expanded mode.

**Source/archive upload pending:** this status document does not contain or replace the local ZIP or Python source. Do not treat this commit as a complete source release. No merge requested.
