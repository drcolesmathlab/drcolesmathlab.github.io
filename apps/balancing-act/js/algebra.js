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

  // ---------- number modes ----------
  // Integer Mode is the original game. Decimal Mode gives decimals (no more than
  // hundredths) and shows any value that terminates as a decimal; a value that
  // would repeat is shown as a fraction instead, never rounded. Fraction Mode
  // gives fractions with integer numerators and denominators. The mode only
  // changes how numbers are generated, typed and shown: the arithmetic is exact
  // fractions throughout, in every mode.
  let numbers = 'integer';
  function setNumbers(m) { numbers = m; }

  // decimal places a value needs, or Infinity if it repeats (or needs > 6)
  function places(f) {
    let p = 1;
    for (let k = 0; k <= 6; k++, p *= 10) if (p % f.d === 0) return k;
    return Infinity;
  }
  // |f| as a decimal string, e.g. 3/8 -> "0.375"
  function decStr(f) {
    const k = places(f), p = Math.pow(10, k);
    const big = Math.abs(f.n) * (p / f.d);
    const whole = Math.floor(big / p);
    if (!k) return String(whole);
    return whole + '.' + String(big % p).padStart(k, '0');
  }
  const showsDecimal = f => numbers === 'decimal' && f.d !== 1 && places(f) !== Infinity;

  // ---------- rendering ----------
  const MINUS = '−';

  // vertical fraction markup (numerator stacked over denominator with a
  // horizontal bar) — matches the .frac/.fnum/.fden CSS used elsewhere.
  function fracHTML(num, den) {
    return '<span class="frac"><span class="fnum">' + num + '</span>' +
      '<span class="fden">' + den + '</span></span>';
  }
  // |f| as markup: an integer, a decimal (Decimal Mode), or a stacked fraction.
  // struck draws it cancelled; a stacked fraction is struck inside its numerator
  // and denominator, since a line-through on its box would not show.
  function numCore(f, struck) {
    const w = s => struck ? '<span class="cancel">' + s + '</span>' : s;
    if (f.d === 1) return w(String(Math.abs(f.n)));
    if (showsDecimal(f)) return w(decStr(f));
    return fracHTML(w(String(Math.abs(f.n))), w(String(f.d)));
  }
  // f as plain text, for messages: "−3", "2.25", "5/6"
  function numText(f) {
    const s = f.n < 0 ? MINUS : '';
    if (f.d === 1 || showsDecimal(f)) return s + decStr(f);
    return s + Math.abs(f.n) + '/' + f.d;
  }

  // coefficient term for x: handles 1, -1, fractions like 1/3 -> x over 3.
  // style s: 'c' draws a fraction as a coefficient, (2/3)x, instead of 2x over 3;
  // 'o' keeps x over a even in Decimal Mode (the x/a = c shapes).
  function xTerm(a, s) {
    const n = Math.abs(a.n), d = a.d;
    if (d !== 1 && s !== 'o' && showsDecimal(a)) return { neg: a.n < 0, core: decStr(a) + 'x' };
    if (d !== 1 && s === 'c') return { neg: a.n < 0, core: fracHTML(String(n), String(d)) + 'x' };
    const xt = (n === 1 ? 'x' : n + 'x');
    const core = d === 1 ? xt : fracHTML(xt, String(d));
    return { neg: a.n < 0, core };
  }
  function numTerm(b) {
    return { neg: b.n < 0, core: numCore(b) };
  }
  // a factored group term: c(x + m), preserved verbatim through operations.
  // Outside Integer Mode a fractional c is drawn with the group over the
  // denominator, so 1/4·(x + 1) reads (x + 1) over 4.
  function groupTerm(t) {
    const cAbs = { n: Math.abs(t.c.n), d: t.c.d };
    const inner = '(' + renderSide(fInt(1), t.m) + ')';
    let coefStr;
    if (cAbs.n === cAbs.d) coefStr = '';                    // |c| === 1
    else if (cAbs.d === 1) coefStr = String(cAbs.n);
    else if (showsDecimal(cAbs)) coefStr = decStr(cAbs);
    else if (numbers !== 'integer') {
      return { neg: t.c.n < 0, core: fracHTML((cAbs.n === 1 ? '' : cAbs.n) + inner, String(cAbs.d)) };
    }
    else coefStr = fracHTML(String(cAbs.n), String(cAbs.d));
    return { neg: t.c.n < 0, core: coefStr + inner };
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
    if (t.t === 'x') return xTerm(t.c, t.s);
    if (t.t === 'n') return numTerm(t.c);
    return groupTerm(t);
  }
  function renderTerms(terms) {
    const parts = [];
    for (const t of terms) {
      if (t.t === 'x') { if (t.c.n !== 0) parts.push(xTerm(t.c, t.s)); }
      else if (t.t === 'n') { if (t.c.n !== 0) parts.push(numTerm(t.c)); }
      else parts.push(groupTerm(t));
    }
    return joinTerms(parts);
  }
  // Whether ×/÷-ing term t by k exactly reduces its coefficient magnitude to 1,
  // e.g. (x/2)·2 -> x, 2x÷2 -> x, 0.5x·2 -> x, or (2/3)x ÷ (2/3) -> x — which is
  // what makes the cancelling coefficient unambiguous to point at. Fractions
  // are always stored in lowest terms, so with a whole-number k (all Integer
  // Mode ever has) this is only possible when the "other half" is already a
  // unit: |n|=1 with d=k (·), or d=1 with |n|=k (÷).
  // Constants are excluded: unlike x/g terms there's no bare glyph left
  // behind to show (6÷6 becomes the digit 1, not an identity), so there's
  // nothing sensible to strike through.
  function cancelsToUnit(t, op, k) {
    if (t.t !== 'x' && t.t !== 'g') return false;
    const after = op === '*' ? fMul(t.c, k) : fDiv(t.c, k);
    return Math.abs(after.n) === 1 && after.d === 1;
  }
  // render a cancelling x/g term with the vanishing coefficient wrapped in a
  // struck-through span, leaving the bare variable/group visible. With a
  // whole-number factor on a coefficient drawn as a fraction or integer, only
  // the one digit that goes is struck (the original game's look); otherwise
  // (a decimal, or a fractional factor) the whole coefficient is.
  function renderTermCellCancel(t, op, k) {
    const strike = s => '<span class="cancel">' + s + '</span>';
    const c = t.c, n = Math.abs(c.n);
    const dec = (t.t === 'g' || t.s !== 'o') && showsDecimal(c);
    const digit = k.d === 1 && !dec;
    if (t.t === 'x') {
      let core;
      if (digit && op === '*') {
        core = c.d === 1 ? 'x' : t.s === 'c' ? fracHTML('1', strike(c.d)) + 'x' : fracHTML('x', strike(c.d));
      } else if (digit) core = strike(n) + 'x';
      else if (dec) core = strike(decStr(c)) + 'x';
      else if (c.d === 1) core = strike(n) + 'x';
      else if (t.s === 'c') core = fracHTML(strike(n), strike(c.d)) + 'x';
      else core = fracHTML((n === 1 ? '' : strike(n)) + 'x', strike(c.d));
      return { neg: c.n < 0, core };
    }
    const inner = '(' + renderSide(fInt(1), t.m) + ')';
    const over = numbers !== 'integer' && c.d !== 1 && !dec;   // drawn as (x + m) over d
    let core;
    if (digit && op === '*') {
      core = c.d === 1 ? inner : over ? fracHTML(inner, strike(c.d)) : fracHTML('1', strike(c.d)) + inner;
    } else if (digit) core = strike(n) + inner;
    else if (dec) core = strike(decStr(c)) + inner;
    else if (c.d === 1) core = strike(n) + inner;
    else if (over) core = fracHTML((n === 1 ? '' : strike(n)) + inner, strike(c.d));
    else core = fracHTML(strike(n), strike(c.d)) + inner;
    return { neg: c.n < 0, core };
  }
  // render a whole side for a ×/÷ step, marking any term that exactly
  // cancels to identity — the per-term building block behind the struck-
  // through "2·(x/2) -> x" display for that operation. coef is a number or a
  // fraction.
  function renderCancelSide(terms, op, coef) {
    const k = typeof coef === 'number' ? fInt(coef) : coef;
    const parts = [];
    let anyCancel = false;
    for (const t of terms) {
      if (t.t !== 'g' && t.c.n === 0) continue;
      if (cancelsToUnit(t, op, k)) { anyCancel = true; parts.push(renderTermCellCancel(t, op, k)); }
      else parts.push(renderTermCell(t));
    }
    return { html: joinTerms(parts), anyCancel };
  }
  // A group with outer coefficient +1 is redundant grouping — 1·(x + m) is just
  // x + m, with nothing to distribute — so drop the parentheses, expanding it
  // into the loose terms x and m. A coefficient of −1 is NOT dropped: the
  // leading minus still has to be distributed to each term, −(x + 2) -> −x − 2,
  // and that is the player's step to make. (The generators never emit c = ±1,
  // so this only fires after the player scales a group, e.g. 3(x+2) ÷ 3, or
  // (x + 1)/4 · 4 in Fraction Mode.)
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
      : withStyle({ t: t.t, c: { n: t.c.n, d: t.c.d } }, t.s));
  }
  // an x term keeps its drawing style ('c' or 'o', see xTerm) through operations
  function withStyle(t, s) { if (s) t.s = s; return t; }
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
        if (idx < 0) { idx = out.length; out.push(withStyle({ t: kind, c: t.c }, t.s)); }
        else out[idx].c = fAdd(out[idx].c, t.c);
      } else out.push(t);
    }
    if (idx >= 0 && out[idx].c.n === 0) out.splice(idx, 1);
    return out;
  }
  function scaleTerms(terms, k) {
    return terms.map(t => t.t === 'g'
      ? { t: 'g', c: fMul(t.c, k), m: t.m }
      : withStyle({ t: t.t, c: fMul(t.c, k) }, t.s));
  }
  // apply one operation to a side, returning a new finalized side.
  // +/- only touch the loose term of the matching kind; ×/÷ scale every term's
  // coefficient (a group stays factored, e.g. 3(x+2) ÷ 3 -> (x+2)).
  // coef is a number or a fraction.
  function opSide(S, op, coef, varFlag) {
    let terms = cloneTerms(S.terms);
    const k = typeof coef === 'number' ? fInt(coef) : coef;
    if (op === '+' || op === '-') {
      const signed = op === '+' ? k : frac(-k.n, k.d);
      terms.push(varFlag ? { t: 'x', c: signed } : { t: 'n', c: signed });
      terms = mergeKind(terms, varFlag ? 'x' : 'n');
    } else if (op === '*') {
      terms = scaleTerms(terms, k);
    } else { // '/'
      terms = scaleTerms(terms, fDiv(fInt(1), k));
    }
    return finalizeSide(terms);
  }

  // ---------- number and expression parsing ----------
  // A typed magnitude: "12" in every mode, "2.5" in Decimal Mode, "3/4" in
  // Decimal and Fraction Modes (Decimal Mode shows repeating values as
  // fractions, so a rewrite there may need one). A fraction, or null.
  function parseNum(s) {
    let m = s.match(/^(\d{1,5})\/(\d{1,4})$/);
    if (m) {
      const d = parseInt(m[2], 10);
      return numbers !== 'integer' && d ? frac(parseInt(m[1], 10), d) : null;
    }
    m = s.match(/^(\d{0,5})\.(\d{1,6})$/);
    if (m) return numbers === 'decimal' ? frac(parseInt((m[1] || '0') + m[2], 10), Math.pow(10, m[2].length)) : null;
    return /^\d{1,5}$/.test(s) ? fInt(parseInt(s, 10)) : null;
  }
  // SIMPLIFY input uses ASCII: digits, 'x', '+', '-', and where parseNum allows
  // them '.' and '/': "2.5x", "3/4x" (drawn (3/4)x), "3x/4" and "x/4" (drawn
  // over 4), "1/2". Returns a finalized side or null.
  // Each typed chunk becomes its own term, so the player's rewrite is shown
  // exactly as entered (e.g. "3x+2x" stays "3x + 2x").
  function parseExpr(str) {
    if (!str || !/^[0-9x+\-./]+$/.test(str)) return null;
    const chunks = str.match(/[+-]?[^+-]+/g);
    if (!chunks || chunks.length > 6) return null;
    if (chunks.join('') !== str) return null; // stray "+-" etc.
    const terms = [];
    for (const ch of chunks) {
      const sign = ch[0] === '-' ? -1 : 1;
      const body = ch.replace(/^[+-]/, '');
      let coef, hasX = false, style, m;
      if ((m = body.match(/^([\d.]*)x\/(\d+)$/))) {          // 3x/4, x/4
        const top = parseNum(m[1] || '1'), d = parseNum(m[2]);
        if (!top || !d || !d.n || numbers === 'integer') return null;
        coef = fDiv(top, d); hasX = true;
      } else if ((m = body.match(/^(\d+\/\d+)x$/))) {         // 3/4x
        coef = parseNum(m[1]); hasX = true; style = 'c';
      } else if ((m = body.match(/^([\d./]*)(x?)$/))) {        // 5, 2.5, 1/2, 3x, x
        hasX = m[2] === 'x';
        if (!m[1] && !hasX) return null;
        coef = m[1] ? parseNum(m[1]) : fInt(1);
      } else return null;
      if (!coef || Math.abs(coef.n) > 9999 || coef.d > 9999) return null;
      coef = frac(sign * coef.n, coef.d);
      terms.push(hasX ? withStyle({ t: 'x', c: coef }, style) : { t: 'n', c: coef });
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

  // ---------- Decimal and Fraction Mode generators ----------
  // The same shapes as Integer Mode at each step count. Each template draws its
  // given numbers at random; x* is then solved for exactly, and the equation is
  // kept only if everything fits the mode (see decimalOk / fractionOk).
  const X = (c, s) => withStyle({ t: 'x', c }, s);
  const N = c => ({ t: 'n', c });
  const G = (c, m) => ({ t: 'g', c, m });
  const neg = f => frac(-f.n, f.d);
  const signed = (f, p) => (Math.random() < (p === undefined ? 0.35 : p) ? neg(f) : f);
  const ONE = fInt(1);
  // two x-terms and an optional constant, in a random left-to-right order
  function mixTerms(x1, x2, n) {
    if (!n) return Math.random() < 0.5 ? [x1, x2] : [x2, x1];
    return pick([[x1, x2, n], [x1, n, x2]]);
  }
  // put a compound expression on one side and a plain number on the other, or
  // (shapes that allow it) compounds on both sides
  function place(compound, flat) {
    return Math.random() < 0.5 ? [compound, [N(flat)]] : [[N(flat)], compound];
  }

  // a decimal in [lo, hi] with one or two places, the hundredths mostly
  // landing on 0 or 5 (2.25, 0.75, 1.4) so the arithmetic stays human
  function rdec(lo, hi) {
    const p = Math.random() < 0.5 ? 10 : 100;
    let n = ri(Math.ceil(lo * p), Math.floor(hi * p));
    if (p === 100 && Math.random() < 0.8) n = Math.max(5, Math.round(n / 5) * 5);
    return frac(n, p);
  }
  const D = (lo, hi, p) => signed(rdec(lo, hi), p);
  // a coefficient other than ±1, as Integer Mode's a x and k(x + m) never are
  function DK(lo, hi, p) {
    let f;
    do f = rdec(lo, hi); while (f.n === f.d);
    return signed(f, p);
  }
  const DEC_T = [
    [ // 1-step: x + b = c, x − b = c, a x = c, x/a = c
      () => [[X(ONE), N(rdec(0.1, 15))], [N(D(0.1, 20, 0.2))]],
      () => [[X(ONE), N(neg(rdec(0.1, 15)))], [N(D(0.1, 20, 0.2))]],
      () => [[X(DK(0.1, 9.9))], [N(D(0.1, 40, 0.2))]],
      () => [[X(frac(1, ri(2, 6)), 'o')], [N(D(0.1, 12))]],
    ],
    [ // 2-step: a x ± b = c, x/a ± b = c
      () => [[X(DK(0.2, 9.9)), N(rdec(0.1, 15))], [N(D(0.1, 30, 0.2))]],
      () => [[X(DK(0.2, 9.9)), N(neg(rdec(0.1, 15)))], [N(D(0.1, 30, 0.2))]],
      () => [[X(frac(1, ri(2, 5)), 'o'), N(rdec(0.1, 12))], [N(D(0.1, 20, 0.2))]],
      () => [[X(frac(1, ri(2, 5)), 'o'), N(neg(rdec(0.1, 12)))], [N(D(0.1, 20, 0.2))]],
    ],
    [ // multi-step
      () => {   // combine like terms
        const side = () => mixTerms(X(rdec(0.5, 6)), X(rdec(0.1, 5)), N(rdec(0.1, 12)));
        return pickPlacement() === 'both' ? [side(), side()] : place(side(), D(0.1, 40, 0.2));
      },
      () => {   // distribute: k(x + m) = c
        if (pickPlacement() !== 'both') return place([G(DK(0.2, 6), rdec(0.1, 9))], D(0.1, 40, 0.2));
        const R = [G(DK(0.2, 6), rdec(0.1, 9))];
        if (Math.random() < 0.7) R.push(N(D(0.1, 20, 0.5)));
        return [[G(DK(0.2, 6), rdec(0.1, 9))], R];
      },
      () => {   // k(x + m) + d = c
        const side = () => [G(DK(0.2, 5), rdec(0.1, 6)), N(D(0.1, 12, 0.3))];
        return pickPlacement() === 'both' ? [side(), side()] : place(side(), D(0.1, 40, 0.2));
      },
      () => [[X(rdec(0.2, 9)), N(D(0.1, 9, 0.5))], [X(rdec(0.1, 9)), N(D(0.1, 20, 0.5))]],
    ],
  ];

  // a positive fraction below `whole` that is not a whole number
  const DENS = [2, 3, 4, 5, 6, 8, 10, 12];
  function rfrac(whole) {
    const d = pick(DENS);
    let n;
    do { n = ri(1, d * whole - 1); } while (n % d === 0);
    return frac(n, d);
  }
  // a fraction or (sometimes) a whole number, either sign
  const rval = (whole, p) => signed(Math.random() < 0.35 ? fInt(ri(1, whole)) : rfrac(whole), p);
  // a fractional x-coefficient, drawn either (2/3)x or 2x over 3
  const fx = (whole, p) => X(signed(rfrac(whole), p === undefined ? 0 : p), Math.random() < 0.5 ? 'c' : undefined);
  // (x + m) over d
  const fg = d => G(frac(1, d), fInt(signed(fInt(ri(1, 9)), 0.3).n));
  const FRAC_T = [
    [ // 1-step: x ± p/q = r/s, (a/b)x = c, x/a = p/q
      () => [[X(ONE), N(rfrac(6))], [N(rval(9, 0.2))]],
      () => [[X(ONE), N(neg(rfrac(6)))], [N(rval(9, 0.2))]],
      () => [[fx(3, 0.25)], [N(rval(12, 0.2))]],
      () => [[X(frac(1, ri(2, 9)))], [N(signed(rfrac(5), 0.2))]],
    ],
    [ // 2-step: (a/b)x ± p/q = r/s, x/a + p/q = r/s, (x + m)/d = c
      () => [[fx(3, 0.25), N(rfrac(6))], [N(rval(12, 0.2))]],
      () => [[fx(3, 0.25), N(neg(rfrac(6)))], [N(rval(12, 0.2))]],
      () => [[X(frac(1, ri(2, 8))), N(rfrac(5))], [N(rval(9, 0.2))]],
      () => [[fg(ri(2, 8))], [N(rval(9, 0.2))]],
    ],
    [ // multi-step
      () => {   // combine like terms: x/a + x/b + p/q = c
        const side = () => mixTerms(X(frac(1, ri(2, 6))), fx(2), N(rval(6, 0.3)));
        return pickPlacement() === 'both' ? [side(), side()] : place(side(), rval(12, 0.2));
      },
      () => {   // distribute: (a/b)(x + m) = c, or (x + m)/d on both sides
        if (pickPlacement() !== 'both') return place([G(rfrac(3), fInt(ri(1, 9)))], rval(12, 0.2));
        return [[fg(ri(2, 8))], [fg(ri(2, 8))]];
      },
      () => {   // (x + m)/d + p/q = c
        if (pickPlacement() !== 'both') return place([fg(ri(2, 8)), N(rval(5, 0.3))], rval(9, 0.2));
        return [[fg(ri(2, 8)), N(rval(5, 0.3))], [fg(ri(2, 8)), N(rval(5, 0.3))]];
      },
      () => [[fx(3), N(rval(6, 0.4))], [fx(3), N(rval(9, 0.4))]],
    ],
  ];

  // every given number in a list of terms
  function givens(terms) {
    const out = [];
    for (const t of terms) { out.push(t.c); if (t.t === 'g') out.push(t.m); }
    return out;
  }
  function lcm(a, b) { return a / gcd(a, b) * b; }
  // Decimal Mode: no given number past the hundredths, at least one of them
  // not whole, and an answer that ends by the thousandths. (x over a counts
  // its two integers, not the repeating 1/a.)
  function decimalOk(x, terms) {
    let anyDec = false;
    for (const t of terms) {
      if (t.s === 'o') continue;
      for (const v of givens([t])) {
        if (places(v) > 2 || Math.abs(fVal(v)) > 100) return false;
        if (v.d !== 1) anyDec = true;
      }
    }
    return anyDec && places(x) <= 3 && Math.abs(fVal(x)) <= 60;
  }
  // Fraction Mode: integer numerators and denominators (always, as fractions),
  // at least one not whole, denominators kept small enough to clear by hand.
  // The answer may be any rational number, shown fully reduced.
  function fractionOk(x, terms) {
    let anyFrac = false, l = 1;
    for (const v of givens(terms)) {
      if (v.d > 12 || Math.abs(v.n) > 99) return false;
      if (v.d !== 1) anyFrac = true;
      l = lcm(l, v.d);
    }
    return anyFrac && l <= 60 && x.d <= 12 && Math.abs(x.n) <= 60 && Math.abs(fVal(x)) <= 30;
  }
  // Draw from a step count's templates until one fits. s is the round's sign
  // class for x* (1 or −1; 0 is let through whenever it comes up), and whole
  // asks for a whole-number answer, so not every answer is a decimal or fraction.
  function generateMode(level, s, whole) {
    const T = (numbers === 'decimal' ? DEC_T : FRAC_T)[Math.min(level, 3) - 1];
    const ok = numbers === 'decimal' ? decimalOk : fractionOk;
    for (let i = 0; i < 5000; i++) {
      const sides = pick(T)();
      const L = sideTerms(sides[0]), R = sideTerms(sides[1]);
      const da = fSub(L.a, R.a);
      if (fIsZero(da)) continue;
      const x = fDiv(fSub(R.b, L.b), da);
      if (x.n !== 0 && Math.sign(x.n) !== s) continue;
      if (whole && x.d !== 1) continue;
      if (ok(x, sides[0].concat(sides[1]))) return { xStar: x, L, R };
    }
    return null;
  }

  function generate(level) {
    if (numbers !== 'integer') {
      let eq = null;
      while (!eq) eq = generateMode(level, Math.random() < 0.3 ? -1 : 1, Math.random() < 0.25);
      return eq;
    }
    const s = pickClass(level);
    const eq = level <= 1 ? gen1(s) : level === 2 ? gen2(s) : gen3(s);
    eq.xStar = fInt(eq.xStar);   // x* is a fraction in every mode
    return eq;
  }

  window.Algebra = {
    frac, fInt, fAdd, fSub, fMul, fDiv, fEq, fIsInt, fIsZero, fVal,
    setNumbers, numCore, numText, parseNum,
    renderSide, renderTermCell, renderCancelSide, parseExpr, generate, opSide, cloneSide, MINUS
  };
})();
