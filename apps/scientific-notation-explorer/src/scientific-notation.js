/*
 * scientific-notation.js — Level 2's exploration: find the exponent that makes
 * scientific notation equal a number in standard form.
 *
 * Built from Doc's spec, given in Claude Code on 2026-10-13 and recorded in
 * design/levels/level-2-standard-to-scientific.md.
 *
 * Part 1 (the only part so far). The app picks c · 10^k, with c an integer from -9 to 9
 * but never 0, and k an integer from -12 to 12. Three windows, top to bottom:
 *   current   the standard form of c · 10^n at the student's current n. Read-only.
 *   problem   the standard form of c · 10^k, a live ≠ / = sign, then c · 10^n with up
 *             and down buttons on the exponent. n starts at 0 for every problem.
 *   feedback  the instruction, always shown, and under it "Warmer!", "Colder!" or
 *             "You found it!" after each click.
 * Submit and New problem sit under the feedback window. Submit rings a bell and flashes
 * the problem window green when the sign is =, and buzzes and flashes it red when it is ≠.
 * One press makes one sound: a held key never repeats it, and presses while a sound is
 * still playing make no sound (they still flash and announce). Sound follows the
 * Settings toggle (api.soundOn). New problem moves on at any time.
 *
 * An exploration records nothing (api.record is not called).
 * Pure functions are exported on SNE.SciNotation for the tests; mount() and the sounds
 * are the only parts that touch the browser.
 */
(function (SNE) {
  'use strict';

  var P = SNE.PowersOfTen;
  var EXP_MIN = -12, EXP_MAX = 12;
  var COEF_MIN = -9, COEF_MAX = 9;
  var DOT = '·';
  var INSTRUCTION = 'Click the arrows to set the value of the exponent.';
  var WARMER = 'Warmer!', COLDER = 'Colder!', FOUND = 'You found it!';
  var FLASH_MS = 1000;
  var SOUND_MS = { bell: 1100, buzz: 300 };   // how long each sound lasts, and its cooldown

  /* Every problem Part 1 can pose: 18 coefficients × 25 exponents. */
  function allProblems() {
    var list = [];
    for (var c = COEF_MIN; c <= COEF_MAX; c++) {
      if (c === 0) continue;
      for (var k = EXP_MIN; k <= EXP_MAX; k++) list.push({ c: c, k: k });
    }
    return list;
  }

  /* A shuffled deck: no problem repeats until all have been dealt, and a new deck never
     starts with the problem that ended the last one. `rand` is injectable for tests. */
  function makeDeck(rand) {
    rand = rand || Math.random;
    var deck = [], last = null;
    function refill() {
      deck = allProblems();
      for (var i = deck.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1));
        var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
      }
      var end = deck.length - 1;
      if (last && deck[end].c === last.c && deck[end].k === last.k) {
        var s = deck[0]; deck[0] = deck[end]; deck[end] = s;
      }
    }
    return function next() {
      if (!deck.length) refill();
      last = deck.pop();
      return last;
    };
  }

  /* What the feedback line says after n moves from `from` to `to`, with answer k. */
  function feedback(k, from, to) {
    if (to === k) return FOUND;
    return Math.abs(to - k) < Math.abs(from - k) ? WARMER : COLDER;
  }

  /* The sound cooldown: allow(kind) says whether a sound may start now, and if so holds
     off every sound until this one has finished. `now` is injectable for tests. */
  function makeCooldown(now) {
    now = now || Date.now;
    var until = 0;
    return function allow(kind) {
      var t = now();
      if (t < until) return false;
      until = t + SOUND_MS[kind];
      return true;
    };
  }

  function said(text) { return text.replace(/−/g, 'negative '); }

  /* What a screen reader hears after an arrow click. */
  function spoken(c, n, k, message) {
    return P.spoken(c, n, true) + '. ' + (n === k ? 'Equal' : 'Not equal') + '. ' + message;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* ---- sounds: made with Web Audio, so there are no files to ship ---------------- */
  var audio = null, playing = [];

  function context() {
    if (audio) return audio;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try { audio = new Ctx(); } catch (e) { audio = null; }
    return audio;
  }

  function stopAll() {
    playing.forEach(function (o) { try { o.stop(); } catch (e) { /* already stopped */ } });
    playing = [];
  }

  function tone(ctx, type, freq, start, length, peak) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + length);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(start);
    o.stop(start + length + 0.02);
    playing.push(o);
  }

  function play(kind) {
    var ctx = context();
    if (!ctx) return;
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    stopAll();
    var t = ctx.currentTime + 0.01;
    if (kind === 'bell') {
      // A soft bell: a fundamental and two partials, fading out over about a second.
      tone(ctx, 'sine', 880, t, 1.1, 0.22);
      tone(ctx, 'sine', 1760, t, 0.7, 0.08);
      tone(ctx, 'sine', 2640, t, 0.4, 0.04);
    } else {
      // A short, low buzz.
      tone(ctx, 'square', 140, t, 0.28, 0.07);
      tone(ctx, 'square', 147, t, 0.28, 0.05);
    }
  }

  /* ---- Part 1 ------------------------------------------------------------------- */
  function makePart(announce, soundOn, next) {
    var prob = next();
    var n = 0;
    var flashTimer = null;
    var allow = makeCooldown();

    var root = el('div', 'pot-part');

    var top = el('section', 'pot-window');
    top.setAttribute('aria-label', 'Standard form of your scientific notation');
    var currentEl = el('div', 'pot-standard');
    top.appendChild(currentEl);

    var mid = el('section', 'pot-window sn-problem');
    mid.setAttribute('aria-label', 'Problem');
    var row = el('div', 'sn-row');
    var left = el('div', 'sn-left');
    var targetEl = el('span', 'pot-standard sn-target');
    var signEl = el('span', 'sn-sign');
    left.appendChild(targetEl);
    left.appendChild(signEl);
    var right = el('div', 'sn-right');
    var expEl = el('div', 'pot-exp sn-exp');
    var box = el('div', 'pot-stepper');
    var up = el('button', 'pot-step', '▲');
    var down = el('button', 'pot-step', '▼');
    up.type = down.type = 'button';
    up.setAttribute('aria-label', 'Increase the exponent');
    down.setAttribute('aria-label', 'Decrease the exponent');
    box.appendChild(up);
    box.appendChild(down);
    right.appendChild(expEl);
    right.appendChild(box);
    row.appendChild(left);
    row.appendChild(right);
    mid.appendChild(row);

    var actions = el('div', 'sn-actions');
    var submit = el('button', 'btn sn-submit', 'Submit');
    var fresh = el('button', 'btn', 'New problem');
    submit.type = fresh.type = 'button';
    actions.appendChild(submit);
    actions.appendChild(fresh);

    var bottom = el('section', 'pot-window sn-feedback');
    bottom.setAttribute('aria-label', 'Feedback');
    bottom.appendChild(el('p', 'sn-instruction', INSTRUCTION));
    var messageEl = el('p', 'sn-message');
    bottom.appendChild(messageEl);

    root.appendChild(top);
    root.appendChild(mid);
    root.appendChild(bottom);
    root.appendChild(actions);

    function render() {
      currentEl.textContent = P.standardForm(prob.c, n);
      targetEl.textContent = P.standardForm(prob.c, prob.k);
      var equal = n === prob.k;
      signEl.textContent = equal ? '=' : '≠';
      signEl.setAttribute('aria-label', equal ? 'equals' : 'does not equal');
      expEl.textContent = '';
      expEl.appendChild(el('span', 'pot-coef', P.signed(prob.c)));
      expEl.appendChild(el('span', 'pot-dot', DOT));
      expEl.appendChild(document.createTextNode('10'));
      expEl.appendChild(el('sup', 'pot-sup', P.signed(n)));
      up.disabled = n >= EXP_MAX;
      down.disabled = n <= EXP_MIN;
    }

    function step(by) {
      var to = n + by;
      if (to < EXP_MIN || to > EXP_MAX) return;
      var message = feedback(prob.k, n, to);
      n = to;
      messageEl.textContent = message;
      render();
      announce(spoken(prob.c, n, prob.k, message));
    }

    function unflash() {
      clearTimeout(flashTimer);
      flashTimer = null;
      mid.classList.remove('is-correct', 'is-wrong');
    }

    function flash(right) {
      unflash();
      void mid.offsetWidth; // restart the animation on a second press
      mid.classList.add(right ? 'is-correct' : 'is-wrong');
      flashTimer = setTimeout(unflash, FLASH_MS);
    }

    up.addEventListener('click', function () { step(1); });
    down.addEventListener('click', function () { step(-1); });

    // A held Enter key fires click again and again. Ignore the repeats, so one press is
    // one sound. (Space clicks on release, and a held mouse button or finger never repeats.)
    submit.addEventListener('keydown', function (e) { if (e.repeat) e.preventDefault(); });
    submit.addEventListener('click', function () {
      if (n === prob.k) {
        if (soundOn() && allow('bell')) play('bell');
        flash(true);
        announce('Correct!');
      } else {
        if (soundOn() && allow('buzz')) play('buzz');
        flash(false);
        announce('Not equal yet. Try again.');
      }
    });

    fresh.addEventListener('click', function () {
      prob = next();
      n = 0;
      messageEl.textContent = '';
      unflash();
      render();
      announce('New problem: ' + said(P.standardForm(prob.c, prob.k)) + '. The exponent is back to 0.');
    });

    render();
    return { root: root, cleanup: unflash };
  }

  var PARTS = [
    { key: 'part-1', label: 'Part 1' },
  ];

  /* The activity contract: mount(el, api), returning an optional cleanup. */
  function mount(host, api) {
    var wrap = el('div', 'pot');

    var nav = el('div', 'part-nav');
    nav.setAttribute('role', 'group');
    nav.setAttribute('aria-label', 'Parts');
    wrap.appendChild(nav);

    var next = makeDeck();
    var parts = PARTS.map(function (p) {
      var soundOn = typeof api.soundOn === 'function' ? api.soundOn : function () { return true; };
      var made = makePart(api.announce, soundOn, next);
      var b = el('button', 'part-btn', p.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'true');
      nav.appendChild(b);
      wrap.appendChild(made.root);
      return made;
    });

    host.appendChild(wrap);

    return function cleanup() {
      parts.forEach(function (p) { p.cleanup(); });
      stopAll();
    };
  }

  SNE.SciNotation = {
    EXP_MIN: EXP_MIN, EXP_MAX: EXP_MAX, COEF_MIN: COEF_MIN, COEF_MAX: COEF_MAX,
    INSTRUCTION: INSTRUCTION, WARMER: WARMER, COLDER: COLDER, FOUND: FOUND,
    SOUND_MS: SOUND_MS,
    allProblems: allProblems, makeDeck: makeDeck, makeCooldown: makeCooldown, feedback: feedback, spoken: spoken,
    mount: mount,
  };
})(typeof window !== 'undefined' ? (window.SNE = window.SNE || {}) : (globalThis.SNE = globalThis.SNE || {}));
