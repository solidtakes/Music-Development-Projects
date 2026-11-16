# MF4TRKBento Beta 3.5 EXP — Linked Sends and repeatable button modules

Owner's Beta 3.4 hardware feedback: independent rotary-row selection works well. This is its **three-part follow-up** in a separate branch and draft PR; Beta 3.4 source & ZIP are untouched.

## Three features
1. **Sends becomes one linked rotary module**. Default row 1/2 still gives Send A/B, but all active Sends rows are indexed top-to-bottom regardless of gaps. When another row becomes Sends, the next destination is picked automatically. If top Send row becomes Device Control, the remaining top Sends row reindexes to A.
2. **Independent Sends banking**: hold the second push and turn the third rotary on the first active Sends row (four detents per page). Each page moves a whole Send-row set, wrapping over available Sends, up to 16 destinations (A through P). Device banking remains four banks independent from Send banking. Gesture consumes push/rotary actions and uses a status message for pages.
3. **Push rows are repeatable**: remove uniqueness restriction on Arm/Solo/Mute so all four rows can be Clip Launch, all Mute/Solo/Arm, or any mixture. Original button module selector and four-row independence preserved.

## Preservation
Beta 3.4 default and custom rotary selector, RGB color preview, Volume audio white VU, no-audio MIDI white ring gate, returns/track switching, four-bank Device row parameter stride and API safety. MIDI channels CC0–15, rotary ch12 and push ch11; no Native Mode/other bank changes. Stable rollback Beta 3.3 SHA256 `7af1cb6d99f884b0ddc607745bed15ad28396f17293cd06efabac60f41cf06c7`. Beta 3.4 installable ZIP SHA256 `39e929ed27ed0e4531221bbd004272415b4f315a3ed14f0babf7ce496be88946`.

## Automated verification and limitations
GitHub Actions syntax compilation, Python mocks regression tests (linked Sends A/B/C, gaps, 16 Sends, 1–4 rows, no controller action leakage during banking, independent Device/Sends paging, repeated button modules) and deterministic 3-file installable ZIP. Hardware verification in Ableton required; mock success is not an independent code review. No auto merge or stable promotion.
