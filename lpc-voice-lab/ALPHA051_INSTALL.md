# LPC VOCODER Alpha 0.5.1 installation and rollback

The editor is branded **LPC VOCODER**. Hosts still list the plugin as **LPC Voice Lab**. The Alpha 0.4, 0.5 and 0.5.1 bundles share the same identifiers. Use only one copy of each plugin format in the folders your host scans.

Alpha 0.5.1b adds **Air Band**. Choose 10, 20 or 40 kHz and drag the dB display to boost the wet path. Double-click the gain to return to 0.0 dB. Older sessions and factory presets start with Air off. The 20 and 40 kHz settings use distinct broad curves even at 44.1 and 48 kHz.

Air adds up to 12 dB of high-frequency boost before the output trim. Watch the output meter and lower OUTPUT as needed to leave headroom.

## Install for owner testing

1. Download your platform’s GitHub Actions artifact. Extract the outer archive, then verify the inner versioned ZIP against `SHA256SUMS.txt`.
   - Windows PowerShell uses `Get-ChildItem -Filter *.zip | Get-FileHash -Algorithm SHA256`.
   - macOS uses `shasum -a 256 -c SHA256SUMS.txt` from the extracted artifact directory.
2. Save a copy of the host project under a new name. Quit the host. Copy your current plugin bundles and saved `.lpcpreset` files to a backup location outside all plugin scan folders.
3. Move the existing bundle of the format you are testing out of the scan location. Extract the new ZIP and copy the complete bundle to the matching location.
   - Windows x64 VST3 goes in `C:\Program Files\Common Files\VST3\`.
   - Apple Silicon VST3 goes in `~/Library/Audio/Plug-Ins/VST3/` or `/Library/Audio/Plug-Ins/VST3/`.
   - Apple Silicon AU goes in `~/Library/Audio/Plug-Ins/Components/` or `/Library/Audio/Plug-Ins/Components/`.
   - The macOS bundles are ad-hoc signed and are for owner testing. They have no notarization.
4. Reopen the host and rescan plugins. Open the test project copy. Check the engine selector, all faders and toggles, legacy preset recall, save/open, and host automation.

## Roll back

Quit the host, move the candidate bundle out of the scan folder, and restore the backed-up bundle at its previous path. Rescan and reopen the original project. Keep the original project for rollback because Alpha 0.4 has no NuVo mode.
