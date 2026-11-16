AOPX S3 live probe, BUILD 2 (read-only)  -  Issue #40, solidtakes/Music-Development-Projects
==========================================================================================

What it is
  A throwaway Live 13 Beta extension that opens AOPX test pages in Live's modal dialog and prints
  what each dialog returns. Build 2 is the consolidated follow-up to the first host run:
    - every probe dialog shows ONLY the button its case asks for (no mis-clicks possible);
    - every result records which button was pressed and whether the injected state arrived intact;
    - the SDK environment (tempDirectory, storageDirectory) is read again when you run the command;
    - G2-gui-stock-apply: you press APPLY in the real AOPX editor; the probe checks the result
      with the product parser and ONLY LOGS IT. Nothing is applied, the clip and Set are unchanged;
    - T1: one small HTML file in your Windows temp folder, opened as file://, deleted afterwards;
    - a short summary table is printed before the JSON block.

  It is READ-ONLY. It never edits, renames, renders or imports anything. Right-clicking a clip is
  only the trigger. Use a NEW, disposable Live Set anyway.

  It uses only the SDK calls from the owner-verified examples/modal-dialog: initialize,
  commands.registerCommand, ui.registerContextMenuAction, ui.showModalDialog. Nothing here has been
  tested inside Live yet: your run is the test.

Install and run (Windows, PowerShell)
  1. Stop the build-1 probe if it is still running (Ctrl+C in its PowerShell window).
  2. Delete the old folder  ...\examples\aopx-s3-probe  and extract this ZIP to the same place:
        F:\Downloads\extensions-sdk-1.0.0-beta.1\extensions-sdk-1.0.0-beta.1\examples\aopx-s3-probe
     (next to examples\modal-dialog; the SDK .tgz files are two folders up, as in the examples).
  3. Open Live 13 Beta with a new, disposable Set containing any one clip.
  4. In PowerShell:
        cd F:\Downloads\extensions-sdk-1.0.0-beta.1\extensions-sdk-1.0.0-beta.1\examples\aopx-s3-probe
        powershell -ExecutionPolicy Bypass -File .\run.ps1
     (If Live is elsewhere: add  -LivePath "C:\...\Ableton Live 13 Beta.exe")
  5. Wait for "Connected to Live". In Live, right-click the clip and choose
        AOPX S3 probe build 2: core (read-only)          (9 to 12 dialogs)
  6. In EACH probe dialog, do what the orange line at the top says. Most have exactly one button.
     X1: close with the window X.  X2: click inside, press Esc once (if it stays open, close with X).
     For the AOPX editor dialogs the instruction is printed in PowerShell:
        G2-gui-stock-cancel: press CANCEL.   G2-gui-stock-apply: press APPLY TO CLIP.
        G1-gui-file (only if the SDK temp folder works): press CANCEL.
  7. When PowerShell prints AOPX_S3_RESULTS_END, copy from the "Context description at activation"
     line through AOPX_S3_RESULTS_END and paste it into Issue #40. Add: Windows display scale (%),
     and anything the dialogs showed that the log cannot (blank pages, errors, title bar text,
     whether Esc closed X2).
  8. Ctrl+C in PowerShell stops the extension. Delete the folder afterwards if you like.

Notes
  - A1, A2 and G1 run only if the SDK's environment.tempDirectory is a string when the command runs;
    otherwise they are SKIPPED and the "Context description" lines show exactly what the SDK exposes.
  - Paths in the log have the Windows user name replaced by <user>.
  - Every generated HTML file is created with a new unique name (never overwriting) and deleted
    right after its dialog closes.
  - "AOPX S3 probe build 2: full matrix" (23 dialogs) is optional.
  - SHA256SUMS.txt lists the checksum of every file in this folder.
