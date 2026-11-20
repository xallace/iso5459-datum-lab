/* ==========================================================================
   DIN EN ISO 5459 Technical Plate Renderer (1967 Book-Plate Aesthetic)
   1) Interactive 3D Isometric Rigid-Body 3-2-1 DOF Plate (Custom 3D Projection)
   2) 2D Plan Inspection Plate for |A|B|C| vs. |A|C|B| Precedence Paradox
   3) Common Datum |A-B| Shaft & Cast Datum Targets (A1/A2/A3) Plates
   ========================================================================== */

(function () {
  'use strict';

  const C = {
    paper: '#faf5e8',
    warm: '#f3ebda',
    grid: '#e8dec9',
    ink: '#181715',
    muted: '#5c564c',
    rule: '#cfc5b2',
    ruleSoft: '#e4dac5',
    green: '#047857',
    greenFill: 'rgba(4, 120, 87, 0.16)',
    blue: '#0369a1',
    blueFill: 'rgba(3, 105, 161, 0.16)',
    amber: '#b45309',
    amberFill: 'rgba(180, 83, 9, 0.18)',
    red: '#d94426',
    redFill: 'rgba(217, 68, 38, 0.14)'
  };

  function setupCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(300, Math.round(rect.width));
    const h = Math.max(220, Math.round(rect.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function drawArrow(ctx, x1, y1, x2, y2, color, head = 6) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(ang - 0.34), y2 - head * Math.sin(ang - 0.34));
    ctx.lineTo(x2 - head * Math.cos(ang + 0.34), y2 - head * Math.sin(ang + 0.34));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ========================================================================
     1) INTERACTIVE 3D RIGID-BODY 3-2-1 DOF STAGE (CUSTOM 3D ENGINE)
     ======================================================================== */

  function makeProjector(w, h, yawDeg, pitchDeg, scale) {
    const yaw = (yawDeg * Math.PI) / 180;
    const pitch = (pitchDeg * Math.PI) / 180;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cx = w * 0.5;
    const cy0 = h * 0.56;

    return (x, y, z) => {
      // Rotate around Z (yaw), then around X (pitch)
      const rx = x * cy - y * sy;
      const ry = x * sy + y * cy;
      const rz = z;
      const py = ry * cp - rz * sp;
      const pz = ry * sp + rz * cp;
      // Gentle perspective factor
      const persp = 1 / (1 - py * 0.0012);
      return {
        x: cx + rx * scale * persp,
        y: cy0 - pz * scale * persp,
        depth: py
      };
    };
  }

  function transformPt(p, motion) {
    // Apply rigid-body free-DOF motion (Rx, Ry, Rz, Tx, Ty, Tz)
    let { x, y, z } = p;
    const cx = Math.cos(motion.rx), sx = Math.sin(motion.rx);
    let y1 = y * cx - z * sx, z1 = y * sx + z * cx;
    y = y1; z = z1;

    const cy = Math.cos(motion.ry), sy = Math.sin(motion.ry);
    let x1 = x * cy + z * sy; z1 = -x * sy + z * cy;
    x = x1; z = z1;

    const cz = Math.cos(motion.rz), sz = Math.sin(motion.rz);
    x1 = x * cz - y * sz; y1 = x * sz + y * cz;
    x = x1; y = y1;

    return { x: x + motion.tx, y: y + motion.ty, z: z + motion.tz };
  }

  function drawDOF3DPlate(canvas, state, dofSol, phase) {
    const { ctx, w, h } = setupCanvas(canvas);

    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = C.ruleSoft;
    ctx.lineWidth = 1;
    ctx.strokeRect(10.5, 10.5, w - 21, h - 21);

    const scale = Math.min(w / 260, h / 215);
    const proj = makeProjector(w, h, state.camYaw, state.camPitch, scale);

    // Granite Surface Plate (Datum A reference granite bed at z = 0)
    const bed = [
      proj(-92, -68, 0),
      proj(92, -68, 0),
      proj(92, 68, 0),
      proj(-92, 68, 0)
    ];
    ctx.save();
    ctx.beginPath();
    bed.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = C.warm;
    ctx.fill();
    ctx.strokeStyle = C.rule;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Subtle granite plate grid lines
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 0.7;
    for (let gx = -60; gx <= 60; gx += 30) {
      const a = proj(gx, -68, 0), b = proj(gx, 68, 0);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (let gy = -45; gy <= 45; gy += 30) {
      const a = proj(-92, gy, 0), b = proj(92, gy, 0);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();

    // Compute live animation motion ONLY along FREE (unlocked) DOFs
    const anim = state.animateFree;
    const motion = {
      tx: anim && !dofSol.dof.Tx ? Math.sin(phase * 1.4) * 14 : 0,
      ty: anim && !dofSol.dof.Ty ? Math.cos(phase * 1.1) * 11 : 0,
      tz: anim && !dofSol.dof.Tz ? (Math.sin(phase * 1.7) * 0.5 + 0.5) * 14 + 4 : (!dofSol.dof.Tz ? 7 : 0),
      rx: anim && !dofSol.dof.Rx ? Math.sin(phase * 1.3) * 0.14 : 0,
      ry: anim && !dofSol.dof.Ry ? Math.cos(phase * 1.2) * 0.13 : 0,
      rz: anim && !dofSol.dof.Rz ? Math.sin(phase * 0.95) * 0.19 : 0
    };

    // Draw Datum Fixture Reference Planes & Physical Contact Pins
    const drawPin = (x, y, z, color, label) => {
      const base = proj(x, y, Math.min(z, 0));
      const tip = proj(x, y, z);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.paper;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      ctx.fillStyle = color;
      ctx.fillText(label, tip.x + 7, tip.y - 4);
      ctx.restore();
    };

    // Block geometry: X in [-54..54], Y in [-34..34], Z in [0..38]
    const bx = 54, by = 34, bz = 38;

    // Primary Datum A: 3 Contact Pads on granite surface (z = 0)
    if (state.hasA) {
      const tri = [proj(-38, -22, 0.5), proj(38, -22, 0.5), proj(0, 24, 0.5)];
      ctx.save();
      ctx.beginPath();
      tri.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = C.greenFill;
      ctx.fill();
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 1.1;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.restore();

      drawPin(-38, -22, 0, C.green, 'A1');
      drawPin(38, -22, 0, C.green, 'A2');
      drawPin(0, 24, 0, C.green, 'A3');
    }

    // Secondary Datum B: Back rail (y = +34) or Bore Cylinder (flange preset)
    if (state.hasB && state.dofPreset === 'block321') {
      const wall = [
        proj(-62, by + 1, 0), proj(62, by + 1, 0),
        proj(62, by + 1, bz + 8), proj(-62, by + 1, bz + 8)
      ];
      ctx.save();
      ctx.beginPath();
      wall.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = C.blueFill;
      ctx.fill();
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.restore();
    }

    // Tertiary Datum C: Left stop plane (x = -54)
    if (state.hasC && state.dofPreset === 'block321') {
      const stop = [
        proj(-bx - 1, -40, 0), proj(-bx - 1, 40, 0),
        proj(-bx - 1, 40, bz + 8), proj(-bx - 1, -40, bz + 8)
      ];
      ctx.save();
      ctx.beginPath();
      stop.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = C.amberFill;
      ctx.fill();
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.restore();
    }

    // Build 3D Workpiece Box vertices & faces (painter's sort by depth)
    const rawVerts = [
      { x: -bx, y: -by, z: 0 },  // 0
      { x:  bx, y: -by, z: 0 },  // 1
      { x:  bx, y:  by, z: 0 },  // 2
      { x: -bx, y:  by, z: 0 },  // 3
      { x: -bx, y: -by, z: bz }, // 4
      { x:  bx, y: -by, z: bz }, // 5
      { x:  bx, y:  by, z: bz }, // 6
      { x: -bx, y:  by, z: bz }  // 7
    ].map(v => {
      // Pivot around center of base (0,0,0) for natural rocking
      const t = transformPt(v, motion);
      return proj(t.x, t.y, t.z);
    });

    const faces = [
      { idx: [0, 1, 2, 3], fill: 'rgba(232, 222, 200, 0.85)', tag: 'A' }, // bottom
      { idx: [4, 5, 6, 7], fill: 'rgba(250, 245, 232, 0.90)', tag: 'TOP' }, // top
      { idx: [0, 1, 5, 4], fill: 'rgba(241, 233, 214, 0.88)', tag: 'FRONT' },
      { idx: [2, 3, 7, 6], fill: state.hasB && state.dofPreset === 'block321' ? 'rgba(3, 105, 161, 0.18)' : 'rgba(230, 220, 198, 0.86)', tag: 'B' },
      { idx: [3, 0, 4, 7], fill: state.hasC && state.dofPreset === 'block321' ? 'rgba(180, 83, 9, 0.18)' : 'rgba(235, 226, 206, 0.88)', tag: 'C' },
      { idx: [1, 2, 6, 5], fill: 'rgba(226, 216, 195, 0.86)', tag: 'RIGHT' }
    ];

    faces.forEach(f => {
      f.avgDepth = f.idx.reduce((acc, i) => acc + rawVerts[i].depth, 0) / f.idx.length;
    });
    faces.sort((a, b) => b.avgDepth - a.avgDepth); // far-to-near

    faces.forEach(f => {
      ctx.save();
      ctx.beginPath();
      f.idx.forEach((vi, k) => {
        const p = rawVerts[vi];
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = f.fill;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    });

    // Draw machined center bore on top face (and Datum B axis pin if flange preset!)
    const borePts = [];
    const rBore = state.dofPreset === 'flange' ? 16 : 11;
    for (let i = 0; i <= 32; i++) {
      const a = (2 * Math.PI * i) / 32;
      const pt = transformPt({ x: Math.cos(a) * rBore, y: Math.sin(a) * rBore, z: bz }, motion);
      borePts.push(proj(pt.x, pt.y, pt.z));
    }
    ctx.save();
    ctx.beginPath();
    borePts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = state.dofPreset === 'flange' && state.hasB ? C.blueFill : 'rgba(24, 23, 21, 0.09)';
    ctx.fill();
    ctx.strokeStyle = state.dofPreset === 'flange' && state.hasB ? C.blue : C.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Flange mode: central locating pin + edge clocking pin C
    if (state.dofPreset === 'flange') {
      if (state.hasB) {
        const pBot = proj(0, 0, -4), pTop = proj(0, 0, bz + 20);
        ctx.strokeStyle = C.blue;
        ctx.lineWidth = 2.2;
        ctx.setLineDash([6, 3]);
        ctx.beginPath(); ctx.moveTo(pBot.x, pBot.y); ctx.lineTo(pTop.x, pTop.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = C.blue;
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillText('Datum B (Axis: Tx, Ty)', pTop.x + 8, pTop.y + 4);
      }
      if (state.hasC) {
        drawPin(38, 0, bz + 4, C.amber, 'C (Clocking Rz)');
      }
    } else {
      // Foreground contact pins for B1, B2 and C1
      if (state.hasB) {
        drawPin(-28, by + 2, 18, C.blue, 'B1');
        drawPin(28, by + 2, 18, C.blue, 'B2');
      }
      if (state.hasC) {
        drawPin(-bx - 2, 0, 18, C.amber, 'C1');
      }
    }
    ctx.restore();

    // Draw Datum Reference Coordinate Triad (X, Y, Z) at bottom-left corner
    const o3 = proj(-bx - 16, -by - 14, 0);
    const x3 = proj(-bx + 12, -by - 14, 0);
    const y3 = proj(-bx - 16, -by + 14, 0);
    const z3 = proj(-bx - 16, -by - 14, 28);
    drawArrow(ctx, o3.x, o3.y, x3.x, x3.y, C.amber, 5.5);
    drawArrow(ctx, o3.x, o3.y, y3.x, y3.y, C.blue, 5.5);
    drawArrow(ctx, o3.x, o3.y, z3.x, z3.y, C.green, 5.5);
    ctx.save();
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillStyle = C.amber; ctx.fillText('X', x3.x + 5, x3.y + 3);
    ctx.fillStyle = C.blue;  ctx.fillText('Y', y3.x + 5, y3.y + 3);
    ctx.fillStyle = C.green; ctx.fillText('Z', z3.x - 3, z3.y - 6);
    ctx.restore();

    // Top-left plate header & hint
    ctx.save();
    const activeFrame = [state.hasA ? 'A' : null, state.hasB ? 'B' : null, state.hasC ? 'C' : null].filter(Boolean);
    ctx.font = '700 11.5px "JetBrains Mono", monospace';
    ctx.fillStyle = C.ink;
    ctx.fillText(
      `DRF: ${activeFrame.length ? '| ' + activeFrame.join(' | ') + ' |' : '(UNCONSTRAINED)'}  ·  ${dofSol.lockedCount}/6 DOF LOCKED`,
      22, 31
    );
    ctx.font = '500 9.5px "Inter", sans-serif';
    ctx.fillStyle = C.muted;
    ctx.fillText('Drag anywhere to orbit 3D fixture · Press Animate Free DOF to see unlocked motion', 22, h - 18);
    ctx.restore();
  }

  /* ========================================================================
     2) 2D PLAN INSPECTION PLATE: |A|B|C| VS. |A|C|B| PRECEDENCE PARADOX
     ======================================================================== */
  function drawPrecedencePlate(canvas, sol) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = C.ruleSoft;
    ctx.lineWidth = 1;
    ctx.strokeRect(10.5, 10.5, w - 21, h - 21);

    // Visual exaggeration of tiny squareness angle (0.35° -> ~8× exaggerated visually so the tilt is unmistakable)
    // While ALL displayed numbers come from the EXACT un-exaggerated SE(2) solver!
    const visExag = 12;
    const visAlpha = ((sol.skewDeg * visExag) * Math.PI) / 180;
    const visTan = Math.tan(visAlpha);

    const scale = Math.min((w - 255) / sol.widthMm, (h - 190) / sol.heightMm);
    const ox = w * 0.21;
    const oy = h * 0.80;

    // Map part coordinates (x right, y up) to canvas (cx, cy)
    const toScr = (x, y) => ({ x: ox + x * scale, y: oy - y * scale });

    // Subtle drafting grid
    ctx.save();
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 0.7;
    for (let gx = 24; gx < w - 24; gx += 32) {
      ctx.beginPath(); ctx.moveTo(gx, 16); ctx.lineTo(gx, h - 16); ctx.stroke();
    }
    for (let gy = 24; gy < h - 24; gy += 32) {
      ctx.beginPath(); ctx.moveTo(16, gy); ctx.lineTo(w - 16, gy); ctx.stroke();
    }
    ctx.restore();

    const act = sol.active;
    const isACB = act.order === 'ACB';

    // Exaggerated visual corners of the skewed workpiece
    const vc0 = { x: 0, y: 0 };
    const vc1 = { x: sol.widthMm, y: 0 };
    const vc2 = { x: sol.widthMm, y: sol.heightMm };
    const vc3 = { x: sol.heightMm * visTan, y: sol.heightMm };
    const vCorners = [vc0, vc1, vc2, vc3].map(p => toScr(p.x, p.y));

    // Draw skewed real workpiece
    ctx.save();
    ctx.beginPath();
    vCorners.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = 'rgba(239, 230, 211, 0.82)';
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.9;
    ctx.stroke();

    // Highlight Face B (bottom) & Face C (left)
    ctx.strokeStyle = isACB ? C.amber : C.blue;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(vCorners[0].x, vCorners[0].y); ctx.lineTo(vCorners[1].x, vCorners[1].y); ctx.stroke();

    ctx.strokeStyle = isACB ? C.blue : C.amber;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(vCorners[0].x, vCorners[0].y); ctx.lineTo(vCorners[3].x, vCorners[3].y); ctx.stroke();
    ctx.restore();

    // Draw Active CMM Inspection Coordinate Axes (Rotated when ACB!)
    const visUx = isACB ? { x: Math.cos(visAlpha), y: -Math.sin(visAlpha) } : { x: 1, y: 0 };
    const visUy = isACB ? { x: Math.sin(visAlpha), y: Math.cos(visAlpha) } : { x: 0, y: 1 };

    let visOrigin;
    if (!isACB) {
      visOrigin = { x: Math.min(vc0.x, vc3.x), y: 0 };
    } else {
      const p1y = vc1.x * visUy.x + vc1.y * visUy.y;
      const minY = Math.min(0, p1y);
      visOrigin = { x: minY * visUy.x, y: minY * visUy.y };
    }

    const scrO = toScr(visOrigin.x, visOrigin.y);
    const scrXEnd = toScr(visOrigin.x + (sol.widthMm + 16) * visUx.x, visOrigin.y + (sol.widthMm + 16) * visUx.y);
    const scrYEnd = toScr(visOrigin.x + (sol.heightMm + 12) * visUy.x, visOrigin.y + (sol.heightMm + 12) * visUy.y);

    // Dashed CMM Coordinate Frame Lines
    ctx.save();
    ctx.strokeStyle = C.blue;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([7, 4]);
    ctx.beginPath();
    ctx.moveTo(scrO.x, scrO.y); ctx.lineTo(scrXEnd.x, scrXEnd.y);
    ctx.moveTo(scrO.x, scrO.y); ctx.lineTo(scrYEnd.x, scrYEnd.y);
    ctx.stroke();
    ctx.restore();

    drawArrow(ctx, scrO.x, scrO.y, scrXEnd.x, scrXEnd.y, C.blue, 6.5);
    drawArrow(ctx, scrO.x, scrO.y, scrYEnd.x, scrYEnd.y, C.blue, 6.5);
    ctx.save();
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillStyle = C.blue;
    ctx.fillText(`X_${act.order}`, scrXEnd.x + 6, scrXEnd.y + 4);
    ctx.fillText(`Y_${act.order}`, scrYEnd.x - 6, scrYEnd.y - 8);
    ctx.restore();

    // Draw Secondary (2 pins) and Tertiary (1 pin) physical stops
    const drawStopPin = (p, color, label, dx = -10, dy = 16) => {
      const s = toScr(p.x, p.y);
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.paper;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      ctx.fillStyle = color;
      ctx.fillText(label, s.x + dx, s.y + dy);
      ctx.restore();
    };

    if (!isACB) {
      drawStopPin({ x: sol.widthMm * 0.25, y: 0 }, C.blue, 'B1 (2nd)', -18, 17);
      drawStopPin({ x: sol.widthMm * 0.78, y: 0 }, C.blue, 'B2 (2nd)', -18, 17);
      const cPt = vc3.x < vc0.x ? vc3 : vc0;
      drawStopPin(cPt, C.amber, 'C1 (3rd)', -56, 4);
    } else {
      drawStopPin({ x: 0.25 * vc3.x, y: 0.25 * vc3.y }, C.blue, 'C1 (2nd)', -58, 4);
      drawStopPin({ x: 0.78 * vc3.x, y: 0.78 * vc3.y }, C.blue, 'C2 (2nd)', -58, 4);
      const bPt = (vc1.x * visUy.x + vc1.y * visUy.y) < 0 ? vc1 : vc0;
      drawStopPin(bPt, C.amber, 'B1 (3rd)', -18, 18);
    }

    // Draw Hole TED Target + Magnified Position Tolerance Zone Øt_pos + Actual Measured Center
    const tedVis = {
      x: visOrigin.x + sol.tedX * visUx.x + sol.tedY * visUy.x,
      y: visOrigin.y + sol.tedX * visUx.y + sol.tedY * visUy.y
    };
    const scrTed = toScr(tedVis.x, tedVis.y);

    // Physical hole circle on bracket
    ctx.save();
    ctx.beginPath();
    ctx.arc(scrTed.x, scrTed.y, 13, 0, Math.PI * 2);
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.7;
    ctx.stroke();

    // Inset Zoom Target on top-right showing exact Øt_pos circle vs actual center (devX, devY)!
    const zx = w - 112;
    const zy = 104;
    const zR = 54;
    ctx.fillStyle = C.paper;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.1;
    ctx.fillRect(zx - 78, zy - 74, 156, 152);
    ctx.strokeRect(zx - 78, zy - 74, 156, 152);

    ctx.font = '700 8.5px "JetBrains Mono", monospace';
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'center';
    ctx.fillText(`POSITION ZONE ZOOM`, zx, zy - 60);

    // Scale zoom so tol radius = 26 px (clamping dot inside box if huge)
    const tolR = sol.tolPosMm * 0.5;
    const zPxPerMm = 26 / Math.max(0.05, tolR);

    // Crosshairs
    ctx.strokeStyle = C.rule;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(zx - 64, zy); ctx.lineTo(zx + 64, zy);
    ctx.moveTo(zx, zy - 46); ctx.lineTo(zx, zy + 54);
    ctx.stroke();

    // Tolerance Zone Circle (Øt_pos)
    ctx.beginPath();
    ctx.arc(zx, zy, 26, 0, Math.PI * 2);
    ctx.fillStyle = act.pass ? C.greenFill : C.redFill;
    ctx.fill();
    ctx.strokeStyle = act.pass ? C.green : C.red;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Actual measured center dot (clamped gently to box radius 52 px)
    let dxPx = act.devX * zPxPerMm;
    let dyPx = -act.devY * zPxPerMm;
    const magPx = Math.hypot(dxPx, dyPx);
    const clipped = magPx > 50;
    if (clipped) {
      dxPx = (dxPx / magPx) * 50;
      dyPx = (dyPx / magPx) * 50;
    }

    drawArrow(ctx, zx, zy, zx + dxPx, zy + dyPx, act.pass ? C.green : C.red, 5);
    ctx.fillStyle = act.pass ? C.green : C.red;
    ctx.beginPath();
    ctx.arc(zx + dxPx, zy + dyPx, 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '700 9.5px "JetBrains Mono", monospace';
    ctx.fillStyle = act.pass ? C.green : C.red;
    ctx.fillText(`Øe = ${act.posDiaErr.toFixed(3)} mm ${act.pass ? '✓' : '✕'}`, zx, zy + 68);
    ctx.restore();

    // Feature Control Frame Callout top-left
    ctx.save();
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    const fcf = act.order === 'ABC'
      ? `| ⌖ | Ø${sol.tolPosMm.toFixed(2)} | A | B | C |`
      : `| ⌖ | Ø${sol.tolPosMm.toFixed(2)} | A | C | B |`;
    ctx.fillText(fcf, 24, 34);
    ctx.font = '500 10px "Inter", sans-serif';
    ctx.fillStyle = C.muted;
    ctx.fillText(
      `Face C squareness error α = ${sol.skewDeg.toFixed(2)}° (magnified ${visExag}× visually) · TED [${sol.tedX}, ${sol.tedY}] mm`,
      24, 50
    );
    ctx.restore();
  }

  /* ========================================================================
     3) COMMON DATUM |A-B| VS. SINGLE DATUM |A| & DATUM TARGETS PLATE
     ======================================================================== */
  function drawCommonDatumPlate(canvas, cdState, cdSol) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = C.ruleSoft;
    ctx.lineWidth = 1;
    ctx.strokeRect(10.5, 10.5, w - 21, h - 21);

    if (cdState.mode === 'targets') {
      drawDatumTargetsView(ctx, w, h, cdState.useTargets);
      return;
    }

    const padL = 56, padR = 46;
    const xOf = (mm) => padL + (mm / 280) * (w - padL - padR);
    const midY = h * 0.54;
    const umScale = 1.65; // visual vertical exaggeration (µm -> px)

    // Nominal shaft centerline
    ctx.save();
    ctx.strokeStyle = 'rgba(24, 23, 21, 0.25)';
    ctx.lineWidth = 0.9;
    ctx.setLineDash([12, 4, 2, 4]);
    ctx.beginPath();
    ctx.moveTo(26, midY); ctx.lineTo(w - 26, midY);
    ctx.stroke();
    ctx.restore();

    // Draw Stepped Shaft Segments: Seat A [10..40], Center Gear [98..142], Seat B [200..230], Overhang Pinion [245..275]
    const drawSeg = (x1, x2, halfH, yOffUm, fill, label, sub) => {
      const sx1 = xOf(x1), sx2 = xOf(x2);
      const cy = midY - yOffUm * umScale;
      ctx.save();
      ctx.fillStyle = fill;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.7;
      ctx.fillRect(sx1, cy - halfH, sx2 - sx1, halfH * 2);
      ctx.strokeRect(sx1, cy - halfH, sx2 - sx1, halfH * 2);
      if (label) {
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillStyle = C.ink;
        ctx.textAlign = 'center';
        ctx.fillText(label, (sx1 + sx2) / 2, cy - halfH - 9);
      }
      if (sub) {
        ctx.font = '500 9px "Inter", sans-serif';
        ctx.fillStyle = C.muted;
        ctx.textAlign = 'center';
        ctx.fillText(sub, (sx1 + sx2) / 2, cy + halfH + 15);
      }
      ctx.restore();
    };

    // Connecting necks
    drawSeg(40, 98, 22, 0, C.warm);
    drawSeg(142, 200, 22, cdSol.seatBOffsetUm * 0.5, C.warm);
    drawSeg(230, 245, 19, cdSol.seatBOffsetUm, C.warm);

    // Key Functional Journals
    drawSeg(10, 40, 32, 0, C.greenFill, 'DATUM A', '30 mm Seat');
    drawSeg(98, 142, 48, cdSol.gearOffsetUm, 'rgba(239,230,211,0.9)', 'GEAR', 'x = 120 mm');
    drawSeg(200, 230, 32, cdSol.seatBOffsetUm, C.blueFill, 'DATUM B', 'Span 190 mm');
    drawSeg(245, 275, 28, cdSol.overhangOffsetUm, C.redFill, 'PINION', 'x = 260 mm');

    // Plot BOTH axes: Single Datum |A| (red dashed) vs. Common Datum |A-B| (cobalt solid)
    const isAB = cdState.datumMode === 'A-B';

    const drawAxisLine = (fn, color, dashed, lw, tag, labelOffsetY) => {
      const y1 = midY - fn(0) * umScale;
      const y2 = midY - fn(280) * umScale;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      if (dashed) ctx.setLineDash([7, 4]);
      ctx.beginPath();
      ctx.moveTo(xOf(0), y1);
      ctx.lineTo(xOf(280), y2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.fillText(tag, xOf(280), y2 + labelOffsetY);
      ctx.restore();
    };

    drawAxisLine(cdSol.singleA.axisAt, C.red, true, isAB ? 1.2 : 2.3, 'Axis |A| (extrapolated)', -9);
    drawAxisLine(cdSol.commonAB.axisAt, C.blue, false, isAB ? 2.4 : 1.1, 'Common Axis |A-B|', 56);

    // Error indicator arrow at Overhang Pinion (x = 260 mm)
    const activeAxisY = midY - cdSol.active.axisAt(260) * umScale;
    const pinionCenterY = midY - cdSol.overhangOffsetUm * umScale;
    const px = xOf(260);
    drawArrow(ctx, px, activeAxisY, px, pinionCenterY, isAB ? C.blue : C.red, 5.5);

    // Header
    ctx.save();
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle = C.ink;
    ctx.fillText(
      `ACTIVE DATUM: | ${cdState.datumMode} |  ·  PINION RUNOUT = ${cdSol.active.overhangRunoutUm.toFixed(1)} µm`,
      24, 34
    );
    ctx.font = '500 10px "Inter", sans-serif';
    ctx.fillStyle = C.muted;
    ctx.fillText(
      `Short-seat amplification over 235 mm overhang = ${cdSol.amplificationFactor.toFixed(1)}× (Datum A alone magnifies seat tilt dramatically)`,
      24, 50
    );
    ctx.restore();
  }

  function drawDatumTargetsView(ctx, w, h, useTargets) {
    // Visualizes a rough cast bracket with bumpy bottom face resting on a granite plate:
    // Without targets -> ambiguous rocking! With A1, A2, A3 Datum Targets -> locked 3-point seating!
    const midY = h * 0.68;
    const bx0 = w * 0.14, bx1 = w * 0.86;

    // Granite plate line
    ctx.fillStyle = C.warm;
    ctx.fillRect(bx0 - 30, midY, (bx1 - bx0) + 60, 22);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(bx0 - 30, midY, (bx1 - bx0) + 60, 22);

    // Bumpy cast bottom curve
    ctx.save();
    const tilt = useTargets ? 0 : 0.045;
    ctx.translate(w * 0.5, midY - (useTargets ? 18 : 6));
    ctx.rotate(tilt);

    const halfW = (bx1 - bx0) * 0.44;
    ctx.beginPath();
    ctx.moveTo(-halfW, -110);
    ctx.lineTo(halfW, -110);
    ctx.lineTo(halfW, 0);
    for (let i = 40; i >= 0; i--) {
      const u = i / 40;
      const x = -halfW + u * halfW * 2;
      const bump = Math.sin(u * Math.PI * 5) * 6 + Math.cos(u * Math.PI * 9) * 3;
      ctx.lineTo(x, bump);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(232, 222, 200, 0.9)';
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.9;
    ctx.stroke();
    ctx.restore();

    if (useTargets) {
      // Three explicit ISO 5459 Datum Target Support Pins A1, A2, A3
      const xs = [w * 0.24, w * 0.50, w * 0.76];
      xs.forEach((tx, idx) => {
        ctx.save();
        ctx.fillStyle = C.green;
        ctx.fillRect(tx - 5, midY - 18, 10, 18);
        ctx.strokeStyle = C.green;
        ctx.lineWidth = 1.4;
        // ISO 5459 Target Symbol circle (top: Ø6, bottom: A1)
        const cy = midY + 52;
        ctx.beginPath(); ctx.moveTo(tx, midY - 12); ctx.lineTo(tx, cy - 16); ctx.stroke();
        ctx.fillStyle = C.paper;
        ctx.beginPath(); ctx.arc(tx, cy, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx - 16, cy); ctx.lineTo(tx + 16, cy); ctx.stroke();
        ctx.fillStyle = C.ink;
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Ø6', tx, cy - 4);
        ctx.fillStyle = C.green;
        ctx.fillText(`A${idx + 1}`, tx, cy + 10);
        ctx.restore();
      });
    } else {
      // Rocking arrows warning
      drawArrow(ctx, w * 0.2, midY - 135, w * 0.2, midY - 102, C.red, 6);
      drawArrow(ctx, w * 0.8, midY - 102, w * 0.8, midY - 135, C.red, 6);
      ctx.save();
      ctx.font = '700 11px "Inter", sans-serif';
      ctx.fillStyle = C.red;
      ctx.textAlign = 'center';
      ctx.fillText('UNSTABLE ROCKING — Entire rough cast face called as Datum A!', w * 0.5, midY + 48);
      ctx.restore();
    }

    ctx.save();
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle = useTargets ? C.green : C.red;
    ctx.fillText(
      useTargets
        ? 'DATUM TARGETS ACTIVE: A1, A2, A3 (Ø6) -> REPEATABLE 3-POINT PLANE'
        : 'FULL ROUGH CAST FACE AS DATUM A -> ROCKING & UNREPEATABLE',
      24, 34
    );
    ctx.restore();
  }

  window.DatumDraw = {
    drawDOF3DPlate,
    drawPrecedencePlate,
    drawCommonDatumPlate
  };
})();
