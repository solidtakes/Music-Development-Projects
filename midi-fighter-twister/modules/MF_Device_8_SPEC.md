# MF Device 8 — module specification

Status: design approved; extraction and hardware validation pending.

Eight logical device parameter controls, orientation-independent, represented canonically as two columns. Original reference is the working MF Sel Track E1–E8 two-row device section. Physical placement is assigned by host.

## Proposed standardized push controls
1. Device On/Off (yellow ON / blue OFF).
2. Next parameter bank (1–8, 9–16, etc.).
3. Previous device.
4. Next device.

Logical controls 2–4: blue at rest; momentary yellow while pressed, returning to blue on release. Preserve parameter behavior, bank LED ownership, and selected device feedback. Show a concise bank range and starting device/parameter information in Ableton's status bar without overwriting it immediately.

The standardized E1–E4 navigation order and momentary LED feedback are approved **for the next build**, not yet validated in v1.6. Do not describe as implemented.
