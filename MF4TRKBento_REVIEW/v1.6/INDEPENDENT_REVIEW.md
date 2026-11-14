# MF4TRKBento v1.6 EXP independent review

A separate reviewer inspected the source at SHA-256
8c3a5b71880e7390cdafdeb58111b5530b6f01e20b96f98cb871d658e29ab965.
No blocking source issues were found.

The independent checks passed 2,256 normal-mode row, column, module and
event-order cases. The reviewer verified eight changed-only zero writes
across duplicate Pan and Sends rows, inert unavailable controls, Send B
removal and restoration, exact BA 09 30 RGB output, and Master Pan bypass
and reset. The main suite also covers three-button ownership and alternate
fourth-slot restrictions.

The reviewer decoded the exact 222.mfs and compared it with vendor
firmware and the published 2026 guide. The configured Extended palette
maps 96 to orange and 48 to violet. Inactive RGB is configured black.
The MIDI output port was enumerated without sending physical test data.
The review verifies source behavior and profile evidence. Live 13 Beta
and physical display/trace remain pending.
