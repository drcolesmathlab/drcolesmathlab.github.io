/*
 * powerquotient.js — Mode 4, Power of a Quotient: problems and grading (no DOM).
 *
 * Design: "Power Crusher: Mode 4 Design, Power of a Quotient" (2026-09-27).
 * Every factor inside the parentheses gets the outer exponent, top and bottom.
 *
 * Level 1 (Repeated Fractions): one fraction written out 2 to 10 times,
 * (x²/5³)(x²/5³)(x²/5³). The student types how many x's and how many 5s, in
 * two fields. Right → the copies' tops crush into x⁶ and their bottoms into
 * 5⁹, at the same time, and the bars join into one: x⁶/5⁹.
 *
 * Level 2 (Outer Power): (x²/5³)⁴, answered in the math answer box. Right →
 * the outer exponent goes to the top and the bottom at once, and each pair
 * crushes: x⁸/5¹².
 *
 * Level 3 (Zero and Negatives): Level 2 with zero and negative exponents,
 * (x²/5¹)⁻³. The app's answer keeps every exponent in place: x⁻⁶/5⁻³.
 *
 * Level 4 (Many Bases): 1 to 3 bases on each side, (2x³y/3z²)². Right → the
 * outer exponent goes to every base at once: 2²x⁶y²/(3²z⁴).
 *
 * Every level (design §2): bases are a constant 2 to 10 or x, y, z, 50/50.
 * Nothing reduces: no base is both top and bottom, and constants top and
 * bottom share no factor. The app's answer shows constants as powers, so there
 * is no 1000 cap (design §11.1). Levels 1 to 3 show a given exponent of 1;
 * Level 4 hides it (design §11.3). Grading is Mode 1's (product.js), with
 * constants on both sides (design §12).
 */
(function (PC) {
  'use strict';
  var E = PC.Expr, G = PC.Generate, Pr = PC.Product;
  var power = Pr.power, baseNode = Pr.baseNode;

  var CONSTS = [2, 3, 4, 5, 6, 7, 8, 9, 10];   // design §2
  var VARS = ['x', 'y', 'z'];

  var LEVEL1 = {
    expMin: 1, expMax: 10,         // design §4: inner exponents 1 to 10, 1 shown
    copiesMin: 2, copiesMax: 10,
  };

  var LEVEL2 = {
    expMin: 1, expMax: 10,         // design §5: inner 1 to 10 (1 shown),
    outerMin: 2, outerMax: 10,     // outer 2 to 10
  };

  // Design §6: Modes 1 to 3's weighting. About 1 problem in 4 has one or two
  // of its given exponents (inner top, inner bottom, outer) zero or negative,
  // any of them equally likely; about 1 in 4 of those is 0, the rest −1 to
  // −10. Every other inner exponent is 1 to 10, every other outer 2 to 10.
  var LEVEL3 = {
    expMin: -10, expMax: 10,
    outerMin: 2,
    lowShare: 0.25, lowMin: 1, lowMax: 2, zeroShare: 0.25,
  };

  // Design §7: Level 3's numbers, with 1 to 3 bases on each side. Each pair
  // of side counts is equally likely [INFERENCE §7]; 3 and 3 never occurs,
  // because a side has at most one constant (design §11.2).
  var LEVEL4 = {
    expMin: -10, expMax: 10,
    outerMin: 2,
    lowShare: 0.25, lowMin: 1, lowMax: 2, zeroShare: 0.25,
    sides: [[1, 1], [1, 2], [2, 1], [1, 3], [3, 1], [2, 2], [2, 3], [3, 2]],
  };

  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  function isConst(b) { return typeof b === 'number'; }

  /* The bases of `type` ('c' or 'v') still allowed beside `used` (design §2):
     a variable not used yet, or a constant that shares no factor with a
     constant already drawn (which also rules out the same constant again). */
  function allowed(type, used) {
    if (type === 'v') return VARS.filter(function (v) { return used.indexOf(v) < 0; });
    return CONSTS.filter(function (c) {
      return used.every(function (u) { return !isConst(u) || gcd(u, c) === 1; });
    });
  }

  /* [INFERENCE §2] The type is drawn first, 50/50, then the value from the
     bases still allowed, so nothing is drawn again and the split holds. */
  function drawBase(r, used, types) {
    types = types || ['c', 'v'];
    var type = types.length === 1 ? types[0] : (r() < 0.5 ? 'c' : 'v');
    return G.pick(r, allowed(type, used));
  }

  /* "How many x’s and 5s …" (design §4): "s" after a number, "’s" after a letter. */
  function word(b) { return b + (isConst(b) ? 's' : '’s'); }

  function product(fs) { return fs.length === 1 ? fs[0] : { t: 'mul', factors: fs }; }

  /* The rules for Levels 2 to 4 (design §5 to §7). Mode 1's, except:
     - two constants on one side are fine (2²·3⁻², design §6: "any other equal
       form with no base written twice"); numbersOk still allows each constant
       once, as its base to a power or its value;
     - a fraction not in lowest terms is wrong (8/18 for 2²/3², design §5). */
  var POLICY = { id: 'power-quotient', issues: ['REPEATED_BASE', 'NOT_LOWEST_TERMS'], notes: [] };

  /* ---- Level 1 --------------------------------------------------------------- */
  /* (x²/5³)(x²/5³)(x²/5³) → x⁶/5⁹. The copies sit side by side with no dot,
     and are read with "times" (design §4). The answer is not evaluated. */
  function problem1(a, m, b, n, copies) {
    var factors = [];
    for (var i = 0; i < copies; i++) factors.push(E.G(E.D(E.P(baseNode(a), m), E.P(baseNode(b), n))));
    return {
      level: 1, bases: [a, b], exps: [m, n], copies: copies, counts: [m * copies, n * copies],
      shown: { t: 'mul', factors: factors, times: true },
      answer: E.D(E.P(baseNode(a), m * copies), E.P(baseNode(b), n * copies)),
      question: 'How many ' + word(a) + ' and ' + word(b) + ' are being multiplied together?',
      // The one fraction the copies join into, mid-crush: x²x²x² over 5³ · 5³ · 5³.
      plan: { type: 'copies', lit: 'answer', joined: E.D(
        { t: 'mul', factors: factors.map(function (f) { return f.inner.num; }) },
        { t: 'mul', factors: factors.map(function (f) { return f.inner.den; }) }) },
    };
  }

  function template1(r) {
    var L = LEVEL1, a = drawBase(r, []), b = drawBase(r, [a]);
    var p = problem1(a, G.int(r, L.expMin, L.expMax), b, G.int(r, L.expMin, L.expMax),
      G.int(r, L.copiesMin, L.copiesMax));
    p.shown.pc = p;   // read back below; dropped before the tree is kept
    return p.shown;
  }

  /* Two whole numbers, each up to 3 digits (design §4). Either empty → not a
     submission. One submission is one attempt, whichever count is wrong. */
  function grade(problem, texts) {
    var t = texts.map(Pr.clean);
    if (t[0] === '' || t[1] === '') return { status: 'empty' };
    var right = +t[0] === problem.counts[0] && +t[1] === problem.counts[1];
    return { status: right ? 'correct' : 'wrong', values: [+t[0], +t[1]] };
  }

  /* ---- Levels 2 to 4 --------------------------------------------------------- */
  /* One problem as data: each side's factors as [base, inner exponent], in
     display order, and the outer exponent. `hide`: a given exponent of 1 is
     hidden (Level 4 only). Tests build their own:
     { top: [['x', 2]], bottom: [[5, 3]], outer: 4 } */
  function build(level, d, hide) {
    var m = d.outer;
    function given(f) { return hide ? power(baseNode(f[0]), f[1]) : E.P(baseNode(f[0]), f[1]); }
    // The app's answer keeps every exponent in place, zero and negative ones
    // too, and every constant as a power; a result exponent of 1 is hidden
    // (design §6, §12): (x⁻¹/5¹)⁻¹ = x/5⁻¹.
    function got(f) { return power(baseNode(f[0]), f[1] * m); }
    var all = d.top.concat(d.bottom), consts = all.filter(function (f) { return isConst(f[0]); });
    return {
      level: level, top: d.top, bottom: d.bottom, outer: m,
      shown: E.P(E.G(E.D(product(d.top.map(given)), product(d.bottom.map(given)))), m),
      answer: E.D(product(d.top.map(got)), product(d.bottom.map(got))),
      // Each constant may be typed as its base to a power, or as its value
      // (design §11.1): 5³ or 125, 2² or 4.
      constant: consts.length ? consts.map(function (f) { return { form: 'power', value: f[0], exp: f[1] * m }; }) : null,
      policy: POLICY,
      question: 'Simplify the expression.',   // design §5: Levels 2 to 4
      // Reduced motion lights the problem, holds, then swaps, as in Modes 2
      // and 3 (Mode 5 design §9.5, replacing this design's swap-then-light).
      plan: { type: 'outer' },
    };
  }

  function problem2(d) { return build(2, d, false); }
  function problem3(d) { return build(3, d, false); }
  function problem4(d) { return build(4, d, true); }

  function template2(r) {
    var L = LEVEL2, a = drawBase(r, []), b = drawBase(r, [a]);
    var p = problem2({ top: [[a, G.int(r, L.expMin, L.expMax)]], bottom: [[b, G.int(r, L.expMin, L.expMax)]],
      outer: G.int(r, L.outerMin, L.outerMax) });
    p.shown.pc = p;
    return p.shown;
  }

  function template3(r) {
    var L = LEVEL3, a = drawBase(r, []), b = drawBase(r, [a]);
    var e = Pr.lower(r, L, [G.int(r, 1, L.expMax), G.int(r, 1, L.expMax), G.int(r, L.outerMin, L.expMax)]);
    var p = problem3({ top: [[a, e[0]]], bottom: [[b, e[1]]], outer: e[2] });
    p.shown.pc = p;
    return p.shown;
  }

  /* Level 4's bases (design §7): the side counts, then each base in turn, top
     first. A base's type is drawn 50/50 where both types can still fill the
     fraction: a side takes at most one constant, and there are three letters. */
  function draw4(r) {
    var L = LEVEL4, want = G.pick(r, L.sides), sides = [[], []], used = [];
    for (var s = 0; s < 2; s++) {
      for (var k = 0; k < want[s]; k++) {
        var types = ['c', 'v'].filter(function (t) { return fits(t, s, k); });
        var b = drawBase(r, used, types);
        used.push(b);
        sides[s].push(b);
      }
    }
    // Can every slot after this one still be filled, if this one is `type`?
    function fits(type, s, k) {
      var hasC = [sides[0].some(isConst), sides[1].some(isConst)];
      var vars = used.filter(function (u) { return !isConst(u); }).length;
      if (type === 'c') { if (hasC[s]) return false; hasC[s] = true; } else vars++;
      if (vars > VARS.length) return false;
      var left = [s === 0 ? want[0] - k - 1 : 0, s === 0 ? want[1] : want[1] - k - 1];
      var need = Math.max(0, left[0] - (hasC[0] ? 0 : 1)) + Math.max(0, left[1] - (hasC[1] ? 0 : 1));
      return need <= VARS.length - vars;
    }
    // Display order (design §7): the constant first, then x, y, z.
    function order(a, b) { return isConst(a) ? -1 : isConst(b) ? 1 : a < b ? -1 : 1; }
    sides.forEach(function (side) { side.sort(order); });
    var n = sides[0].length + sides[1].length;
    var exps = [];
    for (var i = 0; i < n; i++) exps.push(G.int(r, 1, L.expMax));
    exps = Pr.lower(r, L, exps.concat(G.int(r, L.outerMin, L.expMax)));
    return {
      top: sides[0].map(function (b, i) { return [b, exps[i]]; }),
      bottom: sides[1].map(function (b, i) { return [b, exps[sides[0].length + i]]; }),
      outer: exps[n],
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
    { n: 1, title: 'Repeated Fractions', make: maker(1, template1), input: 'counts' },   // names: design §3
    { n: 2, title: 'Outer Power', make: maker(2, template2), input: 'math' },
    { n: 3, title: 'Zero and Negatives', make: maker(3, template3), input: 'math' },
    { n: 4, title: 'Many Bases', make: maker(4, template4), input: 'math' },
  ];

  PC.PowerQuotient = { LEVEL1: LEVEL1, LEVEL2: LEVEL2, LEVEL3: LEVEL3, LEVEL4: LEVEL4, LEVELS: LEVELS, POLICY: POLICY,
    level1: LEVELS[0].make, level2: LEVELS[1].make, level3: LEVELS[2].make, level4: LEVELS[3].make,
    problem1: problem1, problem2: problem2, problem3: problem3, problem4: problem4, draw4: draw4, allowed: allowed,
    grade: grade,
    // Answer-box grading and history are Mode 1's.
    clean: Pr.clean, gradeMath: Pr.gradeMath, entry: Pr.entry };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
