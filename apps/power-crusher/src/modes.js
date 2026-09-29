/*
 * modes.js — the seven modes, in the recommended order (handoff §3). Power of a
 * Product is no longer a mode of its own: it is Power of a Power's Level 4
 * (Mode 3 design §1, §9), and the modes after it moved up one (Dr. Cole,
 * 2026-09-28).
 *
 * `examples` are the verified worked examples from handoff §4 (plus the §11
 * acceptance-check problems), used only by the Phase 0 answer-box preview. They
 * are not the modes' real problem sets; those come with each mode's own phase.
 * Only Mixed Practice still shows the preview; the others' examples are kept for
 * the sandbox and the limits test.
 * `policy` names the checker policy in check.js.
 */
(function (PC) {
  'use strict';
  var E = PC.Expr, N = E.N, V = E.V, P = E.P, D = E.D, G = E.G;
  var x = V('x'), y = V('y');
  function dot() { return { t: 'mul', factors: Array.prototype.slice.call(arguments), dot: true }; }

  var MODES = [
    { id: 'product', title: 'Product of Powers', policy: 'property',
      examples: [dot(P(x, 4), P(x, 3))] },
    { id: 'quotient', title: 'Quotient of Powers', policy: 'property',
      examples: [D(P(x, 8), P(x, 3)), D(P(x, 3), P(x, 5)), D(P(x, 3), P(x, 3))] },
    { id: 'power-of-power', title: 'Power of a Power', policy: 'property',
      examples: [P(G(P(x, 2)), 5)] },
    { id: 'power-of-quotient', title: 'Power of a Quotient', policy: 'property',
      examples: [P(G(D(x, N(3))), 2)] },
    { id: 'zero', title: 'Zero Exponent', policy: 'zero',
      examples: [P(N(7), 0), P(x, 0)] },
    { id: 'negative', title: 'Negative Exponent', policy: 'negative',
      examples: [P(N(4), -2), P(x, -3), P(x, -1)] },
    { id: 'mixed', title: 'Mixed Practice', policy: 'mixed',
      examples: [
        D(P(G(E.M(N(2), P(x, 3), P(y, -2))), 3), E.M(N(4), P(x, 2))),
        dot(P(G(E.M(P(x, -2), P(y, 3))), -2), P(x, 0)),
        dot(P(N(3), 2), P(N(3), -4)),
      ] },
  ];
  MODES.forEach(function (m, i) { m.number = i + 1; });

  function byId(id) {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i];
    return null;
  }

  PC.Modes = { MODES: MODES, byId: byId };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
