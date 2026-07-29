/* game.js — state machine, input, ledger, scoring */
(function () {
  'use strict';
  const A = window.Algebra;
  const $ = s => document.querySelector(s);
  const OPS = { '+': '+', '-': A.MINUS, '*': '×', '/': '/' };
  const MODE_LABEL = { one: '1-STEP', two: '2-STEP', multi: 'MULTI-STEP', endless: 'ENDLESS' };

  // ---- state
  let mode = null;
  let xStar = 0;
  let L = null, R = null;          // {a, b, display} — the working equation sides
  let initial = null;              // {l, r} display of the starting equation
  let steps = [], openStep = null; // ledger step list
  let actSide = null;              // 'l'/'r': side that currently owns the imbalance
  let op = null, digits = '', varFlag = false, negFlag = false; // op-mode input
  let simplifyMode = false, sbuf = '';
  let undoStack = [];              // snapshots for ⌫ undo of applied steps
  let streak = 0;
  let locked = true;
  let showProps = loadShowProps();
  let msgTimer = null;
  let best = loadBest();

  function loadBest() {
    try {
      return Object.assign({ one: 0, two: 0, multi: 0, endless: 0 },
        JSON.parse(localStorage.getItem('eqBalanceBest') || '{}'));
    } catch (e) { return { one: 0, two: 0, multi: 0, endless: 0 }; }
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

  // ---- balance
  function diffVal() {
    return (A.fVal(L.a) * xStar + A.fVal(L.b)) - (A.fVal(R.a) * xStar + A.fVal(R.b));
  }
  // A half-finished move (one side acted on, the other not) is an imbalance even
  // when the values happen to agree — which they always do for the variable terms
  // when x* is 0. openStep is non-null exactly while a move awaits its other half.
  function balanced() { return diffVal() === 0 && !openStep; }
  const TILT = 16; // fixed off-balance angle — balance is binary, not a magnitude
  function updateTilt() {
    if (balanced()) { Character.setTilt(0); return; }
    // Lean toward whichever side received the value-changing action.
    const side = actSide || (diffVal() > 0 ? 'l' : 'r');
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
    if (s.kind === 'simplify') return 'Simplification';
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
        appendCell(el, row, col, cls + ' l' + (step.cancelL ? ' cancel' : ''), '<span class="op">' + step.opL + '</span>');
      }
      if (step.opR != null) {
        const col = step.matchR ? cols.rBase + findMatchSlot(prev.rTerms, step.kindR) : cols.rExtraCol;
        appendCell(el, row, col, cls + ' r' + (step.cancelR ? ' cancel' : ''), '<span class="op">' + step.opR + '</span>');
      }
    } else if (step.op === '*' || step.op === '/') {
      // The applied factor digit is struck too, right alongside whichever
      // term's coefficient it cancels — "2·(x/2)" both 2s go, leaving x.
      const mag = Math.abs(step.factor);
      const fStr = step.factor < 0 ? A.MINUS + mag : String(mag);
      const strikeF = '<span class="cancel">' + fStr + '</span>';
      if (step.opL) {
        const cs = A.renderCancelSide(prev.lTerms, step.op, step.factor);
        const f = cs.anyCancel ? strikeF : fStr;
        const body = step.op === '*' ? f + '(' + cs.html + ')' : frac(cs.html, f);
        appendCell(el, row, spanL(cols), cls + ' l', '<span class="op">' + body + '</span>');
      } else {
        appendCell(el, row, spanL(cols), cls + ' l dim', prev.l);
      }
      if (step.opR) {
        const cs = A.renderCancelSide(prev.rTerms, step.op, step.factor);
        const f = cs.anyCancel ? strikeF : fStr;
        const body = step.op === '*' ? f + '(' + cs.html + ')' : frac(cs.html, f);
        appendCell(el, row, spanR(cols), cls + ' r', '<span class="op">' + body + '</span>');
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
      actSide: actSide
    });
  }
  function undo() {
    if (!undoStack.length) return;
    const s = undoStack.pop();
    L = s.L; R = s.R; steps = s.steps;
    openStep = s.openIdx >= 0 ? steps[s.openIdx] : null;
    actSide = s.actSide;
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
    return !!op && (digits !== '' || varFlag);
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
    else if (digits.length < 3 && !varFlag) digits += d;
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

  // ---- actions
  function applyOpStep(sideKey) {
    if (!op) return warn('Pick an operation first');
    const absStr = digits + (varFlag ? 'x' : '');
    if (!absStr) return warn('Enter a number');
    const mag = digits === '' ? 1 : parseInt(digits, 10);
    if (mag === 0) return warn(op === '+' || op === '-' ? 'Adding 0 changes nothing' : "Can't use zero there");
    if (varFlag && (op === '*' || op === '/')) return warn('Multiply or divide by a constant, not the variable');
    const coef = (negFlag ? -1 : 1) * mag;

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
    if (Math.abs(ns.a.n) > 9999 || Math.abs(ns.b.n) > 9999 || ns.a.d > 999 || ns.b.d > 999) {
      return warn('Whoa — numbers are getting huge!');
    }

    pushUndo();
    S.a = ns.a; S.b = ns.b; S.terms = ns.terms; S.display = ns.display;
    Sound.valid();

    const slot = sideKey === 'l' ? 'opL' : 'opR';
    const matchSlot = sideKey === 'l' ? 'matchL' : 'matchR';
    const kindSlot = sideKey === 'l' ? 'kindL' : 'kindR';
    const cancelSlot = sideKey === 'l' ? 'cancelL' : 'cancelR';
    if (!openStep || openStep[slot] || openStep.op !== op) {
      openStep = {
        kind: 'op', op: op, factor: (op === '*' || op === '/') ? coef : null,
        opL: null, opR: null, matchL: null, matchR: null, kindL: null, kindR: null,
        cancelL: false, cancelR: false,
        result: { l: L.display, r: R.display, lTerms: L.terms, rTerms: R.terms }
      };
      steps.push(openStep);
    }
    const signChar = op === '+' ? '+' : A.MINUS;
    const operandDisp = negFlag ? '(' + A.MINUS + absStr + ')' : absStr;
    openStep[slot] = (op === '+' || op === '-') ? (signChar + ' ' + operandDisp) : String(coef);
    openStep[matchSlot] = matched;
    openStep[kindSlot] = kind;
    openStep[cancelSlot] = canceled;
    openStep.result = { l: L.display, r: R.display, lTerms: L.terms, rTerms: R.terms };

    let completed = false;
    if (openStep.opL != null && openStep.opR != null) { completed = true; openStep = null; }
    actSide = completed ? null : sideKey; // imbalance now belongs to the side just acted on
    if (completed) clearInput(true);
    renderLedger(); updateTilt(); updatePreview();
  }

  function applyRewrite(sideKey) {
    const p = A.parseExpr(sbuf);
    if (!p) return warn('Type an expression like 5x+4');
    const S = sideKey === 'l' ? L : R;
    // A rewrite is faithful only if it names the SAME expression — compare the
    // side's coefficient and constant, not its value at x* (at x* = 0 every
    // coefficient evaluates alike, so a value check would wave a bad rewrite through).
    const wasLevel = balanced();
    const changed = !A.fEq(S.a, p.a) || !A.fEq(S.b, p.b);
    pushUndo();
    S.a = p.a; S.b = p.b; S.terms = p.terms; S.display = p.display;
    openStep = null;
    steps.push({ kind: 'simplify', side: sideKey, result: { l: L.display, r: R.display, lTerms: L.terms, rTerms: R.terms } });
    simplifyMode = false; sbuf = '';
    actSide = (changed || diffVal() !== 0) ? sideKey : null;
    if (wasLevel && changed) warn('Careful — that rewrite changed the value!');
    else { if (wasLevel) setMsg('Nice rewrite ✓', 'good'); Sound.valid(); }
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
    const n = solvedForm();
    if (n === null) return warn('Get it to  x = ▢  first!');
    if (A.fIsInt(n) && n.n === xStar) {
      locked = true;
      streak++;
      if (streak > best[mode]) { best[mode] = streak; saveBest(); }
      updateHud();
      Character.celebrate();
      Sound.win();
      setMsg('BALANCED! +1', 'good');
      setTimeout(() => { locked = false; newEquation(); }, 1000);
    } else {
      Sound.lose();
      gameOver();
    }
  }

  function gameOver() {
    locked = true;
    setMsg('');
    Character.fall(() => {
      $('#goScore').textContent = streak;
      $('#goBest').textContent = best[mode];
      // match the typographic minus the equation itself is drawn with
      $('#goAnswer').textContent = 'x = ' +
        (xStar < 0 ? A.MINUS + Math.abs(xStar) : xStar);
      $('#gameover').classList.remove('hide');
    });
  }

  // ---- rounds / screens
  function newEquation() {
    const eq = A.generate(levelFor());
    xStar = eq.xStar; L = eq.L; R = eq.R;
    initial = { l: L.display, r: R.display, lTerms: L.terms, rTerms: R.terms };
    steps = []; openStep = null; actSide = null;
    undoStack = [];
    clearInput(true);
    Character.reset();
    setMsg('');
    renderLedger(); updateTilt(); updateHud(); updatePreview();
  }

  function updateHud() {
    $('#modeLabel').textContent = mode
      ? MODE_LABEL[mode] + (mode === 'endless' ? ' · LVL ' + levelFor() : '')
      : '';
    $('#streakVal').textContent = streak;
    $('#bestVal').textContent = mode ? best[mode] : 0;
  }

  function showMenu() {
    document.querySelectorAll('#menu [data-mode]').forEach(b => {
      b.querySelector('.best').textContent = 'best ' + best[b.dataset.mode];
    });
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
    $('#btnRetry').addEventListener('click', () => startGame(mode));
    $('#btnGoMenu').addEventListener('click', showMenu);
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
    document.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map = {
        Backspace: 'back', Enter: 'submit',
        '+': '+', '-': '-', '*': '*', '/': '/', x: 'x', s: 'simplify', n: 'sign'
      };
      if (/^[0-9]$/.test(e.key)) { onKey(e.key); e.preventDefault(); }
      else if (map[e.key] !== undefined) { onKey(map[e.key]); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { doApply('l'); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { doApply('r'); e.preventDefault(); }
    });
    setPropToggle();
    setSoundToggle();
    updateHud();
    updatePreview();
    showMenu();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
