/* ==========================================================================
   Analytical Verification Suite — 3-2-1 Datum Reference Frame Lab (ISO 5459)
   Run: node tests/verify.mjs
   ========================================================================== */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ISO5459 = require(path.resolve(__dirname, '..', 'datum-math.js'));

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`  [PASS] ${name}`);
}

console.log('=== 1. ISO 5459 6-DOF Rigid-Body Constraint Algebra ===');

check('Unconstrained body: 0 locked, 6 free DOF', () => {
  const r = ISO5459.solveDOF({ hasA: false, hasB: false, hasC: false });
  assert.equal(r.lockedCount, 0);
  assert.equal(r.freeCount, 6);
});

check('Primary Plane A locks exactly 3 DOF (Tz, Rx, Ry)', () => {
  const r = ISO5459.solveDOF({ hasA: true, hasB: false, hasC: false });
  assert.equal(r.lockedCount, 3);
  assert.deepEqual(r.dof, { Tx: false, Ty: false, Tz: true, Rx: true, Ry: true, Rz: false });
});

check('Primary A + Secondary B locks 5 DOF (leaves only Tx free)', () => {
  const r = ISO5459.solveDOF({ hasA: true, hasB: true, hasC: false });
  assert.equal(r.lockedCount, 5);
  assert.equal(r.dof.Tx, false);
  assert.equal(r.dof.Ty, true);
  assert.equal(r.dof.Rz, true);
});

check('Full 3-2-1 |A|B|C| locks all 6 DOF', () => {
  const r = ISO5459.solveDOF({ hasA: true, hasB: true, hasC: true });
  assert.equal(r.lockedCount, 6);
  assert.equal(r.fullyConstrained, true);
});

check('Flange (Plane A + Bore B) locks 5 DOF, leaving Rz (clocking) free until C', () => {
  const r5 = ISO5459.solveDOF({ preset: 'flange', hasA: true, hasB: true, hasC: false });
  assert.equal(r5.lockedCount, 5);
  assert.equal(r5.dof.Rz, false);
  const r6 = ISO5459.solveDOF({ preset: 'flange', hasA: true, hasB: true, hasC: true });
  assert.equal(r6.lockedCount, 6);
});

console.log('\n=== 2. Exact SE(2) Precedence Solver (|A|B|C| vs. |A|C|B|) ===');

check('At zero squareness error (α = 0°), |A|B|C| and |A|C|B| yield identical results', () => {
  const sol = ISO5459.solvePrecedence({ skewDeg: 0, holeErrX: 0.03, holeErrY: 0.04, tolPosMm: 0.20 });
  assert.ok(Math.abs(sol.resABC.posDiaErr - 0.10) < 1e-6);
  assert.ok(Math.abs(sol.resACB.posDiaErr - 0.10) < 1e-6);
  assert.equal(sol.verdictFlips, false);
});

check('At α = 0.35°, |A|B|C| PASSES while |A|C|B| REJECTS on exact same physical part', () => {
  const sol = ISO5459.solvePrecedence({ skewDeg: 0.35, tedX: 95, tedY: 55, holeErrX: 0.03, holeErrY: 0.02, tolPosMm: 0.20 });
  assert.equal(sol.resABC.pass, true);
  assert.equal(sol.resACB.pass, false);
  assert.equal(sol.verdictFlips, true);
  // Check exact lever-arm rotation shift: ~95 * sin(0.35°) ≈ 0.580 mm => Øe ≈ 2 * 0.580 ≈ 1.16 mm
  assert.ok(sol.resACB.posDiaErr > 1.0 && sol.resACB.posDiaErr < 1.35, `Unexpected ACB Øe: ${sol.resACB.posDiaErr}`);
});

check('Negative squareness angle α = -0.35° shifts Tertiary C contact to upper corner p3', () => {
  const sol = ISO5459.solvePrecedence({ skewDeg: -0.35, tedX: 95, tedY: 55, tolPosMm: 0.20 });
  assert.ok(sol.resABC.origin.x < -0.45, `Expected negative origin.x from high-point contact, got ${sol.resABC.origin.x}`);
});

console.log('\n=== 3. Common Datum |A-B| vs. Single Short Datum |A| ===');

check('Single short bearing seat |A| amplifies tilt by L_overhang / L_A = 235 / 30 = 7.83×', () => {
  const sol = ISO5459.solveCommonDatum({ seatATiltUm: 12, seatBOffsetUm: 10, overhangOffsetUm: 12 });
  assert.ok(Math.abs(sol.amplificationFactor - (235 / 30)) < 1e-6);
  assert.ok(sol.singleA.overhangRunoutUm > 150, `Expected large single-A runout, got ${sol.singleA.overhangRunoutUm}`);
  assert.ok(sol.commonAB.overhangRunoutUm < 5, `Expected small common A-B runout, got ${sol.commonAB.overhangRunoutUm}`);
});

console.log('\n=== 4. ISO 5459 §7.2.2 Datum Letter & Frame Validator ===');

check('Accepts valid |A|B|C| and common datum |A-B|C|', () => {
  assert.equal(ISO5459.validateDatumFrame('A', 'B', 'C').valid, true);
  assert.equal(ISO5459.validateDatumFrame('A-B', 'C', '').valid, true);
});

check('Rejects all four forbidden letters I, O, Q, X per ISO 5459 §7.2.2', () => {
  ['I', 'O', 'Q', 'X'].forEach(ch => {
    const r = ISO5459.validateDatumFrame('A', ch, '');
    assert.equal(r.valid, false, `Should reject forbidden letter ${ch}`);
  });
});

check('Rejects duplicate datum letters (|A|B|A| and |A-A|)', () => {
  assert.equal(ISO5459.validateDatumFrame('A', 'B', 'A').valid, false);
  assert.equal(ISO5459.validateDatumFrame('A-A', '', '').valid, false);
});

check('Rejects empty Primary or empty Secondary before Tertiary', () => {
  assert.equal(ISO5459.validateDatumFrame('', 'B', 'C').valid, false);
  assert.equal(ISO5459.validateDatumFrame('A', '', 'C').valid, false);
});

check('Rejects completely empty datum frame', () => {
  assert.equal(ISO5459.validateDatumFrame('', '', '').valid, false);
});

console.log(`\nALL ${passed} ANALYTICAL CHECKS PASSED.`);
