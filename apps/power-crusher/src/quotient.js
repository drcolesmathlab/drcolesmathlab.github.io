/*
 * quotient.js — Mode 2, Quotient of Powers: problems and grading (no DOM).
 *
 * Design: "Power Crusher: Mode 2 Design, Quotient of Powers" (2026-09-27).
 * Every problem is a vertical fraction.
 *
 * Level 1 (Cancel Out): one constant base written out, more factors on top
 * than below (3 · 3 · 3 · 3 · 3 over 3 · 3 · 3). The student types how many
 * are left after canceling. Right → the canceled pairs light up left to
 * right, crush, and what is left becomes 3².
 *
 * Level 2 (Two Powers): 3⁶ over 3², the top exponent always larger. The
 * student types how many are left. Right → the fraction crushes into 3⁴.
 *
 * Level 3 (Any Base): one base, a constant 2 to 10 or x, y, z, exponents −10
 * to 10 (x³ over x⁵). Answered in the math answer box. Right → x⁻².
 *
 * Level 4 (Many Bases): a product over a product (12x⁵y²z over 4x²z⁶). Like
 * bases gather in columns, then every column with a base top and bottom
 * crushes at once: 3x³y²z⁻⁵. A base only below stays below (Dr. Cole).
 *
 * Levels 1 and 2 draw an exponent of 1 (3¹); Levels 3 and 4 hide it (x), and
 * draw 0 (x⁰), as in Mode 1. The 1000 constant cap is lifted (Mode 1 design
 * §9), because values are never shown. Grading is Mode 1's (product.js).
 */
(function (PC) {
  'use strict';
  var E = PC.Expr, G = PC.Generate, Pr = PC.Product;
  var power = Pr.power, baseNode = Pr.baseNode;

  var LEVEL1 = {
    baseMin: 2, baseMax: 10,     // handoff §4
    topMin: 2, topMax: 10,       // design §4: 2 to 10 factors on top,
    bottomMin: 1,                // 1 to 9 below, always fewer than on top
  };

  var LEVEL2 = {
    baseMin: 2, baseMax: 10,     // handoff §4
    expMin: 1, expMax: 10,       // design §5: the top exponent is always larger,
  };                             // so the answer is 1 to 9

  // Levels 3 and 4 use Mode 1's numbers (design §6 and §7; the 25% weighting
  // confirmed by Dr. Cole, 2026-09-27).
  var LEVEL3 = Pr.LEVEL3, LEVEL4 = Pr.LEVEL4;

  function repeat(base, n) {
    if (n === 1) return E.N(base);
    return Pr.expanded(base, n);
  }

  function question(base) { return 'How many ' + base + 's are left after canceling?'; }

  /* ---- Level 1 --------------------------------------------------------------- */
  /* 3 · 3 · 3 · 3 · 3 over 3 · 3 · 3 → 3². The canceled pairs are the first
     `bottom` factors on top and every factor below. */
  function problem1(base, top, bottom) {
    return {
      level: 1, base: base, top: top, bottom: bottom, count: top - bottom,
      shown: E.D(repeat(base, top), repeat(base, bottom)),
      answer: E.P(E.N(base), top - bottom),     // 3¹ when one is left [ASSUMPTION, design §4]
      question: question(base),
      plan: { type: 'cancel', pairs: bottom },
    };
  }

  /* [My call] The number on top is drawn first, 2 to 10, then the number below,
     1 to one less, so every numerator length is equally likely. */
  function template1(r) {
    var top = G.int(r, LEVEL1.topMin, LEVEL1.topMax);
    var p = problem1(G.int(r, LEVEL1.baseMin, LEVEL1.baseMax), top, G.int(r, LEVEL1.bottomMin, top - 1));
    p.shown.pc = p;   // read back below; dropped before the tree is kept
    return p.shown;
  }

  /* ---- Level 2 --------------------------------------------------------------- */
  /* 3⁶ over 3² → 3⁴. An exponent of 1 is drawn, 3¹ (design §5). */
  function problem2(base, a, b) {
    return {
      level: 2, base: base, exps: [a, b], count: a - b,
      shown: E.D(E.P(E.N(base), a), E.P(E.N(base), b)),
      answer: E.P(E.N(base), a - b),
      question: question(base),
      plan: { type: 'vertical' },
    };
  }

  /* [My call] As at Level 1: the top exponent 2 to 10, then the one below 1 to
     one less. */
  function template2(r) {
    var a = G.int(r, LEVEL2.expMin + 1, LEVEL2.expMax);
    var p = problem2(G.int(r, LEVEL2.baseMin, LEVEL2.baseMax), a, G.int(r, LEVEL2.expMin, a - 1));
    p.shown.pc = p;
    return p.shown;
  }

  /* ---- Level 3 --------------------------------------------------------------- */
  /* x³ over x⁵ → x⁻². The fraction always crushes to one power, even for a
     negative or zero result (design §6). */
  function problem3(b, a, c) {
    return {
      level: 3, base: b, exps: [a, c], diff: a - c,
      shown: E.D(power(baseNode(b), a), power(baseNode(b), c)),
      answer: power(baseNode(b), a - c),
      constant: typeof b === 'number' ? { form: 'power', value: b, exp: a - c } : null,
      question: 'Simplify the expression by writing it as a single base to a power.',
      plan: { type: 'vertical' },
    };
  }

  function template3(r) {
    var b = r() < 0.5 ? G.int(r, LEVEL3.baseMin, LEVEL3.baseMax) : G.pick(r, LEVEL3.variables);
    var e = Pr.lower(r, LEVEL3, [G.int(r, 1, LEVEL3.expMax), G.int(r, 1, LEVEL3.expMax)]);
    var p = problem3(b, e[0], e[1]);
    p.shown.pc = p;
    return p.shown;
  }

  /* ---- Level 4 --------------------------------------------------------------- */
  function factorNode(f) { return f[2] === null ? E.N(f[1]) : power(baseNode(f[1]), f[2]); }
  function product(factors) { return factors.length === 1 ? factors[0] : { t: 'mul', factors: factors }; }

  /* Each base's column, in answer order (constant, x, y, z): the factor on top,
     the factor below (either may be missing), and what the column becomes.
     Coefficients divide and are kept as a fraction in lowest terms (design §7):
     12 over 4 is 3, 3 over 4 stays 3/4. A base top and bottom subtracts
     exponents; a base on one side only stays as it was, on its side. */
  function columns(d) {
    return d.keys.map(function (k) {
      var top = d.terms[0].filter(function (f) { return f[0] === k; })[0] || null;
      var bottom = d.terms[1].filter(function (f) { return f[0] === k; })[0] || null;
      var col = { key: k, top: top && factorNode(top), bottom: bottom && factorNode(bottom) };
      if (k === 'c' && d.form === 'coef') {
        var q = PC.Rational.make(top[1], bottom[1]);
        col.coef = { n: Number(q.n), d: Number(q.d) };
      } else if (!top) {
        col.below = true;
        col.to = col.bottom;
      } else {
        col.exp = top[2] - (bottom ? bottom[2] : 0);
        col.to = power(baseNode(top[1]), col.exp);
      }
      return col;
    });
  }

  /* The app's answer. Only a base top and bottom uses the property, and lands
     on top whatever the sign of its exponent (x³/x⁵ = x⁻²). A base only below
     stays below as it was: moving it up would confuse a student new to the
     property (Dr. Cole, 2026-09-27, replacing design §7's y⁻²). A coefficient's
     denominator goes below, first: 3x⁵ over 4x²y² = 3x³/(4y²).
     `land` is which column each drawn part of the answer grows out of: the
     parts on top in order, then the parts below. */
  function answer4(cols) {
    var top = [], bottom = [], landTop = [], landBottom = [];
    cols.forEach(function (c, i) {
      if (c.coef) {
        if (c.coef.n !== 1) { top.push(E.N(c.coef.n)); landTop.push(i); }
        if (c.coef.d !== 1) { bottom.push(E.N(c.coef.d)); landBottom.push(i); }
      } else if (c.below) {
        bottom.push(c.to); landBottom.push(i);
      } else {
        top.push(c.to); landTop.push(i);
      }
    });
    // Nothing left on top (2 over 4z¹⁰: the coefficient is 1/2 and z is only
    // below): the numerator is 1, grown out of the coefficient's column.
    if (!top.length) { top.push(E.N(1)); landTop.push(0); }
    var tree = product(top);
    if (bottom.length) tree = E.D(tree, product(bottom));
    return { tree: tree, land: landTop.concat(landBottom) };
  }

  /* The problem for one draw. Tests build their own `d`, as for Mode 1:
     { keys: ['c', 'x'], form: 'coef', terms: [[['c', 12, null], ['x', 'x', 5]], [['c', 4, null], ['x', 'x', 2]]] }
     Term 0 is the numerator, term 1 the denominator. */
  function problem4(d) {
    var cols = columns(d), a = answer4(cols), c0 = cols[0];
    return {
      level: 4, keys: d.keys, form: d.form, terms: d.terms,
      shown: E.D(product(d.terms[0].map(factorNode)), product(d.terms[1].map(factorNode))),
      answer: a.tree,
      constant: d.form === 'coef' ? { form: 'coef', value: c0.coef.n, den: c0.coef.d }
        : d.form === 'power' ? { form: 'power', value: d.terms[0][0][1], exp: c0.exp } : null,
      denOne: true,   // 3x³/1 is correct (Dr. Cole, 2026-09-27)
      question: 'Simplify the expression.',   // [ASSUMPTION] as Mode 1 Level 4
      plan: {
        type: 'columns',
        order: d.terms[0].map(function (f) { return [f[0], 0]; }).concat(d.terms[1].map(function (f) { return [f[0], 1]; })),
        columns: cols.map(function (c) { return { key: c.key, top: c.top, bottom: c.bottom }; }),
        land: a.land,
      },
    };
  }

  function template4(r) {
    var p = problem4(Pr.draw4(r, LEVEL4));
    p.shown.pc = p;
    return p.shown;
  }

  /* A constant power with both exponents 1 would draw as 2x² over 2x⁵, which
     looks like coefficient form (design §7). Draw again. */
  function plainConstant(p) {
    return p.form === 'power' && p.terms[0][0][2] === 1 && p.terms[1][0][2] === 1;
  }

  /* A variable only below stays below as it was, so a negative exponent there
     would land as 1/y⁻³. Draw again (Dr. Cole, 2026-09-27). 0 is still drawn. */
  function negativeBelow(p) {
    var top = p.terms[0].map(function (f) { return f[0]; });
    return p.terms[1].some(function (f) { return f[0] !== 'c' && top.indexOf(f[0]) < 0 && f[2] < 0; });
  }

  /* ---- every level ----------------------------------------------------------- */
  /* A level's `make`: draw until the problem is within the handoff §4 limits,
     is allowed, and is not the previous problem again (design §2). */
  function maker(n, template, allowed) {
    return function (r, prev) {
      for (var i = 0; i < 50; i++) {
        var tree = G.generate(template, r, 1000, { constCap: false }).tree;
        var p = tree.pc;
        delete tree.pc;
        if (allowed && !allowed(p)) continue;
        if (prev && E.toText(prev.shown) === E.toText(tree)) continue;
        return p;
      }
      throw new Error('level ' + n + ' kept repeating the previous problem');
    };
  }

  var level1 = maker(1, template1), level2 = maker(2, template2), level3 = maker(3, template3);
  var level4 = maker(4, template4, function (p) { return !plainConstant(p) && !negativeBelow(p); });

  var LEVELS = [
    { n: 1, title: 'Cancel Out', make: level1, input: 'count' },   // names: Dr. Cole, 2026-09-27
    { n: 2, title: 'Two Powers', make: level2, input: 'count' },
    { n: 3, title: 'Any Base', make: level3, input: 'math' },
    { n: 4, title: 'Many Bases', make: level4, input: 'math' },
  ];

  PC.Quotient = { LEVEL1: LEVEL1, LEVEL2: LEVEL2, LEVEL3: LEVEL3, LEVEL4: LEVEL4, LEVELS: LEVELS,
    level1: level1, level2: level2, level3: level3, level4: level4,
    problem1: problem1, problem2: problem2, problem3: problem3, problem4: problem4,
    // Grading and history are Mode 1's.
    clean: Pr.clean, grade: Pr.grade, gradeMath: Pr.gradeMath, entry: Pr.entry };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
