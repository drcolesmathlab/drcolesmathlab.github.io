/*
 * generate.js — the problem-generation harness every mode will share.
 *
 * A mode supplies a template: a function (rng) → expression tree. The harness
 * keeps drawing until the tree passes Expr.checkLimits, so no mode can hand a
 * student a base of 0 or 1, a given exponent past ±10, or a constant past 1000
 * (handoff §4), however its template is written. Templates and levels are [TBD]
 * per mode and arrive in Phases 1–8.
 *
 * Seeded, so a problem can be reproduced from its seed when something looks wrong.
 */
(function (PC) {
  'use strict';

  /* mulberry32: small, fast, good enough for picking exponents. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function int(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

  /* Returns { tree, tries } or throws if the template can't produce a legal
     problem — that is a bug in the template, and it should be loud.
     `limits` is passed on to Expr.checkLimits (e.g. { constCap: false }). */
  function generate(template, r, maxTries, limits) {
    maxTries = maxTries || 1000;
    for (var tries = 1; tries <= maxTries; tries++) {
      var tree = template(r);
      if (PC.Expr.checkLimits(tree, limits).length === 0) return { tree: tree, tries: tries };
    }
    throw new Error('template produced no legal problem in ' + maxTries + ' tries');
  }

  PC.Generate = { rng: rng, int: int, pick: pick, generate: generate };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
