/*
 * solver.js — Mode 7 phase 2: the app's own steps for a Mixed Practice problem (no DOM).
 *
 * Design §12 (the step workspace). Answered by Dr. Cole, 2026-09-30, before the build:
 *   - Step and Solution show the solver's steps; each step applies one property
 *     everywhere it fits;
 *   - the order is outer exponents first (Power of a Power, with Power of a Product;
 *     then Power of a Quotient), then same-base combining (Product of Powers, then
 *     Quotient of Powers), then zero and negative exponents;
 *   - Step continues from the student's latest step, not from a fixed path.
 * My calls: Power of a Power and Power of a Quotient are two steps, and so are Product
 * and Quotient; a step that would change nothing is skipped; and a last step, "simplest
 * form" (E), multiplies and evaluates the numbers and writes the letters in order, so the
 * last step is exactly the app's answer (`Expr.simplest`).
 *
 * Everything here is tree to tree. `step(tree)` reads the tree it is given, so it works on
 * the problem and on any tree the student typed. A tree it can't read (`neg`, a group
 * inside a group, a zero) comes back `{ unreadable: true }`; activity.js then falls back to
 * the last readable step (Dr. Cole, 2026-09-30).
 *
 * The state a tree is read into:
 *   { top: [item…], bot: [item…] }   numerator side and denominator side; a line has no bot
 *   item = { k: 'n', v, ref }                  a plain number (never a base: 3 · 4)
 *        | { k: 'p', b, e, ref }               a power: b is a letter, or a number (2³)
 *        | { k: 'g', inner: state, e, ref }    a group, (…)ᵉ; inner holds no group
 * `ref` is the tree node an item was read from, which is how Hint marks it. A 1 is dropped
 * on reading; an item read from nothing has no ref.
 */
(function (PC) {
  'use strict';
  var E = PC.Expr;

  var UNREADABLE = { unreadable: true };

  /* ---- 1. Tree → state ------------------------------------------------------- */
  function power(b, e, ref) {
    if (typeof b === 'number') {
      if (b === 1) return null;
      if (e === 1) return { k: 'n', v: b, ref: ref || null };
    }
    return { k: 'p', b: b, e: e, ref: ref || null };
  }

  /* Push a node's factors into `into`; a denominator's go to `other`. */
  function flatten(node, into, other, inGroup) {
    switch (node.t) {
      case 'num':
        if (!(node.v >= 1)) throw UNREADABLE;
        if (node.v !== 1) into.push({ k: 'n', v: node.v, ref: node });
        return;
      case 'var':
        into.push({ k: 'p', b: node.name, e: 1, ref: node });
        return;
      case 'pow': {
        var b = node.base, it;
        if (b.t === 'var') it = power(b.name, node.exp, node);
        else if (b.t === 'num') {
          if (!(b.v >= 1)) throw UNREADABLE;
          it = power(b.v, node.exp, node);
        } else if (b.t === 'group') it = group(b, node.exp, node, inGroup);
        else throw UNREADABLE;
        if (it) into.push(it);
        return;
      }
      case 'group':
        into.push(group(node, 1, node, inGroup));
        return;
      case 'mul':
        node.factors.forEach(function (f) { flatten(f, into, other, inGroup); });
        return;
      case 'div':
        flatten(node.num, into, other, inGroup);
        flatten(node.den, other, into, inGroup);
        return;
    }
    throw UNREADABLE;   // 'neg', or anything else a problem never has
  }

  function group(node, e, ref, inGroup) {
    if (inGroup) throw UNREADABLE;    // one level only
    var inner = { top: [], bot: [] };
    flatten(node.inner, inner.top, inner.bot, true);
    return { k: 'g', inner: inner, e: e, ref: ref };
  }

  /* The state of a tree, or null when it can't be read. */
  function read(tree) {
    try {
      var st = { top: [], bot: [] };
      flatten(tree, st.top, st.bot, false);
      return st;
    } catch (err) {
      if (err === UNREADABLE) return null;
      throw err;
    }
  }

  /* ---- 2. State → tree ------------------------------------------------------- */
  function itemNode(it) {
    if (it.k === 'n') return E.N(it.v);
    if (it.k === 'p') {
      var base = typeof it.b === 'number' ? E.N(it.b) : E.V(it.b);
      return it.e === 1 ? base : E.P(base, it.e);
    }
    var g = E.G(sideTree(it.inner));
    return it.e === 1 ? g : E.P(g, it.e);
  }

  function isNumber(it) { return it.k === 'n' || (it.k === 'p' && typeof it.b === 'number'); }

  /* A row of items, numbers first as the problems are written (4y⁶, not y⁶ · 4), "·"
     between them when a group or a repeated base is in it, so two x powers or two
     numbers never run together. */
  function row(items) {
    items = items.filter(isNumber).concat(items.filter(function (it) { return !isNumber(it); }));
    if (items.length === 1) return itemNode(items[0]);
    var seen = {}, dot = false;
    items.forEach(function (it) {
      if (it.k === 'g') dot = true;
      if (it.k === 'p') { var key = String(it.b); if (seen[key]) dot = true; seen[key] = true; }
    });
    var m = { t: 'mul', factors: items.map(itemNode) };
    if (dot) m.dot = true;
    return m;
  }

  function sideTree(st) {
    if (!st.bot.length) return st.top.length ? row(st.top) : E.N(1);
    return E.D(st.top.length ? row(st.top) : E.N(1), row(st.bot));
  }

  /* ---- 3. The stages ---------------------------------------------------------- */
  /* Each returns the new state, or null if it changes nothing. `targets` returns the
     items it would change (Hint marks them). */
  function raise(x, e) {
    if (x.k === 'n') return power(x.v, e);
    return power(x.b, x.e * e);
  }

  function distribute(st, pick) {
    var out = { top: [], bot: [] }, changed = false;
    ['top', 'bot'].forEach(function (side) {
      var other = side === 'top' ? 'bot' : 'top';
      st[side].forEach(function (it) {
        if (it.k !== 'g' || !pick(it)) { out[side].push(it); return; }
        changed = true;
        it.inner.top.forEach(function (x) { var r = raise(x, it.e); if (r) out[side].push(r); });
        it.inner.bot.forEach(function (x) { var r = raise(x, it.e); if (r) out[other].push(r); });
      });
    });
    return changed ? out : null;
  }
  var noBar = function (g) { return g.inner.bot.length === 0; };
  var hasBar = function (g) { return g.inner.bot.length > 0; };

  function keyOf(it) { return String(it.b); }

  /* Items of one side that share a base with another item of that side. */
  function repeats(items) {
    var count = {};
    items.forEach(function (it) { if (it.k === 'p') count[keyOf(it)] = (count[keyOf(it)] || 0) + 1; });
    return items.filter(function (it) { return it.k === 'p' && count[keyOf(it)] > 1; });
  }

  /* Product of Powers: a base twice on one side, add the exponents. */
  function combineSide(items) {
    var total = {}, count = {}, first = {}, out = [];
    items.forEach(function (it, idx) {
      if (it.k !== 'p') return;
      var k = keyOf(it);
      total[k] = (total[k] || 0) + it.e;
      count[k] = (count[k] || 0) + 1;
      if (first[k] === undefined) first[k] = idx;
    });
    items.forEach(function (it, idx) {
      if (it.k !== 'p' || count[keyOf(it)] === 1) { out.push(it); return; }
      if (idx !== first[keyOf(it)]) return;
      var r = power(it.b, total[keyOf(it)]);
      if (r) out.push(r);
    });
    return out;
  }
  function stageP(st) {
    var out = { top: combineSide(st.top), bot: combineSide(st.bot) };
    return out.top.length !== st.top.length || out.bot.length !== st.bot.length ? out : null;
  }

  /* Quotient of Powers: a base above and below the bar. The result lands on top,
     whatever its sign (Mode 2 design). */
  function bothSides(st) {
    var below = {};
    st.bot.forEach(function (it) { if (it.k === 'p') below[keyOf(it)] = true; });
    return below;
  }
  function stageQ(st) {
    var below = bothSides(st), sum = { top: {}, bot: {} }, changed = false;
    ['top', 'bot'].forEach(function (s) {
      st[s].forEach(function (it) { if (it.k === 'p') sum[s][keyOf(it)] = (sum[s][keyOf(it)] || 0) + it.e; });
    });
    var out = { top: [], bot: [] }, done = {};
    st.top.forEach(function (it) {
      var k = it.k === 'p' ? keyOf(it) : null;
      if (k === null || !below[k]) { out.top.push(it); return; }
      changed = true;
      if (done[k]) return;
      done[k] = true;
      var r = power(it.b, sum.top[k] - sum.bot[k]);
      if (r) out.top.push(r);
    });
    st.bot.forEach(function (it) {
      var k = it.k === 'p' ? keyOf(it) : null;
      // A base only below stays below; a base that met one above was used above.
      if (k !== null && done[k]) return;
      out.bot.push(it);
    });
    return changed ? out : null;
  }

  /* Zero Exponent: b⁰ is 1, and a 1 beside anything else is left out. */
  function stageZ(st) {
    var out = { top: [], bot: [] }, changed = false;
    ['top', 'bot'].forEach(function (s) {
      st[s].forEach(function (it) { if (it.k === 'p' && it.e === 0) changed = true; else out[s].push(it); });
    });
    return changed ? out : null;
  }

  /* Negative Exponent: b⁻ⁿ crosses the bar and becomes bⁿ. */
  function stageN(st) {
    var out = { top: [], bot: [] }, changed = false;
    ['top', 'bot'].forEach(function (s) {
      var other = s === 'top' ? 'bot' : 'top';
      st[s].forEach(function (it) {
        if (it.k === 'p' && it.e < 0) { changed = true; out[other].push(power(it.b, -it.e)); } else out[s].push(it);
      });
    });
    return changed ? out : null;
  }

  var STAGES = [
    { id: 'PP', name: 'Power of a Power', run: function (st) { return distribute(st, noBar); },
      targets: function (st) { return groups(st, noBar); } },
    { id: 'PQ', name: 'Power of a Quotient', run: function (st) { return distribute(st, hasBar); },
      targets: function (st) { return groups(st, hasBar); } },
    { id: 'P', name: 'Product of Powers', run: stageP,
      targets: function (st) { return repeats(st.top).concat(repeats(st.bot)); } },
    { id: 'Q', name: 'Quotient of Powers', run: stageQ,
      targets: function (st) {
        var below = bothSides(st), above = {};
        st.top.forEach(function (it) { if (it.k === 'p') above[keyOf(it)] = true; });
        return st.top.concat(st.bot).filter(function (it) { return it.k === 'p' && above[keyOf(it)] && below[keyOf(it)]; });
      } },
    { id: 'Z', name: 'Zero Exponent', run: stageZ,
      targets: function (st) { return st.top.concat(st.bot).filter(function (it) { return it.k === 'p' && it.e === 0; }); } },
    { id: 'N', name: 'Negative Exponent', run: stageN,
      targets: function (st) { return st.top.concat(st.bot).filter(function (it) { return it.k === 'p' && it.e < 0; }); } },
  ];
  function groups(st, pick) { return st.top.concat(st.bot).filter(function (it) { return it.k === 'g' && pick(it); }); }

  /* The last step: numbers multiplied and evaluated, letters in order. The tree is the
     app's answer. */
  var SIMPLEST = { id: 'E', name: 'Simplest form' };

  function simplestOf(tree) {
    try { return E.simplest(E.normalize(tree)); } catch (err) { return null; }
  }

  /* Numbers a student would evaluate: plain numbers and powers of numbers. */
  function numbers(st) {
    return st.top.concat(st.bot).filter(function (it) { return it.k === 'n' || (it.k === 'p' && typeof it.b === 'number'); });
  }

  /* ---- 4. Steps, hints ---------------------------------------------------------- */
  /* The next step from `tree`: { stage, name, tree }, { done: true } when the tree is
     already the app's answer as written, or { unreadable: true }. */
  function step(tree) {
    var st = read(tree);
    if (!st) return UNREADABLE;
    for (var i = 0; i < STAGES.length; i++) {
      var out = STAGES[i].run(st);
      if (out) return { stage: STAGES[i].id, name: STAGES[i].name, tree: sideTree(out) };
    }
    var ans = simplestOf(tree);
    if (!ans) return UNREADABLE;
    if (E.toText(ans) === E.toText(tree)) return { done: true };
    return { stage: SIMPLEST.id, name: SIMPLEST.name, tree: ans };
  }

  /* Every step from `tree` to the answer. Stops early, with `unreadable: true`, if a
     step can't be read. */
  function all(tree) {
    var steps = [], cur = tree;
    for (var guard = 0; guard < 24; guard++) {
      var s = step(cur);
      if (s.done) return { steps: steps };
      if (s.unreadable) return { steps: steps, unreadable: true };
      steps.push(s);
      cur = s.tree;
    }
    return { steps: steps, unreadable: true };
  }

  /* Where the next property applies in `tree`: { stage, name, marks: [tree nodes] }.
     No marks means the step has nothing to point at (writing the letters in order). */
  function hint(tree) {
    var st = read(tree);
    if (!st) return UNREADABLE;
    for (var i = 0; i < STAGES.length; i++) {
      if (!STAGES[i].run(st)) continue;
      return { stage: STAGES[i].id, name: STAGES[i].name, marks: refs(STAGES[i].targets(st)) };
    }
    var ans = simplestOf(tree);
    if (!ans) return UNREADABLE;
    if (E.toText(ans) === E.toText(tree)) return { done: true };
    return { stage: SIMPLEST.id, name: SIMPLEST.name, marks: refs(numbers(st)) };
  }

  function refs(items) {
    var out = [];
    items.forEach(function (it) { if (it.ref && out.indexOf(it.ref) < 0) out.push(it.ref); });
    return out;
  }

  /* Hint marks nodes with `hl`; Render.draw draws them lit. */
  function mark(nodes) { nodes.forEach(function (n) { n.hl = true; }); }
  function clearMarks(tree) {
    (function walk(n) {
      if (!n) return;
      delete n.hl;
      if (n.t === 'pow') walk(n.base);
      else if (n.t === 'mul') n.factors.forEach(walk);
      else if (n.t === 'div') { walk(n.num); walk(n.den); }
      else if (n.t === 'group' || n.t === 'neg') walk(n.inner);
    })(tree);
  }

  PC.Solver = {
    read: read, step: step, all: all, hint: hint, mark: mark, clearMarks: clearMarks,
    NAMES: STAGES.concat([SIMPLEST]).map(function (s) { return s.name; }),
  };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
