AOPX S3 live probe (read-only)  -  Issue #40, solidtakes/Music-Development-Projects
=====================================================================================

What it is
  A throwaway Live 13 Beta extension that opens AOPX test pages in Live's modal dialog and prints
  what each dialog returns. It answers spike S3: which way of delivering the AOPX GUI works
  (the stock data: URL form, base64 data URL, temp file), whether injected state arrives intact,
  what Cancel / Esc / X return, and the real dialog size and DPI.

  It is READ-ONLY. It never edits, renames, renders or imports anything. Right-clicking a clip is
  only the trigger. Use a NEW, disposable Live Set anyway.

  It uses only the SDK calls from the owner-verified examples/modal-dialog: initialize,
  commands.registerCommand, ui.registerContextMenuAction, ui.showModalDialog.
  Nothing here has been tested inside Live yet: your run is the test.

Install and run (Windows, PowerShell)
  1. Extract this ZIP so the folder becomes
        F:\Downloads\extensions-sdk-1.0.0-beta.1\extensions-sdk-1.0.0-beta.1\examples\aopx-s3-probe
     (next to examples\modal-dialog; the SDK .tgz files are two folders up, as in the examples).
  2. Stop any other running SDK extension (close their PowerShell windows or press Ctrl+C).
  3. Open Live 13 Beta with a new, disposable Set containing any one clip.
  4. In PowerShell:
        cd F:\Downloads\extensions-sdk-1.0.0-beta.1\extensions-sdk-1.0.0-beta.1\examples\aopx-s3-probe
        powershell -ExecutionPolicy Bypass -File .\run.ps1
     (If Live is elsewhere: add  -LivePath "C:\...\Ableton Live 13 Beta.exe")
     It runs npm install, npm run build, then npm start -- --live "<Live exe>".
  5. Wait for "Connected to Live". In Live, right-click the clip and choose
        AOPX S3 probe: core cases (read-only)        (7 dialogs)
     or AOPX S3 probe: full matrix (read-only)       (21 dialogs)
  6. In EACH dialog, do exactly what the orange line at the top says (for the two AOPX editor
     dialogs, the instruction is printed in PowerShell: press CANCEL).
  7. When PowerShell prints AOPX_S3_RESULTS_END, copy from the "Context description" line through
     AOPX_S3_RESULTS_END and paste it into Issue #40. Add: Windows display scale (%), and anything
     the dialogs showed that the log cannot (blank pages, errors, title bar text).
  8. Ctrl+C in PowerShell stops the extension. Delete the folder afterwards if you like.

Notes
  - Cases that need a temp directory (A1, A2, G1, D1, D2) run only if this SDK build exposes one
    (context.environment.tempDirectory). That API is not verified yet; if it is missing they are
    reported as SKIPPED, and the "Context description" line shows what the SDK does expose.
  - Blank dialogs for case B3 are expected (data URLs over ~2 MB are refused by Chromium).
  - SHA256SUMS.txt lists the checksum of every file in this folder.
