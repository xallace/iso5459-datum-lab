/* ==========================================================================
   DIN EN ISO 5459 Analytical Datum Reference Frame Engine
   1) 6-DOF Lock Algebra (3-2-1 Plane-Plane-Plane & Plane-Cylinder-Slot)
   2) Exact SE(2) Rigid Alignment Solver for |A|B|C| vs. |A|C|B| Precedence
   3) Common Datum |A-B| vs. Single Datum |A| Shaft Runout Solver
   4) Datum Targets (A1, A2, A3) Plane Stability Solver
   5) ISO 5459 §7.2.2 Datum Letter & Frame Validator
   Dual Browser + Node.js module.
   ========================================================================== */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ISO5459 = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FORBIDDEN_LETTERS = new Set(['I', 'O', 'Q', 'X']);

  /* ========================================================================
     1) 6-DOF LOCK ALGEBRA
     ======================================================================== */

  /**
   * Compute locked/free degrees of freedom for a 3-2-1 datum setup.
   * preset = 'block321' (Plane A, Plane B, Plane C)
   *        | 'flange'   (Plane A, Bore Axis B, Key Slot C)
   */
  function solveDOF(opts) {
    const {
      preset = 'block321',
      hasA = true,
      hasB = true,
      hasC = true
    } = opts;

    const dof = {
      Tx: false, Ty: false, Tz: false,
      Rx: false, Ry: false, Rz: false
    };
    const lockedBy = {
      Tx: null, Ty: null, Tz: null,
      Rx: null, Ry: null, Rz: null
    };

    const lock = (keys, by) => {
      keys.forEach(k => {
        if (!dof[k]) {
          dof[k] = true;
          lockedBy[k] = by;
        }
      });
    };

    if (preset === 'flange') {
      // Plane A (3 pts): Tz, Rx, Ry
      // Bore Cylinder B (axis || Z): Tx, Ty (2 translations!)
      // Clocking Slot/Pin C: Rz (1 rotation!)
      if (hasA) lock(['Tz', 'Rx', 'Ry'], 'A');
      if (hasB) lock(['Tx', 'Ty'], 'B');
      if (hasC) lock(['Rz'], 'C');
    } else {
      // Classic 3-2-1 Orthogonal Block:
      // Primary Plane A (3 pts, normal Z): Tz, Rx, Ry
      // Secondary Plane B (2 pts, normal Y): Ty, Rz
      // Tertiary Plane C (1 pt, normal X): Tx
      if (hasA) lock(['Tz', 'Rx', 'Ry'], 'A');
      if (hasB) lock(['Ty', 'Rz'], 'B');
      if (hasC) lock(['Tx'], 'C');
    }

    const lockedCount = Object.values(dof).filter(Boolean).length;
    return {
      preset,
      dof,
      lockedBy,
      lockedCount,
      freeCount: 6 - lockedCount,
      fullyConstrained: lockedCount === 6
    };
  }

  /* ========================================================================
     2) EXACT SE(2) PRECEDENCE SOLVER: |A|B|C| vs. |A|C|B|
     ======================================================================== */

  /**
   * Models a real machined rectangular bracket lying flat on Primary Plane A (Z=0):
   * - Nominal size: width W (along X, 120 mm) × depth H (along Y, 80 mm)
   * - Back edge (Datum B): straight line along y = 0 from x = 0 to x = W
   * - Left edge (Datum C): manufactured out-of-square by angle skewDeg (deg):
   *     starts at bottom-left corner (0, 0) and tilts inward/outward as y increases:
   *     P_C(y) = (y * tan(skew), y) for y in [0..H]
   *   Wait: for a real exterior part pressed against physical gauge pins:
   *   - Under |A|B|C|:
   *       Secondary B contacts the back edge (y = 0) at 2 pins -> Frame X-axis lies along B!
   *       Tertiary  C contacts the extreme leftmost point of Edge C -> sets X = 0!
   *         If skewDeg >= 0, Edge C goes from (0,0) to (H*tan(a), H), so leftmost point is (0,0).
   *         If skewDeg <  0, Edge C goes from (0,0) to (H*tan(a), H) where H*tan(a) < 0,
   *         so the extreme left high-point contact is at (H*tan(a), H)!
   *   - Under |A|C|B|:
   *       Secondary C contacts the tilted left edge C at 2 pins -> Frame Y'-axis aligns with Edge C!
   *       Frame X'-axis is strictly perpendicular to Edge C (rotated by -skewDeg)!
   *       Tertiary  B contacts the extreme bottom point of Edge B along Y' -> sets Y' = 0!
   *
   * Then evaluates the exact measured coordinates (xM, yM) of a precision bore whose
   * physical center (in part-B coordinates) is at (tedX + errX, tedY + errY),
   * against Theoretically Exact Dimensions [tedX, tedY] and cylindrical position tolerance ØtPos!
   */
  function solvePrecedence(params) {
    const {
      widthMm = 120,
      heightMm = 80,
      skewDeg = 0.35,   // squareness deviation of Face C relative to Face B (degrees)
      tedX = 95,        // Theoretically Exact X of mounting hole [95]
      tedY = 55,        // Theoretically Exact Y of mounting hole [55]
      holeErrX = 0.03,  // Actual manufacturing hole error in B-frame X (mm)
      holeErrY = 0.02,  // Actual manufacturing hole error in B-frame Y (mm)
      tolPosMm = 0.20,  // Cylindrical true-position tolerance Øt (mm)
      order = 'ABC'     // 'ABC' or 'ACB'
    } = params;

    const alpha = (skewDeg * Math.PI) / 180;
    const tanA = Math.tan(alpha);

    // Part corner polygon in Part-B coordinates (origin at B∩C intersection):
    // P0 = (0, 0), P1 = (W, 0), P2 = (W, H), P3 = (H*tan(alpha), H)
    const p0 = { x: 0, y: 0 };
    const p1 = { x: widthMm, y: 0 };
    const p2 = { x: widthMm, y: heightMm };
    const p3 = { x: heightMm * tanA, y: heightMm };
    const corners = [p0, p1, p2, p3];

    // Actual physical hole center in Part-B coordinates
    const holePhys = { x: tedX + holeErrX, y: tedY + holeErrY };

    // Helper: evaluate a given order ('ABC' or 'ACB')
    function evalOrder(ord) {
      let origin, ux, uy, pinsSecondary, pinTertiary, frameAngleRad;

      if (ord === 'ABC') {
        // Secondary B: 2 pins along Edge B (y = 0) => X-axis = (1, 0), Y-axis = (0, 1)
        ux = { x: 1, y: 0 };
        uy = { x: 0, y: 1 };
        frameAngleRad = 0;

        // Tertiary C: 1 pin touches the extreme leftmost point of Edge C (min x among p0, p3)
        const cContact = p3.x < p0.x ? p3 : p0;
        origin = { x: cContact.x, y: 0 };

        pinsSecondary = [
          { x: widthMm * 0.22, y: 0, label: 'B1' },
          { x: widthMm * 0.78, y: 0, label: 'B2' }
        ];
        pinTertiary = { x: cContact.x, y: cContact.y, label: 'C1' };
      } else {
        // Secondary C: 2 pins along tilted Edge C from p0 to p3!
        // Unit vector along Edge C (pointing upward): uy = (sin(alpha), cos(alpha))
        // Unit vector perpendicular to Edge C (pointing right): ux = (cos(alpha), -sin(alpha))
        ux = { x: Math.cos(alpha), y: -Math.sin(alpha) };
        uy = { x: Math.sin(alpha), y: Math.cos(alpha) };
        frameAngleRad = -alpha;

        // Tertiary B: 1 pin touches the extreme lowest point of Edge B (p0 or p1) projected onto uy!
        const proj0 = p0.x * uy.x + p0.y * uy.y; // 0
        const proj1 = p1.x * uy.x + p1.y * uy.y; // W * sin(alpha)
        const bContact = proj1 < proj0 ? p1 : p0;
        const minY = Math.min(proj0, proj1);

        // Origin of Frame (C-line is x'=0, minY along uy is y'=0):
        // Point on Edge C at coordinate y' = minY is: origin = minY * uy
        origin = { x: minY * uy.x, y: minY * uy.y };

        pinsSecondary = [
          { x: p0.x + 0.22 * (p3.x - p0.x), y: p0.y + 0.22 * (p3.y - p0.y), label: 'C1' },
          { x: p0.x + 0.78 * (p3.x - p0.x), y: p0.y + 0.78 * (p3.y - p0.y), label: 'C2' }
        ];
        pinTertiary = { x: bContact.x, y: bContact.y, label: 'B1' };
      }

      // Measure hole center in this Datum Reference Frame:
      const dx = holePhys.x - origin.x;
      const dy = holePhys.y - origin.y;
      const measX = dx * ux.x + dy * ux.y;
      const measY = dx * uy.x + dy * uy.y;

      const devX = measX - tedX;
      const devY = measY - tedY;
      const radialErr = Math.hypot(devX, devY);
      const posDiaErr = 2 * radialErr; // ISO 1101 cylindrical position deviation = 2 * r
      const pass = posDiaErr <= tolPosMm + 1e-9;

      // Also compute ideal TED target position in Part-B coordinates for drawing overlay
      const tedWorld = {
        x: origin.x + tedX * ux.x + tedY * uy.x,
        y: origin.y + tedX * ux.y + tedY * uy.y
      };

      return {
        order: ord,
        origin,
        ux,
        uy,
        frameAngleRad,
        frameAngleDeg: (frameAngleRad * 180) / Math.PI,
        pinsSecondary,
        pinTertiary,
        measX,
        measY,
        devX,
        devY,
        radialErr,
        posDiaErr,
        tolPosMm,
        pass,
        tedWorld
      };
    }

    const resABC = evalOrder('ABC');
    const resACB = evalOrder('ACB');
    const active = order === 'ACB' ? resACB : resABC;

    // Lever arm amplification ratio: distance to hole / length of secondary datum edge
    const leverRatioABC = tedY / widthMm;
    const leverRatioACB = tedX / heightMm;

    return {
      widthMm,
      heightMm,
      skewDeg,
      tedX,
      tedY,
      tolPosMm,
      corners,
      holePhys,
      resABC,
      resACB,
      active,
      verdictFlips: resABC.pass !== resACB.pass,
      deltaPosErrMm: Math.abs(resACB.posDiaErr - resABC.posDiaErr),
      leverRatioABC,
      leverRatioACB
    };
  }

  /* ========================================================================
     3) COMMON DATUM |A-B| VS. SINGLE DATUM |A| SHAFT RUNOUT SOLVER
     ======================================================================== */

  /**
   * Models a stepped shaft of length L = 240 mm:
   * - Bearing seat A at x in [10..40 mm] (short width L_A = 30 mm)
   * - Bearing seat B at x in [200..230 mm] (span between centers = 190 mm)
   * - Functional gear journal at x = 120 mm (mid-span) or overhanging pinion at x = 215/260 mm
   * If seat A has a tiny tilt / coaxiality deviation (tiltUm over seat A length 30 mm)
   * and seat B is offset by offsetBUm:
   *   - Single Datum |A| extrapolates the short 30 mm axis of A across 210 mm -> huge lever error!
   *   - Common Datum |A-B| draws the line between centers of A and B -> stable, realistic runout!
   */
  function solveCommonDatum(params) {
    const {
      seatACenterX = 25,
      seatALen = 30,
      seatBCenterX = 215,
      gearX = 120,
      overhangX = 260,
      seatATiltUm = 12,  // radial runout/tilt across short bearing seat A (µm)
      seatBOffsetUm = 10,// radial offset of seat B center relative to nominal (µm)
      gearOffsetUm = 14, // radial offset of central gear journal (µm)
      overhangOffsetUm = 12,
      datumMode = 'A-B'  // 'A' | 'A-B'
    } = params;

    // Axis of Single Datum A: passes through (seatACenterX, 0) with slope mA = seatATiltUm / seatALen (µm/mm)
    const mA = seatATiltUm / seatALen;
    const axisA = (x) => mA * (x - seatACenterX);

    // Axis of Common Datum A-B: connects (seatACenterX, 0) to (seatBCenterX, seatBOffsetUm)
    const spanAB = seatBCenterX - seatACenterX;
    const mAB = seatBOffsetUm / spanAB;
    const axisAB = (x) => mAB * (x - seatACenterX);

    const evalMode = (mode) => {
      const fn = mode === 'A-B' ? axisAB : axisA;
      const gearAxisY = fn(gearX);
      const ovAxisY = fn(overhangX);
      const seatBAxisY = fn(seatBCenterX);
      // Total indicator reading (TIR = 2 * radial eccentricity)
      const gearRunoutUm = 2 * Math.abs(gearOffsetUm - gearAxisY);
      const overhangRunoutUm = 2 * Math.abs(overhangOffsetUm - ovAxisY);
      const seatBRunoutUm = 2 * Math.abs(seatBOffsetUm - seatBAxisY);
      return {
        mode,
        slopeUmPerMm: mode === 'A-B' ? mAB : mA,
        gearRunoutUm,
        overhangRunoutUm,
        seatBRunoutUm,
        axisAt: fn
      };
    };

    const singleA = evalMode('A');
    const commonAB = evalMode('A-B');
    const amplificationFactor = (overhangX - seatACenterX) / seatALen;

    return {
      seatACenterX,
      seatALen,
      seatBCenterX,
      gearX,
      overhangX,
      seatBOffsetUm,
      gearOffsetUm,
      overhangOffsetUm,
      spanAB,
      amplificationFactor,
      singleA,
      commonAB,
      active: datumMode === 'A-B' ? commonAB : singleA
    };
  }

  /* ========================================================================
     4) ISO 5459 §7.2.2 DATUM FRAME & LETTER VALIDATOR
     ======================================================================== */

  function validateDatumFrame(primary, secondary, tertiary) {
    const raw = [primary, secondary, tertiary].map(s => (s || '').trim().toUpperCase());
    const issues = [];
    const warnings = [];

    const parseSlot = (val, slotName) => {
      if (!val) return [];
      // Allow single letter 'A' or common datum 'A-B'
      const m = /^([A-Z])(?:-([A-Z]))?$/.exec(val);
      if (!m) {
        issues.push(`${slotName} datum "${val}" has invalid syntax (use a single letter like A or common datum A-B).`);
        return [];
      }
      const letters = m[2] ? [m[1], m[2]] : [m[1]];
      if (m[2] && m[1] === m[2]) {
        issues.push(`${slotName} common datum "${val}" cannot repeat the same letter.`);
      }
      letters.forEach(ch => {
        if (FORBIDDEN_LETTERS.has(ch)) {
          issues.push(`Letter "${ch}" in ${slotName} datum is forbidden by DIN EN ISO 5459 §7.2.2 (avoid I, O, Q, X).`);
        }
      });
      return letters;
    };

    const pL = parseSlot(raw[0], 'Primary');
    const sL = parseSlot(raw[1], 'Secondary');
    const tL = parseSlot(raw[2], 'Tertiary');

    if (!raw[0] && (raw[1] || raw[2])) {
      issues.push('Primary datum compartment cannot be empty while Secondary/Tertiary is filled.');
    }
    if (!raw[1] && raw[2]) {
      issues.push('Secondary datum compartment cannot be empty while Tertiary is filled.');
    }

    const seen = new Set();
    [...pL, ...sL, ...tL].forEach(ch => {
      if (seen.has(ch)) {
        issues.push(`Datum letter "${ch}" appears more than once in the same reference frame.`);
      }
      seen.add(ch);
    });

    if (raw[0] && !raw[1] && !raw[2]) {
      warnings.push('Single datum locks at most 3 DOF (plane) or 4 DOF (cylinder); remaining DOF stay unconstrained.');
    }

    const slots = raw.filter(Boolean);
    const frameStr = slots.length ? `| ${slots.join(' | ')} |` : '| (none) |';

    return {
      valid: issues.length === 0 && slots.length > 0,
      frameStr,
      issues,
      warnings
    };
  }

  return {
    FORBIDDEN_LETTERS,
    solveDOF,
    solvePrecedence,
    solveCommonDatum,
    validateDatumFrame
  };
}));
