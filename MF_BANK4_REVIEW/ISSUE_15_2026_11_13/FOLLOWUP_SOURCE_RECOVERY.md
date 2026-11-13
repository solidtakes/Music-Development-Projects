# Bank 4 follow-up execution — source recovery blocked

Assignment executed in response to PR #17 comment 6867344684. PR #17 remains the draft review branch; no repair ZIP was built.

## Recovery evidence

Fresh clone: `/workspace/work/music`, review branch `codex/bank4-issue15-audit-20261113`, starting head `8a4b475ecec76eceb5052d1563f726906306e881`.
Inspected all fetched reachable objects: 29 remote refs (including origin/HEAD), 45 distinct candidate .py/.zip/.mfs/.log/archive blobs, six ZIP blobs including their member lists and Python contents. No selected_device, appointed_device or MFBank4Test token occurred in candidate Python or ZIP Python members. No complete selected-device implementation or diagnostics recovered. Full paths, blob IDs and independently calculated SHA-256 values are in FOLLOWUP_RECOVERY_INVENTORY.json. Counts are distinct objects, not unique filenames or accepted builds.

`/workspace/library-files`, `/workspace/shared` and `/workspace/scratch` contain no files. This cloud environment has no mounted owner Downloads, Ableton installation, local project backups or previous ChatGPT attachments. Those locations were not searched and are not claimed empty. Unreachable Git objects and inaccessible attachments remain outside this evidence.

## Exact missing inputs and likely owner recovery locations

| Missing input | Recovery location / minimum useful contents |
|---|---|
| **Complete Bank 4 Selected Device Controls source**; original archive/install name and version unknown | ZIP the actual installed Bank 4 Remote Script folder, including __init__.py, every .py/module and local dependency, README and existing parameter/gesture definitions. Search the Ableton User Library/Remote Scripts folder, older Live installation MIDI Remote Scripts folders, Downloads, project backups and the original device-control conversation downloads. A combined build is useful only if it actually contains Bank 4. |
| Diagnostic v0.4.1 and v0.4.2 packages; original exact archive names unknown | Original conversation downloads/Downloads/backups, or separately installed diagnostic folders (reported class MFBank4Test). A diagnostic alone cannot establish the complete controller's mappings. |
| Historical unedited Live traceback/Log.txt | macOS ~/Library/Preferences/Ableton/Live <version>/Log.txt; Windows %APPDATA%/Ableton/Live <version>/Preferences/Log.txt; backups if the original session log has rotated. Include surrounding initialization lines and script identity. |
| Actual configuration bytes: 2026 all rel cchold(1).mfs; installed firmware identity | Existing saved Utility export/Downloads/backups. Registry reports 2312 bytes and SHA-256 3ab457f9c427d8933340119cf4cd960f87d98b183f12af0cb406c7902a7694f4; bytes absent, hash not independently verified. Read existing firmware identity without changing settings. |
| Working Bento and accepted combined comparison source | Existing accepted source folders/ZIP backups. Bento_v0.1.32_REDOWNLOAD.zip has registry-reported SHA-256 a1d377fdacb40629bc8454ab48d4ebee984588f933568c02543900ed516ad4fd, not recomputed. Latest accepted combined name/hash remains unknown. Accepted sequencer SP1 is available in Git and need not be uploaded again. |

**Smallest upload to unblock source audit:** one ZIP of the complete original Bank 4 installed script/source folder, with its install name/version if known. Include local imported modules. Do not substitute only an LED diagnostic or .pyc files. Diagnostics/log/configuration and accepted comparison builds are additional evidence needed to complete the requested failure audit and safe release; their absence may leave specific conclusions blocked.

No SHA-256 can be computed for a missing file. No guessed original filenames, mappings, repair or hardware-success claim is supplied.

## Verification and research

Reran pinned firmware extraction checks: **7 protocol groups PASS** with address/undefined-behavior sanitizers. Reran reference Python: **4 groups PASS**. Accepted SP1 archive hash/CRC, exact RGB/ring frame and unchanged-frame suppression PASS. Existing SHA256SUMS: all ten entries OK. Tests open no MIDI ports.

Reviewed the pinned version/license/design comparisons in [COMPARABLE_IMPLEMENTATIONS.md](COMPARABLE_IMPLEMENTATIONS.md): CC0 Twister 16 Macros at 526e5b9 (Live 11/12 upstream claim), MIT ableton-js at 63bf873 (Live 11+), GPL-3.0 BeatStep at e394886 (Live 9–11), and GPL-3.0-or-later TwisterXT at bf4bacd (Bitwig, conceptual only). Appointed-device versus GUI-selected-device focus and exact listener ownership remain relevant review patterns. No implementation copied. These sources do not establish target Live 12.4.16/13 beta compatibility.

RGB zero restoring the configured inactive color and detent-sensitive ring zero are firmware-source findings, not confirmed Bank 4 failure causes. The reported log_message crash and selection/parameter/lifecycle behavior remain unassessed without original code and traceback. Bank 4 tests and Live/hardware tests **NOT RUN**.

No Banks 1–3, shared ownership/listeners/MIDI/routing, accepted source, firmware or Utility settings changed. No Native Mode activation, hardware MIDI, merge or installation. CROSS-BANK REVIEW REQUIRED before shared changes. Next action is source recovery, not a speculative hardware test.
