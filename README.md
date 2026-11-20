# 3-2-1 Datum Reference Frame Lab · DIN EN ISO 5459

[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-d94426?style=for-the-badge&logo=github)](https://xallace.github.io/iso5459-datum-lab/)
[![License: MIT](https://img.shields.io/badge/License-MIT-047857?style=for-the-badge)](LICENSE)
[![Standards Verified](https://img.shields.io/badge/ISO_5459-14_Analytical_Checks-181715?style=for-the-badge)](#verification)

Interactive standalone **1967 Book-Plate** inspection lab for **DIN EN ISO 5459** Datum Reference Frames, demonstrating 6-DOF rigid-body locking (`3-2-1`), why `|A|B|C|` and `|A|C|B|` produce different CMM inspection verdicts on the exact same physical part, common datums `|A-B|`, cast datum targets (`A1`, `A2`, `A3`), and ISO 5459 §7.2.2 frame validation.

## Four Interactive Modules

1. **3-2-1 DOF Lock (3D Fixture):** Orbitable 3D workpiece on a granite inspection plate. Toggle Primary `A` (`Tz, Rx, Ry`), Secondary `B` (`Ty, Rz`), and Tertiary `C` (`Tx`) — or switch to a **Flange (`Plane A + Bore B + Clocking C`)** — and animate the remaining unlocked degrees of freedom live.
2. **Precedence Paradox (`|A|B|C|` vs. `|A|C|B|`):** Exact SE(2) rigid-body alignment solver showing how a tiny `0.35°` squareness error on Face `C` pivots the entire CMM grid and flips a precision bore from **PASS** to **REJECT** when Secondary and Tertiary datums are swapped.
3. **Common Datum `|A-B|` & Datum Targets:** Compares short-seat Single Datum `|A|` (amplified runout over a shaft overhang) against Common Datum `|A-B|`, plus rough-cast rocking vs. repeatable 3-point Datum Targets (`A1`, `A2`, `A3`).
4. **ISO 5459 Rules & Frame Guard:** Live datum-frame validator flagging forbidden letters (`I`, `O`, `Q`, `X` per ISO 5459 §7.2.2), duplicates, and precedence gaps alongside practical datum selection guidelines.

## Running Standalone
Open [`index.html`](index.html) directly in any modern browser (`file://` or HTTP) — zero build steps and zero external runtime dependencies.

## Verification
```bash
node tests/verify.mjs
```

## License
Licensed under the **MIT License** ([LICENSE](LICENSE)).
