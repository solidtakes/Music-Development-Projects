# Windows ETW preflight result

The uploaded evidence ZIP passed archive integrity checks. It contains a synthetic preflight ETL, the live observer logs, and compiled output. The raw archive, ETL, logs, and binaries remain outside Git.

- ETL: `preflight_000001.etl`, 851,968 bytes, SHA-256 `d1f857de35cdcdb28aa60f07e43e8f9cd5a44a867038801e782c761d21e5207a`.
- Live log independently inspected: READY, markers 1–12 exactly once and in order, reported age 1,999–2,001 ms. Live stderr is empty.
- Windows console evidence: .NET 8.0.428 built the observer with zero warnings and errors. The initial query reported mode `0x800100` and zero loss counters. The wrapper aborted at the heartbeat emitter exit check and successfully stopped and deleted the collector. A subsequent standalone file decode printed markers 1–12 in order. The final live loss query was not reached.
- Result: generic simultaneous live and file delivery demonstrated. The wrapper did not produce an end-to-end PASS. This run did not exercise the DEMORA or Ableton.

## Follow-up

From driver checkpoint `b00aa28`, make the wrapper compatible with Windows PowerShell 5.1 encoding and incorporate the locally tested mode check for implicit sequential logging with a configured log filename. Diagnose emitter exit handling by recording timeout and actual exit code separately and preserving emitter stderr. Keep the existing marker and loss checks. Report the fix and test results before repeating the generic preflight. The DEMORA shutdown capture remains pending.
