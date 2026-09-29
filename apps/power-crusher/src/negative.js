/*
 * negative.js — Mode 6, Negative Exponent: problems and grading (no DOM).
 *
 * Design: "Power Crusher: Mode 6 Design, Negative Exponent" (2026-09-29). The
 * route (design §1): which way the quotient goes; counting the extra factors
 * left below; a single base to a negative power becomes a denominator; and
 * rewriting an expression so every exponent is positive.
 *
 * Level 1 (Which Way?): x³/x⁵ or 3⁷/3². The student finishes a statement with
 * two dropdowns: the numerator or denominator has more factors, so the
 * exponent is positive or negative. Right → Mode 2 Level 3's crush, landing on
 * x⁻² or 3⁵ (it stops there).
 *
 * Level 2 (Count the Extra): x²/x⁵. The student types how many more factors
 * are below (3). Right → the fraction unfolds into (x · x) over (x · x · x · x
 * · x), the pairs cancel, a 1 appears on top, and it stops at 1/(x · x · x).
 *
 * Level 3 (Flip It): x⁻³. The student types how many more factors of the base
 * must have been in the denominator to make it (3). Right → a 1 and a bar
 * appear, the power crosses the bar and its sign flips: 1/x³. An exponent of −1
 * lands as 1/x¹, on purpose.
 *
 * Level 4 (Only Positives): 5x⁻², x⁻²/y³, 1/2⁻³. The student rewrites the
 * expression with only positive exponents, in the answer box. Right → every
 * negative power crosses the bar at once and flips.
 *
 * No false frames (design §3): a power never shows under a bar with its
 * negative exponent still on it while it moves, because 1/x⁻³ is x³. The sign
 * flips when the power crosses the bar (crush.js, `cross`).
 *
 * Answers to the design's open questions (Dr. Cole, 2026-09-29), for Level 4's
 * draw: the denominator case has no second base; in the 75% case a problem is
 * a fraction half the time where it can be (something to put under the bar);
 * with no coefficient the 75% case always has 2 bases, so a bare x⁻² (Level
 * 3's problem) never comes up. At Level 1 a result exponent of 1 is hidden
 * (x⁴/x³ lands as x).
 */
(function (PC) {
  'use strict';
  var E = PC.Expr, G = PC.Generate, Pr = PC.Product;
  var power = Pr.power, baseNode = Pr.baseNode;

  var CONSTANTS = { baseMin: 2, baseMax: 10, variables: ['x', 'y', 'z'] };   // design §4 to §7

  // Design §4: positive exponents 1 to 10, 1 shown; 3 problems in 4 have more
  // factors on top (a positive result), 1 in 4 more below.
  var LEVEL1 = { baseMin: 2, baseMax: 10, variables: CONSTANTS.variables, expMin: 1, expMax: 10, topShare: 0.75 };
  // Design §5: n from 2 to 10 below, m from 1 to n − 1 on top, 1 shown.
  var LEVEL2 = { baseMin: 2, baseMax: 10, variables: CONSTANTS.variables, expMin: 1, expMax: 10 };
  // Design §6: exponents −1 to −10, uniform; −1 is shown.
  var LEVEL3 = { baseMin: 2, baseMax: 10, variables: CONSTANTS.variables, expMin: -10, expMax: -1 };
  // Design §7: shares are exact, because nothing is redrawn. `fractionShare` is
  // the share of fractions where a fraction is possible (Dr. Cole, 2026-09-29).
  var LEVEL4 = {
    baseMin: 2, baseMax: 10, variables: CONSTANTS.variables,
    expMax: 10,                     // positives 1 to 10, negatives −1 to −10
    bottomShare: 0.25,              // the negative power is in the denominator
    coefShare: 0.25,                // a plain coefficient
    coefMin: 2, coefMax: 10,
    fractionShare: 0.5,
  };

  var ORDER = Pr.ORDER;             // answer order: constant first, then x, y, z

  function drawBase(r, L) { return r() < 0.5 ? G.int(r, L.baseMin, L.baseMax) : G.pick(r, L.variables); }
  function keyOf(b) { return typeof b === 'number' ? 'c' : b; }

  /* n copies of a base written out, joined by dots: x · x · x. One copy is the
     base alone. */
  function copies(b, n) {
    if (n === 1) return baseNode(b);
    var fs = [];
    for (var i = 0; i < n; i++) fs.push(baseNode(b));
    return { t: 'mul', factors: fs, dot: true };
  }

  /* ---- Level 1 --------------------------------------------------------------- */
  /* x³/x⁵ → x⁻². `choices` is the right statement: which side has more factors,
     and whether the exponent is positive. A result exponent of 1 is hidden. */
  function problem1(b, m, n) {
    return {
      level: 1, base: b, exps: [m, n], diff: m - n,
      shown: E.D(E.P(baseNode(b), m), E.P(baseNode(b), n)),
      answer: power(baseNode(b), m - n),
      choices: { side: m > n ? 'numerator' : 'denominator', sign: m > n ? 'positive' : 'negative' },
      question: 'Finish the statement below.',   // design §4
      plan: { type: 'vertical', lit: 'problem' },
    };
  }

  /* [My call] The case first, then the larger exponent 2 to 10 and the smaller
     1 to one less (as Mode 2 Levels 1 and 2 draw theirs). */
  function template1(r) {
    var L = LEVEL1, top = r() < L.topShare;
    var big = G.int(r, L.expMin + 1, L.expMax), small = G.int(r, L.expMin, big - 1);
    var b = drawBase(r, L);
    var p = top ? problem1(b, big, small) : problem1(b, small, big);
    p.shown.pc = p;   // read back below; dropped before the tree is kept
    return p.shown;
  }

  /* ---- Level 2 --------------------------------------------------------------- */
  /* x²/x⁵ → (x · x)/(x · x · x · x · x) → 1/(x · x · x). `plan.mid` is the
     unfolded fraction; `plan.pairs` how many pairs cancel (m). */
  function problem2(b, m, n) {
    return {
      level: 2, base: b, exps: [m, n], count: n - m,
      shown: E.D(E.P(baseNode(b), m), E.P(baseNode(b), n)),
      mid: E.D(copies(b, m), copies(b, n)),
      answer: E.D(E.N(1), copies(b, n - m)),
      question: 'How many more factors are in the denominator than the numerator?',   // design §5
      plan: { type: 'expand', lit: 'expanded', pairs: m, mid: E.D(copies(b, m), copies(b, n)) },
    };
  }

  function template2(r) {
    var L = LEVEL2, n = G.int(r, L.expMin + 1, L.expMax), m = G.int(r, L.expMin, n - 1);
    var p = problem2(drawBase(r, L), m, n);
    p.shown.pc = p;
    return p.shown;
  }

  /* ---- Levels 3 and 4: a power crossing the bar ------------------------------ */
  /* A problem as two lists of factors, [key, base, exponent]: what is on top
     (or on the line) and what is below. `key` names the factor for the crush
     ('c' for the one constant, else x, y or z); the exponent is null for a
     plain coefficient. Below with nothing on top has an implicit 1.

     arranged() gives the shown problem, the app's answer, and the crush's
     plan: every factor with a negative exponent moves to the other side and
     its sign flips; the rest stay. `keepOne` shows a result exponent of 1
     (Level 3: y⁻¹ lands as 1/y¹, design §6). Otherwise it is hidden (Level 4). */
  function sorted(list) {
    return list.slice().sort(function (a, b) { return ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]); });
  }
  function fnode(f, keepOne) {
    if (f[2] === null) return E.N(f[1]);
    return keepOne && f[2] === 1 ? E.P(baseNode(f[1]), 1) : power(baseNode(f[1]), f[2]);
  }
  function side(list, keepOne) {
    return list.length === 1 ? fnode(list[0], keepOne) : { t: 'mul', factors: list.map(function (f) { return fnode(f, keepOne); }) };
  }
  /* The drawn parts of a tree, top then bottom: what crush.js's drawnParts sees. */
  function keysOf(top, bottom) {
    var keys = top.map(function (f) { return f[0]; });
    if (bottom.length && !top.length) keys = ['one'];
    return keys.concat(bottom.map(function (f) { return f[0]; }));
  }

  function arranged(d, keepOne) {
    var top = [], bottom = [], flips = {};
    d.top.forEach(function (f) {
      if (f[2] !== null && f[2] < 0) { bottom.push([f[0], f[1], -f[2]]); flips[f[0]] = 'down'; } else top.push(f);
    });
    d.bottom.forEach(function (f) {
      if (f[2] !== null && f[2] < 0) { top.push([f[0], f[1], -f[2]]); flips[f[0]] = 'up'; } else bottom.push(f);
    });
    top = sorted(top); bottom = sorted(bottom);
    var from = sorted(d.top), under = sorted(d.bottom);
    var shown = under.length ? E.D(from.length ? side(from) : E.N(1), side(under)) : side(from);
    var answer = bottom.length ? E.D(top.length ? side(top, keepOne) : E.N(1), side(bottom, keepOne)) : side(top, keepOne);
    return {
      shown: shown, answer: answer,
      plan: { type: 'cross', lit: 'cross', from: keysOf(from, under), to: keysOf(top, bottom), flips: flips },
    };
  }

  /* ---- Level 3 --------------------------------------------------------------- */
  /* Dr. Cole's wording (2026-09-29), replacing design §6's "How many factors of x are
     in the denominator?": "How many more factors of x must have been in the
     denominator to make x⁻³?". `question` is that in words (as a screen reader gets
     it); `questionParts` is the same with the base and the expression as trees, so
     the page draws them with real superscripts. */
  function question3(b, shown) {
    return 'How many more factors of ' + b + ' must have been in the denominator to make ' + PC.Render.speak(shown) + '?';
  }

  /* x⁻³ → 1/x³. `b` is a number or 'x', 'y', 'z'; `e` is −1 to −10. */
  function problem3(b, e) {
    var a = arranged({ top: [[keyOf(b), b, e]], bottom: [] }, true);
    return {
      level: 3, base: b, exp: e, count: -e,
      shown: a.shown, answer: a.answer,
      question: question3(b, a.shown),
      questionParts: ['How many more factors of ', baseNode(b), ' must have been in the denominator to make ', a.shown, '?'],
      plan: a.plan,
    };
  }

  function template3(r) {
    var L = LEVEL3;
    var p = problem3(drawBase(r, L), G.int(r, L.expMin, L.expMax));
    p.shown.pc = p;
    return p.shown;
  }

  /* ---- Level 4 --------------------------------------------------------------- */
  /* The order of the draw is the design's (§7), and nothing is redrawn, so the
     stated shares are exact: the case (75/25), a coefficient or not (25/75),
     how many bases, then each base's type and value, then the exponents, then
     the shape.
       - Denominator case: one base, its exponent negative and below; on top is
         1, or the coefficient (1/2⁻³, 5/x⁻²).
       - Otherwise the negative power(s) are on top: 1 or 2 bases, one or both
         negative (the rest positive). With no coefficient there are 2 bases,
         so it is never a bare Level 3 problem. Where something can go under
         the bar it is a fraction half the time: the coefficient goes below
         (x⁻²/5), or with none the positive base (x⁻²/y³); everything else
         stays on top. */
  function draw4(r) {
    var L = LEVEL4;
    var bottomCase = r() < L.bottomShare;
    var coef = r() < L.coefShare ? G.int(r, L.coefMin, L.coefMax) : null;
    var n = bottomCase ? 1 : coef === null ? 2 : G.int(r, 1, 2);
    // Each base a constant or x, y, z, 50/50; the one constant allowed is
    // spent already if there is a coefficient. A letter is never repeated.
    var bases = [], letters = [], hasConst = coef !== null;
    for (var i = 0; i < n; i++) {
      if (!hasConst && r() < 0.5) { bases.push(G.int(r, L.baseMin, L.baseMax)); hasConst = true; }
      else {
        var b = G.pick(r, L.variables.filter(function (v) { return letters.indexOf(v) < 0; }));
        letters.push(b);
        bases.push(b);
      }
    }
    bases.sort(function (a, b) { return ORDER.indexOf(keyOf(a)) - ORDER.indexOf(keyOf(b)); });
    // Which are negative: the only base, or one or both of two (50/50, then which).
    var neg = bases.map(function () { return false; });
    if (n === 1) neg[0] = true;
    else if (r() < 0.5) neg[0] = neg[1] = true;
    else neg[G.int(r, 0, 1)] = true;
    var factors = bases.map(function (b, k) {
      var e = G.int(r, 1, L.expMax);
      return [keyOf(b), b, neg[k] ? -e : e];
    });
    var coefFactor = coef === null ? null : ['c', coef, null];
    if (bottomCase) return { top: coefFactor ? [coefFactor] : [], bottom: factors };
    var below = coefFactor || factors.filter(function (f) { return f[2] > 0; })[0] || null;
    if (below && r() < L.fractionShare) {
      return { top: factors.filter(function (f) { return f !== below; }), bottom: [below] };
    }
    return { top: (coefFactor ? [coefFactor] : []).concat(factors), bottom: [] };
  }

  /* Design §7, "Grading type": equal to the answer, no base written twice, and
     the named rules: no negative or zero exponent left, no denominator of 1, a
     coefficient fraction in lowest terms. An evaluated constant, bases in any
     order and a fraction outside the variables ((1/8)x) are all fine; so is a
     visible exponent of 1. This replaces check.js's provisional `negative`. */
  var POLICY = {
    id: 'negative-4',
    issues: ['REPEATED_BASE', 'NEGATIVE_EXPONENT', 'ZERO_EXPONENT', 'DENOMINATOR_ONE', 'NOT_LOWEST_TERMS'],
    notes: [],
  };

  /* The problem for one draw. Tests build their own `d`:
     { top: [['c', 5, null], ['x', 'x', -2]], bottom: [] }  for 5x⁻²
     { top: [], bottom: [['c', 2, -3]] }                    for 1/2⁻³ */
  function problem4(d) {
    var a = arranged(d, false);
    var c = d.top.concat(d.bottom).filter(function (f) { return f[0] === 'c'; })[0] || null;
    var constant = null;
    if (c) {
      constant = c[2] === null
        ? { form: 'coef', value: d.top.indexOf(c) >= 0 ? c[1] : 1, den: d.bottom.indexOf(c) >= 0 ? c[1] : 1 }
        : { form: 'power', value: c[1], exp: Math.abs(c[2]) };
    }
    return {
      level: 4, top: d.top, bottom: d.bottom,
      shown: a.shown, answer: a.answer, constant: constant, policy: POLICY,
      question: 'Rewrite the expression using only positive exponents.',   // design §7
      plan: a.plan,
    };
  }

  function template4(r) {
    var p = problem4(draw4(r));
    p.shown.pc = p;
    return p.shown;
  }

  /* ---- grading --------------------------------------------------------------- */
  /* Level 1: two dropdowns, 'numerator' or 'denominator' and 'positive' or
     'negative'. Either unset ('') is not a submission (design §4). One Crush it!
     is one attempt, whichever is wrong. */
  function gradeChoices(problem, values) {
    if (!values || !values[0] || !values[1]) return { status: 'empty' };
    var right = values[0] === problem.choices.side && values[1] === problem.choices.sign;
    return { status: right ? 'correct' : 'wrong', values: values };
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
    { n: 1, title: 'Which Way?', make: maker(1, template1), input: 'choices' },   // names: design §2, for now
    { n: 2, title: 'Count the Extra', make: maker(2, template2), input: 'count' },
    { n: 3, title: 'Flip It', make: maker(3, template3), input: 'count' },
    { n: 4, title: 'Only Positives', make: maker(4, template4), input: 'math' },
  ];

  PC.Negative = { LEVEL1: LEVEL1, LEVEL2: LEVEL2, LEVEL3: LEVEL3, LEVEL4: LEVEL4, LEVELS: LEVELS, POLICY: POLICY,
    level1: LEVELS[0].make, level2: LEVELS[1].make, level3: LEVELS[2].make, level4: LEVELS[3].make,
    problem1: problem1, problem2: problem2, problem3: problem3, problem4: problem4, draw4: draw4, arranged: arranged,
    gradeChoices: gradeChoices,
    // Whole-number grading, answer-box grading and history are Mode 1's.
    clean: Pr.clean, grade: Pr.grade, gradeMath: Pr.gradeMath, entry: Pr.entry };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
