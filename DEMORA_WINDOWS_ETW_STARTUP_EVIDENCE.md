# DEMORA 96 kHz Windows ETW startup evidence

Input `DEMORA-96k_000001.etl`, 71,696,384 bytes. The decoder verifies the SHA-256 before reading events. The raw ETL stays outside Git.

The same UCX device object links configuration and interface controls to two streaming pipes. Configuration 1 completed at +19.083073 s. After initial alternate 0 selections, interface 2 alternate 1 completed at +27.564629 s, then interface 1 alternate 1 at +27.565245 s. The three URB statuses were zero. The first isochronous dispatch followed at +27.565254 s. Independent confirmation of VID/PID and mapping pipe labels to endpoint addresses remains pending. The control extract covers UCX 23 v0 and 24 v1 with this URB layout. Other request formats are outside this extract. Both pipes remained active at trace end. The four-event dispatch/completion difference per pipe is a count difference. Individual isochronous request pairing and shutdown remain unverified.

## Reproduction

Save the Python block as `demora_extract.py`, install `dissect.etl==3.14`, and run `python demora_extract.py DEMORA-96k_000001.etl`. The offsets apply to the observed event layouts. The extract omits raw payloads and object addresses.

## Verified output

```text
SHA-256 8eabe40e3737bb0eae94bde9b435272d54f6a0209f342432892955b9b8b65a7e
UTC 2026-11-11T23:15:55.057289+00:00 to 2026-11-11T23:16:44.180151+00:00
Events lost 0; buffers lost 0
Streaming device group 1 (UCX object correlation)
pipe 1 event 30 count 21554 first +27.565254s last +49.119475s
pipe 1 event 31 count 21550 first +27.570446s last +49.119454s
pipe 2 event 30 count 21548 first +27.570471s last +49.119461s
pipe 2 event 31 count 21544 first +27.576456s last +49.119450s
control +19.044132s -> +19.044352s setup 80 06 00 01 00 00 40 00 URB status 0x00000000
control +19.054613s -> +19.054852s setup 80 06 00 01 00 00 12 00 URB status 0x00000000
control +19.058983s -> +19.059670s setup 80 06 00 02 00 00 ff 00 URB status 0x00000000
control +19.059679s -> +19.060448s setup 80 06 00 02 00 00 02 01 URB status 0x00000000
control +19.060473s -> +19.060722s setup 80 06 00 03 00 00 ff 00 URB status 0x00000000
control +19.060724s -> +19.061113s setup 80 06 02 03 09 04 ff 00 URB status 0x00000000
control +19.083050s -> +19.083073s setup 00 09 01 00 00 00 00 00 URB status 0x00000000
control +19.083126s -> +19.083126s setup 01 0b 00 00 02 00 00 00 URB status 0x00000000
control +19.083178s -> +19.083225s setup 01 0b 00 00 03 00 00 00 URB status 0x00000000
control +19.084498s -> +19.084545s setup 01 0b 00 00 03 00 00 00 URB status 0x00000000
control +19.084566s -> +19.084602s setup 01 0b 00 00 01 00 00 00 URB status 0x00000000
control +19.084623s -> +19.084643s setup 01 0b 00 00 02 00 00 00 URB status 0x00000000
control +19.179733s -> +19.179972s setup 80 06 00 03 00 00 ff 00 URB status 0x00000000
control +19.180018s -> +19.180348s setup 80 06 01 03 09 04 ff 00 URB status 0x00000000
control +19.180357s -> +19.180672s setup 80 06 00 03 00 00 ff 00 URB status 0x00000000
control +19.180681s -> +19.181040s setup 80 06 02 03 09 04 ff 00 URB status 0x00000000
control +19.181048s -> +19.181399s setup 80 06 01 03 09 04 ff 00 URB status 0x00000000
control +19.181498s -> +19.181774s setup 80 06 02 03 09 04 ff 00 URB status 0x00000000
control +19.183594s -> +19.183849s setup 80 06 00 03 00 00 ff 00 URB status 0x00000000
control +19.183905s -> +19.184174s setup 80 06 01 03 09 04 ff 00 URB status 0x00000000
control +19.184181s -> +19.184540s setup 80 06 00 03 00 00 ff 00 URB status 0x00000000
control +19.184544s -> +19.184899s setup 80 06 02 03 09 04 ff 00 URB status 0x00000000
control +19.184904s -> +19.185249s setup 80 06 01 03 09 04 ff 00 URB status 0x00000000
control +19.185280s -> +19.185648s setup 80 06 02 03 09 04 ff 00 URB status 0x00000000
control +27.564585s -> +27.564629s setup 01 0b 01 00 02 00 00 00 URB status 0x00000000
control +27.565191s -> +27.565245s setup 01 0b 01 00 01 00 00 00 URB status 0x00000000
```

## Decoder

```python
"""Run with Python 3 and dissect.etl==3.14 against the original ETL."""
import argparse
from collections import defaultdict
from hashlib import sha256
from pathlib import Path
from struct import unpack_from

from dissect.etl import ETL

EXPECTED_SHA256 = "8eabe40e3737bb0eae94bde9b435272d54f6a0209f342432892955b9b8b65a7e"
# dissect.etl 3.14 exposes manifest provider IDs in this byte order.
UCX = "2d59da36-3ae4-284e-af6f-4bc57c5a11e8"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("etl", type=Path)
    path = parser.parse_args().etl
    with path.open("rb") as stream:
        digest = sha256()
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
        if digest.hexdigest() != EXPECTED_SHA256:
            raise SystemExit("Unexpected ETL SHA-256")
        stream.seek(0)
        trace = ETL(stream)
        print(f"SHA-256 {digest.hexdigest()}")
        print(f"UTC {trace.start.isoformat()} to {trace.end.isoformat()}")
        header = trace.logfile_header.header
        print(f"Events lost {header.EventsLost}; buffers lost {header.BufferLost}")
        controls = defaultdict(list)
        iso = defaultdict(list)
        for record in trace:
            event = record.header
            descriptor = getattr(event, "descriptor", None)
            if descriptor is None or str(event.provider_id) != UCX:
                continue
            event_id = descriptor.id
            payload = event.payload
            if event_id not in (23, 24, 30, 31) or len(payload) < 78:
                continue
            device = bytes(payload[40:48])
            pipe = bytes(payload[48:56])
            request = bytes(payload[56:72])
            relative = (event.timestamp - trace.start).total_seconds()
            if event_id in (30, 31) and descriptor.version == 0:
                iso[device, pipe, event_id].append(relative)
            elif (event_id, descriptor.version) in ((23, 0), (24, 1)):
                # Embedded URB begins at byte 72 in these records.
                urb_len, function, status = unpack_from("<HHI", payload, 72)
                if function == 0x32 and urb_len == 136 and len(payload) >= 208:
                    setup = bytes(payload[200:208])
                    controls[device].append((relative, event_id, request, setup, status))

        devices = {device for device, _, _ in iso}
        for index, device in enumerate(sorted(devices), start=1):
            print(f"Streaming device group {index} (UCX object correlation)")
            pipes = sorted({pipe for dev, pipe, _ in iso if dev == device})
            for pipe_index, pipe in enumerate(pipes, start=1):
                for event_id in (30, 31):
                    times = iso[device, pipe, event_id]
                    if times:
                        print(f"pipe {pipe_index} event {event_id} count {len(times)} "
                              f"first +{min(times):.6f}s last +{max(times):.6f}s")
            active = {}
            for relative, event_id, request, setup, status in sorted(controls[device]):
                if event_id == 23:
                    active[request] = (relative, setup)
                else:
                    start = active.pop(request, None)
                    if start is not None:
                        submitted, setup = start
                        print(f"control +{submitted:.6f}s -> +{relative:.6f}s "
                              f"setup {setup.hex(' ')} URB status 0x{status:08x}")


if __name__ == "__main__":
    main()
```
