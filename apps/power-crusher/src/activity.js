/*
 * activity.js — a mode's levels on screen: the problem, the "Crush it!" form,
 * feedback, the in-mode history panel, and statistics (Mode 1 design §3, §5, §6).
 *
 * Product of Powers (src/product.js), Quotient of Powers (src/quotient.js),
 * Power of a Power (src/power.js) and Power of a Quotient (src/powerquotient.js)
 * have levels so far. A level's `input` says what it takes: 'count' (one whole
 * number), 'counts' (two, top and bottom: Mode 4 Level 1) or 'math' (the
 * Phase 0 math answer box and keypad). The flow for one problem:
 *   right → crush runs, reward sound, input and Crush it! lock, history entry,
 *           the student chooses Next (no auto-advance, so they can study it)
 *   wrong → no crush, red flash and shake, buzz; they may edit and resubmit,
 *           or choose Next to skip. Not added to history; counted in stats.
 */
(function (PC) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* Placeholders built from the design's own words ("Correct. 3 to the power
     4."). Dr. Cole writes the real wording. */
  var MESSAGES = {
    correct: 'Correct.',
    wrong: 'Incorrect.',
    empty: 'Type a whole number, then Crush it!',
    emptyCounts: 'Type a number in each box, then Crush it!',   // Mode 4 design §4
    emptyMath: 'Type your answer, then Crush it!',   // Levels 3+ (spec §3)
  };

  /* Each mode with levels: its module (problems, grading, history entries). */
  var LIBS = { product: 'Product', quotient: 'Quotient', 'power-of-power': 'Power', 'power-of-quotient': 'PowerQuotient' };
  function lib(modeId) { return LIBS[modeId] ? PC[LIBS[modeId]] : null; }

  /* The levels built for a mode so far, or null while it is still being designed. */
  function levelsFor(modeId) {
    var m = lib(modeId);
    return m ? m.LEVELS : null;
  }

  function Activity(opts) {
    this.store = opts.store;
    this.settings = opts.settings;       // () → current settings
    this.reduce = opts.reduce;           // () → reduced motion on?
    this.levels = null;
    this.modeId = null;
    this.level = null;
    this.problem = null;
    this.locked = false;
    this.seq = 0;                        // stops a slow crush finishing on a newer problem
    this.rng = PC.Generate.rng((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
    this.openGroups = {};                // history groups the student collapsed stay collapsed
    this.bind();
  }

  Activity.prototype.bind = function () {
    var self = this;
    $('crushForm').addEventListener('submit', function (e) { e.preventDefault(); self.submit(); });
    $('nextProblemBtn').addEventListener('click', function () { self.next(true); });
    ['countInput', 'topCount', 'bottomCount'].forEach(function (id) {
      var input = $(id);
      input.addEventListener('input', function () {
        var c = PC.Product.clean(input.value);
        if (c !== input.value) input.value = c;
        if (!self.locked) { PC.Crush.reset($('stage')); self.say('', ''); }
      });
    });
    // Levels 3+: the Phase 0 math answer box and keypad. Editing clears the red
    // highlight of a wrong answer, as typing in the count field does.
    PC.MathInput.buildKeypad($('playKeypad'));
    this.box = new PC.MathInput.Widget($('playAnswer'), {
      echo: $('playEcho'),
      onSubmit: function () { self.submit(); },
      onChange: function () { if (!self.locked) { PC.Crush.reset($('stage')); self.say('', ''); } },
    });
    PC.MathInput.bindKeypad($('playKeypad'), this.box);
    $('levelNav').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-level]');
      if (b) self.pick(+b.dataset.level, true);
    });
  };

  /* Show a mode's activity. Returns false if the mode has no levels yet. */
  Activity.prototype.open = function (mode) {
    var levels = levelsFor(mode.id);
    this.levels = levels;
    this.modeId = mode.id;
    if (!levels) return false;
    var nav = $('levelNav');
    nav.replaceChildren();
    levels.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'level-btn';
      b.dataset.level = l.n;
      b.textContent = 'Level ' + l.n + ' · ' + l.title;
      nav.appendChild(b);
    });
    this.pick(levels[0].n, false);
    return true;
  };

  Activity.prototype.pick = function (n, focus) {
    this.level = this.levels.filter(function (l) { return l.n === n; })[0];
    Array.prototype.forEach.call($('levelNav').children, function (b) {
      b.setAttribute('aria-pressed', String(+b.dataset.level === n));
    });
    this.problem = null;
    this.next(focus);
    this.renderHistory();
  };

  Activity.prototype.next = function (focus) {
    this.seq++;
    this.problem = this.level.make(this.rng, this.problem);
    this.locked = false;
    var kind = this.level.input, math = kind === 'math';
    this.fields().forEach(function (f) { f.value = ''; f.readOnly = false; });
    $('countInput').hidden = kind !== 'count';
    $('counts').hidden = kind !== 'counts';
    $('playAnswer').hidden = !math;
    $('playKeys').hidden = !math;
    this.box.clear();
    this.lockBox(false);
    var input = math ? $('playAnswer') : this.fields()[0];
    $('crushBtn').disabled = false;
    $('nextProblemBtn').classList.remove('primary');
    if (kind === 'counts') this.countBases();
    $('question').textContent = this.problem.question;
    PC.Crush.show($('stage'), this.problem.shown);
    this.say('', '');
    $('announce').textContent = '';
    if (focus) input.focus();
  };

  /* Mode 4 Level 1: the problem's bases label the two exponent boxes, drawn as
     the answer's fraction (y over 3). Each box's name says the same in words. */
  Activity.prototype.countBases = function () {
    var bases = this.problem.bases;
    [['topBase', 'topCount', 'numerator'], ['bottomBase', 'bottomCount', 'denominator']].forEach(function (d, i) {
      $(d[0]).replaceChildren(PC.Render.draw(PC.Product.baseNode(bases[i])));
      $(d[1]).setAttribute('aria-label', 'Exponent of ' + bases[i] + ', in the ' + d[2]);
    });
  };

  /* The whole-number fields of this level: one, or two for 'counts'. */
  Activity.prototype.fields = function () {
    return this.level && this.level.input === 'counts' ? [$('topCount'), $('bottomCount')] : [$('countInput')];
  };

  Activity.prototype.submit = function () {
    if (!this.problem || this.locked) return;
    var kind = this.level.input, math = kind === 'math', fields = this.fields();
    var input = math ? $('playAnswer') : fields[0];
    var L = lib(this.modeId);
    var r = math ? L.gradeMath(this.problem, this.box.model.root)
      : kind === 'counts' ? L.grade(this.problem, fields.map(function (f) { return f.value; }))
      : L.grade(this.problem, input.value);
    if (r.status === 'empty' || r.status === 'invalid') {
      // Not a submission: nothing is graded or counted. An answer the box can't
      // read (an empty exponent box) gets the checker's placeholder hint.
      this.say(r.status === 'invalid' ? r.message : math ? MESSAGES.emptyMath
        : kind === 'counts' ? MESSAGES.emptyCounts : MESSAGES.empty, '');
      // Two fields: the first empty one.
      if (kind === 'counts') input = fields.filter(function (f) { return PC.Product.clean(f.value) === ''; })[0] || input;
      input.focus();
      return;
    }
    var set = this.settings(), p = this.problem, stage = $('stage');
    var right = r.status === 'correct';
    this.store.record(this.modeId, this.level.n, right);

    if (right) {
      this.locked = true;
      if (math) this.lockBox(true); else fields.forEach(function (f) { f.readOnly = true; });
      $('crushBtn').disabled = true;
      var next = $('nextProblemBtn');
      next.classList.add('primary');
      next.focus();
      this.store.addHistory(this.modeId, this.level.n, L.entry(p));
      this.renderHistory();
      if (set.sound) PC.Sound.play('reward');
      var seq = this.seq, self = this;
      // Mode 1 Level 4 groups then crushes; Modes 2 and 3 carry their own plan.
      var plan = p.plan || (p.groups ? { order: p.order, groups: p.groups } : null);
      PC.Crush.crush(stage, p.answer, { reduce: this.reduce(), plan: plan }).then(function () {
        if (seq !== self.seq) return;
        self.say('✓ ' + MESSAGES.correct, 'good');
      });
      this.announce(MESSAGES.correct + ' ' + PC.Render.speak(p.answer) + '.');
    } else {
      PC.Crush.mismatch(stage);
      if (set.sound) PC.Sound.play('buzz');
      this.say('✗ ' + MESSAGES.wrong, 'bad');
      this.announce(MESSAGES.wrong);
      if (math) input.focus(); else input.select();
    }
  };

  Activity.prototype.lockBox = function (on) {
    this.box.setLocked(on);
    Array.prototype.forEach.call($('playKeypad').querySelectorAll('button'), function (b) { b.disabled = on; });
  };

  /* Visible result line. The icon is text, so colour never carries it alone. */
  Activity.prototype.say = function (text, kind) {
    var el = $('result');
    el.textContent = text;
    el.className = 'result' + (kind ? ' ' + kind : '');
  };

  /* Screen-reader announcement, only when that setting is on. Cleared first so
     the same words twice in a row are read twice. */
  Activity.prototype.announce = function (text) {
    var el = $('announce');
    el.textContent = '';
    if (!this.settings().announce) return;
    setTimeout(function () { el.textContent = text; }, 60);
  };

  Activity.prototype.renderHistory = function () {
    var self = this;
    var all = this.store.load('progress').history[this.modeId] || {};
    var host = $('historyList');
    host.replaceChildren();
    this.levels.forEach(function (l) {
      var key = self.modeId + ':' + l.n;
      var d = document.createElement('details');
      d.className = 'hist-group';
      d.open = self.openGroups[key] !== false;
      d.addEventListener('toggle', function () { self.openGroups[key] = d.open; });
      var s = document.createElement('summary');
      s.textContent = 'Level ' + l.n + ' · ' + l.title;
      d.appendChild(s);
      var items = (all[l.n] || []).map(historyItem).filter(Boolean);
      if (items.length) {
        var ol = document.createElement('ol');
        ol.className = 'hist-list';
        items.forEach(function (li) { ol.appendChild(li); });
        d.appendChild(ol);
      } else {
        var p = document.createElement('p');
        p.className = 'hist-empty';
        p.textContent = 'No correct answers yet.';
        d.appendChild(p);
      }
      host.appendChild(d);
    });
  };

  /* One entry, 3 · 3 · 3 · 3 = 3⁴, or 3x²y³z · 4x⁵z⁶ = 12x⁷y³z⁷, or a fraction
     (drawn vertically) = its answer. Drawn for the eye,
     one sentence for the ear. A malformed saved entry is skipped rather than
     breaking the panel. */
  function historyItem(e) {
    try {
      var R = PC.Render;
      var li = document.createElement('li');
      var vis = document.createElement('span');
      vis.className = 'hist-row';
      vis.setAttribute('aria-hidden', 'true');
      // "=" is glued to the problem's last factor, so a row that doesn't fit
      // breaks after it (Level 3 spec §6). Only a problem too wide for the
      // panel wraps inside, and then "=" still ends its last line.
      var lhs = R.draw(e.from);
      var eq = document.createElement('span');
      eq.className = 'hist-eq';
      eq.textContent = '=';
      var tail = document.createElement('span');
      tail.className = 'hist-tail';
      if (lhs.classList.contains('m-mul') && lhs.lastElementChild) {
        lhs.insertBefore(tail, lhs.lastElementChild);
        tail.appendChild(lhs.lastElementChild);
      } else {
        tail.appendChild(lhs);
        lhs = tail;
      }
      tail.appendChild(eq);
      lhs.classList.add('hist-lhs');
      vis.appendChild(lhs);
      vis.appendChild(R.draw(e.to));
      var sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = R.speak(e.from) + ', equals ' + R.speak(e.to);
      li.appendChild(vis);
      li.appendChild(sr);
      return li;
    } catch (err) {
      return null;
    }
  }

  PC.Activity = { Activity: Activity, MESSAGES: MESSAGES, levelsFor: levelsFor };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
