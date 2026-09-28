/*
 * power.js — Mode 3, Power of a Power: problems and grading (no DOM).
 *
 * Design: "Power Crusher: Mode 3 Design, Power of a Power" (2026-09-27).
 * Level 4 also covers Power of a Product, which is no longer a mode of its
 * own (design §1, §9).
 *
 * Level 1 (More Powers): one power repeated, (x²)(x²)(x²). The student types
 * how many x's that is in all. Right → the copies crush into x⁶ (Mode 1's crush).
 *
 * Level 2 (Two Exponents): the compact form, (x²)³. Same question. Right →
 * the parentheses go, and the two exponents crush into one: x⁶.
 *
 * Level 3 (Any Base): (x⁻²)³, with zero and negative exponents, answered in
 * the math answer box. Right → x⁻⁶, crushed as at Level 2.
 *
 * Level 4 (Many Bases): several bases in one set of parentheses, (3x²y)⁴.
 * Right → the outer exponent goes to every base at once, and every pair
 * crushes: 81x⁸y⁴.
 *
 * Levels 1 and 2 show an exponent of 1 ((x¹)⁴); Levels 3 and 4 hide an inner
 * 1 ((x)⁻³, (xy²)³) and show 0. The outer exponent is never 1. The 1000
 * constant cap is lifted for the problem (Mode 1 design §9); only Level 4's
 * coefficient answer keeps it. Grading and history are Mode 1's (product.js).
 */
(function (PC) {
  'use strict';
  var E = PC.Expr, G = PC.Generate, Pr = PC.Product;
  var power = Pr.power, baseNode = Pr.baseNode;

  var LEVEL1 = {
    baseMin: 2, baseMax: 10,       // design §4: a constant 2 to 10 or x, y, z, 50/50
    variables: ['x', 'y', 'z'],
    expMin: 1, expMax: 10,         // the inner exponent, 1 shown
    copiesMin: 2, copiesMax: 10,
  };

  var LEVEL2 = {
    baseMin: 2, baseMax: 10,       // design §5: bases as Level 1
    variables: ['x', 'y', 'z'],
    expMin: 1, expMax: 10,         // inner, 1 shown
    outerMin: 2, outerMax: 10,     // outer, never 1
  };

  // Design §6, §7: Mode 1's weighting. About 1 problem in 4 has a zero or
  // negative given exponent (one or two of them, inner or outer); about 1 in 4
  // of those is 0, the rest −1 to −10. Every other inner exponent is 1 to 10,
  // and every other outer exponent 2 to 10.
  var LEVEL3 = {
    baseMin: 2, baseMax: 10,
    variables: ['x', 'y', 'z'],
    expMin: -10, expMax: 10,
    outerMin: 2,
    lowShare: 0.25, lowMin: 1, lowMax: 2, zeroShare: 0.25,
  };

  var LEVEL4 = {
    basesMin: 2, basesMax: 4,      // design §7: 2, 3 or 4 bases from {constant, x, y, z}
    constMin: 2, constMax: 10,
    expMin: -10, expMax: 10,
    outerMin: 2,
    coefMax: 1000,                 // design §7: a coefficient answer c^m stays within 1000
    lowShare: 0.25, lowMin: 1, lowMax: 2, zeroShare: 0.25,
  };

  /* "How many x’s …" for a letter, "How many 3s …" for a number (design §4). */
  function question(b) {
    return 'How many ' + b + (typeof b === 'number' ? 's' : '’s') + ' are being multiplied together?';
  }

  function drawBase(r, L) {
    return r() < 0.5 ? G.int(r, L.baseMin, L.baseMax) : G.pick(r, L.variables);
  }

  /* ---- Level 1 --------------------------------------------------------------- */
  /* (x²)(x²)(x²) → x⁶. The copies sit side by side with no dot, and are read
     "x to the power 2, times x to the power 2, …" (design §4). */
  function problem1(b, n, copies) {
    var factors = [];
    for (var i = 0; i < copies; i++) factors.push(E.G(E.P(baseNode(b), n)));
    return {
      level: 1, base: b, exp: n, copies: copies, count: n * copies,
      shown: { t: 'mul', factors: factors, times: true },
      answer: E.P(baseNode(b), n * copies),
      question: question(b),
    };
  }

  /* [ASSUMPTION §4] The inner exponent and the number of copies are drawn on
     their own, each uniformly. */
  function template1(r) {
    var p = problem1(drawBase(r, LEVEL1), G.int(r, LEVEL1.expMin, LEVEL1.expMax),
      G.int(r, LEVEL1.copiesMin, LEVEL1.copiesMax));
    p.shown.pc = p;   // read back below; dropped before the tree is kept
    return p.shown;
  }

  /* ---- Level 2 --------------------------------------------------------------- */
  /* (x²)³ → x⁶. An inner exponent of 1 is shown: (x¹)⁴ (design §5). */
  function problem2(b, n, m) {
    return {
      level: 2, base: b, exps: [n, m], count: n * m,
      shown: E.P(E.G(E.P(baseNode(b), n)), m),
      answer: E.P(baseNode(b), n * m),
      question: question(b),
      plan: { type: 'outer' },
    };
  }

  function template2(r) {
    var p = problem2(drawBase(r, LEVEL2), G.int(r, LEVEL2.expMin, LEVEL2.expMax),
      G.int(r, LEVEL2.outerMin, LEVEL2.outerMax));
    p.shown.pc = p;
    return p.shown;
  }

  /* ---- Level 3 --------------------------------------------------------------- */
  /* (x⁻²)³ → x⁻⁶. An inner 1 is hidden, (x)⁻³, and 0 is shown, (x⁰)⁵. The
     app's answer is one power, zero and negative exponents kept (design §6). */
  function problem3(b, n, m) {
    return {
      level: 3, base: b, exps: [n, m], product: n * m,
      shown: E.P(E.G(power(baseNode(b), n)), m),
      answer: power(baseNode(b), n * m),
      constant: typeof b === 'number' ? { form: 'power', value: b, exp: n * m } : null,
      question: 'Simplify the expression by writing it as a single base to a power.',
      plan: { type: 'outer' },
    };
  }

  function template3(r) {
    var e = Pr.lower(r, LEVEL3, [G.int(r, 1, LEVEL3.expMax), G.int(r, LEVEL3.outerMin, LEVEL3.expMax)]);
    var p = problem3(drawBase(r, LEVEL3), e[0], e[1]);
    p.shown.pc = p;
    return p.shown;
  }

  /* ---- Level 4 --------------------------------------------------------------- */
  /* One Level 4 problem as data: which bases, the constant's form, each
     factor as [key, value, inner exponent] (null for a coefficient), and the
     outer exponent. Tests build their own:
     { keys: ['c', 'x', 'y'], form: 'coef', factors: [['c', 3, null], ['x', 'x', 2], ['y', 'y', 1]], outer: 4 } */
  function draw4(r) {
    var L = LEVEL4;
    var keys = Pr.shuffle(r, Pr.ORDER).slice(0, G.int(r, L.basesMin, L.basesMax));
    keys.sort(function (a, b) { return Pr.ORDER.indexOf(a) - Pr.ORDER.indexOf(b); });
    // [ASSUMPTION §7] The constant, when there is one, is a coefficient or a
    // constant power, 50/50. 2, 3 or 4 bases from four leaves 25% with none.
    var form = keys[0] === 'c' ? (r() < 0.5 ? 'coef' : 'power') : null;
    var factors = keys.map(function (k) {
      if (k !== 'c') return [k, k, G.int(r, 1, L.expMax)];
      // A constant power with an inner 1 would look like a coefficient (Mode 1
      // Level 4 rule): its inner exponent is drawn from 2.
      return form === 'coef' ? ['c', G.int(r, L.constMin, L.constMax), null]
        : ['c', G.int(r, L.constMin, L.constMax), G.int(r, 2, L.expMax)];
    });
    var slots = factors.filter(function (f) { return f[2] !== null; });
    var exps = Pr.lower(r, L, slots.map(function (f) { return f[2]; }).concat(G.int(r, L.outerMin, L.expMax)));
    slots.forEach(function (f, i) { f[2] = exps[i]; });
    var outer = exps[exps.length - 1];
    // [My call] A coefficient over the cap (c^m > 1000 for a positive m) draws
    // the coefficient and outer exponent again, not the whole problem, so the
    // 50/50 forms, the 25% with no constant and the 25% weighting all hold.
    var c = factors[0];
    while (form === 'coef' && outer > 0 && Math.pow(c[1], outer) > L.coefMax) {
      c[1] = G.int(r, L.constMin, L.constMax);
      outer = G.int(r, L.outerMin, L.expMax);
    }
    return { keys: keys, form: form, factors: factors, outer: outer };
  }

  function factorNode(f) { return f[2] === null ? E.N(f[1]) : power(baseNode(f[1]), f[2]); }
  function product(fs) { return fs.length === 1 ? fs[0] : { t: 'mul', factors: fs }; }

  /* What one factor becomes (design §7): a coefficient to a positive power is
     its plain value (3 → 81); to a zero or negative power it keeps the power
     (3⁻², 5⁰). Every other base keeps its base, with the exponents multiplied. */
  function part(f, m) {
    if (f[2] === null) return m > 0 ? E.N(Math.pow(f[1], m)) : E.P(E.N(f[1]), m);
    return power(baseNode(f[1]), f[2] * m);
  }

  function problem4(d) {
    var m = d.outer, c = d.factors[0];
    return {
      level: 4, keys: d.keys, form: d.form, factors: d.factors, outer: m,
      shown: E.P(E.G(product(d.factors.map(factorNode))), m),
      answer: product(d.factors.map(function (f) { return part(f, m); })),
      // Either form may be typed as its base to a power or as its value:
      // 3⁴x⁸ or 81x⁸ (Dr. Cole, 2026-09-28, answering design §11), 3⁻²x⁻² or
      // 1/(9x²) (design §7), 2⁶x⁴ or 64x⁴.
      constant: d.form ? { form: 'power', value: c[1], exp: (c[2] === null ? 1 : c[2]) * m } : null,
      question: 'Simplify the expression.',   // [ASSUMPTION §7] as Modes 1 and 2
      plan: { type: 'outer' },
    };
  }

  function template4(r) {
    var p = problem4(draw4(r));
    p.shown.pc = p;
    return p.shown;
  }

  /* ---- every level ----------------------------------------------------------- */
  /* A level's `make`: draw until the problem is within the handoff §4 limits
     and is not the previous problem again (design §2). */
  function maker(n, template) {
    return function (r, prev) {
      for (var i = 0; i < 50; i++) {
        var tree = G.generate(template, r, 1000, { constCap: false }).tree;
        var p = tree.pc;
        delete tree.pc;
        if (prev && E.toText(prev.shown) === E.toText(tree)) continue;
        return p;
      }
      throw new Error('level ' + n + ' kept repeating the previous problem');
    };
  }

  var LEVELS = [
    { n: 1, title: 'More Powers', make: maker(1, template1), input: 'count' },   // names: design §2
    { n: 2, title: 'Two Exponents', make: maker(2, template2), input: 'count' },
    { n: 3, title: 'Any Base', make: maker(3, template3), input: 'math' },
    { n: 4, title: 'Many Bases', make: maker(4, template4), input: 'math' },
  ];

  PC.Power = { LEVEL1: LEVEL1, LEVEL2: LEVEL2, LEVEL3: LEVEL3, LEVEL4: LEVEL4, LEVELS: LEVELS,
    level1: LEVELS[0].make, level2: LEVELS[1].make, level3: LEVELS[2].make, level4: LEVELS[3].make,
    problem1: problem1, problem2: problem2, problem3: problem3, problem4: problem4, draw4: draw4,
    // Grading and history are Mode 1's.
    clean: Pr.clean, grade: Pr.grade, gradeMath: Pr.gradeMath, entry: Pr.entry };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
