# Proposed v0.5.1 parameter assignments

NEW prototype assignments, not recovered or previously accepted mappings. Declared before implementation; all require owner hardware/behavior approval. Resolve the exact listed original_name (or name if no original_name) against the runtime parameter list. Record discovered index, name, bounds, quantization and binding status on the controller. No numeric-index fallback, positional guessing, substring matching or silent assignment of another control. If no unique match exists across a slot's aliases, that encoder is unbound and its white ring is zero. Device-status RGB remains the requested full palette even where a control is unavailable.

| Encoder | EQ Eight (`Eq8`) | Auto Filter (`AutoFilter`) | Compressor (`Compressor2` / `Compressor`) |
|---|---|---|---|
| E1 | 1 Frequency A | Frequency | Threshold |
| E2 | 1 Gain A | Resonance | Ratio |
| E3 | 2 Frequency A | Filter Type | Attack |
| E4 | 2 Gain A | Filter Circuit - LP/HP / Filter Circuit | Release |
| E5 | 3 Frequency A | Drive | Knee |
| E6 | 3 Gain A | LFO Amount | Makeup |
| E7 | 4 Frequency A | LFO Frequency / LFO Freq / LFO Rate | Dry/Wet |
| E8 | 4 Gain A | Env. Modulation / Env Modulation / Env Amount | Output Gain / Output |
| E9 | 5 Frequency A | Unbound | Auto Release |
| E10 | 5 Gain A | Unbound | LookAhead / Lookahead |
| E11 | 6 Frequency A | Unbound | Model |
| E12 | 6 Gain A | Unbound | Envelope |
| E13 | 7 Frequency A | Unbound | S/C EQ On |
| E14 | 7 Gain A | Unbound | S/C EQ Freq |
| E15 | 8 Frequency A | Unbound | S/C EQ Gain |
| E16 | 8 Gain A | Unbound | S/C Listen |

Aliases above are explicit candidate host names, not a claim that every Live version exposes them. Missing names degrade to an unbound slot, not an initialization failure. Runtime inventories can be inspected through `surface._bank4.parameter_inventory` and `.binding_report` during development; no private user files are written. New/renamed parameter collections trigger re-resolution; changing devices rebinds the fixed table. There are no parameter pages in this minimum slice.

EQ Eight: RGB 68 on sixteen. Auto Filter: RGB 108 E1–E8, zero E9–E16. Compressor: RGB 72 on sixteen. Other/no device: RGB/rings zero. EQ A-channel frequency/gain pairs are deliberately a small subset; no B-channel, Q or band-enable gesture is inferred. Compressor 1, Glue Compressor and other classes are not implicitly supported.

Rotary: human ch12, CC48–63, **63 decreases / 65 increases**, one discrete tick. Continuous parameters move by raw `(max-min)/128`, clamped; quantized parameters move one integer step, clamped. This raw-range sensitivity is proposed, not perceptually/logarithmically calibrated. Only these two relative byte values are accepted. White ring = nearest integer `127*(value-min)/(max-min)`, clamped. Disabled, unavailable, nonfinite or zero-width parameters show zero and cannot be written. All push events are inert; power, reset, page, hold and device-navigation gestures are not implemented or approved.
