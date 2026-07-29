/* algebra.js — fractions, structured side model, rendering, parsing, generator */
(function () {
  'use strict';

  // ---------- fractions ----------
  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = a % b; a = b; b = t; }
    return a || 1;
  }
  function frac(n, d) {
    if (d === undefined) d = 1;
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
  }
  const fInt = n => frac(n, 1);
  const fAdd = (x, y) => frac(x.n * y.d + y.n * x.d, x.d * y.d);
  const fSub = (x, y) => frac(x.n * y.d - y.n * x.d, x.d * y.d);
  const fMul = (x, y) => frac(x.n * y.n, x.d * y.d);
  const fDiv = (x, y) => frac(x.n * y.d, x.d * y.n);
  const fEq = (x, y) => x.n === y.n && x.d === y.d;
  const fIsInt = x => x.d === 1;
  const fIsZero = x => x.n === 0;
  const fVal = x => x.n / x.d;

  // ---------- rendering ----------
  const MINUS = '−';

  // vertical fraction markup (numerator stacked over denominator with a
  // horizontal bar) — matches the .frac/.fnum/.fden CSS used elsewhere.
  function fracHTML(num, den) {
    return '<span class="frac"><span class="fnum">' + num + '</span>' +
      '<span class="fden">' + den + '</span></span>';
  }

  // coefficient term for x: handles 1, -1, fractions like 1/3 -> x over 3
  function xTerm(a) {
    const n = Math.abs(a.n), d = a.d;
    const xt = (n === 1 ? 'x' : n + 'x');
    const core = d === 1 ? xt : fracHTML(xt, String(d));
    return { neg: a.n < 0, core };
  }
  function numTerm(b) {
    const n = Math.abs(b.n);
    return { neg: b.n < 0, core: b.d === 1 ? String(n) : fracHTML(String(n), String(b.d)) };
  }
  // a factored group term: c(x + m), preserved verbatim through operations
  function groupTerm(t) {
    const cAbs = { n: Math.abs(t.c.n), d: t.c.d };
    let coefStr;
    if (cAbs.n === cAbs.d) coefStr = '';                    // |c| === 1
    else if (cAbs.d === 1) coefStr = String(cAbs.n);
    else coefStr = fracHTML(String(cAbs.n), String(cAbs.d));
    return { neg: t.c.n < 0, core: coefStr + '(' + renderSide(fInt(1), t.m) + ')' };
  }
  function joinTerms(parts) {
    if (!parts.length) return '0';
    let s = (parts[0].neg ? MINUS : '') + parts[0].core;
    for (let i = 1; i < parts.length; i++) {
      s += (parts[i].neg ? ' ' + MINUS + ' ' : ' + ') + parts[i].core;
    }
    return s;
  }
  // canonical display of a*x + b (also used for a group's inner "x + m")
  function renderSide(a, b) {
    const parts = [];
    if (a.n !== 0) parts.push(xTerm(a));
    if (b.n !== 0) parts.push(numTerm(b));
    return joinTerms(parts);
  }

  // ---------- structured side model ----------
  // A side is an ordered list of terms; each is one of:
  //   { t: 'x', c }      -> c·x
  //   { t: 'n', c }      -> constant c
  //   { t: 'g', c, m }   -> c·(x + m), rendered factored
  // Totals a (x-coefficient) and b (constant) are derived for the balance math,
  // but the term list is the source of truth for what is shown — so operations
  // never silently distribute or combine what the player didn't ask them to.
  function abFromTerms(terms) {
    let a = fInt(0), b = fInt(0);
    for (const t of terms) {
      if (t.t === 'x') a = fAdd(a, t.c);
      else if (t.t === 'n') b = fAdd(b, t.c);
      else { a = fAdd(a, t.c); b = fAdd(b, fMul(t.c, t.m)); }
    }
    return { a, b };
  }
  // render a single term to {neg, core} — the per-term building block the
  // ledger uses to lay out each term in its own aligned grid column.
  function renderTermCell(t) {
    if (t.t === 'x') return xTerm(t.c);
    if (t.t === 'n') return numTerm(t.c);
    return groupTerm(t);
  }
  function renderTerms(terms) {
    const parts = [];
    for (const t of terms) {
      if (t.t === 'x') { if (t.c.n !== 0) parts.push(xTerm(t.c)); }
      else if (t.t === 'n') { if (t.c.n !== 0) parts.push(numTerm(t.c)); }
      else parts.push(groupTerm(t));
    }
    return joinTerms(parts);
  }
  // Whether ×/÷-ing term t by coef exactly reduces its coefficient magnitude
  // to 1, e.g. (x/2)·2 -> x, or 2x÷2 -> x. Fractions are always stored in
  // lowest terms, so this is only possible when the "other half" of the
  // reduction is already a unit — |n|=1 with d=coef (·), or d=1 with |n|=coef
  // (÷) — which is what makes the cancelling glyph unambiguous to point at.
  // Constants are excluded: unlike x/g terms there's no bare glyph left
  // behind to show (6÷6 becomes the digit 1, not an identity), so there's
  // nothing sensible to strike through.
  function cancelsToUnit(t, op, coef) {
    if (t.t !== 'x' && t.t !== 'g') return false;
    const k = Math.abs(coef);
    if (op === '*') return Math.abs(t.c.n) === 1 && t.c.d === k;
    if (op === '/') return t.c.d === 1 && Math.abs(t.c.n) === k;
    return false;
  }
  // render a cancelling x/g term with the vanishing coefficient digit(s)
  // wrapped in a struck-through span, leaving the bare variable/group visible.
  function renderTermCellCancel(t, op) {
    const strike = s => '<span class="cancel">' + s + '</span>';
    if (t.t === 'x') {
      const core = op === '*'
        ? (t.c.d === 1 ? 'x' : fracHTML('x', strike(t.c.d)))
        : strike(Math.abs(t.c.n)) + 'x';
      return { neg: t.c.n < 0, core };
    }
    const inner = renderSide(fInt(1), t.m);
    const coefStr = op === '*'
      ? (t.c.d === 1 ? '' : fracHTML('1', strike(t.c.d)))
      : strike(Math.abs(t.c.n));
    return { neg: t.c.n < 0, core: coefStr + '(' + inner + ')' };
  }
  // render a whole side for a ×/÷ step, marking any term that exactly
  // cancels to identity — the per-term building block behind the struck-
  // through "2·(x/2) -> x" display for that operation.
  function renderCancelSide(terms, op, coef) {
    const parts = [];
    let anyCancel = false;
    for (const t of terms) {
      if (t.t !== 'g' && t.c.n === 0) continue;
      if (cancelsToUnit(t, op, coef)) { anyCancel = true; parts.push(renderTermCellCancel(t, op)); }
      else parts.push(renderTermCell(t));
    }
    return { html: joinTerms(parts), anyCancel };
  }
  // A group with outer coefficient +1 is redundant grouping — 1·(x + m) is just
  // x + m, with nothing to distribute — so drop the parentheses, expanding it
  // into the loose terms x and m. A coefficient of −1 is NOT dropped: the
  // leading minus still has to be distributed to each term, −(x + 2) -> −x − 2,
  // and that is the player's step to make. (The generator never emits |c| < 2,
  // so this only fires after the player scales a group down, e.g. 3(x+2) ÷ 3.)
  function expandUnitGroups(terms) {
    const out = [];
    for (const t of terms) {
      if (t.t === 'g' && t.c.n === 1 && t.c.d === 1) {
        out.push({ t: 'x', c: t.c });
        const cm = fMul(t.c, t.m);
        if (cm.n !== 0) out.push({ t: 'n', c: cm });
      } else out.push(t);
    }
    return out;
  }
  function finalizeSide(terms) {
    terms = expandUnitGroups(terms);
    const ab = abFromTerms(terms);
    return { a: ab.a, b: ab.b, terms, display: renderTerms(terms) };
  }
  function cloneTerms(terms) {
    return terms.map(t => t.t === 'g'
      ? { t: 'g', c: { n: t.c.n, d: t.c.d }, m: { n: t.m.n, d: t.m.d } }
      : { t: t.t, c: { n: t.c.n, d: t.c.d } });
  }
  function cloneSide(S) {
    return { a: { n: S.a.n, d: S.a.d }, b: { n: S.b.n, d: S.b.d }, terms: cloneTerms(S.terms), display: S.display };
  }
  // build a plain canonical side a*x + b
  function sideAB(a, b) {
    if (typeof a === 'number') a = fInt(a);
    if (typeof b === 'number') b = fInt(b);
    const terms = [];
    if (a.n !== 0) terms.push({ t: 'x', c: a });
    if (b.n !== 0) terms.push({ t: 'n', c: b });
    return finalizeSide(terms);
  }
  function sideTerms(terms) { return finalizeSide(cloneTerms(terms)); }

  // merge every loose term of one kind ('x' or 'n') into a single term,
  // dropping it if it cancels to zero. Group terms are never merged.
  function mergeKind(terms, kind) {
    const out = [];
    let idx = -1;
    for (const t of terms) {
      if (t.t === kind) {
        if (idx < 0) { idx = out.length; out.push({ t: kind, c: t.c }); }
        else out[idx].c = fAdd(out[idx].c, t.c);
      } else out.push(t);
    }
    if (idx >= 0 && out[idx].c.n === 0) out.splice(idx, 1);
    return out;
  }
  function scaleTerms(terms, k) {
    return terms.map(t => t.t === 'g'
      ? { t: 'g', c: fMul(t.c, k), m: t.m }
      : { t: t.t, c: fMul(t.c, k) });
  }
  // apply one operation to a side, returning a new finalized side.
  // +/- only touch the loose term of the matching kind; ×/÷ scale every term's
  // coefficient (a group stays factored, e.g. 3(x+2) ÷ 3 -> (x+2)).
  function opSide(S, op, coef, varFlag) {
    let terms = cloneTerms(S.terms);
    const k = fInt(coef);
    if (op === '+' || op === '-') {
      const signed = op === '+' ? k : fInt(-coef);
      terms.push(varFlag ? { t: 'x', c: signed } : { t: 'n', c: signed });
      terms = mergeKind(terms, varFlag ? 'x' : 'n');
    } else if (op === '*') {
      terms = scaleTerms(terms, k);
    } else { // '/'
      terms = scaleTerms(terms, fDiv(fInt(1), k));
    }
    return finalizeSide(terms);
  }

  // ---------- expression parsing (for SIMPLIFY input) ----------
  // input uses ASCII: digits, 'x', '+', '-'. Returns a finalized side or null.
  // Each typed chunk becomes its own term, so the player's rewrite is shown
  // exactly as entered (e.g. "3x+2x" stays "3x + 2x").
  function parseExpr(str) {
    if (!str || !/^[0-9x+\-]+$/.test(str)) return null;
    const chunks = str.match(/[+-]?[^+-]+/g);
    if (!chunks || chunks.length > 6) return null;
    if (chunks.join('') !== str) return null; // stray "+-" etc.
    const terms = [];
    for (const ch of chunks) {
      const m = ch.match(/^([+-]?)(\d*)(x?)$/);
      if (!m) return null;
      const sign = m[1] === '-' ? -1 : 1;
      const ds = m[2], hasX = m[3] === 'x';
      if (!ds && !hasX) return null;
      const mag = ds ? parseInt(ds, 10) : 1;
      if (mag > 9999) return null;
      const coef = fInt(sign * mag);
      terms.push(hasX ? { t: 'x', c: coef } : { t: 'n', c: coef });
    }
    return finalizeSide(terms);
  }

  // ---------- equation generator ----------
  function ri(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function pick(arr) { return arr[ri(0, arr.length - 1)]; }
  // randomly flip a coefficient's sign so problems present negative
  // x-coefficients (which the player must undo by multiplying/dividing by a negative)
  function maybeNeg(p) { return Math.random() < (p === undefined ? 0.35 : p) ? -1 : 1; }

  const side = sideAB;                                     // plain a*x + b
  const xt = k => ({ t: 'x', c: fInt(k) });
  const nt = k => ({ t: 'n', c: fInt(k) });
  const gt = (k, m) => ({ t: 'g', c: fInt(k), m: fInt(m) });

  // Each round commits to a solution class up front (1 positive, 0 zero,
  // -1 negative) so every branch of the generator agrees on the sign of x*.
  // Level 1 keeps the SOLUTION x* nonnegative so it always meets CCSS 6.EE.B.7
  // (the standard 1-STEP drills, restricted to nonnegative numbers). A negative
  // coefficient may still appear (see maybeNeg) — that only exceeds the standard,
  // it never fails it, and nonnegative coefficients remain the large majority.
  function pickClass(level) {
    const r = Math.random();
    if (level <= 1) return r < 0.15 ? 0 : 1;
    return r < 0.15 ? 0 : r < 0.40 ? -1 : 1;
  }
  // a magnitude in [lo, hi] carrying the round's sign class
  const sx = (s, lo, hi) => (s === 0 ? 0 : s * ri(lo, hi));

  // Which side(s) carry the expression that needs player-driven simplification
  // (combining like terms, or distributing a factored group) — weighted so a
  // single side is more common than needing to simplify both at once.
  function pickPlacement() {
    const r = Math.random();
    return r < 0.4 ? 'L' : r < 0.8 ? 'R' : 'both';
  }
  // term list for two x-terms (plus an optional constant) that combine to
  // p+q · x + b, in a random left-to-right order — what SIMPLIFY must collapse.
  function combineTerms(p, q, b) {
    const xs = [xt(p), xt(q)];
    if (b === 0) return Math.random() < 0.5 ? xs : [xs[1], xs[0]];
    const bt = nt(b);
    return pick([[xs[0], xs[1], bt], [xs[0], bt, xs[1]]]);
  }

  function gen1(s) {
    const v = ri(0, 3);
    let L, R, x;
    if (v === 0) {           // x + b = c
      x = sx(s, 1, 12); const b = ri(1, 12);
      L = side(1, b); R = side(0, x + b);
    } else if (v === 1) {    // x - b = c
      const b = ri(1, 10); x = sx(s, 1, 12);
      L = side(1, -b); R = side(0, x - b);
    } else if (v === 2) {    // a x = c  (a may be negative -> divide by a negative)
      const a = maybeNeg() * ri(2, 9); x = sx(s, 2, 9);
      L = side(a, 0); R = side(0, a * x);
    } else {                 // x / a = c
      const a = ri(2, 6); const c = sx(s, 2, 9); x = a * c;
      L = side(frac(1, a), fInt(0)); R = side(0, c);
    }
    return { xStar: x, L, R };
  }

  function gen2(s) {
    const v = ri(0, 3);
    let L, R, x;
    if (v === 0) {           // a x + b = c
      const a = maybeNeg() * ri(2, 9); x = sx(s, 1, 9); const b = ri(1, 12);
      L = side(a, b); R = side(0, a * x + b);
    } else if (v === 1) {    // a x - b = c
      const a = maybeNeg() * ri(2, 9); x = sx(s, 2, 9); const b = ri(1, 9);
      L = side(a, -b); R = side(0, a * x - b);
    } else if (v === 2) {    // x/a + b = c
      const a = ri(2, 5); const m = sx(s, 2, 8); x = a * m; const b = ri(1, 9);
      L = side(frac(1, a), fInt(b)); R = side(0, m + b);
    } else {                 // x/a - b = c
      const a = ri(2, 5); const m = sx(s, 2, 9); x = a * m; const b = ri(1, 9);
      L = side(frac(1, a), fInt(-b)); R = side(0, m - b);
    }
    return { xStar: x, L, R };
  }

  function gen3(s) {
    const v = ri(0, 3);
    let L, R, x;
    if (v === 0) {           // combine like terms: p x + q x + b = c
      x = sx(s, 1, 9);
      const where = pickPlacement();
      if (where === 'both') {
        const p1 = ri(2, 5), q1 = ri(1, 4), b1 = ri(1, 9), a1 = p1 + q1;
        let p2, q2, a2, b2, tries = 0;
        do {
          p2 = ri(2, 5); q2 = ri(1, 4); a2 = p2 + q2;
          b2 = b1 + (a1 - a2) * x; // solves R(x*) = L(x*) for this side's constant
          tries++;
        } while ((a2 === a1 || Math.abs(b2) > 20) && tries < 8);
        L = sideTerms(combineTerms(p1, q1, b1));
        R = sideTerms(combineTerms(p2, q2, b2));
      } else {
        const p = ri(2, 5), q = ri(1, 4), b = ri(1, 9);
        const a = p + q, c = a * x + b;
        const compound = sideTerms(combineTerms(p, q, b));
        const flat = side(0, c);
        L = where === 'L' ? compound : flat;
        R = where === 'L' ? flat : compound;
      }
    } else if (v === 1) {    // distribute: k(x + m) = c  (k may be negative)
      x = sx(s, 1, 9);
      const where = pickPlacement();
      if (where === 'both') {
        const k1 = maybeNeg() * ri(2, 6), m1 = ri(1, 8);
        let k2, m2, d, tries = 0;
        do {
          k2 = maybeNeg() * ri(2, 6); m2 = ri(1, 8);
          d = k1 * (x + m1) - k2 * (x + m2); // constant that balances the two groups
          tries++;
        } while ((k2 === k1 || Math.abs(d) > 40) && tries < 8);
        L = sideTerms([gt(k1, m1)]);
        R = d === 0 ? sideTerms([gt(k2, m2)]) : sideTerms([gt(k2, m2), nt(d)]);
      } else {
        const k = maybeNeg() * ri(2, 6), m = ri(1, 8);
        const compound = sideTerms([gt(k, m)]);
        const flat = side(0, k * (x + m));
        L = where === 'L' ? compound : flat;
        R = where === 'L' ? flat : compound;
      }
    } else if (v === 2) {    // k(x + m) + d = c  (k may be negative)
      x = sx(s, 1, 9);
      const where = pickPlacement();
      if (where === 'both') {
        const k1 = maybeNeg() * ri(2, 5), m1 = ri(1, 6), d1 = ri(1, 9);
        const val = k1 * (x + m1) + d1;
        let k2, m2, d2, tries = 0;
        do {
          k2 = maybeNeg() * ri(2, 5); m2 = ri(1, 6);
          d2 = val - k2 * (x + m2);
          tries++;
        } while ((k2 === k1 || Math.abs(d2) > 40) && tries < 8);
        L = sideTerms([gt(k1, m1), nt(d1)]);
        R = d2 === 0 ? sideTerms([gt(k2, m2)]) : sideTerms([gt(k2, m2), nt(d2)]);
      } else {
        const k = maybeNeg() * ri(2, 5), m = ri(1, 6), d = ri(1, 9);
        const compound = sideTerms([gt(k, m), nt(d)]);
        const flat = side(0, k * (x + m) + d);
        L = where === 'L' ? compound : flat;
        R = where === 'L' ? flat : compound;
      }
    } else {                 // variables on both sides: a x + b = c x + d
      // c is free of a, so the net coefficient (a - c) can be negative
      const a = ri(2, 9); let c = ri(1, 9); if (c === a) c = a === 9 ? a - 1 : a + 1;
      x = sx(s, 1, 9);
      const b = (Math.random() < 0.5 ? -1 : 1) * ri(1, 9);
      const d = (a - c) * x + b;
      L = side(a, b); R = side(c, d);
    }
    return { xStar: x, L, R };
  }

  function generate(level) {
    const s = pickClass(level);
    if (level <= 1) return gen1(s);
    if (level === 2) return gen2(s);
    return gen3(s);
  }

  window.Algebra = {
    frac, fInt, fAdd, fSub, fMul, fDiv, fEq, fIsInt, fIsZero, fVal,
    renderSide, renderTermCell, renderCancelSide, parseExpr, generate, opSide, cloneSide, MINUS
  };
})();
