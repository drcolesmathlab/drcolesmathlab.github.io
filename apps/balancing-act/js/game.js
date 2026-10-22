/* game.js — state machine, input, ledger, scoring */
(function () {
  'use strict';
  const A = window.Algebra;
  const $ = s => document.querySelector(s);
  const OPS = { '+': '+', '-': A.MINUS, '*': '×', '/': '/' };
  const MODE_LABEL = { one: '1-STEP', two: '2-STEP', multi: 'MULTI-STEP', endless: 'ENDLESS' };
  // Number modes, chosen along the bottom of the menu and remembered. Each has
  // all four step modes above, with its own bests.
  const NUM_LABEL = { integer: 'INTEGER', decimal: 'DECIMAL', fraction: 'FRACTION' };
  const NUMS_KEY = 'mathlab.balancing-act.numbers';

  // ---- state
  let mode = null;
  let nums = loadNums();           // 'integer' / 'decimal' / 'fraction'
  let xStar = null;                // the answer, as a fraction
  let L = null, R = null;          // {a, b, display} — the working equation sides
  let initial = null;              // {l, r} display of the starting equation
  let steps = [], openStep = null; // ledger step list
  let actSide = null;              // 'l'/'r': side that currently owns the imbalance
  let broken = false;              // a SIMPLIFY changed a side's value: tipped for the rest of the round
  let start = null;                // {xStar, L, R}: the round's starting equation, for Retry
  let op = null, digits = '', varFlag = false, negFlag = false; // op-mode input
  let simplifyMode = false, sbuf = '';
  let undoStack = [];              // snapshots for ⌫ undo of applied steps
  let streak = 0;
  let locked = true;
  let showProps = loadShowProps();
  let msgTimer = null;
  let best = loadBest();

  // Integer Mode keeps the original keys (one, two, …), so bests saved before
  // the number modes existed carry over; the others are e.g. 'decimal-two'.
  function bestKey(m, n) { return n === 'integer' ? m : n + '-' + m; }
  function loadBest() {
    const zero = {};
    for (const n in NUM_LABEL) for (const m in MODE_LABEL) zero[bestKey(m, n)] = 0;
    try {
      return Object.assign(zero, JSON.parse(localStorage.getItem('eqBalanceBest') || '{}'));
    } catch (e) { return zero; }
  }
  function loadNums() {
    try { const v = localStorage.getItem(NUMS_KEY); return NUM_LABEL[v] ? v : 'integer'; } catch (e) { return 'integer'; }
  }
  function saveBest() { localStorage.setItem('eqBalanceBest', JSON.stringify(best)); }
  function loadShowProps() {
    try { return localStorage.getItem('eqBalanceShowProps') === '1'; } catch (e) { return false; }
  }

  function levelFor() {
    if (mode === 'one') return 1;
    if (mode === 'two') return 2;
    if (mode === 'multi') return 3;
    return streak < 3 ? 1 : streak < 7 ? 2 : 3; // endless ramp
  }

  // ---- balance (exact: decimals would drift in floating point)
  function diffVal() {
    return A.fSub(A.fAdd(A.fMul(L.a, xStar), L.b), A.fAdd(A.fMul(R.a, xStar), R.b));
  }
  // A half-finished move (one side acted on, the other not) is an imbalance even
  // when the values happen to agree — which they always do for the variable terms
  // when x* is 0. openStep is non-null exactly while a move awaits its other half.
  function balanced() { return A.fIsZero(diffVal()) && !openStep && !broken; }
  const TILT = 16; // fixed off-balance angle — balance is binary, not a magnitude
  function updateTilt() {
    if (balanced()) { Character.setTilt(0); return; }
    // Lean toward whichever side received the value-changing action.
    const side = actSide || (A.fVal(diffVal()) > 0 ? 'l' : 'r');
    Character.setTilt(side === 'l' ? -TILT : TILT); // left acted -> left end dips
  }

  // ---- messages
  function setMsg(text, kind) {
    const el = $('#message');
    el.textContent = text || ' ';
    el.className = kind || '';
    clearTimeout(msgTimer);
    if (text && kind === 'bad') {
      msgTimer = setTimeout(() => { el.textContent = ' '; el.className = ''; }, 2200);
    }
  }
  function warn(t) { setMsg(t, 'bad'); Sound.invalid(); }

  // ---- ledger rendering
  function stepProperty(s) {
    if (s.kind === 'simplify') return s.changed ? 'Invalid' : 'Simplification';
    // A property of equality only holds once the SAME operation has been applied
    // to BOTH sides. If the two sides don't match, the step broke the balance.
    if (s.opL == null || s.opR == null || s.opL !== s.opR) {
      // While it's still the in-progress step, stay blank — the player may yet
      // match the other side. Once it's finalized (a new step began, or it
      // completed unbalanced), call the broken step out as Invalid.
      return s === openStep ? '' : 'Invalid';
    }
    switch (s.op) {
      case '+': return 'Addition Property of Equality';
      case '-': return 'Subtraction Property of Equality';
      // Applying the same factor to both sides is the property of equality; the
      // parentheses distribution is a prerequisite mechanic, not the focus here.
      case '*': return 'Multiplication Property of Equality';
      case '/': return 'Division Property of Equality';
    }
    return '';
  }

  function frac(n, d) {
    return '<span class="frac"><span class="fnum">' + n + '</span><span class="fden">' + d + '</span></span>';
  }

  // ---- ledger columns
  // The whole ledger is ONE css grid so every row (equation lines and
  // operation lines alike) shares the same column tracks — that's what makes
  // an added/subtracted operand line up under the term it targets. Columns,
  // left to right: [L-extra?] L-1..L-maxL [=] R-1..R-maxR [R-extra?].
  // L-extra/R-extra only exist if some step actually needed one (a +/- with
  // no like term on that side); they sit outside the side's own terms —
  // before the left expression, after the right one.
  function computeColumns() {
    let maxL = 1, maxR = 1, extraL = false, extraR = false;
    // A row with an extra-column slot still counts it in kindSlots(terms) —
    // subtract it back out here so it isn't ALSO reserved as a base column;
    // it already has its own dedicated extra column.
    function upd(terms, isL, isExtraRow) {
      const n = kindSlots(terms).length - (isExtraRow ? 1 : 0);
      if (isL) maxL = Math.max(maxL, n); else maxR = Math.max(maxR, n);
    }
    upd(initial.lTerms, true, false); upd(initial.rTerms, false, false);
    for (const s of steps) {
      if (!s.result) continue;
      const eL = s.kind === 'op' && s.matchL === false;
      const eR = s.kind === 'op' && s.matchR === false;
      upd(s.result.lTerms, true, eL); upd(s.result.rTerms, false, eR);
      if (eL) extraL = true;
      if (eR) extraR = true;
    }
    let col = 1;
    const lExtraCol = extraL ? col++ : null;
    const lBase = col; col += maxL;
    const eqCol = col++;
    const rBase = col; col += maxR;
    const rExtraCol = extraR ? col++ : null;
    const parts = [];
    if (extraL) parts.push('auto');
    for (let i = 0; i < maxL; i++) parts.push('auto');
    parts.push('2ch');
    for (let i = 0; i < maxR; i++) parts.push('auto');
    if (extraR) parts.push('auto');
    return { maxL, maxR, lExtraCol, lBase, eqCol, rBase, rExtraCol, template: parts.join(' ') };
  }
  function spanL(cols) { return (cols.lExtraCol || cols.lBase) + ' / ' + (cols.lBase + cols.maxL); }
  function spanR(cols) { return cols.rBase + ' / ' + ((cols.rExtraCol || (cols.rBase + cols.maxR - 1)) + 1); }
  // Groups a side's raw terms by kind (x / n / g), preserving first-seen
  // order. A slot normally holds one raw term, but can hold more than one
  // when duplicates haven't been merged yet — the unsimplified starting
  // equation (e.g. "2x + x + 9"), or a SIMPLIFY rewrite like "3x+2x" that
  // deliberately keeps them apart (see parseExpr). Those duplicates share
  // ONE ledger column instead of each claiming a column of its own that
  // then sits permanently empty in every other row once they do merge —
  // that reserved-but-unused space was what left big gaps before an extra
  // column in longer ledgers.
  function kindSlots(terms) {
    const slots = [];
    const byKind = {};
    terms.forEach(t => {
      if (t.t !== 'g' && t.c.n === 0) return;
      let slot = byKind[t.t];
      if (!slot) { slot = { kind: t.t, raw: [] }; byKind[t.t] = slot; slots.push(slot); }
      slot.raw.push(t);
    });
    return slots;
  }
  function findMatchSlot(terms, kind) {
    const i = kindSlots(terms).findIndex(s => s.kind === kind);
    return i < 0 ? 0 : i;
  }
  function appendCell(el, row, col, cls, html) {
    const span = document.createElement('span');
    span.className = cls;
    span.style.gridRow = row;
    span.style.gridColumn = col;
    span.innerHTML = html;
    el.appendChild(span);
  }

  // nextStep is the step (if any) that acts on THIS row's state — when it's
  // an additive cancel, the term it wipes out is still present here (this is
  // the "before" row), so it's struck through instead of rendered plainly.
  // Renders one side's kind-slots for an equation row. Columns are computed
  // first (solo-group span, extra column, or base+slotIndex), THEN the
  // leftmost cell by actual grid column is found and given the
  // sign-suppressed "first" treatment. extraKind (the kind field off the
  // step that produced this row, e.g. step.kindL) — not array position —
  // identifies which slot is the extra one, since a slot's position in the
  // terms array says nothing about which grid column it lands in once an
  // extra column (which can sit before the base columns, e.g. the left
  // side) is involved.
  function renderSideCells(el, row, terms, extra, extraKind, base, extraCol, span, sideCls, cls, cancel, cancelKind) {
    const slots = kindSlots(terms);
    // A side with no terms at all (every term canceled away, or the
    // generator handed us a bare 0) still needs something in its column —
    // joinTerms already renders '0' for the display string, this is the
    // per-term-cell path's equivalent fallback.
    if (!slots.length) { appendCell(el, row, base, cls + ' ' + sideCls, '0'); return; }
    const placed = slots.map((slot, i) => {
      const isExtra = extra && slot.kind === extraKind;
      // A group that is its side's ONLY slot spans that side's whole column
      // range instead of locking into a single column — otherwise a wide
      // "6(x + 7)" row would force that one column permanently wide, leaving
      // a gap once the group later expands (issue 6) into separate x/n
      // columns.
      const isSoloGroup = slot.kind === 'g' && slots.length === 1;
      const col = isSoloGroup ? span : (isExtra ? extraCol : base + i);
      return { slot, col };
    });
    const colNum = p => typeof p.col === 'number' ? p.col : parseInt(p.col, 10);
    const first = placed.reduce((best, p) => colNum(p) < colNum(best) ? p : best, placed[0]);
    placed.forEach(p => {
      let html = '';
      p.slot.raw.forEach((t, j) => {
        const r = A.renderTermCell(t);
        const isFirst = p === first && j === 0;
        // j>0 means this term is glued onto an earlier one INSIDE the same
        // cell (unmerged duplicate-kind terms sharing a slot) — that needs
        // its own leading space since there's no grid gap between them; a
        // slot's own first raw term never does, whether or not the slot
        // itself is the row's leftmost.
        html += isFirst ? (r.neg ? A.MINUS : '') + r.core
          : (j > 0 ? ' ' : '') + (r.neg ? A.MINUS : '+') + ' ' + r.core;
      });
      const doCancel = cancel && p.slot.kind === cancelKind;
      appendCell(el, row, p.col, cls + ' ' + sideCls + (doCancel ? ' cancel' : ''), html);
    });
  }

  function appendEqRow(el, row, state, current, cols, extraL, extraR, extraKindL, extraKindR, nextStep) {
    const cls = 'cell eq' + (current ? ' current' : '');
    const cancelL = nextStep && nextStep.kind === 'op' && nextStep.cancelL;
    const cancelR = nextStep && nextStep.kind === 'op' && nextStep.cancelR;
    renderSideCells(el, row, state.lTerms, extraL, extraKindL, cols.lBase, cols.lExtraCol, spanL(cols), 'l', cls, cancelL, nextStep && nextStep.kindL);
    appendCell(el, row, cols.eqCol, 'cell eqsign', '=');
    renderSideCells(el, row, state.rTerms, extraR, extraKindR, cols.rBase, cols.rExtraCol, spanR(cols), 'r', cls, cancelR, nextStep && nextStep.kindR);
  }

  // Renders the operation row + its rule/label underneath; returns the next
  // free grid row.
  function appendStepRow(el, row, step, prev, cols) {
    const cls = 'cell work';
    if (step.kind === 'simplify') {
      const mark = '<span class="op">✎</span>';
      if (step.side === 'l') appendCell(el, row, spanL(cols), cls + ' l', mark);
      else appendCell(el, row, spanR(cols), cls + ' r', mark);
    } else if (step.op === '+' || step.op === '-') {
      if (step.opL != null) {
        const col = step.matchL ? cols.lBase + findMatchSlot(prev.lTerms, step.kindL) : cols.lExtraCol;
        appendCell(el, row, col, cls + ' l' + (step.cancelL ? ' cancel' : ''), '<span class="op">' + step.dispL + '</span>');
      }
      if (step.opR != null) {
        const col = step.matchR ? cols.rBase + findMatchSlot(prev.rTerms, step.kindR) : cols.rExtraCol;
        appendCell(el, row, col, cls + ' r' + (step.cancelR ? ' cancel' : ''), '<span class="op">' + step.dispR + '</span>');
      }
    } else if (step.op === '*' || step.op === '/') {
      // The applied factor digit is struck too, right alongside whichever
      // term's coefficient it cancels — "2·(x/2)" both 2s go, leaving x.
      // Each side is drawn with its own factor (fL/fR, as fractions): when the
      // two halves differ, which loses the run, the log shows both.
      const body = (terms, factor) => {
        const cs = A.renderCancelSide(terms, step.op, factor);
        const sign = factor.n < 0 ? A.MINUS : '';
        const f = !cs.anyCancel ? sign + A.numCore(factor)
          : factor.d === 1 ? '<span class="cancel">' + sign + A.numCore(factor) + '</span>'
          : (sign && '<span class="cancel">' + sign + '</span>') + A.numCore(factor, true);
        return step.op === '*' ? f + '(' + cs.html + ')' : frac(cs.html, f);
      };
      if (step.opL) {
        appendCell(el, row, spanL(cols), cls + ' l', '<span class="op">' + body(prev.lTerms, step.fL) + '</span>');
      } else {
        appendCell(el, row, spanL(cols), cls + ' l dim', prev.l);
      }
      if (step.opR) {
        appendCell(el, row, spanR(cols), cls + ' r', '<span class="op">' + body(prev.rTerms, step.fR) + '</span>');
      } else {
        appendCell(el, row, spanR(cols), cls + ' r dim', prev.r);
      }
    }
    const w = document.createElement('div');
    w.className = 'rulewrap';
    w.style.gridRow = row + 1;
    w.style.gridColumn = '1 / -1';
    const label = stepProperty(step);
    const labelCls = 'proplabel' + (showProps ? '' : ' hide') + (label === 'Invalid' ? ' invalid' : '');
    w.innerHTML = '<div class="rule"></div><span class="' + labelCls + '">' + label + '</span>';
    el.appendChild(w);
    return row + 2;
  }

  function renderLedger() {
    const el = $('#ledger');
    // keep the newest step in view, but don't yank the player back down if
    // they've scrolled up to review earlier work.
    const prevTop = el.scrollTop;
    const nearBottom = el.scrollHeight - prevTop - el.clientHeight < 30;
    el.innerHTML = '';
    const cols = computeColumns();
    el.style.gridTemplateColumns = cols.template;

    let row = 1;
    appendEqRow(el, row, initial, steps.length === 0, cols, false, false, null, null, steps[0]);
    row++;
    let prev = initial;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      row = appendStepRow(el, row, s, prev, cols);
      const extraL = s.kind === 'op' && s.matchL === false;
      const extraR = s.kind === 'op' && s.matchR === false;
      appendEqRow(el, row, s.result, i === steps.length - 1, cols, extraL, extraR, s.kindL, s.kindR, steps[i + 1]);
      row++;
      prev = s.result;
    }
    el.scrollTop = nearBottom ? el.scrollHeight : prevTop;
  }

  // ---- undo (snapshot the working state before each applied step)
  const cloneSide = A.cloneSide;
  function cloneStep(s) {
    return Object.assign({}, s, { result: {
      l: s.result.l, r: s.result.r, lTerms: s.result.lTerms, rTerms: s.result.rTerms
    } });
  }
  function pushUndo() {
    undoStack.push({
      L: cloneSide(L), R: cloneSide(R),
      steps: steps.map(cloneStep),
      openIdx: openStep ? steps.indexOf(openStep) : -1,
      actSide: actSide, broken: broken
    });
  }
  function undo() {
    if (!undoStack.length) return;
    const s = undoStack.pop();
    L = s.L; R = s.R; steps = s.steps;
    openStep = s.openIdx >= 0 ? steps[s.openIdx] : null;
    actSide = s.actSide; broken = s.broken;
    clearInput(true);
    renderLedger(); updateTilt(); updatePreview();
  }

  // ---- input
  function clearInput(full) {
    digits = ''; varFlag = false; negFlag = false;
    if (full) { op = null; sbuf = ''; simplifyMode = false; }
    updatePreview();
  }

  function operandValid() {
    if (simplifyMode) return !!A.parseExpr(sbuf);
    return !!op && (digits === '' ? varFlag : !!A.parseNum(digits));
  }

  function updatePreview() {
    const pv = $('#previewText');
    if (simplifyMode) {
      pv.textContent = '✎ ' + (sbuf ? sbuf.replace(/-/g, A.MINUS) : '…');
    } else {
      const operand = (negFlag ? A.MINUS : '') + digits + (varFlag ? 'x' : '');
      pv.textContent = (op ? OPS[op] + ' ' : '') + (operand || '▢');
    }
    document.querySelectorAll('#keypad [data-k]').forEach(b => {
      const k = b.dataset.k;
      if (OPS[k]) b.classList.toggle('sel', !simplifyMode && op === k);
    });
    $('[data-k="sign"]').classList.toggle('on', !simplifyMode && negFlag);
    $('#kSimplify').classList.toggle('on', simplifyMode);
    const ready = operandValid();
    $('#applyL').classList.toggle('ready', ready);
    $('#applyR').classList.toggle('ready', ready);
  }

  function pressDigit(d) {
    if (locked) return;
    if (simplifyMode) { if (sbuf.length < 24) sbuf += d; }
    else if (!varFlag && digitRoom()) digits += d;
    updatePreview();
  }
  // How long a typed number may be: 3 digits in Integer Mode; in Decimal Mode
  // 4 before the point and 3 after; in Fraction Mode 3 above and 3 below.
  function digitRoom() {
    if (nums === 'decimal') {
      const p = digits.split('.');
      return p.length === 1 ? p[0].length < 4 : p[1].length < 3;
    }
    if (nums === 'fraction') return digits.split('/').pop().length < 3;
    return digits.length < 3;
  }
  function pressPoint() {
    if (locked || nums !== 'decimal') return;
    if (simplifyMode) { if (sbuf.length < 24) sbuf += '.'; }
    else if (!varFlag && digits.indexOf('.') < 0) digits += digits ? '.' : '0.';
    updatePreview();
  }
  // The fraction bar: Fraction Mode types a number as numerator/denominator.
  // In a rewrite it works in Decimal Mode too, where a repeating value is
  // shown as a fraction.
  function pressBar() {
    if (locked || nums === 'integer') return;
    if (simplifyMode) { if (sbuf.length < 24) sbuf += '/'; }
    else if (nums === 'fraction' && !varFlag && digits && digits.indexOf('/') < 0) digits += '/';
    updatePreview();
  }
  function pressX() {
    if (locked) return;
    if (simplifyMode) { if (sbuf.length < 24) sbuf += 'x'; }
    else varFlag = !varFlag;
    updatePreview();
  }
  function pressSign() {
    if (locked || simplifyMode) return;
    negFlag = !negFlag;
    updatePreview();
  }
  function pressBack() {
    if (locked) return;
    if (simplifyMode) {
      if (sbuf) sbuf = sbuf.slice(0, -1); else undo();
    } else if (varFlag) varFlag = false;
    else if (digits) digits = digits.slice(0, -1);
    else if (negFlag) negFlag = false;
    else if (op) op = null;
    else undo();
    updatePreview();
  }
  function pressOp(o) {
    if (locked) return;
    if (simplifyMode) {
      if (o === '+' || o === '-') { if (sbuf.length < 24) sbuf += o; }
      else if (o === '/' && nums !== 'integer') { pressBar(); return; }
      else warn('Only + and − inside an expression');
    } else {
      op = o;
    }
    updatePreview();
  }
  function toggleSimplify() {
    if (locked) return;
    simplifyMode = !simplifyMode;
    sbuf = ''; digits = ''; varFlag = false; negFlag = false;
    setMsg(simplifyMode ? 'Rewrite one side, then apply it to that side' : '');
    updatePreview();
  }

  // ---- losing (Math Lab rule, not upstream — tools/vendor-balancing-act.js
  // refuses an upstream game.js without it)
  // Two ways to lose: SUBMIT a wrong x, or take a next step while he's tipped.
  // While a move is half done, the only allowed step is the same operation and
  // amount on the other side; a different amount or operation there loses at
  // once. SIMPLIFY and SUBMIT are steps too. ⌫ undo is not a step: it takes the
  // last one back. The WIPEOUT screen says which rule ended the run.
  const SIDE = { l: 'left', r: 'right' };
  function tippedReason() {
    let why = 'You took a new step before balancing the last one.';
    if (openStep) {
      const done = openStep.opL != null ? 'l' : 'r';
      why += ' The ' + SIDE[done === 'l' ? 'r' : 'l'] + ' side still needed ' +
        openStep[done === 'l' ? 'txtL' : 'txtR'] + '.';
    } else if (broken) {
      why += ' A rewrite had changed the value of one side.';
    }
    return why;
  }
  function lose(reason) {
    Sound.lose();
    gameOver(reason);
  }

  // After a loss, three ways back in. All of them start the streak again from 0.
  // Last Valid Step: undo back to the last point where he stood level.
  function lastValidStep() {
    $('#gameover').classList.add('hide');
    streak = 0; locked = false;
    Character.reset();
    while (!balanced() && undoStack.length) undo();
    if (!balanced()) return retryEquation();
    clearInput(true); setMsg('');
    renderLedger(); updateTilt(); updateHud(); updatePreview();
  }
  // Retry: the same equation from the start.
  function retryEquation() {
    $('#gameover').classList.add('hide');
    streak = 0; locked = false;
    beginRound(start);
  }
  // The WIPEOUT panel sits over the work log, so the work shows through it. When
  // it is taller than the work log (small phones) it grows and slides up to stay
  // on screen.
  function placeGameOver() {
    const o = $('#gameover');
    if (o.classList.contains('hide')) return;
    const r = $('#ledgerWrap').getBoundingClientRect();
    o.style.left = (r.left + scrollX) + 'px';
    o.style.width = r.width + 'px';
    o.style.minHeight = r.height + 'px';
    const below = r.top + o.offsetHeight - innerHeight;
    o.style.top = (Math.max(0, below > 0 ? r.top - below : r.top) + scrollY) + 'px';
  }

  // ---- actions
  function applyOpStep(sideKey) {
    if (!op) return warn('Pick an operation first');
    if (digits === '' && !varFlag) return warn('Enter a number');
    const mag = digits === '' ? A.fInt(1) : A.parseNum(digits);
    if (!mag) return warn('Finish the number first');
    if (A.fIsZero(mag)) return warn(op === '+' || op === '-' ? 'Adding 0 changes nothing' : "Can't use zero there");
    if (varFlag && (op === '*' || op === '/')) return warn('Multiply or divide by a constant, not the variable');
    const coef = negFlag ? A.frac(-mag.n, mag.d) : mag;   // a fraction

    const S = sideKey === 'l' ? L : R;
    const kind = varFlag ? 'x' : 'n';
    // Whether this +/- lands on an EXISTING term of the same kind (aligns
    // under it) or is genuinely new (gets its own outer column) — decided
    // against the side's state BEFORE this operation touches it.
    const matched = (op === '+' || op === '-') ? S.terms.some(t => t.t === kind) : null;
    // opSide preserves the side's structure (factored groups, un-combined
    // terms) — only the part the player actually operated on changes.
    const ns = A.opSide(S, op, coef, varFlag);
    // Full additive cancellation: there WAS a term of this kind, and after
    // the operation there is none — it summed to exactly zero rather than
    // just changing value.
    const canceled = matched === true && !ns.terms.some(t => t.t === kind);
    const big = nums === 'integer' ? [9999, 999] : [99999, 9999];
    if (Math.abs(ns.a.n) > big[0] || Math.abs(ns.b.n) > big[0] || ns.a.d > big[1] || ns.b.d > big[1]) {
      return warn('Whoa — numbers are getting huge!');
    }

    // A step's opL/opR is its key: the operation and the exact value, so .5
    // and 0.50 typed on the two sides are the same step. disp is the ledger's
    // markup for a +/- operand, txt the plain words for the WIPEOUT reason.
    const slot = sideKey === 'l' ? 'opL' : 'opR';
    const additive = op === '+' || op === '-';
    const val = op + ' ' + kind + ' ' + coef.n + '/' + coef.d;
    const wrap = s => negFlag ? '(' + A.MINUS + s + ')' : s;
    const unitX = varFlag && A.fEq(mag, A.fInt(1));
    const absTxt = (unitX ? '' : A.numText(mag)) + (varFlag ? 'x' : '');
    const disp = additive
      ? (op === '+' ? '+' : A.MINUS) + ' ' + wrap(A.renderTermCell({ t: kind, c: mag }).core) : null;
    const txt = (additive ? (op === '+' ? '+ ' : A.MINUS + ' ') : (op === '*' ? '× ' : '÷ ')) + wrap(absTxt);
    // Answering the open move on its other side: it has to be the same step.
    let mismatch = null;
    if (openStep && !openStep[slot]) {
      const done = slot === 'opL' ? 'opR' : 'opL';
      if (openStep.op !== op || openStep[done] !== val) {
        const other = sideKey === 'l' ? 'r' : 'l';
        mismatch = 'The ' + SIDE[other] + ' side got ' + openStep[other === 'l' ? 'txtL' : 'txtR'] +
          ', but the ' + SIDE[sideKey] + ' side got ' + txt + '.';
      }
    } else if (!balanced()) {
      return lose(tippedReason());
    }

    pushUndo();
    S.a = ns.a; S.b = ns.b; S.terms = ns.terms; S.display = ns.display;
    Sound.valid();

    const matchSlot = sideKey === 'l' ? 'matchL' : 'matchR';
    const kindSlot = sideKey === 'l' ? 'kindL' : 'kindR';
    const cancelSlot = sideKey === 'l' ? 'cancelL' : 'cancelR';
    if (!openStep || openStep[slot] || openStep.op !== op) {
      openStep = {
        kind: 'op', op: op, factor: additive ? null : coef,
        opL: null, opR: null, dispL: null, dispR: null, txtL: null, txtR: null, fL: null, fR: null,
        matchL: null, matchR: null, kindL: null, kindR: null,
        cancelL: false, cancelR: false,
        result: { l: L.display, r: R.display, lTerms: L.terms, rTerms: R.terms }
      };
      steps.push(openStep);
    }
    openStep[slot] = val;
    openStep[sideKey === 'l' ? 'dispL' : 'dispR'] = disp;
    openStep[sideKey === 'l' ? 'txtL' : 'txtR'] = txt;
    openStep[sideKey === 'l' ? 'fL' : 'fR'] = coef;
    openStep[matchSlot] = matched;
    openStep[kindSlot] = kind;
    openStep[cancelSlot] = canceled;
    openStep.result = { l: L.display, r: R.display, lTerms: L.terms, rTerms: R.terms };

    let completed = false;
    if (openStep.opL != null && openStep.opR != null) { completed = true; openStep = null; }
    actSide = completed ? null : sideKey; // imbalance now belongs to the side just acted on
    if (completed) clearInput(true);
    renderLedger(); updateTilt(); updatePreview();
    if (mismatch) lose(mismatch);   // after drawing it, so the mismatched step shows
  }

  function applyRewrite(sideKey) {
    const p = A.parseExpr(sbuf);
    if (!p) return warn('Type an expression like 5x+4');
    if (!balanced()) return lose(tippedReason());
    const S = sideKey === 'l' ? L : R;
    // A rewrite is faithful only if it names the SAME expression — compare the
    // side's coefficient and constant, not its value at x* (at x* = 0 every
    // coefficient evaluates alike, so a value check would wave a bad rewrite through).
    // An unfaithful one tips him, and the next step then loses.
    const changed = !A.fEq(S.a, p.a) || !A.fEq(S.b, p.b);
    pushUndo();
    S.a = p.a; S.b = p.b; S.terms = p.terms; S.display = p.display;
    steps.push({ kind: 'simplify', side: sideKey, changed: changed, result: { l: L.display, r: R.display, lTerms: L.terms, rTerms: R.terms } });
    simplifyMode = false; sbuf = '';
    broken = changed;
    actSide = changed ? sideKey : null;
    if (changed) warn('Careful — that rewrite changed the value!');
    else { setMsg('Nice rewrite ✓', 'good'); Sound.valid(); }
    renderLedger(); updateTilt(); updatePreview();
  }

  function doApply(sideKey) {
    if (locked || !mode) return;
    setMsg('');   // clear any leftover feedback so it can't linger past this step
    if (simplifyMode) applyRewrite(sideKey);
    else applyOpStep(sideKey);
  }

  // The equation must be literally simplified to x = n (or n = x): one side is
  // the single term x (coefficient 1, nothing else) and the other a single
  // constant. Checking the term STRUCTURE — not the derived a/b totals — means
  // a side that merely nets to 1·x (e.g. 2x − x) is not yet accepted as solved;
  // the player has to combine it first.
  function isBareX(S) {
    return S.terms.length === 1 && S.terms[0].t === 'x' && A.fEq(S.terms[0].c, A.fInt(1));
  }
  // the side's constant if it's a single number (or an empty side ⇒ 0), else null
  function bareConst(S) {
    if (S.terms.length === 0) return A.fInt(0);
    if (S.terms.length === 1 && S.terms[0].t === 'n') return S.terms[0].c;
    return null;
  }
  function solvedForm() {
    const lx = isBareX(L), rx = isBareX(R);
    if (lx && !rx) return bareConst(R);
    if (rx && !lx) return bareConst(L);
    return null;
  }

  function doSubmit() {
    if (locked || !mode) return;
    if (!balanced()) return lose(tippedReason());
    const n = solvedForm();
    if (n === null) return warn('Get it to  x = ▢  first!');
    if (A.fEq(n, xStar)) {
      locked = true;
      streak++;
      if (streak > best[bestKey(mode, nums)]) { best[bestKey(mode, nums)] = streak; saveBest(); }
      updateHud();
      Character.celebrate();
      Sound.win();
      setMsg('BALANCED! +1', 'good');
      setTimeout(() => { locked = false; newEquation(); }, 1000);
    } else {
      lose('x = ' + A.numText(n) + ' does not solve it.');
    }
  }

  function gameOver(reason) {
    locked = true;
    setMsg('');
    Character.fall(() => {
      $('#goReason').textContent = reason;
      $('#goScore').textContent = streak;
      $('#goBest').textContent = best[bestKey(mode, nums)];
      // match the typographic minus the equation itself is drawn with; a
      // repeating answer is given as a fraction, never rounded
      $('#goAnswer').textContent = 'x = ' + A.numText(xStar);
      $('#gameover').classList.remove('hide');
      placeGameOver();
    });
  }

  // ---- rounds / screens
  function newEquation() {
    beginRound(A.generate(levelFor()));
  }
  function beginRound(eq) {
    start = { xStar: eq.xStar, L: A.cloneSide(eq.L), R: A.cloneSide(eq.R) };
    xStar = eq.xStar; L = A.cloneSide(eq.L); R = A.cloneSide(eq.R);
    initial = { l: L.display, r: R.display, lTerms: L.terms, rTerms: R.terms };
    steps = []; openStep = null; actSide = null; broken = false;
    undoStack = [];
    clearInput(true);
    Character.reset();
    setMsg('');
    renderLedger(); updateTilt(); updateHud(); updatePreview();
  }

  function updateHud() {
    // each part unbroken, so on a phone the label wraps between parts only
    const parts = mode ? [NUM_LABEL[nums], MODE_LABEL[mode]].concat(mode === 'endless' ? ['LVL ' + levelFor()] : []) : [];
    $('#modeLabel').innerHTML = parts.map((p, i) => '<span>' + p + (i < parts.length - 1 ? ' ·' : '') + '</span>').join(' ');
    $('#streakVal').textContent = streak;
    $('#bestVal').textContent = mode ? best[bestKey(mode, nums)] : 0;
  }

  function showBests() {
    document.querySelectorAll('#menu [data-mode]').forEach(b => {
      b.querySelector('.best').textContent = 'best ' + best[bestKey(b.dataset.mode, nums)];
    });
  }
  // Pick a number mode: the menu's bests, its pro tip, and the keypad's
  // decimal point or fraction bar key follow it.
  function setNums(n, remember) {
    nums = n;
    A.setNumbers(n);
    if (remember) { try { localStorage.setItem(NUMS_KEY, n); } catch (e) {} }
    document.querySelectorAll('#menu [data-nums]').forEach(b => b.classList.toggle('on', b.dataset.nums === n));
    $('#proTip').classList.toggle('hide', n !== 'fraction');
    $('#kPoint').classList.toggle('hide', n !== 'decimal');
    $('#kBar').classList.toggle('hide', n !== 'fraction');
    $('#keypad').classList.toggle('with-pt', n !== 'integer');
    showBests();
  }

  function showMenu() {
    showBests();
    $('#menu').classList.remove('hide');
    $('#gameover').classList.add('hide');
    locked = true;
  }

  function startGame(m) {
    mode = m;
    streak = 0;
    locked = false;
    $('#menu').classList.add('hide');
    $('#gameover').classList.add('hide');
    newEquation();
  }

  function setPropToggle() {
    const b = $('#propToggle');
    b.classList.toggle('on', showProps);
    b.textContent = showProps ? 'Hide Property' : 'Show Property';
  }

  function setSoundToggle() {
    const on = Sound.isEnabled();
    const b = $('#soundToggle');
    b.classList.toggle('on', on);
    b.textContent = on ? '♪ ON' : '♪ OFF';
  }

  // ---- wiring
  function onKey(k) {
    if (k === 'submit') { doSubmit(); return; }
    if (!locked) Sound.click();
    if (/^[0-9]$/.test(k)) pressDigit(k);
    else if (k === 'x') pressX();
    else if (k === 'back') pressBack();
    else if (k === 'sign') pressSign();
    else if (OPS[k]) pressOp(k);
    else if (k === 'simplify') toggleSimplify();
    else if (k === 'pt') pressPoint();
    else if (k === 'bar') pressBar();
  }

  function init() {
    Character.init();
    $('#keypad').addEventListener('click', e => {
      const b = e.target.closest('[data-k]');
      if (b) onKey(b.dataset.k);
    });
    $('#applyL').addEventListener('click', () => doApply('l'));
    $('#applyR').addEventListener('click', () => doApply('r'));
    $('#btnMenu').addEventListener('click', showMenu);
    $('#btnLastValid').addEventListener('click', lastValidStep);
    $('#btnRetry').addEventListener('click', retryEquation);
    $('#btnNewGame').addEventListener('click', () => startGame(mode));
    window.addEventListener('resize', placeGameOver);
    $('#propToggle').addEventListener('click', () => {
      showProps = !showProps;
      try { localStorage.setItem('eqBalanceShowProps', showProps ? '1' : '0'); } catch (e) {}
      setPropToggle();
      renderLedger();
    });
    $('#soundToggle').addEventListener('click', () => {
      const on = Sound.toggle();
      setSoundToggle();
      if (on) Sound.click();   // confirm audibly when turning sound on
    });
    document.querySelectorAll('#menu [data-mode]').forEach(b => {
      b.addEventListener('click', () => startGame(b.dataset.mode));
    });
    document.querySelectorAll('#menu [data-nums]').forEach(b => {
      b.addEventListener('click', () => setNums(b.dataset.nums, true));
    });
    document.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map = {
        Backspace: 'back', Enter: 'submit',
        '+': '+', '-': '-', '*': '*', '/': '/', x: 'x', s: 'simplify', n: 'sign', '.': 'pt'
      };
      // In Fraction Mode, / right after a typed number is its fraction bar.
      const bar = e.key === '/' && nums === 'fraction' && !simplifyMode && op && digits &&
        digits.indexOf('/') < 0 && !varFlag;
      if (/^[0-9]$/.test(e.key)) { onKey(e.key); e.preventDefault(); }
      else if (bar) { onKey('bar'); e.preventDefault(); }
      else if (map[e.key] !== undefined) { onKey(map[e.key]); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { doApply('l'); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { doApply('r'); e.preventDefault(); }
    });
    setPropToggle();
    setSoundToggle();
    setNums(nums, false);
    updateHud();
    updatePreview();
    showMenu();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
