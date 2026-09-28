/*
 * expr.js — the expression tree every other module shares, and its normal form.
 *
 * Tree nodes (plain objects, so they serialise and compare easily):
 *   { t: 'num',   v: 2 }                      positive whole number
 *   { t: 'var',   name: 'x' }
 *   { t: 'pow',   base: node, exp: -3 }        integer exponent, always a literal
 *   { t: 'mul',   factors: [node, ...] }       juxtaposition or ·
 *   { t: 'div',   num: node, den: node }        drawn as a vertical fraction
 *   { t: 'group', inner: node }                 parentheses; only matters for display
 *   { t: 'neg',   inner: node }                 a leading minus a student typed
 *
 * Normal form: { coef: Rational, vars: { x: 3, y: -2 } } with zero exponents
 * dropped. Two expressions are equivalent exactly when their normal forms are
 * equal — which is safe here because every expression is a monomial.
 */
(function (PC) {
  'use strict';
  var R = PC.Rational;

  /* ---- constructors (short, because tests and examples build a lot of trees) -- */
  function N(v) { return { t: 'num', v: v }; }
  function V(name) { return { t: 'var', name: name }; }
  function P(base, exp) { return { t: 'pow', base: base, exp: exp }; }
  function M() { return { t: 'mul', factors: Array.prototype.slice.call(arguments) }; }
  function D(num, den) { return { t: 'div', num: num, den: den }; }
  function G(inner) { return { t: 'group', inner: inner }; }

  /* ---- normal form ------------------------------------------------------------ */
  function nf(coef, vars) { return { coef: coef, vars: vars || {} }; }

  function nfMul(a, b) {
    var vars = Object.assign({}, a.vars);
    Object.keys(b.vars).forEach(function (k) {
      vars[k] = (vars[k] || 0) + b.vars[k];
      if (vars[k] === 0) delete vars[k];
    });
    return nf(R.mul(a.coef, b.coef), vars);
  }

  function nfPow(a, e) {
    var vars = {};
    if (e !== 0) Object.keys(a.vars).forEach(function (k) { vars[k] = a.vars[k] * e; });
    return nf(R.pow(a.coef, e), vars);
  }

  function nfInv(a) { return nfPow(a, -1); }

  /* Throws RangeError for 0 to a non-positive power or a runaway number. */
  function normalize(node) {
    switch (node.t) {
      case 'num': return nf(R.make(node.v));
      case 'var': var v = {}; v[node.name] = 1; return nf(R.ONE, v);
      case 'pow': return nfPow(normalize(node.base), node.exp);
      case 'mul': return node.factors.reduce(function (acc, f) {
        return nfMul(acc, normalize(f));
      }, nf(R.ONE));
      case 'div': return nfMul(normalize(node.num), nfInv(normalize(node.den)));
      case 'group': return normalize(node.inner);
      case 'neg': return nfMul(nf(R.make(-1)), normalize(node.inner));
    }
    throw new TypeError('unknown node ' + node.t);
  }

  function tryNormalize(node) {
    try { return normalize(node); } catch (e) { return null; }
  }

  function nfEqual(a, b) {
    if (!a || !b || !R.eq(a.coef, b.coef)) return false;
    var ka = Object.keys(a.vars), kb = Object.keys(b.vars);
    if (ka.length !== kb.length) return false;
    return ka.every(function (k) { return a.vars[k] === b.vars[k]; });
  }

  function equivalent(a, b) { return nfEqual(tryNormalize(a), tryNormalize(b)); }

  /* The fully simplified tree for a normal form: positive exponents only, no
     exponent of 1, variables alphabetical, coefficients inside the fraction.
     This is the Mixed-mode target form (handoff §4). */
  function simplest(n) {
    var top = [], bottom = [];
    var cn = n.coef.n, cd = n.coef.d, neg = cn < 0n;
    if (neg) cn = -cn;
    Object.keys(n.vars).sort().forEach(function (k) {
      var e = n.vars[k], f = Math.abs(e) === 1 ? V(k) : P(V(k), Math.abs(e));
      (e > 0 ? top : bottom).push(f);
    });
    if (cn !== 1n || top.length === 0) top.unshift(N(Number(cn)));
    if (cd !== 1n) bottom.unshift(N(Number(cd)));
    var numNode = top.length === 1 ? top[0] : { t: 'mul', factors: top };
    var out = numNode;
    if (bottom.length) {
      out = D(numNode, bottom.length === 1 ? bottom[0] : { t: 'mul', factors: bottom });
    }
    return neg ? { t: 'neg', inner: out } : out;
  }

  /* ---- plain-text form, for debugging and test names ------------------------- */
  function toText(node) {
    switch (node.t) {
      case 'num': return String(node.v);
      case 'var': return node.name;
      case 'pow': return toText(node.base) + '^' + node.exp;
      case 'mul': return node.factors.map(function (f) {
        return f.t === 'div' ? '(' + toText(f) + ')' : toText(f);
      }).join('');
      case 'div': return wrap(node.num) + '/' + wrap(node.den);
      case 'group': return '(' + toText(node.inner) + ')';
      case 'neg': return '-' + toText(node.inner);
    }
    function wrap(n) { return n.t === 'mul' || n.t === 'div' ? '(' + toText(n) + ')' : toText(n); }
  }

  /* ---- problem limits (handoff §4) ------------------------------------------- */
  var LIMITS = {
    constBaseMin: 2, constBaseMax: 10,
    givenExpMin: -10, givenExpMax: 10,   // result exponents have no limit (Mode 3 design §3)
    constMax: 1000,
    variables: ['x', 'y', 'z'],
  };

  /* Returns a list of broken rules; an empty list means the problem is allowed.
     Every constant is treated as a base (a bare 4 is 4¹), so 0 and 1 are refused
     everywhere except a lone 1 as a fraction's numerator, as in 1/x³.
     The constant cap is checked on every power, product and fraction, not just
     the final answer: (2x)¹⁰ breaks it even if something later divides it back
     down. A result exponent has no limit (Mode 3 design §3): (x¹⁰)¹⁰ = x¹⁰⁰.
     `opts.constCap: false` lifts the 1000 cap, which applies only to fully
     simplified answers, not to Explore problems (Mode 1 design §9). */
  function checkLimits(tree, opts) {
    var constCap = !(opts && opts.constCap === false);
    var errors = [];
    function add(msg) { if (errors.indexOf(msg) < 0) errors.push(msg); }

    function checkResult(node) {
      var n;
      try { n = normalize(node); } catch (e) { add('undefined or runaway value in ' + toText(node)); return; }
      var cn = n.coef.n < 0n ? -n.coef.n : n.coef.n;
      if (cn < 1n || (constCap && (cn > BigInt(LIMITS.constMax) || n.coef.d > BigInt(LIMITS.constMax)))) {
        add('constant ' + R.toString(n.coef) + ' outside 1..' + LIMITS.constMax);
      }
    }

    function walk(node, loneNumerator) {
      switch (node.t) {
        case 'num':
          if (!(loneNumerator && node.v === 1) &&
              (node.v < LIMITS.constBaseMin || node.v > LIMITS.constBaseMax)) {
            add('constant base ' + node.v + ' outside ' + LIMITS.constBaseMin + '..' + LIMITS.constBaseMax);
          }
          return;
        case 'var':
          if (LIMITS.variables.indexOf(node.name) < 0) add('variable ' + node.name + ' not allowed');
          return;
        case 'pow':
          if (node.exp < LIMITS.givenExpMin || node.exp > LIMITS.givenExpMax) {
            add('given exponent ' + node.exp + ' outside ' + LIMITS.givenExpMin + '..' + LIMITS.givenExpMax);
          }
          walk(node.base, false); checkResult(node); return;
        case 'mul': node.factors.forEach(function (f) { walk(f, false); }); checkResult(node); return;
        case 'div': walk(node.num, true); walk(node.den, false); checkResult(node); return;
        case 'group': walk(node.inner, false); return;
        case 'neg': add('negative sign in a problem'); walk(node.inner, false); return;
      }
    }

    walk(tree, false);
    checkResult(tree);
    return errors;
  }

  PC.Expr = {
    N: N, V: V, P: P, M: M, D: D, G: G,
    normalize: normalize, tryNormalize: tryNormalize, nfEqual: nfEqual,
    equivalent: equivalent, simplest: simplest, toText: toText,
    LIMITS: LIMITS, checkLimits: checkLimits,
  };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
