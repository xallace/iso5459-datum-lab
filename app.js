/* ==========================================================================
   3-2-1 DATUM REFERENCE FRAME LAB · Interactive Controller (English Only)
   DIN EN ISO 5459
   ========================================================================== */

(function () {
  'use strict';

  const ISO5459 = window.ISO5459;
  const Draw = window.DatumDraw;
  const $ = (id) => document.getElementById(id);

  const TOUR_STEPS = [
    {
      tab: 'dof',
      action: 'step1',
      title: 'Stop 1 · Primary Datum A Locks 3 Degrees of Freedom',
      body: 'With only Primary Datum A engaged (3 contact pins on the granite plate), vertical translation Tz and tilt Rx, Ry are locked — watch the workpiece still slide freely along X, Y and spin around Z!'
    },
    {
      tab: 'dof',
      action: 'step3',
      title: 'Stop 2 · Complete 3-2-1 Locking (All 6 DOF Constrained)',
      body: 'Adding Secondary Datum B (2 back-rail pins) locks Ty and Rz, and Tertiary Datum C (1 side stop) locks Tx. All 6 degrees of freedom are now rigidly constrained into one repeatable CMM coordinate frame.'
    },
    {
      tab: 'precedence',
      action: 'acb',
      title: 'Stop 3 · Why |A|B|C| and |A|C|B| Flip the Inspection Verdict',
      body: 'Face C has a tiny 0.35° squareness deviation. Under |A|B|C| the hole passes (Ø0.072 ≤ Ø0.200 mm). Swap to |A|C|B| and the entire CMM grid rotates to align with tilted Face C — the exact same part jumps to Ø1.158 mm and FAILS!'
    },
    {
      tab: 'common',
      action: 'commonAB',
      title: 'Stop 4 · Common Datum |A-B| vs. Short Single Datum |A|',
      body: 'A shaft supported by two bearings should NEVER be referenced to a single 30 mm bearing seat |A| alone — a tiny seat tilt amplifies 7.8× at the overhang pinion! Use Common Datum |A-B| to define the real rotation axis.'
    }
  ];

  const state = {
    tab: 'dof',
    // Tab 1: 3D DOF
    dofPreset: 'block321',
    hasA: true,
    hasB: true,
    hasC: true,
    animateFree: true,
    camYaw: -34,
    camPitch: 27,
    phase: 0,
    // Tab 2: Precedence
    prec: {
      skewDeg: 0.35,
      tedX: 95,
      tedY: 55,
      tolPosMm: 0.20,
      order: 'ABC'
    },
    // Tab 3: Common Datum & Targets
    cd: {
      mode: 'shaft', // 'shaft' | 'targets'
      datumMode: 'A-B',
      seatATiltUm: 12,
      seatBOffsetUm: 10,
      overhangOffsetUm: 12,
      useTargets: true
    },
    tourActive: false,
    tourStep: 0
  };

  /* ---------------- TAB 1: 3-2-1 DOF LOCK ---------------- */
  function updateDOFTab() {
    const sol = ISO5459.solveDOF({
      preset: state.dofPreset,
      hasA: state.hasA,
      hasB: state.hasB,
      hasC: state.hasC
    });

    const isFlange = state.dofPreset === 'flange';
    $('lbl-a-title').textContent = 'Primary Datum A · Base Plane (3 Contact Points)';
    $('lbl-a-dof').textContent = 'Locks 3 DOF: Tz, Rx, Ry';
    $('lbl-b-title').textContent = isFlange
      ? 'Secondary Datum B · Central Bore Axis'
      : 'Secondary Datum B · Back Wall (2 Contact Points)';
    $('lbl-b-dof').textContent = isFlange ? 'Locks 2 DOF: Tx, Ty' : 'Locks 2 DOF: Ty, Rz';
    $('lbl-c-title').textContent = isFlange
      ? 'Tertiary Datum C · Clocking Pin / Slot'
      : 'Tertiary Datum C · Side Stop (1 Contact Point)';
    $('lbl-c-dof').textContent = isFlange ? 'Locks 1 DOF: Rz' : 'Locks 1 DOF: Tx';

    $('dof-locked-val').textContent = `${sol.lockedCount} / 6`;
    $('dof-v-locked').className = `verdict-cell ${sol.fullyConstrained ? 'pass' : 'paradox'}`;
    $('dof-locked-sub').textContent = sol.fullyConstrained
      ? 'Fully constrained rigid body'
      : `${sol.freeCount} degrees of freedom still unconstrained`;

    $('dof-free-val').textContent = `${sol.freeCount} FREE`;
    $('dof-v-free').className = `verdict-cell ${sol.freeCount === 0 ? 'pass' : 'fail'}`;
    const freeKeys = Object.entries(sol.dof).filter(([, locked]) => !locked).map(([k]) => k);
    $('dof-free-sub').textContent = freeKeys.length ? `Unlocked: ${freeKeys.join(', ')}` : 'Zero residual rigid-body motion';

    const letters = [state.hasA ? 'A' : null, state.hasB ? 'B' : null, state.hasC ? 'C' : null].filter(Boolean);
    $('dof-frame-val').textContent = letters.length ? `| ${letters.join(' | ')} |` : '(NONE)';
    $('dof-frame-sub').textContent = isFlange ? 'Plane + Cylinder + Clocking Pin' : '3-2-1 Orthogonal Planes';

    // 6-DOF Matrix Cards
    const order = ['Tx', 'Ty', 'Tz', 'Rx', 'Ry', 'Rz'];
    const labels = {
      Tx: 'Slide X', Ty: 'Slide Y', Tz: 'Lift Z',
      Rx: 'Pitch X', Ry: 'Roll Y', Rz: 'Yaw Z'
    };
    $('dof-matrix').innerHTML = order.map(k => {
      const by = sol.lockedBy[k];
      const cls = by ? `locked-${by}` : 'is-free';
      const st = by ? `LOCKED (${by})` : 'FREE';
      return `
        <div class="dof-chip ${cls}">
          <div class="dof-name">${k}</div>
          <span class="dof-state">${st}</span>
          <span style="font-size:0.65rem;color:var(--text-dim); font-family: var(--xt-small);">${labels[k]}</span>
        </div>
      `;
    }).join('');

    Draw.drawDOF3DPlate($('canvas-dof3d'), state, sol, state.phase);
  }

  /* ---------------- TAB 2: |A|B|C| VS |A|C|B| PRECEDENCE ---------------- */
  function updatePrecedenceTab() {
    const sol = ISO5459.solvePrecedence(state.prec);

    $('val-skew').textContent = `${state.prec.skewDeg.toFixed(2)}°`;
    $('val-tedx').textContent = `${state.prec.tedX} mm`;
    $('val-tedy').textContent = `${state.prec.tedY} mm`;
    $('val-tolpos').textContent = `Ø${state.prec.tolPosMm.toFixed(2)} mm`;

    const isACB = state.prec.order === 'ACB';
    $('btn-order-abc').classList.toggle('active', !isACB);
    $('btn-order-abc').classList.toggle('vermilion', !isACB);
    $('btn-order-acb').classList.toggle('active', isACB);
    $('btn-order-acb').classList.toggle('vermilion', isACB);

    $('prec-fcf-display').textContent = isACB
      ? `| ⌖ | Ø${state.prec.tolPosMm.toFixed(2)} | A | C | B |`
      : `| ⌖ | Ø${state.prec.tolPosMm.toFixed(2)} | A | B | C |`;
    $('btn-swap-big').textContent = isACB ? '⇄ Swap to |A|B|C|' : '⇄ Swap to |A|C|B|';
    $('prec-explain').textContent = isACB
      ? `Secondary Datum C contacts tilted Face C at 2 pins, rotating the entire CMM X-axis by ${(-state.prec.skewDeg).toFixed(2)}°. Over the ${state.prec.tedX} mm lever arm, the bore shifts dramatically.`
      : `Secondary Datum B contacts long back Face B at 2 pins, keeping the CMM X-axis horizontal. Tertiary C touches only 1 extreme point, minimizing angular sensitivity.`;

    // Verdicts
    $('prec-v-abc').className = `verdict-cell ${sol.resABC.pass ? 'pass' : 'fail'}`;
    $('prec-abc-val').textContent = sol.resABC.pass ? 'PASS' : 'REJECT';
    $('prec-abc-sub').textContent = `Øe = ${sol.resABC.posDiaErr.toFixed(3)} mm ${sol.resABC.pass ? '≤' : '>'} Ø${sol.tolPosMm.toFixed(2)}`;

    $('prec-v-acb').className = `verdict-cell ${sol.resACB.pass ? 'pass' : 'fail'}`;
    $('prec-acb-val').textContent = sol.resACB.pass ? 'PASS' : 'REJECT';
    $('prec-acb-sub').textContent = `Øe = ${sol.resACB.posDiaErr.toFixed(3)} mm ${sol.resACB.pass ? '≤' : '>'} Ø${sol.tolPosMm.toFixed(2)}`;

    $('prec-v-flip').className = `verdict-cell ${sol.verdictFlips ? 'paradox' : 'info'}`;
    $('prec-flip-val').textContent = sol.verdictFlips ? 'VERDICT FLIPS!' : `Δ = ${sol.deltaPosErrMm.toFixed(3)} mm`;
    $('prec-flip-sub').textContent = sol.verdictFlips
      ? 'Exact same physical part flips PASS ↔ REJECT!'
      : 'Increase α or tighten Øt to trigger a verdict flip';

    const act = sol.active;
    $('prec-telemetry').innerHTML = `
      <tr><th>Active Datum Order</th><td class="tag-blue">| A | ${isACB ? 'C | B' : 'B | C'} |</td></tr>
      <tr><th>CMM Frame Rotation</th><td>${act.frameAngleDeg.toFixed(2)}°</td></tr>
      <tr><th>Measured Center (X, Y)</th><td>(${act.measX.toFixed(3)}, ${act.measY.toFixed(3)}) mm</td></tr>
      <tr><th>Deviation (ΔX, ΔY)</th><td>(${act.devX >= 0 ? '+' : ''}${act.devX.toFixed(3)}, ${act.devY >= 0 ? '+' : ''}${act.devY.toFixed(3)}) mm</td></tr>
      <tr><th>Cylindrical True Position Øe</th><td class="${act.pass ? 'tag-pass' : 'tag-fail'}">Ø${act.posDiaErr.toFixed(3)} mm (${act.pass ? 'PASS' : 'REJECT'})</td></tr>
      <tr><th>Lever Ratio (ABC vs. ACB)</th><td>${sol.leverRatioABC.toFixed(2)}× vs. ${sol.leverRatioACB.toFixed(2)}×</td></tr>
    `;

    Draw.drawPrecedencePlate($('canvas-precedence'), sol);
  }

  /* ---------------- TAB 3: COMMON DATUM |A-B| & TARGETS ---------------- */
  function updateCommonTab() {
    const sol = ISO5459.solveCommonDatum({
      seatATiltUm: state.cd.seatATiltUm,
      seatBOffsetUm: state.cd.seatBOffsetUm,
      overhangOffsetUm: state.cd.overhangOffsetUm,
      datumMode: state.cd.datumMode
    });

    $('val-atilt').textContent = `${state.cd.seatATiltUm} µm`;
    $('val-boff').textContent = `${state.cd.seatBOffsetUm >= 0 ? '+' : ''}${state.cd.seatBOffsetUm} µm`;
    $('val-poff').textContent = `${state.cd.overhangOffsetUm >= 0 ? '+' : ''}${state.cd.overhangOffsetUm} µm`;

    $('cd-single-val').textContent = `${sol.singleA.overhangRunoutUm.toFixed(1)} µm`;
    $('cd-v-single').className = `verdict-cell ${sol.singleA.overhangRunoutUm > 40 ? 'fail' : 'paradox'}`;
    $('cd-common-val').textContent = `${sol.commonAB.overhangRunoutUm.toFixed(1)} µm`;
    $('cd-amp-val').textContent = `${sol.amplificationFactor.toFixed(1)}×`;

    $('cd-telemetry').innerHTML = `
      <tr><th>Gear Journal Runout (|A|)</th><td class="tag-fail">${sol.singleA.gearRunoutUm.toFixed(1)} µm</td></tr>
      <tr><th>Gear Journal Runout (|A-B|)</th><td class="tag-pass">${sol.commonAB.gearRunoutUm.toFixed(1)} µm</td></tr>
      <tr><th>Pinion Overhang Runout (|A|)</th><td class="tag-fail">${sol.singleA.overhangRunoutUm.toFixed(1)} µm</td></tr>
      <tr><th>Pinion Overhang Runout (|A-B|)</th><td class="tag-pass">${sol.commonAB.overhangRunoutUm.toFixed(1)} µm</td></tr>
      <tr><th>Bearing Span L_AB vs Seat L_A</th><td class="tag-blue">${sol.spanAB} mm vs ${sol.seatALen} mm</td></tr>
    `;

    Draw.drawCommonDatumPlate($('canvas-common'), state.cd, sol);
  }

  /* ---------------- TAB 4: ISO 5459 VALIDATOR ---------------- */
  function updateValidator() {
    const p = $('inp-val-p').value;
    const s = $('inp-val-s').value;
    const t = $('inp-val-t').value;
    const res = ISO5459.validateDatumFrame(p, s, t);

    $('val-preview-fcf').textContent = `| ⌖ | Ø0.10 ${res.frameStr}`;
    const box = $('val-result-box');
    if (res.valid) {
      box.className = 'val-result ok';
      box.innerHTML = `<strong>✓ Valid ISO 5459 Datum Reference Frame (${res.frameStr})</strong>` +
        (res.warnings.length ? `<br />Note: ${res.warnings.join(' ')}` : '<br />All datum letters comply with DIN EN ISO 5459 §7.2.2 and precedence syntax.');
    } else {
      box.className = 'val-result err';
      box.innerHTML = `<strong>✕ ISO 5459 Violation Detected:</strong><br />• ${res.issues.join('<br />• ')}`;
    }
  }

  /* ---------------- TABS & GUIDED TOUR ---------------- */
  function setTab(tabName) {
    state.tab = tabName;
    document.querySelectorAll('.tab-btn').forEach(b => {
      const act = b.dataset.tab === tabName;
      b.classList.toggle('active', act);
      b.setAttribute('aria-selected', String(act));
    });
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${tabName}`));
    if (tabName === 'dof') updateDOFTab();
    else if (tabName === 'precedence') updatePrecedenceTab();
    else if (tabName === 'common') updateCommonTab();
    else if (tabName === 'rules') updateValidator();
  }

  function applyStep(n) {
    state.hasA = n >= 1;
    state.hasB = n >= 2;
    state.hasC = n >= 3;
    $('chk-has-a').checked = state.hasA;
    $('chk-has-b').checked = state.hasB;
    $('chk-has-c').checked = state.hasC;
    document.querySelectorAll('[data-step]').forEach(b => b.classList.toggle('active', Number(b.dataset.step) === n));
    updateDOFTab();
  }

  function renderTourStep() {
    const step = TOUR_STEPS[state.tourStep];
    $('tour-step-badge').textContent = `Stop ${state.tourStep + 1} / ${TOUR_STEPS.length}`;
    $('tour-title').textContent = step.title;
    $('tour-body').textContent = step.body;
    $('btn-tour-prev').disabled = state.tourStep === 0;
    $('btn-tour-next').textContent = state.tourStep === TOUR_STEPS.length - 1 ? 'Finish ✓' : 'Next →';

    if (step.tab) setTab(step.tab);
    if (step.action === 'step1') applyStep(1);
    if (step.action === 'step3') applyStep(3);
    if (step.action === 'acb') {
      state.prec.order = 'ACB';
      updatePrecedenceTab();
    }
    if (step.action === 'commonAB') {
      state.cd.mode = 'shaft';
      state.cd.datumMode = 'A-B';
      updateCommonTab();
    }
  }

  /* ---------------- 3D DRAG ORBIT & ANIMATION LOOP ---------------- */
  function bindCanvasOrbit() {
    const cvs = $('canvas-dof3d');
    let dragging = false, lx = 0, ly = 0;
    cvs.addEventListener('pointerdown', e => {
      dragging = true; lx = e.clientX; ly = e.clientY;
      cvs.setPointerCapture(e.pointerId);
    });
    cvs.addEventListener('pointermove', e => {
      if (!dragging) return;
      state.camYaw += (e.clientX - lx) * 0.45;
      state.camPitch = Math.max(8, Math.min(72, state.camPitch + (e.clientY - ly) * 0.35));
      lx = e.clientX; ly = e.clientY;
      updateDOFTab();
    });
    cvs.addEventListener('pointerup', () => { dragging = false; });
    cvs.addEventListener('pointercancel', () => { dragging = false; });
  }

  let lastT = performance.now();
  function animLoop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (state.tab === 'dof' && state.animateFree && !(state.hasA && state.hasB && state.hasC)) {
      state.phase += dt * 2.2;
      updateDOFTab();
    }
    requestAnimationFrame(animLoop);
  }

  /* ---------------- EVENTS ---------------- */
  function bindEvents() {
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

    // Tab 1
    document.querySelectorAll('[data-dofpreset]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-dofpreset]').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        state.dofPreset = btn.dataset.dofpreset;
        updateDOFTab();
      });
    });
    document.querySelectorAll('[data-step]').forEach(btn => {
      btn.addEventListener('click', () => applyStep(Number(btn.dataset.step)));
    });
    ['a', 'b', 'c'].forEach(ch => {
      $(`chk-has-${ch}`).addEventListener('change', e => {
        state[`has${ch.toUpperCase()}`] = e.target.checked;
        document.querySelectorAll('[data-step]').forEach(x => x.classList.remove('active'));
        updateDOFTab();
      });
    });
    $('btn-anim-free').addEventListener('click', () => {
      state.animateFree = !state.animateFree;
      $('btn-anim-free').classList.toggle('active', state.animateFree);
      $('btn-anim-free').textContent = state.animateFree ? '⏸ Animate Free DOF' : '▶ Animate Free DOF';
      updateDOFTab();
    });
    $('btn-reset-cam').addEventListener('click', () => {
      state.camYaw = -34; state.camPitch = 27; updateDOFTab();
    });

    // Tab 2
    const swapOrder = () => {
      state.prec.order = state.prec.order === 'ABC' ? 'ACB' : 'ABC';
      updatePrecedenceTab();
    };
    $('btn-order-abc').addEventListener('click', () => { state.prec.order = 'ABC'; updatePrecedenceTab(); });
    $('btn-order-acb').addEventListener('click', () => { state.prec.order = 'ACB'; updatePrecedenceTab(); });
    $('btn-swap-order').addEventListener('click', swapOrder);
    $('btn-swap-big').addEventListener('click', swapOrder);
    $('sl-skew').addEventListener('input', e => { state.prec.skewDeg = Number(e.target.value); updatePrecedenceTab(); });
    $('sl-tedx').addEventListener('input', e => { state.prec.tedX = Number(e.target.value); updatePrecedenceTab(); });
    $('sl-tedy').addEventListener('input', e => { state.prec.tedY = Number(e.target.value); updatePrecedenceTab(); });
    $('sl-tolpos').addEventListener('input', e => { state.prec.tolPosMm = Number(e.target.value); updatePrecedenceTab(); });

    // Tab 3
    $('btn-cd-shaft').addEventListener('click', () => {
      state.cd.mode = 'shaft';
      $('btn-cd-shaft').classList.add('active', 'vermilion');
      $('btn-cd-targets').classList.remove('active', 'vermilion');
      $('cd-panel-shaft').classList.remove('hidden');
      $('cd-panel-targets').classList.add('hidden');
      $('cd-fig-label').textContent = 'PLATE III · COMMON DATUM |A-B| (DUAL BEARING SHAFT) VS. SINGLE DATUM |A|';
      updateCommonTab();
    });
    $('btn-cd-targets').addEventListener('click', () => {
      state.cd.mode = 'targets';
      $('btn-cd-targets').classList.add('active', 'vermilion');
      $('btn-cd-shaft').classList.remove('active', 'vermilion');
      $('cd-panel-targets').classList.remove('hidden');
      $('cd-panel-shaft').classList.add('hidden');
      $('cd-fig-label').textContent = 'PLATE IIIB · CAST DATUM TARGETS (A1, A2, A3) VS. ROCKING ROUGH CAST FACE';
      updateCommonTab();
    });
    document.querySelectorAll('[data-cdmode]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-cdmode]').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        state.cd.datumMode = btn.dataset.cdmode;
        updateCommonTab();
      });
    });
    document.querySelectorAll('[data-tgt]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-tgt]').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        state.cd.useTargets = btn.dataset.tgt === 'on';
        updateCommonTab();
      });
    });
    $('sl-atilt').addEventListener('input', e => { state.cd.seatATiltUm = Number(e.target.value); updateCommonTab(); });
    $('sl-boff').addEventListener('input', e => { state.cd.seatBOffsetUm = Number(e.target.value); updateCommonTab(); });
    $('sl-poff').addEventListener('input', e => { state.cd.overhangOffsetUm = Number(e.target.value); updateCommonTab(); });

    // Tab 4 Validator
    ['inp-val-p', 'inp-val-s', 'inp-val-t'].forEach(id => $(id).addEventListener('input', updateValidator));
    document.querySelectorAll('[data-valex]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [p, s, t] = btn.dataset.valex.split(',');
        $('inp-val-p').value = p || '';
        $('inp-val-s').value = s || '';
        $('inp-val-t').value = t || '';
        updateValidator();
      });
    });

    // Tour
    $('btn-tour').addEventListener('click', () => {
      state.tourActive = true; state.tourStep = 0;
      $('tour-banner').classList.remove('hidden');
      renderTourStep();
    });
    $('btn-tour-prev').addEventListener('click', () => {
      if (state.tourStep > 0) { state.tourStep--; renderTourStep(); }
    });
    $('btn-tour-next').addEventListener('click', () => {
      if (state.tourStep < TOUR_STEPS.length - 1) { state.tourStep++; renderTourStep(); }
      else { state.tourActive = false; $('tour-banner').classList.add('hidden'); }
    });
    $('btn-tour-close').addEventListener('click', () => {
      state.tourActive = false; $('tour-banner').classList.add('hidden');
    });

    window.addEventListener('resize', () => {
      if (state.tab === 'dof') updateDOFTab();
      else if (state.tab === 'precedence') updatePrecedenceTab();
      else if (state.tab === 'common') updateCommonTab();
    });
  }

  bindEvents();
  bindCanvasOrbit();
  updateDOFTab();
  updateValidator();
  requestAnimationFrame(animLoop);
})();
