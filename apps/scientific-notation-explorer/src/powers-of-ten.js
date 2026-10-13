/*
 * powers-of-ten.js — Level 1's exploration: a power of 10 shown three ways.
 *
 * Built from Doc's spec, given in the build session on 2026-10-12, and recorded as
 * Decided in design/levels/level-1-powers-of-10.md on 2026-10-13.
 *
 * Two parts, chosen with pill buttons the way Power Crusher chooses a level:
 *   Part 1  10^n, exponent n an integer from -12 to 12 (starts at 1)
 *   Part 2  c · 10^n, as Part 1 plus a coefficient c, an integer from -9 to 9 (starts at 1)
 *
 * Three windows, top to bottom:
 *   standard    the value in standard form. Read-only in both parts.
 *   exponential c · 10^n, with up and down buttons: exponent on the right, and in Part 2
 *               the coefficient on the left.
 *   expanded    10^0 is 1, 10^1 is 10, 10^n is n tens joined by dots, and a negative
 *               exponent is a stacked fraction: 1 (or the coefficient) over |n| tens,
 *               with a horizontal bar and never a slash. Multiplication is always a dot.
 *               Part 2 with n = 0 shows the coefficient times 1 (confirmed by Doc,
 *               2026-10-13), and a negative coefficient keeps its sign on the numerator.
 *
 * An exploration has no right or wrong, so nothing is recorded (api.record is not called).
 * Pure functions are exported on SNE.PowersOfTen for the tests; mount() is the only
 * part that touches the DOM.
 */
(function (SNE) {
  'use strict';

  var EXP_MIN = -12, EXP_MAX = 12;
  var COEF_MIN = -9, COEF_MAX = 9;
  var MINUS = '−';
  var DOT = '·';

  function signed(v) { return v < 0 ? MINUS + (-v) : String(v); }

  function group(digits) { return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /* Standard form of c · 10^n, built from strings so floating point is never involved.
     Part 1 is the case c = 1. */
  function standardForm(c, n) {
    if (c === 0) return '0';
    var sign = c < 0 ? MINUS : '';
    var a = String(Math.abs(c));
    if (n >= 0) return sign + group(a + '0'.repeat(n));
    return sign + '0.' + '0'.repeat(-n - 1) + a;
  }

  /* What a screen reader hears when a value changes. */
  function spoken(c, n, hasCoef) {
    var power = '10 to the power ' + (n < 0 ? 'negative ' + (-n) : n);
    var value = standardForm(hasCoef ? c : 1, n).replace(MINUS, 'negative ');
    var lead = hasCoef ? (c < 0 ? 'negative ' + (-c) : String(c)) + ' times ' : '';
    return lead + power + ', which is ' + value;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function dotted(items) {
    var row = el('div', 'pot-factors');
    items.forEach(function (t, i) {
      if (i > 0) row.appendChild(el('span', 'pot-dot', DOT));
      row.appendChild(el('span', 'pot-factor', t));
    });
    return row;
  }

  function tens(count) {
    var a = [];
    for (var i = 0; i < count; i++) a.push('10');
    return a;
  }

  function fraction(numText, denItems) {
    var frac = el('div', 'pot-frac');
    frac.appendChild(el('div', 'pot-num', numText));
    var den = el('div', 'pot-den');
    den.appendChild(dotted(denItems));
    frac.appendChild(den);
    return frac;
  }

  function stepper(what) {
    var box = el('div', 'pot-stepper');
    var up = el('button', 'pot-step', '▲');
    var down = el('button', 'pot-step', '▼');
    up.type = down.type = 'button';
    up.setAttribute('aria-label', 'Increase the ' + what);
    down.setAttribute('aria-label', 'Decrease the ' + what);
    box.appendChild(up);
    box.appendChild(down);
    return { box: box, up: up, down: down };
  }

  /* One part: its three windows, its own state. `announce` reads changes aloud. */
  function makePart(hasCoef, announce) {
    var c = 1;
    var n = 1;

    var root = el('div', 'pot-part');

    var top = el('section', 'pot-window');
    top.setAttribute('aria-label', 'Standard form');
    var standardEl = el('div', 'pot-standard');
    top.appendChild(standardEl);

    var mid = el('section', 'pot-window');
    mid.setAttribute('aria-label', 'Exponential form');
    var row = el('div', 'pot-exp-row');
    var coefStep = null;
    if (hasCoef) {
      coefStep = stepper('coefficient');
      row.appendChild(coefStep.box);
    }
    var expEl = el('div', 'pot-exp');
    row.appendChild(expEl);
    var expStep = stepper('exponent');
    row.appendChild(expStep.box);
    mid.appendChild(row);

    var bottom = el('section', 'pot-window');
    bottom.setAttribute('aria-label', 'Expanded form');
    var expandedEl = el('div', 'pot-expanded');
    bottom.appendChild(expandedEl);

    root.appendChild(top);
    root.appendChild(mid);
    root.appendChild(bottom);

    function renderExpanded() {
      expandedEl.textContent = '';
      if (!hasCoef) {
        if (n === 0) expandedEl.textContent = '1';
        else if (n > 0) expandedEl.appendChild(dotted(tens(n)));
        else expandedEl.appendChild(fraction('1', tens(-n)));
        return;
      }
      var cs = signed(c);
      if (n === 0) expandedEl.appendChild(dotted([cs, '1']));
      else if (n > 0) expandedEl.appendChild(dotted([cs].concat(tens(n))));
      else expandedEl.appendChild(fraction(cs, tens(-n)));
    }

    /* The row never wraps: shrink the font until it fits the window. Does nothing while
       the part is hidden (width 0); the observer in mount() calls it again once shown. */
    function fit() {
      expandedEl.style.fontSize = '';
      var content = expandedEl.querySelector('.pot-factors');
      var avail = expandedEl.clientWidth;
      if (!content || !avail) return;
      var max = parseFloat(getComputedStyle(expandedEl).fontSize);
      var w = content.scrollWidth;
      if (w > avail) expandedEl.style.fontSize = Math.floor(max * avail / w * 10) / 10 + 'px';
    }

    function render(say) {
      standardEl.textContent = standardForm(hasCoef ? c : 1, n);
      expEl.textContent = '';
      if (hasCoef) {
        expEl.appendChild(el('span', 'pot-coef', signed(c)));
        expEl.appendChild(el('span', 'pot-dot', DOT));
      }
      expEl.appendChild(document.createTextNode('10'));
      expEl.appendChild(el('sup', 'pot-sup', signed(n)));
      renderExpanded();
      fit();
      expStep.up.disabled = n >= EXP_MAX;
      expStep.down.disabled = n <= EXP_MIN;
      if (coefStep) {
        coefStep.up.disabled = c >= COEF_MAX;
        coefStep.down.disabled = c <= COEF_MIN;
      }
      if (say) announce(spoken(c, n, hasCoef));
    }

    expStep.up.addEventListener('click', function () { if (n < EXP_MAX) { n++; render(true); } });
    expStep.down.addEventListener('click', function () { if (n > EXP_MIN) { n--; render(true); } });
    if (coefStep) {
      coefStep.up.addEventListener('click', function () { if (c < COEF_MAX) { c++; render(true); } });
      coefStep.down.addEventListener('click', function () { if (c > COEF_MIN) { c--; render(true); } });
    }

    render(false);
    return { root: root, fit: fit };
  }

  var PARTS = [
    { key: 'part-1', label: 'Part 1', about: 'Part 1: a power of 10', coef: false },
    { key: 'part-2', label: 'Part 2', about: 'Part 2: a power of 10 with a coefficient', coef: true },
  ];

  /* The activity contract: mount(el, api), returning an optional cleanup. */
  function mount(host, api) {
    var wrap = el('div', 'pot');

    var nav = el('div', 'part-nav');
    nav.setAttribute('role', 'group');
    nav.setAttribute('aria-label', 'Parts');
    wrap.appendChild(nav);

    var parts = PARTS.map(function (p) {
      var made = makePart(p.coef, api.announce);
      var b = el('button', 'part-btn', p.label);
      b.type = 'button';
      nav.appendChild(b);
      wrap.appendChild(made.root);
      return { def: p, button: b, part: made };
    });

    function pick(i, say) {
      parts.forEach(function (p, j) {
        p.button.setAttribute('aria-pressed', String(i === j));
        p.part.root.hidden = i !== j;
      });
      parts[i].part.fit();
      if (say) api.announce(parts[i].def.about);
    }

    parts.forEach(function (p, i) {
      p.button.addEventListener('click', function () { pick(i, true); });
    });

    host.appendChild(wrap);
    pick(0, false);

    /* The stage is still hidden when mount() runs, so fit again whenever the width
       becomes real or changes (screen shown, window resized, part switched). */
    var lastWidth = 0;
    function refit() {
      parts.forEach(function (p) {
        if (!p.part.root.hidden) {
          var w = p.part.root.clientWidth;
          if (w !== lastWidth) { lastWidth = w; p.part.fit(); }
        }
      });
    }
    var observer = null;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(refit);
      observer.observe(wrap);
    }
    window.addEventListener('resize', refit);
    // Switching parts changes which panel is visible without changing the width.
    nav.addEventListener('click', function () { lastWidth = 0; refit(); });

    return function cleanup() {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', refit);
    };
  }

  SNE.PowersOfTen = {
    EXP_MIN: EXP_MIN, EXP_MAX: EXP_MAX, COEF_MIN: COEF_MIN, COEF_MAX: COEF_MAX,
    standardForm: standardForm, spoken: spoken, signed: signed, mount: mount,
  };
})(typeof window !== 'undefined' ? (window.SNE = window.SNE || {}) : (globalThis.SNE = globalThis.SNE || {}));
