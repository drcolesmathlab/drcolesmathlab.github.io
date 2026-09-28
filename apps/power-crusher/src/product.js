/*
 * product.js — Mode 1, Product of Powers: problems and grading (no DOM).
 *
 * Design: "Mode 1 Design, Product of Powers" (2026-09-27), "Mode 1, Level 2
 * Build Spec", and the "Mode 1, Level 3" and "Level 4" specs (all 2026-09-27).
 *
 * Level 1 (Warm-up): one constant base, 2 to 10, written out as repeated
 * multiplication (3 · 3 · 3 · 3). The student types how many factors there are.
 * Right → the factors crush into 3⁴.
 *
 * Level 2 (Two Powers): two powers of the same constant base, compact form only
 * (3⁶ · 3³). The student types how many 3s that is in all. Right → the two
 * powers merge into 3⁹.
 *
 * Level 3 (Any Base): two powers of one base, a constant 2 to 10 or x, y, z,
 * with exponents −10 to 10 (x³ · x⁻⁵). The student types the answer in the
 * math answer box. Right → the two powers merge into x⁻².
 *
 * Level 4 (Many Bases): two terms, 2 to 4 bases in all (3x²y³z · 4x⁵z⁶). Like
 * bases group together, then each group crushes: 12x⁷y³z⁷.
 *
 * At Levels 3 and 4 an exponent of 1 is never drawn (x, not x¹); 0 is (x⁰).
 * The 1000 constant cap does not apply to any level (design §9), because
 * values are never shown.
 */
(function (PC) {
  'use strict';
  var E = PC.Expr, G = PC.Generate;

  var LEVEL1 = {
    baseMin: 2, baseMax: 10,     // handoff §4
    countMin: 2, countMax: 10,   // Dr. Cole, 2026-09-27: 2 to 10, never a lone factor
  };

  var LEVEL2 = {
    baseMin: 2, baseMax: 10,     // handoff §4
    expMin: 1, expMax: 10,       // Level 2 spec §2: each power 1 to 10, so the total is 2 to 20
  };

  function expanded(base, count) {
    var factors = [];
    for (var i = 0; i < count; i++) factors.push(E.N(base));
    return { t: 'mul', factors: factors, dot: true };
  }

  function template(r) {
    return expanded(G.int(r, LEVEL1.baseMin, LEVEL1.baseMax), G.int(r, LEVEL1.countMin, LEVEL1.countMax));
  }

  /* A new Level 1 problem. `prev` (the last problem) is never repeated exactly,
     so Next always visibly changes something. */
  function level1(r, prev) {
    for (var i = 0; i < 50; i++) {
      var tree = G.generate(template, r, 1000, { constCap: false }).tree;
      var base = tree.factors[0].v, count = tree.factors.length;
      if (prev && prev.base === base && prev.count === count) continue;
      return {
        level: 1, base: base, count: count,
        shown: tree,
        answer: E.P(E.N(base), count),
        question: 'How many ' + base + 's are being multiplied together?',
      };
    }
    throw new Error('level 1 kept repeating the previous problem');
  }

  /* 3⁶ · 3³. An exponent of 1 is drawn, 3¹ (Level 2 spec §2 [ASSUMPTION]). */
  function compact(base, a, b) {
    return { t: 'mul', factors: [E.P(E.N(base), a), E.P(E.N(base), b)], dot: true };
  }

  function template2(r) {
    var base = G.int(r, LEVEL2.baseMin, LEVEL2.baseMax);
    return compact(base, G.int(r, LEVEL2.expMin, LEVEL2.expMax), G.int(r, LEVEL2.expMin, LEVEL2.expMax));
  }

  /* A new Level 2 problem. Each exponent is drawn on its own, so 3⁴ · 3⁴ can
     come up (Level 2 spec §2 [ASSUMPTION]). Like Level 1, `prev` is never
     repeated exactly (Dr. Cole). `count` is the answer: how many times the base
     is multiplied in all. */
  function level2(r, prev) {
    for (var i = 0; i < 50; i++) {
      var tree = G.generate(template2, r, 1000, { constCap: false }).tree;
      var base = tree.factors[0].base.v;
      var exps = [tree.factors[0].exp, tree.factors[1].exp];
      if (prev && prev.base === base && prev.exps[0] === exps[0] && prev.exps[1] === exps[1]) continue;
      return {
        level: 2, base: base, exps: exps, count: exps[0] + exps[1],
        shown: tree,
        answer: E.P(E.N(base), exps[0] + exps[1]),
        question: 'How many ' + base + 's are being multiplied together?',
      };
    }
    throw new Error('level 2 kept repeating the previous problem');
  }

  /* The field only takes whole numbers; anything else is stripped as it is typed. */
  function clean(text) { return String(text || '').replace(/\D+/g, '').replace(/^0+(?=\d)/, '').slice(0, 3); }

  /* 'empty' is not a submission: nothing is graded or counted. */
  function grade(problem, text) {
    var t = clean(text);
    if (t === '') return { status: 'empty' };
    return { status: +t === problem.count ? 'correct' : 'wrong', value: +t };
  }

  /* What the history panel keeps for a correct problem: 3 · 3 · 3 · 3 = 3⁴, or
     3⁶ · 3³ = 3⁹. "=" at every level (Dr. Cole, 2026-09-27), not the spec's arrow.
     Always the app's own answer, never the student's typed form (x⁻², not 1/x²). */
  function entry(problem) { return { from: problem.shown, to: problem.answer }; }

  /* ---- Levels 3 and 4: the math answer box ---------------------------------- */

  var LEVEL3 = {
    baseMin: 2, baseMax: 10,     // Level 3 spec §2: half constant 2 to 10,
    variables: ['x', 'y', 'z'],  // half x, y or z, each equally likely [ASSUMPTION]
    expMin: -10, expMax: 10,     // every given exponent stays within these
    // Dr. Cole, 2026-09-27, as at Level 4: about 1 problem in 4 has a negative or
    // zero exponent (one or both); every other exponent is 1 to 10. About 1 in 4
    // of those is 0, the rest −1 to −10.
    lowShare: 0.25, lowMin: 1, lowMax: 2, zeroShare: 0.25,
  };

  var LEVEL4 = {
    basesMin: 2, basesMax: 4,    // Level 4 spec §2: 2, 3 or 4 bases, equally likely [ASSUMPTION]
    constMin: 2, constMax: 10,   // coefficients and constant bases
    expMin: -10, expMax: 10,     // every given exponent stays within these
    unmatched: 1 / 3,            // share of problems with a variable in one term only
    // Dr. Cole, 2026-09-27: about 1 problem in 4 has a negative or zero exponent,
    // one or two of them; every other exponent is 1 to 10. About 1 in 4 of those
    // is 0, the rest −1 to −10.
    lowShare: 0.25, lowMin: 1, lowMax: 2, zeroShare: 0.25,
  };

  /* x³, or x for an exponent of 1 (never drawn at Levels 3 and 4). */
  function power(base, e) { return e === 1 ? base : E.P(base, e); }
  function baseNode(b) { return typeof b === 'number' ? E.N(b) : E.V(b); }
  function textOf(tree) { return E.toText(tree); }

  /* x³ · x⁻⁵ → x⁻². `b` is a number or 'x', 'y', 'z'. */
  function problem3(b, a, c) {
    return {
      level: 3, base: b, exps: [a, c], sum: a + c,
      shown: { t: 'mul', factors: [power(baseNode(b), a), power(baseNode(b), c)], dot: true },
      answer: power(baseNode(b), a + c),
      constant: typeof b === 'number' ? { form: 'power', value: b, exp: a + c } : null,
      question: 'Simplify the expression by writing it as a single base to a power.',
    };
  }

  /* Exponents 1 to 10, except that about 1 problem in L.lowShare gets
     L.lowMin to L.lowMax of them negative or zero. `exps` is changed in place. */
  function lower(r, L, exps) {
    if (r() >= L.lowShare) return exps;
    var at = shuffle(r, exps.map(function (_, i) { return i; }));
    at.slice(0, G.int(r, L.lowMin, L.lowMax)).forEach(function (i) {
      exps[i] = r() < L.zeroShare ? 0 : G.int(r, L.expMin, -1);
    });
    return exps;
  }

  function template3(r) {
    var b = r() < 0.5 ? G.int(r, LEVEL3.baseMin, LEVEL3.baseMax) : G.pick(r, LEVEL3.variables);
    var e = lower(r, LEVEL3, [G.int(r, 1, LEVEL3.expMax), G.int(r, 1, LEVEL3.expMax)]);
    var p = problem3(b, e[0], e[1]);
    p.shown.pc = p;   // read back below; dropped before the tree is kept
    return p.shown;
  }

  /* Like Levels 1 and 2, `prev` is never repeated exactly (spec §2). */
  function level3(r, prev) {
    for (var i = 0; i < 50; i++) {
      var tree = G.generate(template3, r, 1000, { constCap: false }).tree;
      var p = tree.pc;
      delete tree.pc;
      if (prev && textOf(prev.shown) === textOf(tree)) continue;
      return p;
    }
    throw new Error('level 3 kept repeating the previous problem');
  }

  var ORDER = ['c', 'x', 'y', 'z'];   // answer order: constant first, then alphabetical

  function shuffle(r, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* One Level 4 problem as data: which bases, the constant's form, and each
     term's factors as [key, value, exponent] (the exponent is null for a
     coefficient). Exponents are drawn per factor. Mode 2 draws its fractions
     with this too (`L` is its own LEVEL4): term 0 on top, term 1 below. */
  function draw4(r, L) {
    L = L || LEVEL4;
    var x = function () { return G.int(r, 1, L.expMax); };
    var n = G.int(r, L.basesMin, L.basesMax);
    var keys = shuffle(r, ORDER).slice(0, n);
    keys.sort(function (a, b) { return ORDER.indexOf(a) - ORDER.indexOf(b); });
    var hasC = keys[0] === 'c', vars = keys.filter(function (k) { return k !== 'c'; });
    var form = hasC ? (r() < 0.5 ? 'coef' : 'power') : null;
    // [ASSUMPTION] The constant is always in both terms; only variables are
    // unmatched. At least one base stays in both terms, so something combines.
    var alone = {};
    if (r() < L.unmatched) {
      var most = vars.length - (hasC ? 0 : 1);
      shuffle(r, vars).slice(0, G.int(r, 1, most)).forEach(function (v) { alone[v] = G.int(r, 0, 1); });
    }
    var terms = [[], []], cBase = G.int(r, L.constMin, L.constMax);
    keys.forEach(function (k) {
      if (k === 'c') {
        if (form === 'coef') {
          terms[0].push(['c', G.int(r, L.constMin, L.constMax), null]);
          terms[1].push(['c', G.int(r, L.constMin, L.constMax), null]);
        } else {
          terms[0].push(['c', cBase, x()]);
          terms[1].push(['c', cBase, x()]);
        }
      } else if (k in alone) {
        terms[alone[k]].push([k, k, x()]);
      } else {
        terms[0].push([k, k, x()]);
        terms[1].push([k, k, x()]);
      }
    });
    var slots = terms[0].concat(terms[1]).filter(function (f) { return f[2] !== null; });
    lower(r, L, slots.map(function (f) { return f[2]; })).forEach(function (e, i) { slots[i][2] = e; });
    return { keys: keys, form: form, terms: terms };
  }

  function factorNode(f) { return f[2] === null ? E.N(f[1]) : power(baseNode(f[1]), f[2]); }
  function product(factors) { return factors.length === 1 ? factors[0] : { t: 'mul', factors: factors }; }

  /* The problem for one draw. Tests build their own `d`:
     { keys: ['c', 'x'], form: 'coef', terms: [[['c', 3, null], ['x', 'x', 2]], [...]] }. */
  function problem4(d) {
    var groups = groups4(d);
    return {
      level: 4, keys: d.keys, form: d.form, terms: d.terms,
      order: d.terms[0].concat(d.terms[1]).map(function (f) { return f[0]; }),
      shown: { t: 'mul', dot: true, factors: d.terms.map(function (term) { return product(term.map(factorNode)); }) },
      groups: groups,
      answer: product(groups.map(function (g) { return g.to; })),
      constant: d.form === 'coef' ? { form: 'coef', value: groups[0].to.v, den: 1 }
        : d.form === 'power' ? { form: 'power', value: d.terms[0][0][1], exp: d.terms[0][0][2] + d.terms[1][0][2] } : null,
      question: 'Simplify the expression.',
    };
  }

  function template4(r) {
    var p = problem4(draw4(r));
    p.shown.pc = p;
    return p.shown;
  }

  /* Each base's factors in answer order, with what they crush into: the
     coefficients' product, or the base to the sum of its exponents. */
  function groups4(d) {
    return d.keys.map(function (k) {
      var fs = d.terms[0].concat(d.terms[1]).filter(function (f) { return f[0] === k; });
      var to;
      if (k === 'c' && d.form === 'coef') to = E.N(fs.reduce(function (p, f) { return p * f[1]; }, 1));
      else to = power(baseNode(fs[0][1]), fs.reduce(function (s, f) { return s + f[2]; }, 0));
      return { key: k, from: fs.map(factorNode), to: to };
    });
  }

  function level4(r, prev) {
    for (var i = 0; i < 50; i++) {
      var tree = G.generate(template4, r, 1000, { constCap: false }).tree;
      var p = tree.pc;
      delete tree.pc;
      // A constant power with both exponents 1 would draw as 2x² · 2x⁵, which is
      // coefficient form on screen but graded as 2²x⁷. Draw again.
      if (p.form === 'power' && p.terms[0][0][2] === 1 && p.terms[1][0][2] === 1) continue;
      if (prev && textOf(prev.shown) === textOf(tree)) continue;
      return p;
    }
    throw new Error('level 4 kept repeating the previous problem');
  }

  /* Levels 3 and 4 grade the answer box. Two steps:
     1. The checker: equal to the answer, and no base written twice (x³x⁴, or
        3·4 left unmultiplied, typed as 3¹4). Anything equal is fine otherwise:
        x¹, x⁰ or 1, x⁻² or 1/x², bases in any order.
     2. The numbers typed (numbersOk). A 1 is always fine as a plain number: the
        whole answer, a numerator (1/x²) or a coefficient (1x⁷, Mode 2 design
        §9.1). Any other number must be the problem's constant:
        - a constant power, as its base to any power, or evaluated: 3⁹ or 19683,
          3⁻² or 1/9, 2⁷x⁷ or 128x⁷ (Mode 2 design §9.2, and Dr. Cole,
          2026-09-27: at Level 3 too, in both modes);
        - a coefficient, as one plain number (Dr. Cole, 2026-09-27): 16x⁷, not
          4²x⁷ or 2⁴x⁷. A Mode 2 coefficient can be a fraction in lowest terms,
          so its numerator and denominator are each one plain number: 3x³/2,
          not 6x³/4 (Mode 2 design §7 [ASSUMPTION]). */
  var POLICY = { id: 'product-3', issues: ['REPEATED_BASE', 'UNCOMBINED_CONSTANTS'], notes: [] };

  /* `constant`: { form: 'power', value: base, exp: the answer's exponent },
     { form: 'coef', value: numerator, den: denominator }, a list of constant
     powers (Mode 4: one top and one below, each typed once, as its base to a
     power or its value: 2²/3² or 4/9), or null.
     `opts.denOne`: a denominator of 1 is allowed (3x³/1, Mode 2 Level 4 only). */
  function numbersOk(tree, constant, opts) {
    var denOne = !!(opts && opts.denOne), used = 0, ok = true;
    var coef = constant && constant.form === 'coef' ? constant : null;
    var powers = coef ? [] : [].concat(constant || []).map(function (c) {
      return { value: c.value, evaluated: PC.Rational.pow(PC.Rational.make(c.value), Math.abs(c.exp)).n };
    });
    function row(node, where) {
      var fs = node.t === 'mul' ? node.factors : [node];
      fs.forEach(function (f) {
        if (f.t === 'div') { row(f.num, 'num'); row(f.den, 'den'); return; }
        var n = f.t === 'num' ? f : f.t === 'pow' && f.base.t === 'num' ? f.base : null;
        if (!n) return;
        var e = f.t === 'pow' ? f.exp : null, plain = e === null || e === 1;
        if (n.v === 1) { if (e !== null || (where === 'den' && !denOne)) ok = false; return; }
        used++;
        if (coef) {
          if (!plain || n.v !== (where === 'den' ? coef.den : coef.value)) ok = false;
        } else if (!powers.some(function (c) { return n.v === c.value || (plain && BigInt(n.v) === c.evaluated); })) ok = false;
      });
    }
    if (tree.t === 'neg') return false;
    row(tree, 'top');
    return ok && used <= (coef ? 2 : Math.max(1, powers.length));
  }

  /* model: the answer box's model. 'empty' and 'invalid' (an empty exponent
     box, say) are not submissions: nothing is counted (Dr. Cole, 2026-09-27).
     A problem with `denOne: true` accepts a denominator of 1; one with a
     `policy` is checked against it instead of POLICY (Mode 4). */
  function gradeMath(problem, model) {
    if (!model || !model.items || !model.items.length) return { status: 'empty' };
    var r = PC.Check.check(model, problem.answer, problem.policy || POLICY);
    if (r.status === 'invalid') {
      if (r.errors[0] === 'EMPTY') return { status: 'empty' };
      return { status: 'invalid', message: PC.Check.message(r), errors: r.errors };
    }
    if (!r.correct || !numbersOk(r.tree, problem.constant, { denOne: problem.denOne })) return { status: 'wrong', result: r };
    return { status: 'correct', result: r };
  }

  var LEVELS = [
    { n: 1, title: 'Warm-up', make: level1, input: 'count' },
    { n: 2, title: 'Two Powers', make: level2, input: 'count' },
    { n: 3, title: 'Any Base', make: level3, input: 'math' },    // label [ASSUMPTION, built as written]
    { n: 4, title: 'Many Bases', make: level4, input: 'math' },  // label [ASSUMPTION, built as written]
  ];

  PC.Product = { LEVEL1: LEVEL1, LEVEL2: LEVEL2, LEVEL3: LEVEL3, LEVEL4: LEVEL4, LEVELS: LEVELS, POLICY: POLICY,
    expanded: expanded, compact: compact, level1: level1, level2: level2, level3: level3, level4: level4, problem3: problem3, problem4: problem4,
    clean: clean, grade: grade, gradeMath: gradeMath, numbersOk: numbersOk, entry: entry,
    // shared with Mode 2 (quotient.js)
    power: power, baseNode: baseNode, lower: lower, shuffle: shuffle, draw4: draw4, ORDER: ORDER };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
