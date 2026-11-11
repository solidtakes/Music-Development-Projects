# MF Device 4 — module specification

Status: planned; source extraction and hardware testing pending.

Four logical device parameter controls; canonical single-column layout, rotatable to a row at placement time. Derive from the verified eight-control device implementation, not a rewrite.

Standard navigation push controls: logical 1 Device On/Off, 2 Next parameter bank, 3 Previous device, 4 Next device. Controls 2–4 blue at rest and momentary yellow while held; logical 1 yellow ON / blue OFF. Actual parameter mapping and button/rotary coexistence must be validated during implementation.

Orientation and physical CC/encoder mapping are host-owned. Do not modify MF Sel Track v1.6 baseline.
