/*
 * zero.js — Mode 5, Zero Exponent: problems and grading (no DOM).
 *
 * Design: "Power Crusher: Mode 5 Design, Zero Exponent" (2026-09-28). The
 * route (design §1): a number divided by itself is 1; equal powers cancel
 * completely, leaving an exponent of 0; the Quotient of Powers gives b⁰; and
 * b⁰ is 1.
 *
 * Level 1 (Divide by Itself): a number over itself, 12/12 or 3⁴/3⁴. The
 * student types its value. Right → top and bottom are pushed onto the bar,
 * and the fraction pops into 1.
 *
 * Level 2 (Cancel It All): 3⁴/3⁴. The student types how many 3s are left
 * after canceling: 0. Right → Mode 2's crush, landing as 3⁰.
 *
 * Level 3 (To the Zero): x⁻³/x⁻³, any base, answered in the math answer box.
 * Only b⁰ is right: 1, x⁰/1 and the problem typed back are wrong (Dr. Cole,
 * 2026-09-28, answering design §11). Right → as Level 2, landing as x⁰.
 *
 * Level 4 (Zero Means One): one of four forms (design §7): 3⁴/3⁴,
 * x²y³/(x²y³), (5x)⁰ or 5x⁰, answered in two boxes and one Crush it! (Dr.
 * Cole, 2026-09-29), so the student ties the zero power to its value:
 *   1. "Apply the exponent property.": the zero powers, 3⁰, x⁰y⁰ or 5⁰x⁰.
 *   2. "Evaluate the expression.": the value, 1.
 * 5x⁰ is already simplified, so it has only the second box, and its value is 5.
 * Both right → the problem crushes to its zero powers (a fraction as at Level
 * 3; (5x)⁰ gives its 0 to every factor, as in Mode 3), each zero power becomes
 * 1, and the 1s go.
 *
 * Bases are never 0 (design §3). Levels 1 and 2 use constants only, with no
 * zero or negative exponents; Levels 3 and 4 use constants 2 to 10 or x, y, z,
 * with the usual weighting. An exponent of 1 is hidden at Levels 2 to 4.
 */
(function (PC) {
  'use strict';
  var E = PC.Expr, G = PC.Generate, Pr = PC.Product;
  var power = Pr.power, baseNode = Pr.baseNode;

  var LEVEL1 = {
    plainMin: 2, plainMax: 1000,   // design §4 (a): a plain number, 2 to 1000
    baseMin: 2, baseMax: 10,       // design §4 (b): a power, base 2 to 10,
    expMin: 2, expMax: 10,         // exponent 2 to 10, so it never looks like (a) [ASSUMPTION]
    powerShare: 0.5,               // each form 50/50 [ASSUMPTION]
  };

  var LEVEL2 = {
    baseMin: 2, baseMax: 10,       // design §5
    expMin: 1, expMax: 10,         // the same top and bottom; 1 hidden (3/3)
  };

  // Design §6: a constant 2 to 10 or x, y, z, 50/50 [ASSUMPTION]. The usual
  // weighting: about 1 problem in 4 has a zero or negative exponent (its only
  // one, drawn once for top and bottom); about 1 in 4 of those is 0.
  var LEVEL3 = {
    baseMin: 2, baseMax: 10,
    variables: ['x', 'y', 'z'],
    expMin: -10, expMax: 10,
    lowShare: 0.25, lowMin: 1, lowMax: 1, zeroShare: 0.25,
  };

  // Design §7: Level 3's bases, exponents and weighting [ASSUMPTION]. The four
  // forms are equally likely (Dr. Cole, 2026-09-28: the design's default, so
  // 3 answers in 4 are 1). Forms (b) and (c) have 2 or 3 bases.
  var LEVEL4 = {
    baseMin: 2, baseMax: 10,
    variables: ['x', 'y', 'z'],
    expMin: -10, expMax: 10,
    lowShare: 0.25, lowMin: 1, lowMax: 2, zeroShare: 0.25,
    forms: ['one', 'many', 'group', 'coef'],
    basesMin: 2, basesMax: 3,
    coefMin: 2, coefMax: 10,
  };

  function product(fs) { return fs.length === 1 ? fs[0] : { t: 'mul', factors: fs }; }

  /* ---- Level 1 --------------------------------------------------------------- */
  /* 12/12 (exp null) or 3⁴/3⁴ → 1. */
  function problem1(n, exp) {
    var part = exp === null ? E.N(n) : E.P(E.N(n), exp);
    return {
      level: 1, n: n, exp: exp, count: 1,
      shown: E.D(part, part),
      answer: E.N(1),
      question: 'What is the value of the fraction?',   // design §4
      plan: { type: 'vertical', lit: 'problem' },
    };
  }

  function template1(r) {
    var L = LEVEL1;
    var p = r() < L.powerShare
      ? problem1(G.int(r, L.baseMin, L.baseMax), G.int(r, L.expMin, L.expMax))
      : problem1(G.int(r, L.plainMin, L.plainMax), null);
    p.shown.pc = p;   // read back below; dropped before the tree is kept
    return p.shown;
  }

  /* ---- Level 2 --------------------------------------------------------------- */
  /* 3⁴/3⁴ → 3⁰. The student types 0, and sees it land as a zero exponent. */
  function problem2(b, e) {
    return {
      level: 2, base: b, exp: e, count: 0,
      shown: E.D(power(E.N(b), e), power(E.N(b), e)),
      answer: E.P(E.N(b), 0),
      question: 'How many ' + b + 's are left after canceling?',   // Mode 2 Level 1's
      plan: { type: 'vertical', lit: 'problem' },
    };
  }

  function template2(r) {
    var L = LEVEL2;
    var p = problem2(G.int(r, L.baseMin, L.baseMax), G.int(r, L.expMin, L.expMax));
    p.shown.pc = p;
    return p.shown;
  }

  /* ---- Level 3 --------------------------------------------------------------- */
  /* x⁻³/x⁻³ → x⁰. `b` is a number or 'x', 'y', 'z'. */
  function problem3(b, e) {
    return {
      level: 3, base: b, exp: e,
      shown: E.D(power(baseNode(b), e), power(baseNode(b), e)),
      answer: E.P(baseNode(b), 0),
      question: 'Write the expression as a base to a power.',   // design §6
      plan: { type: 'vertical', lit: 'problem' },
    };
  }

  function drawBase(r, L) { return r() < 0.5 ? G.int(r, L.baseMin, L.baseMax) : G.pick(r, L.variables); }
  function drawExp(r, L) { return Pr.lower(r, L, [G.int(r, 1, L.expMax)])[0]; }

  function template3(r) {
    var p = problem3(drawBase(r, LEVEL3), drawExp(r, LEVEL3));
    p.shown.pc = p;
    return p.shown;
  }

  /* ---- Level 4 --------------------------------------------------------------- */
  // Dr. Cole, 2026-09-29: two boxes, each with its own prompt, one Crush it!.
  var APPLY = 'Apply the exponent property.';
  var EVALUATE = 'Evaluate the expression.';

  /* One problem as data. `form` is design §7's (a) to (d):
       'one'   3⁴/3⁴          factors [[3, 4]]
       'many'  x²y³/(x²y³)    factors [['x', 2], ['y', 3]], constant first
       'group' (5x)⁰          coef 5, factors [['x', 1]]
       'coef'  5x⁰            coef 5, factors [['x', 0]]
     Tests build their own: { form: 'group', coef: 5, factors: [['x', 1]] }.
     `mid` is what the problem becomes before its zero powers turn into 1s:
     x⁰y⁰ for a fraction, 5⁰x⁰ for (5x)⁰; 5x⁰ is already there.
     `parts` are the answer boxes, top to bottom, each with its prompt and
     answer; activity.js grades them together (gradeParts). `question` is the
     prompts in one line, for the page's (visually hidden) heading. */
  function problem4(d) {
    var given = d.factors.map(function (f) { return power(baseNode(f[0]), f[1]); });
    var zeros = d.factors.map(function (f) { return E.P(baseNode(f[0]), 0); });
    var shown, mid, first = null, value = 1;
    if (d.form === 'one' || d.form === 'many') {
      shown = E.D(product(given), product(given));
      mid = product(zeros);
      first = { type: 'vertical' };
    } else if (d.form === 'group') {
      shown = E.P(E.G(product([E.N(d.coef)].concat(given))), 0);
      mid = product([E.P(E.N(d.coef), 0)].concat(zeros));
      first = { type: 'outer' };
    } else {
      shown = { t: 'mul', factors: [E.N(d.coef)].concat(zeros) };
      mid = shown;
      value = d.coef;
    }
    var parts = [{ label: EVALUATE, answer: E.N(value) }];
    if (first) parts.unshift({ label: APPLY, answer: mid, anyOrder: true });
    return {
      level: 4, form: d.form, coef: d.coef || null, factors: d.factors, value: value,
      shown: shown, mid: mid,
      answer: E.N(value),
      question: parts.map(function (pt) { return pt.label; }).join(' '),
      parts: parts,
      plan: { type: 'zero', lit: 'problem', first: first, mid: mid },
    };
  }

  /* The history keeps both parts: 3⁴/3⁴ = 3⁰ = 1. 5x⁰ = 5 has one. */
  function entry(problem) {
    var e = Pr.entry(problem);
    if (problem.parts && problem.parts.length > 1) e.via = problem.mid;
    return e;
  }

  /* 2 or 3 bases from a constant and x, y, z, each set equally likely, shown
     constant first, then x, y, z (as Mode 1 Level 4). */
  function bases(r, L) {
    var keys = Pr.shuffle(r, Pr.ORDER).slice(0, G.int(r, L.basesMin, L.basesMax));
    keys.sort(function (a, b) { return Pr.ORDER.indexOf(a) - Pr.ORDER.indexOf(b); });
    return keys.map(function (k) { return k === 'c' ? G.int(r, L.baseMin, L.baseMax) : k; });
  }

  function draw4(r) {
    var L = LEVEL4, form = G.pick(r, L.forms);
    if (form === 'one') return { form: form, factors: [[drawBase(r, L), drawExp(r, L)]] };
    if (form === 'coef') return { form: form, coef: G.int(r, L.coefMin, L.coefMax), factors: [[G.pick(r, L.variables), 0]] };
    var bs;
    if (form === 'many') bs = bases(r, L);
    else {
      // [My call] (5x)⁰ always has a coefficient, 2 to 10, then 1 or 2 of x, y,
      // z, so it stands against 5x⁰ (design §7: "must sound different").
      bs = Pr.shuffle(r, L.variables).slice(0, G.int(r, L.basesMin, L.basesMax) - 1).sort();
    }
    var exps = Pr.lower(r, L, bs.map(function () { return G.int(r, 1, L.expMax); }));
    var d = { form: form, factors: bs.map(function (b, i) { return [b, exps[i]]; }) };
    if (form === 'group') d.coef = G.int(r, L.coefMin, L.coefMax);
    return d;
  }

  function template4(r) {
    var p = problem4(draw4(r));
    p.shown.pc = p;
    return p.shown;
  }

  /* ---- grading --------------------------------------------------------------- */
  /* Levels 1 and 2: the whole-number field (Mode 1's grade). 0 is an answer,
     not an empty field (design §5).
     Levels 3 and 4: the answer box. Only the app's own answer, as written, is
     right (design §6, §7, and Dr. Cole, 2026-09-28):
       Level 3: b⁰. Not 1 (that is Level 4's task), not b⁰/1, not the problem
                typed back, not another base or exponent.
       Level 4, box 1: the zero powers, each base once, in any order
                [my call]: x⁰y⁰ or y⁰x⁰, 5⁰x⁰. Not 1 (that is box 2), not x⁰
                alone, not the problem typed back.
       Level 4, box 2: the value, one plain number. Not x⁰, 5⁰x⁰ or 5x⁰, not
                the problem typed back, not 1/1.
     `problem` is a problem, or one part (box) of a Level 4 problem.
     'empty' and 'invalid' (an empty exponent box) are not submissions. */
  function factorTexts(t) { return (t.t === 'mul' ? t.factors : [t]).map(E.toText).sort(); }

  function gradeMath(problem, model) {
    if (!model || !model.items || !model.items.length) return { status: 'empty' };
    var p = PC.Parse.parse(model);
    if (p.errors.length) {
      if (p.errors[0] === 'EMPTY') return { status: 'empty' };
      return { status: 'invalid', message: PC.Check.message({ status: 'invalid', errors: p.errors }), errors: p.errors };
    }
    var right = problem.anyOrder ? factorTexts(p.tree).join() === factorTexts(problem.answer).join()
      : E.toText(p.tree) === E.toText(problem.answer);
    return { status: right ? 'correct' : 'wrong', tree: p.tree };
  }

  /* Level 4: every box at once, from one Crush it! (Dr. Cole, 2026-09-29).
     `roots` are the boxes' models, in the order of problem.parts. An empty or
     unreadable box makes the whole submission not count; `at` is that box.
     Otherwise it is right only when every box is, and `parts` says which were
     ('correct' or 'wrong'), so each box can be marked. */
  function gradeParts(problem, roots) {
    var rs = problem.parts.map(function (pt, i) { return gradeMath(pt, roots[i]); });
    for (var i = 0; i < rs.length; i++) {
      if (rs[i].status === 'empty' || rs[i].status === 'invalid') {
        return { status: rs[i].status, message: rs[i].message, at: i, parts: rs.map(function (r) { return r.status; }) };
      }
    }
    var all = rs.every(function (r) { return r.status === 'correct'; });
    return { status: all ? 'correct' : 'wrong', parts: rs.map(function (r) { return r.status; }) };
  }

  /* ---- every level ----------------------------------------------------------- */
  /* A level's `make`: draw until the problem is within the handoff §4 limits
     (Level 1's plain numbers go to 1000) and is not the previous problem again. */
  function maker(n, template, limits) {
    return function (r, prev) {
      for (var i = 0; i < 50; i++) {
        var tree = G.generate(template, r, 1000, limits || { constCap: false }).tree;
        var p = tree.pc;
        delete tree.pc;
        if (prev && E.toText(prev.shown) === E.toText(tree)) continue;
        return p;
      }
      throw new Error('level ' + n + ' kept repeating the previous problem');
    };
  }

  var LEVELS = [
    { n: 1, title: 'Divide by Itself', make: maker(1, template1, { constCap: false, plainMax: LEVEL1.plainMax }), input: 'count' },   // names: design §2
    { n: 2, title: 'Cancel It All', make: maker(2, template2), input: 'count' },
    { n: 3, title: 'To the Zero', make: maker(3, template3), input: 'math' },
    { n: 4, title: 'Zero Means One', make: maker(4, template4), input: 'parts' },   // two boxes (Dr. Cole, 2026-09-29)
  ];

  PC.Zero = { LEVEL1: LEVEL1, LEVEL2: LEVEL2, LEVEL3: LEVEL3, LEVEL4: LEVEL4, LEVELS: LEVELS,
    level1: LEVELS[0].make, level2: LEVELS[1].make, level3: LEVELS[2].make, level4: LEVELS[3].make,
    problem1: problem1, problem2: problem2, problem3: problem3, problem4: problem4, draw4: draw4,
    gradeMath: gradeMath, gradeParts: gradeParts, entry: entry,
    // Whole-number grading is Mode 1's.
    clean: Pr.clean, grade: Pr.grade };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
