# MF Build 3 — Four-Encoder Module Catalog

Status: design specification; not implemented or hardware tested.

Modules: Selected Track Mixer, FX Sends, Device Controls, Clip Launcher, Beat Counter, Transport, VU Meter, Device Slots.

Newly requested:
- **Transport:** Play, Stop, Record, and fourth action to be defined.
- **VU Meter:** Four-control meter display; exact meter sources, LED scales and control gestures to be defined.
- **Device Slots:** Four device-chain slots with on/off feedback; selection and empty-slot behavior to be defined.

Orientation: modules should be reusable as four-encoder vertical columns or horizontal rows; Bank 1 currently has four-column layout, and whether horizontal row placement is now enabled requires clarification. E1–E4 hold+twist currently controls corresponding columns. Do not silently assign the same physical encoder to two active modules.

Lifecycle: on module deactivation unsubscribe listeners, stop animations/polling, invalidate pending callbacks and clear owned LEDs; activate only currently assigned modules. Share central event subscriptions where possible. See BANK_1_MODULE_LIFECYCLE.md.
