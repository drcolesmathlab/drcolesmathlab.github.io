/*
 * render.js — draws an expression tree and says it in words.
 *
 * Display rule (handoff §6): exponents are always real superscripts and
 * fractions are always vertical, never a slash. The drawn maths is aria-hidden;
 * its container carries role="img" and the spoken form as its label, so a
 * screen reader gets "x to the power negative 3" instead of "x, 3".
 */
(function (PC) {
  'use strict';

  var MINUS = '−';

  /* ---- words ----------------------------------------------------------------- */
  function isAtom(n) { return n.t === 'num' || n.t === 'var'; }

  function speakExp(e) { return e < 0 ? 'negative ' + -e : String(e); }

  function speak(node) {
    switch (node.t) {
      case 'num': return String(node.v);
      case 'var': return node.name;
      case 'pow':
        // A power of a group: "3, x to the power 2, y, all to the power 4" (Mode 3 design §5, §7).
        if (node.base.t === 'group') return speak(node.base.inner) + ', all to the power ' + speakExp(node.exp);
        return speak(node.base) + ' to the power ' + speakExp(node.exp);
      case 'mul':
        // A comma after each power stops "x to the power 3 y" reading as x^(3y).
        // `times` says "times" without drawing a dot: (x²)(x²) (Mode 3 design §4).
        return node.factors.map(function (f, i) {
          var s = speak(f);
          if ((node.dot || node.times) && i > 0) s = 'times ' + s;
          return s;
        }).join(', ');
      case 'div':
        if (isAtom(node.num) && isAtom(node.den)) return speak(node.num) + ' over ' + speak(node.den);
        return 'the fraction ' + speak(node.num) + ', over ' + speak(node.den) + ', end fraction';
      case 'group':
        // Parentheses around one power change nothing, so (x²) is read as x².
        // Nor around a fraction, whose reading already ends ("end fraction"):
        // (x²/5³)(x²/5³) is read with "times" between the fractions (Mode 4 design §4).
        if (isAtom(node.inner) || (node.inner.t === 'pow' && isAtom(node.inner.base)) || node.inner.t === 'div') return speak(node.inner);
        return 'the quantity ' + speak(node.inner) + ', end quantity';
      case 'neg': return 'negative ' + speak(node.inner);
    }
    return '';
  }

  /* ---- DOM ------------------------------------------------------------------- */
  function span(cls, text) {
    var s = document.createElement('span');
    if (cls) s.className = cls;
    if (text !== undefined) s.textContent = text;
    return s;
  }

  function startsWithDigit(n) {
    if (n.t === 'num') return true;
    if (n.t === 'pow') return startsWithDigit(n.base);
    if (n.t === 'mul') return startsWithDigit(n.factors[0]);
    return false;
  }

  /* A node with `hl` set is drawn lit: Hint marks the parts of a step it points at
     (solver.js). The class goes on the node's own element. */
  function draw(node) {
    var el = drawNode(node);
    if (node.hl) el.classList.add('m-hl');
    return el;
  }

  function drawNode(node) {
    switch (node.t) {
      case 'num': return span('m-ch', String(node.v));
      case 'var': return span('m-var', node.name);
      case 'pow':
        var p = span('m-pow');
        p.appendChild(draw(node.base));
        p.appendChild(span('m-exp', (node.exp < 0 ? MINUS : '') + Math.abs(node.exp)));
        return p;
      case 'mul':
        var m = span('m-mul');
        node.factors.forEach(function (f, i) {
          // Two numbers side by side need a dot, or 3²3⁻⁴ reads as 33⁻⁴.
          if (i > 0 && (node.dot || startsWithDigit(f))) m.appendChild(span('m-op', '·'));
          m.appendChild(draw(f));
        });
        return m;
      case 'div':
        var f = span('m-frac');
        var n = span('m-num'), d = span('m-den');
        n.appendChild(draw(node.num));
        d.appendChild(draw(node.den));
        f.appendChild(n); f.appendChild(d);
        return f;
      case 'group':
        // Parentheses around a fraction stand as tall as it (Mode 4).
        var g = span(node.inner.t === 'div' ? 'm-group m-group-frac' : 'm-group');
        g.appendChild(span('m-paren', '('));
        g.appendChild(draw(node.inner));
        g.appendChild(span('m-paren', ')'));
        return g;
      case 'neg':
        var s = span('m-neg');
        s.appendChild(span('m-op', MINUS));
        s.appendChild(draw(node.inner));
        return s;
    }
    return span();
  }

  /* Fill `host` with the drawn expression; the words go on the host. */
  function into(host, node) {
    var d = draw(node);
    d.setAttribute('aria-hidden', 'true');
    host.replaceChildren(d);
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', speak(node));
  }

  PC.Render = { speak: speak, draw: draw, into: into };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
