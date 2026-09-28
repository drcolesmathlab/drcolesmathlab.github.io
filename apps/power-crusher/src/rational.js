/*
 * rational.js — exact fractions on BigInt.
 *
 * Every coefficient the app handles is a fraction (4⁻² = 1/16), and a student can
 * type things far outside the problem limits (10^20), so Number is not safe here.
 * A rational is always stored reduced, with a positive denominator.
 */
(function (PC) {
  'use strict';

  function gcd(a, b) {
    if (a < 0n) a = -a;
    if (b < 0n) b = -b;
    while (b) { var t = a % b; a = b; b = t; }
    return a;
  }

  function make(n, d) {
    n = BigInt(n);
    d = d === undefined ? 1n : BigInt(d);
    if (d === 0n) throw new RangeError('zero denominator');
    if (d < 0n) { n = -n; d = -d; }
    var g = gcd(n, d);
    if (g > 1n) { n /= g; d /= g; }
    if (n === 0n) d = 1n;
    return { n: n, d: d };
  }

  function mul(a, b) { return make(a.n * b.n, a.d * b.d); }
  function div(a, b) {
    if (b.n === 0n) throw new RangeError('division by zero');
    return make(a.n * b.d, a.d * b.n);
  }

  /* Integer power, negative exponents allowed. 0 to a negative power throws;
     0⁰ throws too, because the app never treats it as defined. */
  function pow(a, e) {
    if (a.n === 0n && e <= 0) throw new RangeError('0 to a non-positive power');
    // A student can type 99^999; refuse before BigInt spends seconds on it.
    var digits = String(a.n < 0n ? -a.n : a.n).length + String(a.d).length;
    if (digits * Math.abs(e) > 4000) throw new RangeError('too large');
    var k = BigInt(Math.abs(e));
    var r = make(a.n ** k, a.d ** k);
    return e < 0 ? make(r.d, r.n) : r;
  }

  function eq(a, b) { return a.n === b.n && a.d === b.d; }
  function isOne(a) { return a.n === 1n && a.d === 1n; }
  function toString(a) { return a.d === 1n ? String(a.n) : a.n + '/' + a.d; }

  PC.Rational = {
    gcd: gcd, make: make, mul: mul, div: div, pow: pow, eq: eq, isOne: isOne,
    toString: toString, ONE: make(1n), ZERO: make(0n),
  };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
