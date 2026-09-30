/*
 * activity.js — a mode's levels on screen: the problem, the "Crush it!" form,
 * feedback, the in-mode history panel, and statistics (Mode 1 design §3, §5, §6).
 *
 * Product of Powers (src/product.js), Quotient of Powers (src/quotient.js),
 * Power of a Power (src/power.js), Power of a Quotient (src/powerquotient.js),
 * Zero Exponent (src/zero.js), Negative Exponent (src/negative.js) and Mixed
 * Practice (src/mixed.js) have levels. A level's `input` says what it takes: 'count' (one whole
 * number), 'counts' (two, top and bottom: Mode 4 Level 1), 'math' (the
 * Phase 0 math answer box and keypad), 'parts' (an answer box per part of
 * the problem, each under its own prompt: Mode 5 Level 4) or 'choices' (two
 * dropdowns in a sentence: Mode 6 Level 1). The flow for one problem:
 *   right → crush runs, reward sound, input and Crush it! lock, history entry,
 *           the student chooses Next (no auto-advance, so they can study it)
 *   wrong → no crush, red flash and shake, buzz; they may edit and resubmit,
 *           or choose Next to skip. Not added to history; counted in stats.
 * 'parts' boxes are all sent by one Crush it! and count as one attempt (Dr.
 * Cole, 2026-09-29). Each box is marked ✓ or ✗, so a wrong answer says which
 * box to fix. Enter in a box before the last moves to the next one.
 * Mixed Practice adds a third result to 'math' (Mode 7 design §6): yellow, an answer
 * that is equal to the problem but not fully simplified. It counts as correct (once
 * per problem), the box stays open, and a note says what to improve; no crush yet.
 * Any later try on that problem is an attempt only, and never breaks the streak.
 * 'choices' are also sent by one Crush it! and count as one attempt, but a wrong
 * answer marks nothing per dropdown: the whole statement flashes red and shakes
 * (Mode 6 design §4), so it is never a hint.
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
    emptyParts: 'Type an answer in each box, then Crush it!',   // Mode 5 Level 4 [my wording]
    emptyChoices: 'Choose both answers, then Crush it!',   // Mode 6 design §4
    almost: 'Correct, but not fully simplified.',   // Mode 7 design §6 (wording is a placeholder)
  };

  /* Each mode with levels: its module (problems, grading, history entries). */
  var LIBS = { product: 'Product', quotient: 'Quotient', 'power-of-power': 'Power', 'power-of-quotient': 'PowerQuotient',
    zero: 'Zero', negative: 'Negative', mixed: 'Mixed' };
  function lib(modeId) { return LIBS[modeId] ? PC[LIBS[modeId]] : null; }

  /* The levels built for a mode so far, or null while it is still being designed. */
  function levelsFor(modeId) {
    var m = lib(modeId);
    return m ? m.LEVELS : null;
  }

  /* "Level 2 · Two Powers", or "Level 2" for a level with no title (Mixed Practice). */
  function levelLabel(l) { return 'Level ' + l.n + (l.title ? ' · ' + l.title : ''); }

  function Activity(opts) {
    this.store = opts.store;
    this.settings = opts.settings;       // () → current settings
    this.reduce = opts.reduce;           // () → reduced motion on?
    this.levels = null;
    this.modeId = null;
    this.level = null;
    this.problem = null;
    this.locked = false;
    this.credited = false;               // this problem already counted as correct (a yellow)
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
    // Mode 6 Level 1: two dropdowns. Changing either clears the red (design §4).
    // Enter submits from anywhere in the statement, except while a dropdown's
    // list is open: there it picks the option, as browsers do. Not the "next
    // dropdown" of Mode 5 Level 4's boxes.
    ['pickSide', 'pickSign'].forEach(function (id) {
      var sel = $(id);
      sel.addEventListener('change', function () {
        if (!self.locked) { $('choices').classList.remove('is-wrong'); self.say('', ''); }
      });
      sel.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        var open = false;
        try { open = sel.matches(':open'); } catch (err) { /* no :open here: treat it as closed */ }
        if (open) return;
        e.preventDefault();
        self.submit();
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
    // Mode 5 Level 4: a box per part. Enter moves on to the next box; the last
    // one submits. The keypad types into whichever box was focused last.
    this.parts = [1, 2].map(function (n, i) {
      var box = new PC.MathInput.Widget($('part' + n + 'Box'), {
        echo: $('playEcho'),
        onSubmit: function () {
          var next = self.problem && self.problem.parts && self.parts[i + 1];
          if (next && i + 1 < self.problem.parts.length) next.el.focus(); else self.submit();
        },
        onChange: function () {
          if (self.locked) return;
          self.mark(i, null);
          PC.Crush.reset($('stage'));
          self.say('', '');
        },
      });
      box.el.addEventListener('focus', function () { self.active = box; });
      return box;
    });
    this.active = this.box;
    PC.MathInput.bindKeypad($('playKeypad'), { run: function (cmd, arg) { return self.active.run(cmd, arg); } });
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
      b.textContent = levelLabel(l);
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
    this.credited = false;
    var kind = this.level.input, math = kind === 'math', parts = kind === 'parts';
    this.fields().forEach(function (f) { f.value = ''; f.readOnly = false; f.disabled = false; });
    $('countInput').hidden = kind !== 'count';
    $('counts').hidden = kind !== 'counts';
    $('choices').hidden = kind !== 'choices';
    $('choices').classList.remove('is-wrong');
    $('playAnswer').hidden = !math;
    $('parts').hidden = !parts;
    $('playKeys').hidden = !math && !parts;
    this.box.clear();
    this.showParts();
    this.lockBox(false);
    var input = math ? $('playAnswer') : parts ? this.parts[0].el : this.fields()[0];
    this.active = parts ? this.parts[0] : this.box;
    $('crushBtn').disabled = false;
    $('nextProblemBtn').classList.remove('primary');
    if (kind === 'counts') this.countBases();
    if (kind === 'choices') $('choiceBase').replaceChildren(PC.Render.draw(PC.Product.baseNode(this.problem.base)));
    // With a prompt over each box, the heading would say them twice, so it is
    // only for screen readers (Dr. Cole, 2026-09-29).
    this.showQuestion();
    $('question').classList.toggle('sr-only', parts);
    PC.Crush.show($('stage'), this.problem.shown);
    this.say('', '');
    $('announce').textContent = '';
    if (focus) input.focus();
  };

  /* The question above the stage. Most are plain words. A problem with
     `questionParts` (Mode 6 Level 3) mixes words with expressions, which are drawn
     with real superscripts like everything else; the heading then carries the whole
     question in words as its label, and the drawing is hidden from screen readers. */
  Activity.prototype.showQuestion = function () {
    var el = $('question'), p = this.problem;
    el.removeAttribute('aria-label');
    if (!p.questionParts) { el.textContent = p.question; return; }
    el.replaceChildren();
    p.questionParts.forEach(function (part) {
      if (typeof part === 'string') { el.appendChild(document.createTextNode(part)); return; }
      var math = PC.Render.draw(part);
      math.classList.add('q-math');
      math.setAttribute('aria-hidden', 'true');
      el.appendChild(math);
    });
    el.setAttribute('aria-label', p.question);
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

  /* Mode 5 Level 4: one box per part of the problem, each under its prompt,
     cleared and unmarked. A box with no part (5x⁰ has one) is hidden. */
  Activity.prototype.showParts = function () {
    var ps = this.level.input === 'parts' ? this.problem.parts : [];
    var self = this;
    this.parts.forEach(function (box, i) {
      var n = i + 1;
      $('part' + n).hidden = !ps[i];
      $('part' + n + 'Lbl').textContent = ps[i] ? ps[i].label : '';
      box.clear();
      self.mark(i, null);
    });
  };

  /* A box's ✓ or ✗ (null clears it). The symbol is shown; the word is for
     screen readers, which hear it with the box (aria-describedby). */
  Activity.prototype.mark = function (i, status) {
    var el = $('part' + (i + 1) + 'Mark');
    el.className = 'part-mark' + (status === 'correct' ? ' good' : status === 'wrong' ? ' bad' : '');
    el.replaceChildren();
    if (!status) return;
    var sym = document.createElement('span');
    sym.setAttribute('aria-hidden', 'true');
    sym.textContent = status === 'correct' ? '✓' : '✗';
    var word = document.createElement('span');
    word.className = 'sr-only';
    word.textContent = status === 'correct' ? MESSAGES.correct : MESSAGES.wrong;
    el.appendChild(sym);
    el.appendChild(word);
  };

  /* The fields of this level: one whole-number field, two for 'counts', or the
     two dropdowns of 'choices'. */
  Activity.prototype.fields = function () {
    var kind = this.level && this.level.input;
    return kind === 'counts' ? [$('topCount'), $('bottomCount')]
      : kind === 'choices' ? [$('pickSide'), $('pickSign')] : [$('countInput')];
  };

  /* A right answer locks the fields: a dropdown can't be read-only, so it is disabled. */
  Activity.prototype.lockFields = function (fields) {
    fields.forEach(function (f) { if (f.tagName === 'SELECT') f.disabled = true; else f.readOnly = true; });
  };

  Activity.prototype.submit = function () {
    if (!this.problem || this.locked) return;
    var kind = this.level.input, math = kind === 'math', parts = kind === 'parts', fields = this.fields();
    var choices = kind === 'choices';
    var input = math ? $('playAnswer') : parts ? this.parts[0].el : fields[0];
    var L = lib(this.modeId);
    var p = this.problem, self = this;
    var r = math ? L.gradeMath(p, this.box.model.root)
      : parts ? L.gradeParts(p, p.parts.map(function (pt, i) { return self.parts[i].model.root; }))
      : choices ? L.gradeChoices(p, fields.map(function (f) { return f.value; }))
      : kind === 'counts' ? L.grade(p, fields.map(function (f) { return f.value; }))
      : L.grade(p, input.value);
    if (r.status === 'empty' || r.status === 'invalid') {
      // Not a submission: nothing is graded or counted. An answer the box can't
      // read (an empty exponent box) gets the checker's placeholder hint.
      this.say(r.status === 'invalid' ? r.message : math ? MESSAGES.emptyMath
        : parts ? (p.parts.length > 1 ? MESSAGES.emptyParts : MESSAGES.emptyMath)
        : kind === 'counts' ? MESSAGES.emptyCounts : choices ? MESSAGES.emptyChoices : MESSAGES.empty, '');
      // Two fields or boxes: the first empty (or unreadable) one.
      if (kind === 'counts') input = fields.filter(function (f) { return PC.Product.clean(f.value) === ''; })[0] || input;
      if (choices) input = fields.filter(function (f) { return f.value === ''; })[0] || input;
      if (parts) input = this.parts[r.at].el;
      input.focus();
      return;
    }
    var set = this.settings(), stage = $('stage');
    // Mixed Practice: 'yellow' is equal but not fully simplified. It counts as correct
    // once per problem; a later try is an attempt only (Mode 7 design §6).
    var yellow = r.status === 'yellow';
    var right = r.status === 'correct' || yellow;
    var again = this.credited;
    if (again) this.store.recordAttempt(this.modeId, this.level.n);
    else this.store.record(this.modeId, this.level.n, right);
    if (parts) r.parts.forEach(function (st, i) { self.mark(i, st); });

    if (yellow) {
      if (!again) this.addHistory(L, p);
      this.credited = true;
      var note = r.hints.join(' ');
      if (set.sound) PC.Sound.play('almost');
      this.say('✓ ' + MESSAGES.almost + ' ' + note, 'warn');
      this.announce(MESSAGES.almost + ' ' + note);
      input.focus();
      return;
    }

    if (right) {
      this.locked = true;
      if (math || parts) this.lockBox(true); else this.lockFields(fields);
      $('crushBtn').disabled = true;
      var next = $('nextProblemBtn');
      next.classList.add('primary');
      next.focus();
      if (!again) this.addHistory(L, p);
      if (set.sound) PC.Sound.play('reward');
      var seq = this.seq;
      // Mode 1 Level 4 groups then crushes; Modes 2 and 3 carry their own plan.
      var plan = p.plan || (p.groups ? { order: p.order, groups: p.groups } : null);
      PC.Crush.crush(stage, p.answer, { reduce: this.reduce(), plan: plan }).then(function () {
        if (seq !== self.seq) return;
        self.say('✓ ' + MESSAGES.correct, 'good');
      });
      // Two parts are read as the history line: "3 to the power 0, equals 1".
      var said = parts && p.parts.length > 1 ? PC.Render.speak(p.mid) + ', equals ' : '';
      this.announce(MESSAGES.correct + ' ' + said + PC.Render.speak(p.answer) + '.');
    } else {
      if (choices) this.flashStatement(); else PC.Crush.mismatch(stage);
      if (set.sound) PC.Sound.play('buzz');
      this.say('✗ ' + MESSAGES.wrong, 'bad');
      if (parts && p.parts.length > 1) {
        // Which box is wrong, in words: "Incorrect. Apply the exponent property: correct. …"
        this.announce(MESSAGES.wrong + ' ' + p.parts.map(function (pt, i) {
          return pt.label.replace(/\.$/, '') + ': ' + (r.parts[i] === 'correct' ? 'correct.' : 'incorrect.');
        }).join(' '));
        this.parts[r.parts.indexOf('wrong')].el.focus();
      } else {
        this.announce(MESSAGES.wrong);
        // A wrong statement sends focus back to the first dropdown (design §4).
        if (choices) fields[0].focus(); else if (math || parts) input.focus(); else input.select();
      }
    }
  };

  /* The problem goes in the history panel the first time it counts as correct. */
  Activity.prototype.addHistory = function (L, p) {
    this.store.addHistory(this.modeId, this.level.n, L.entry(p));
    this.renderHistory();
  };

  /* Mode 6 Level 1: the whole statement flashes red and shakes, restarted on
     every wrong answer. Reduced motion keeps the red, without the shake, until
     a dropdown changes (styles.css). */
  Activity.prototype.flashStatement = function () {
    var el = $('choices');
    el.classList.remove('is-wrong');
    void el.offsetWidth;
    el.classList.add('is-wrong');
  };

  Activity.prototype.lockBox = function (on) {
    this.box.setLocked(on);
    this.parts.forEach(function (b) { b.setLocked(on); });
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
      s.textContent = levelLabel(l);
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
      // Mode 5 Level 4 keeps its middle step: 3⁴/3⁴ = 3⁰ = 1.
      if (e.via) {
        var mid = document.createElement('span');
        mid.className = 'hist-tail';
        mid.appendChild(R.draw(e.via));
        var eq2 = document.createElement('span');
        eq2.className = 'hist-eq';
        eq2.textContent = '=';
        mid.appendChild(eq2);
        vis.appendChild(mid);
      }
      vis.appendChild(R.draw(e.to));
      var sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = R.speak(e.from) + (e.via ? ', equals ' + R.speak(e.via) : '') + ', equals ' + R.speak(e.to);
      li.appendChild(vis);
      li.appendChild(sr);
      return li;
    } catch (err) {
      return null;
    }
  }

  PC.Activity = { Activity: Activity, MESSAGES: MESSAGES, levelsFor: levelsFor, levelLabel: levelLabel };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
