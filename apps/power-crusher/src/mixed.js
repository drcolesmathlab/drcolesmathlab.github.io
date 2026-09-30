/*
 * mixed.js — Mode 7, Mixed Practice: problems and grading (no DOM).
 *
 * Design: "Power Crusher: Mode 7 Design, Mixed Practice" (2026-09-29), phase 1
 * (sections 1 to 10). Four levels; each adds one required property. Every level
 * asks the same question, in the answer box, and every level is graded the same
 * way: green (correct and fully simplified), yellow (equal, but not fully
 * simplified: a specific note, the box stays open) or red (wrong).
 *
 * The six properties (design §2): P Product of Powers, Q Quotient of Powers,
 * PP Power of a Power (with Power of a Product), PQ Power of a Quotient,
 * Z Zero Exponent, N Negative Exponent. `analyze` computes a problem's property
 * set from its expression tree by the design's §3 rules; the generator draws a
 * property set, builds a problem to match it, and checks with `analyze` (§4.1).
 *
 * Answers to questions the design left open (Dr. Cole, 2026-09-30, asked before
 * the build):
 *   - a problem with a constant has one constant in one of three forms (a plain
 *     coefficient, a coefficient inside a group, or a constant power), except
 *     that a coefficient may appear twice where there is room (3x² · 4x⁵);
 *   - where a set doesn't decide the shape, a line and a fraction are 50/50;
 *   - a yellow answer is in History as soon as it first counts correct, and any
 *     later try on that problem is an attempt only (activity.js).
 */
(function (PC) {
  'use strict';
  var E = PC.Expr, G = PC.Generate, Pr = PC.Product, R = PC.Rational;
  var power = Pr.power, baseNode = Pr.baseNode;

  var CODES = ['P', 'Q', 'PP', 'PQ', 'Z', 'N'];   // design §2, in the design's order

  /* Design §1: the same question at every level. */
  var QUESTION = 'Simplify the expression to have only positive exponents. All constants must be evaluated.';

  var LIMITS = {
    coefMin: 2, coefMax: 10,      // design §4.2: plain coefficients 2 to 10, as in Mode 2
    baseMin: 2, baseMax: 10,      // a constant base 2 to 10
    expMax: 10,                   // given exponents −10 to 10
    answerMax: 1000,              // design §4.3: the answer's numerator and denominator
    fillerShare: 0.25,            // [my call] how often a base that no property touches is added
    carrierShare: 0.5,            // [my call] Z and N get a factor of their own (y⁰), else use an exponent already there
  };

  /* ---- 1. The property set of a problem (design §3) -------------------------- */
  /* Returns { props: ['P', …] in CODES order, hasConstant }. Works on an
     expression tree, so it also checks the design's own worked examples.
       - Every base occurrence is placed on a side, the numerator (a line, a
         numerator) or the denominator, after any outer exponent is applied.
       - PP: an outer exponent on a group that is not a fraction. PQ: on a fraction.
       - P: a base twice on one side. Q: a base on both sides.
       - Z, N: a zero or negative exponent is given, is the result of an outer
         exponent (inner × outer), or is what P (a side's total) or Q (top minus
         bottom) leaves.
       - A plain coefficient (a number that is not a power's base) is never a
         base: 3 · 4 and 8 ÷ 4 are not properties (§3). */
  function analyze(tree) {
    var props = {}, occ = [], values = [], constant = false;
    function flip(s) { return s === 'n' ? 'd' : 'n'; }

    function add(base, exp, side, mult) { occ.push({ key: String(base), side: side, e: exp * mult }); }

    function walk(node, side, mult) {
      switch (node.t) {
        case 'num': constant = true; return;                 // a coefficient
        case 'var': add(node.name, 1, side, mult); return;
        case 'mul': node.factors.forEach(function (f) { walk(f, side, mult); }); return;
        case 'group': walk(node.inner, side, mult); return;
        case 'div':
          if (!(node.num.t === 'num' && node.num.v === 1)) walk(node.num, side, mult);   // the 1 in 1/x⁻²
          walk(node.den, flip(side), mult);
          return;
        case 'pow':
          values.push(node.exp);
          if (node.base.t === 'group') {
            var inner = node.base.inner;
            if (inner.t === 'div') props.PQ = true; else props.PP = true;
            walk(inner, side, mult * node.exp);
          } else if (node.base.t === 'num') {
            constant = true;
            add(node.base.v, 1, side, mult * node.exp);
          } else {
            add(node.base.name, 1, side, mult * node.exp);
          }
          return;
      }
      throw new TypeError('cannot analyze ' + node.t);
    }
    walk(tree, 'n', 1);

    var by = {};
    occ.forEach(function (o) {
      var b = by[o.key] = by[o.key] || { n: [], d: [] };
      b[o.side].push(o.e);
    });
    function sum(a) { return a.reduce(function (s, e) { return s + e; }, 0); }
    occ.forEach(function (o) { values.push(o.e); });
    Object.keys(by).forEach(function (k) {
      var b = by[k];
      ['n', 'd'].forEach(function (s) {
        if (b[s].length >= 2) { props.P = true; values.push(sum(b[s])); }
      });
      if (b.n.length && b.d.length) { props.Q = true; values.push(sum(b.n) - sum(b.d)); }
    });
    if (values.some(function (v) { return v === 0; })) props.Z = true;
    if (values.some(function (v) { return v < 0; })) props.N = true;
    return { props: CODES.filter(function (c) { return props[c]; }), hasConstant: constant };
  }

  /* ---- 2. The app's answer (design §5) --------------------------------------- */
  function answerOf(tree) { return E.simplest(E.normalize(tree)); }

  /* Design §4.3: the answer's coefficient, numerator and denominator, each at most 1000. */
  function withinCap(tree) {
    var c = E.normalize(tree).coef, cap = BigInt(LIMITS.answerMax);
    return c.n <= cap && c.d <= cap;
  }

  /* ---- 3. Building a problem to match a property set (design §4.1, step 3) ----- */
  /* A problem is drawn as a small structure and then turned into a tree.
       { shape: 'line' | 'frac', n: [factor…], d: [factor…] }   (d only for a fraction)
     A factor is one of
       { k: 't', coef, ps }            a term: a coefficient and powers of distinct bases
       { k: 'g', coef, ps, out }       (…)^out, a group that is not a fraction (PP)
       { k: 'f', num, den, out }       (…/…)^out, a group fraction (PQ); num, den = { coef, ps }
     and a power is { s, b, e, tag }: a symbol (a base slot), its base once
     chosen, its exponent, and 'Z' or 'N' for a factor that exists to carry a
     zero or a negative exponent. A base repeated in two terms of one side is
     what makes P; a base on both sides is Q. */
  var FAIL = { fail: true };

  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

  function drawStructure(S, form, r) {
    var has = function (c) { return S.indexOf(c) >= 0; };
    var budget = form === 'power' ? 4 : 3;    // 1 to 3 variables, and a constant base for the 'power' form
    var used = 0;
    function sym() { if (used >= budget) throw FAIL; return used++; }
    function pw(s, tag) { return { s: s, b: null, e: null, tag: tag || null }; }
    function syms(n) { var out = []; for (var i = 0; i < n; i++) out.push(pw(sym())); return out; }

    // Design §4.4: PQ needs a line; Q (without PQ) needs a fraction; otherwise 50/50 (Dr. Cole).
    var shape = has('PQ') ? 'line' : has('Q') ? 'frac' : (r() < 0.5 ? 'line' : 'frac');
    var sides = shape === 'line' ? ['n'] : ['n', 'd'];
    var m = { shape: shape, n: [], d: [] };
    function side() { return pick(r, sides); }
    function put(sd, f) { m[sd].push(f); return f; }
    function term(sd, ps) { return put(sd, { k: 't', coef: null, ps: ps }); }
    function all() { return m.n.concat(m.d); }
    /* Every base occurrence and the side it is on. A group fraction's bottom is the denominator's side. */
    function occurrences() {
      var out = [];
      ['n', 'd'].forEach(function (sd) {
        m[sd].forEach(function (f) {
          if (f.k === 'f') {
            f.num.ps.forEach(function (p) { out.push({ s: p.s, side: sd }); });
            f.den.ps.forEach(function (p) { out.push({ s: p.s, side: sd === 'n' ? 'd' : 'n' }); });
          } else f.ps.forEach(function (p) { out.push({ s: p.s, side: sd }); });
        });
      });
      return out;
    }
    function count(s) { return occurrences().filter(function (o) { return o.s === s; }).length; }

    // PQ: a fraction to a power. PP: a group to a power. Their bases are their own.
    var f = null, g = null, spare = budget - (has('PP') ? 1 : 0);
    if (has('PQ')) {
      var nn = 1 + (r() < 0.25 ? 1 : 0), dn = 1 + (r() < 0.15 ? 1 : 0);
      while (nn + dn > spare) { if (dn > 1) dn--; else if (nn > 1) nn--; else break; }
      f = put('n', { k: 'f', num: { coef: null, ps: syms(nn) }, den: { coef: null, ps: syms(dn) }, out: null });
    }
    if (has('PP')) {
      var size = Math.min(1 + (r() < 0.3 ? 1 : 0) + (r() < 0.1 ? 1 : 0), budget - used);
      g = put(side(), { k: 'g', coef: null, ps: syms(size), out: null });
    }

    // P: a base twice on one side. Often the group's or the fraction's own base, repeated
    // outside it: (x²y)³ · x, or (x²/2)⁴ · x³.
    if (has('P')) {
      var again = occurrences().filter(function (o) { return sides.indexOf(o.side) >= 0; });
      if (again.length && r() < 0.7) {
        var o = pick(r, again);
        term(o.side, [pw(o.s)]);
      } else {
        var s = sym(), sd = side();
        term(sd, [pw(s)]);
        term(sd, [pw(s)]);
      }
    }

    // Q: a base on both sides.
    if (has('Q')) {
      if (shape === 'line') {
        // With PQ: a base under the group fraction's bar, repeated on the line, (x/y)³ · y⁵.
        var below = pick(r, f.den.ps).s;
        if (g && r() < 0.3 && g.ps.length < 3 && !g.ps.some(function (p) { return p.s === below; })) g.ps.push(pw(below));
        else term('n', [pw(below)]);
      } else {
        var seen = occurrences();
        if (seen.length && r() < 0.6) {
          var q = pick(r, seen);
          term(q.side === 'n' ? 'd' : 'n', [pw(q.s)]);
        } else {
          var t = sym();
          term('n', [pw(t)]);
          term('d', [pw(t)]);
        }
      }
    }

    // A base that no property touches (design §4.2).
    if (used < budget && r() < LIMITS.fillerShare) term(side(), [pw(sym())]);

    // Z and N: their own factor (y⁰, x⁻²) or an exponent already there. With nothing
    // there yet, the factor is a must.
    ['Z', 'N'].forEach(function (c) {
      if (!has(c)) return;
      var empty = all().length === 0;
      if (used < budget && (empty || r() < LIMITS.carrierShare)) term(side(), [pw(sym(), c)]);
      else if (empty) throw FAIL;
    });

    // A fraction needs something under the bar. With a constant of the plain
    // kind it may be the constant alone, x⁴ · x³ over 5.
    var denCoef = false;
    if (shape === 'frac' && m.d.length === 0) {
      if (form === 'coef' && r() < 0.5) denCoef = true;
      else term('d', [pw(sym())]);
    }

    // The constant (design §4.1 step 2): one of three forms.
    if (form === 'coef') {
      var places = all().filter(function (x) { return x.k === 't' && x.ps.length; });
      var den = null, chosen = [];
      if (denCoef) chosen.push(den = put('d', { k: 't', coef: null, ps: [] }));
      if (!chosen.length && !places.length) chosen.push(term('n', []));        // 3 · (x²)⁵
      var want = 1 + (r() < 0.5 ? 1 : 0);
      while (chosen.length < want && places.length) chosen.push(places.splice(Math.floor(r() * places.length), 1)[0]);
      chosen.forEach(function (x) { x.coef = G.int(r, LIMITS.coefMin, LIMITS.coefMax); });
    } else if (form === 'ingroup') {
      var groups = all().filter(function (x) { return x.k !== 't'; });
      var host = pick(r, groups);
      if (host.k === 'g') host.coef = G.int(r, LIMITS.coefMin, LIMITS.coefMax);
      else {
        var mine = r() < 0.5 ? host.num : host.den, other = mine === host.num ? host.den : host.num;
        mine.coef = G.int(r, LIMITS.coefMin, LIMITS.coefMax);
        // (x/3)²: the whole side is the constant, when its bases are no one else's.
        if (other.ps.length && r() < 0.5 && mine.ps.every(function (p) { return count(p.s) === 1; })) mine.ps = [];
      }
    }

    // Terms that share a line read as one term when they can: x²y⁰, not x² · y⁰.
    sides.forEach(function (sd) {
      var list = shuffle(r, m[sd]), out = [];
      list.forEach(function (x) {
        var prev = out[out.length - 1];
        if (x.k === 't' && prev && prev.k === 't' && r() < 0.5 && prev.ps.length + x.ps.length <= 3 &&
            !(prev.coef !== null && x.coef !== null) &&
            !x.ps.some(function (p) { return prev.ps.some(function (q) { return q.s === p.s; }); })) {
          prev.ps = prev.ps.concat(x.ps);
          if (prev.coef === null) prev.coef = x.coef;
        } else out.push(x);
      });
      m[sd] = out;
    });
    return m;
  }

  function shuffle(r, arr) { return Pr.shuffle(r, arr); }

  /* Bases for the symbols, then exponents. Returns false when there are more
     bases than the problem may have. */
  function fill(m, S, form, r) {
    var has = function (c) { return S.indexOf(c) >= 0; };
    var all = m.n.concat(m.d), ps = [], outs = [];
    all.forEach(function (x) {
      if (x.k === 'f') { ps.push.apply(ps, x.num.ps.concat(x.den.ps)); outs.push(x); }
      else { ps.push.apply(ps, x.ps); if (x.k === 'g') outs.push(x); }
    });
    var symbols = [];
    ps.forEach(function (p) { if (symbols.indexOf(p.s) < 0) symbols.push(p.s); });
    var vars = shuffle(r, E.LIMITS.variables), constSym = null, c = null;
    if (form === 'power') { constSym = pick(r, symbols); c = G.int(r, LIMITS.baseMin, LIMITS.baseMax); }
    var map = {};
    symbols.forEach(function (s) { map[s] = s === constSym ? c : vars.shift(); });
    if (symbols.some(function (s) { return map[s] === undefined; })) return false;
    ps.forEach(function (p) { p.b = map[p.s]; });

    // Exponents: 1 to 10, but a constant base is never to the 1 (2 · 2⁴ would read as
    // a coefficient), and a lone power in a group is never to the 1 ((x)³ isn't a group).
    var lone = [];
    all.forEach(function (x) { if (x.k === 'g' && x.coef === null && x.ps.length === 1) lone.push(x.ps[0]); });
    ps.forEach(function (p) {
      var low = typeof p.b === 'number' || lone.indexOf(p) >= 0 ? 2 : 1;
      p.e = G.int(r, low, LIMITS.expMax);
      if (p.tag === 'Z') p.e = 0;
      if (p.tag === 'N') p.e = -G.int(r, 1, LIMITS.expMax);
    });
    outs.forEach(function (x) { x.out = G.int(r, 2, LIMITS.expMax); });   // never 1

    // Zero and negative exponents only where the set has Z or N (design §4.2); where
    // there is a choice, how many and which is uniform. With a Q pair they may come out
    // of it (x³/x⁵), so none need be given.
    var slots = [];
    ps.forEach(function (p) { if (!p.tag) slots.push({ o: p, k: 'e' }); });
    outs.forEach(function (x) { slots.push({ o: x, k: 'out' }); });
    function give(n, value) {
      for (var i = 0; i < n && slots.length; i++) {
        var s = slots.splice(Math.floor(r() * slots.length), 1)[0];
        s.o[s.k] = value();
      }
    }
    var hasCarrier = function (t) { return ps.some(function (p) { return p.tag === t; }); };
    if (has('Z') && !hasCarrier('Z')) give(has('Q') ? G.int(r, 0, 1) : 1, function () { return 0; });
    if (has('N') && !hasCarrier('N')) give(has('Q') ? G.int(r, 0, 2) : G.int(r, 1, 2), function () { return -G.int(r, 1, LIMITS.expMax); });
    return true;
  }

  /* ---- 4. Structure to tree -------------------------------------------------- */
  function sortedPs(ps) {
    return ps.slice().sort(function (a, b) {
      var an = typeof a.b === 'number', bn = typeof b.b === 'number';
      if (an !== bn) return an ? -1 : 1;
      return an ? a.b - b.b : (a.b < b.b ? -1 : 1);
    });
  }
  /* A coefficient, then the powers: 3x²y. */
  function termNode(coef, ps) {
    var fs = [];
    if (coef !== null) fs.push(E.N(coef));
    sortedPs(ps).forEach(function (p) { fs.push(power(baseNode(p.b), p.e)); });
    return fs.length === 1 ? fs[0] : { t: 'mul', factors: fs };
  }
  function factorNode(x) {
    if (x.k === 't') return termNode(x.coef, x.ps);
    if (x.k === 'g') return E.P(E.G(termNode(x.coef, x.ps)), x.out);
    return E.P(E.G(E.D(termNode(x.num.coef, x.num.ps), termNode(x.den.coef, x.den.ps))), x.out);
  }
  /* Terms and groups are joined by "·": (x²y)³ · x⁴. */
  function lineNode(list) {
    var nodes = list.map(factorNode);
    return nodes.length === 1 ? nodes[0] : { t: 'mul', dot: true, factors: nodes };
  }
  function toTree(m) {
    if (m.shape === 'line') return lineNode(m.n);
    return E.D(m.n.length ? lineNode(m.n) : E.N(1), lineNode(m.d));
  }

  /* ---- 5. One problem -------------------------------------------------------- */
  /* Every combination of n of the six properties, in the design's order. */
  function sets(n) {
    var out = [];
    (function go(from, chosen) {
      if (chosen.length === n) { out.push(chosen.slice()); return; }
      for (var i = from; i < CODES.length; i++) { chosen.push(CODES[i]); go(i + 1, chosen); chosen.pop(); }
    })(0, []);
    return out;
  }

  var MAX_TRIES = 5000;

  /* Does a list of factors have an exponent below zero written in it? */
  function negativeGiven(list) {
    return list.some(function (x) {
      var ps = x.k === 'f' ? x.num.ps.concat(x.den.ps) : x.ps;
      return (x.out !== undefined && x.out < 0) || ps.some(function (p) { return p.e < 0; });
    });
  }

  /* The problem for one draw: property set S, whether it has a constant, and (if it
     does) the constant's form. Only step 3 is redrawn until the check passes
     (design §4.1 step 4): exactly the set, the constant as drawn, the answer within the
     cap, the limits of handoff §4. Returns { tree, tries } or throws. */
  function build(S, K, form, r) {
    for (var tries = 1; tries <= MAX_TRIES; tries++) {
      var m;
      try {
        m = drawStructure(S, K ? form : null, r);
        if (!fill(m, S, K ? form : null, r)) continue;
      } catch (e) {
        if (e === FAIL) continue;
        throw e;
      }
      // 1 over something is for a negative exponent below the bar (1/x⁻²); a fraction
      // whose top is empty for any other reason (1/(x²)³, 1/z⁰) is redrawn.
      if (m.shape === 'frac' && !m.n.length && !negativeGiven(m.d)) continue;
      var tree = toTree(m);
      if (E.checkLimits(tree, { constCap: false }).length) continue;
      var a;
      try { a = analyze(tree); } catch (e) { continue; }
      if (a.props.join() !== S.join() || a.hasConstant !== K) continue;
      try { if (!withinCap(tree)) continue; } catch (e) { continue; }
      return { tree: tree, tries: tries };
    }
    throw new Error('no problem for {' + S.join(',') + '} after ' + MAX_TRIES + ' tries');
  }

  /* The problem object for a shown tree: the app's answer and what the screen needs.
     Tests build their own trees with this. */
  function problemFor(n, tree) {
    var a = analyze(tree);
    return {
      level: n, shown: tree, answer: answerOf(tree), set: a.props, hasConstant: a.hasConstant,
      question: QUESTION,
      // Design §7: one crush from the problem straight to the answer. Reduced motion:
      // light the problem, hold 0.7 s, swap (crush.js, `all` and `litProblem`).
      plan: { type: 'all', lit: 'problem' },
    };
  }

  /* A new problem for level n. Steps 1 and 2 of the draw are exact (design §4.1): every set
     of the level's size is equally likely, and half the problems have a constant. The
     constant's form is drawn uniformly among the forms the set allows: a group to hold the
     coefficient needs a PP or a PQ. Never the previous problem again. */
  function make(n) {
    var all = sets(n);
    return function (r, prev) {
      for (var i = 0; i < 50; i++) {
        var S = pick(r, all), K = r() < 0.5;
        var forms = ['coef', 'power'];
        if (S.indexOf('PP') >= 0 || S.indexOf('PQ') >= 0) forms.push('ingroup');
        var tree = build(S, K, pick(r, forms), r).tree;
        if (prev && E.toText(prev.shown) === E.toText(tree)) continue;
        return problemFor(n, tree);
      }
      throw new Error('level ' + n + ' kept repeating the previous problem');
    };
  }

  /* ---- 6. Grading (design §6) ------------------------------------------------ */
  /* 'empty' and 'invalid' are not submissions. Otherwise: 'wrong' (red), 'yellow'
     (equal, but not fully simplified: `notes` says what to improve; it counts as
     correct and the box stays open) or 'correct' (green). */
  function gradeMath(problem, model) {
    if (!model || !model.items || !model.items.length) return { status: 'empty' };
    var r = PC.Check.check(model, problem.answer, 'mixed');
    if (r.status === 'invalid') {
      if (r.errors[0] === 'EMPTY') return { status: 'empty' };
      return { status: 'invalid', message: PC.Check.message(r), errors: r.errors };
    }
    if (!r.correct) return { status: 'wrong', result: r };
    var hints = PC.Check.improvements(r);
    if (hints.length) return { status: 'yellow', result: r, notes: r.notes, hints: hints };
    return { status: 'correct', result: r };
  }

  /* The history panel keeps problem = the app's answer, never the typed form. */
  function entry(problem) { return { from: problem.shown, to: problem.answer }; }

  var LEVELS = [1, 2, 3, 4].map(function (n) {
    // Button names are "Level 1" to "Level 4", with no titles (design §1).
    return { n: n, title: '', make: make(n), input: 'math' };
  });

  PC.Mixed = {
    CODES: CODES, QUESTION: QUESTION, LIMITS: LIMITS, LEVELS: LEVELS,
    analyze: analyze, answerOf: answerOf, withinCap: withinCap, sets: sets,
    build: build, problemFor: problemFor, make: make,
    level1: LEVELS[0].make, level2: LEVELS[1].make, level3: LEVELS[2].make, level4: LEVELS[3].make,
    gradeMath: gradeMath, entry: entry,
  };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
