MF4TRKBento v1.6 STARTUP REPAIR EXP
=====================================

This is an experimental repair candidate based on v1.6 commit
ac34e38df3c42984daa01abb20b508ee5526e610.

Do not install before the startup-focused independent review is complete.
Do not test alongside another Ableton Live instance. The accepted rollback
is the unchanged MF4TRKBento v1.5 EXP at commit
0bc87548853af047ae6c70535494a2546a8befb1.

Install only after review approval:
1. Quit every Ableton Live process.
2. Back up the currently installed MF4TRKBento folder.
3. Replace only the MF4TRKBento remote-script package with this folder.
4. Leave MIDI Fighter Utility, MIDI routing, Native Mode, CC assignments,
   other banks and all other control surfaces unchanged.
5. Perform one safe Live 13 Beta launch and verify responsiveness before
   opening a Set or testing controls. Stop immediately if Live becomes
   unresponsive.

Rollback:
1. Quit every Ableton Live process.
2. Remove this candidate package.
3. Restore the saved v1.5 EXP package.
4. Start Live once and confirm the known-working v1.5 baseline.

This candidate does not claim a successful Ableton hardware startup.
