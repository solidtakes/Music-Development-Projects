# NCC-1337 LCARS Direct OSC — working studio baseline

**Working combination:** v0.8 Windows TotalMix Direct OSC backend + v1.0.1 LCARS/Android touch companion.

## Confirmed on the user's studio

- Home Assistant LCARS displays the ten hardware input sends and live Global OSC feedback.
- DX100 and Mic Chain, plus additional selected inputs, have been controlled successfully.
- MAIN / MON 2 move together with the user's intentional TotalMix link configuration; PHONES is independent.
- Windows LCARS direct vertical faders and Samsung Android companion were exercised by the owner; Android was reported working, with tolerable minor step/lag sensation.
- Prior live DX100 readback was MATCHED; RX-triggered fader TX loop count was zero. These are **observations**, not universal guarantees.
- Android pairing 403 addressed by the v1.0.1 `SameSite=Lax` QR-pairing fix; the owner subsequently confirmed working Android control.

## Architecture and startup

- `START_LCARS_OSC.bat`: TotalMix OSC Controller 2 incoming UDP 7002 / outgoing UDP 9002; Windows HTTP API **127.0.0.1:8772**. This is v0.8 unchanged. Only one receiver should own UDP 9002.
- `ncc1337-direct-osc-addon.js`: Home Assistant frontend script installed at `/config/www/lcars/`; resource `/local/lcars/ncc1337-direct-osc-addon.js?v=1.0`. Works in the Windows PC browser where localhost refers to the OSC host.
- `START_ANDROID_TOUCH.bat`: separate Windows private-LAN HTTP gateway for the Android mixer, TCP 8773, with fresh QR/cookie pairing. The QR is generated at runtime as `OPEN_ANDROID_PAIRING.html` and must **never be committed**.
- `android_proxy.py` serves `android_mixer.html` on the trusted home network, forwarding paired commands to localhost:8772. It does not make the localhost OSC API reachable directly from LAN.
- On Android, use the QR-paired separate LCARS touchscreen page. The existing Home Assistant iframe/card is **not** a mobile proxy and cannot reach the PC's 127.0.0.1.

## Safety and maintenance

- No credentials or runtime-generated QR/pairing cookies belong in source control. Use PRIVATE network firewall profile only; do not port-forward TCP 8773.
- Touch sends are globally rate-limited to at most one outgoing fader request per 120 ms, with latest-position coalescing. An initial tap alone does not send; dragging does.
- Fresh feedback is required; stale feedback stops commands. Stereo partners are governed by TotalMix's native link configuration rather than writing an unverified partner index.
- MAIN/Speaker A's separate planned **−14 dB master ceiling is not enforced** by these files; do not assume it is. This project writes *input sends*, not the main output master.
- Back up the running working directories and exported HA JS/resource config before experimentation.

## Offline regression tests

Run from the folder containing these files:

```sh
python -B -m unittest -q test_bridge_v08 test_android_proxy
node --check ncc1337-direct-osc-addon.js
node test_multitouch.js
```

The release packaging was checked with **14 backend tests, 4 proxy tests and the multi-touch JS test**, all passing. These do not replace on-hardware verification.

## Next optional checks

1. Android: two-finger independent moves; final levels match TotalMix readback after fingers lift.
2. Briefly move a stereo input and verify TotalMix linked L/R behavior by eye.
3. Reconnect after switching Wi-Fi or restarting Android companion: newly generated QR must re-pair.
4. Confirm stale/offline feedback halts changes rather than leaving a moving control active.
5. Leave fine-tuning of quantization and dispatch rate for a separate branch; do not increase bandwidth on the proven build.
