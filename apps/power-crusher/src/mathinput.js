/*
 * mathinput.js — the structured answer box: exponents as real superscripts,
 * fractions stacked vertically (handoff §6), typed or built from the keypad.
 *
 * Three layers, so the editing rules can be tested without a browser:
 *   InputModel   the model (see parse.js for its shape) and a cursor, edited by
 *                named commands: char, sup, frac, left, right, up, down, leave,
 *                back, clear, home, end.
 *   keyCommand   maps a keydown to one of those commands. The keypad buttons carry
 *                the same command names in data-cmd, so `^` and the exponent
 *                button (and `/` and the fraction button) run identical code.
 *   MathInput    the DOM widget: renders the model with a visible caret, handles
 *                keys and keypad, and keeps a spoken description current.
 *
 * Deliberate limits: no parentheses, no exponent inside an exponent, no fraction
 * inside a fraction, and only digits and − inside an exponent. Every answer form
 * the handoff grades — including the wrong ones like (1/8)x⁻³ — fits in that.
 */
(function (PC) {
  'use strict';

  var VARIABLES = PC.Expr.LIMITS.variables;
  var MAX_ITEMS = 40, MAX_EXP_ITEMS = 4;

  function row() { return { items: [] }; }

  /* ======================================================================== */
  function InputModel() { this.clear(); }

  InputModel.prototype.clear = function () {
    this.root = row();
    this.cur = { row: this.root, i: 0 };
    return ok();
  };
  InputModel.prototype.cmd_clear = InputModel.prototype.clear;

  function ok() { return { ok: true }; }
  function no(msg) { return { ok: false, msg: msg }; }

  /* Where a row sits: { row, idx, item, slot } or null for the top row. */
  InputModel.prototype.parentOf = function (target) {
    function walk(r) {
      for (var i = 0; i < r.items.length; i++) {
        var it = r.items[i], hit;
        if (it.k === 'sup') {
          if (it.row === target) return { row: r, idx: i, item: it, slot: 'sup' };
          if ((hit = walk(it.row))) return hit;
        } else if (it.k === 'frac') {
          if (it.num === target) return { row: r, idx: i, item: it, slot: 'num' };
          if (it.den === target) return { row: r, idx: i, item: it, slot: 'den' };
          if ((hit = walk(it.num)) || (hit = walk(it.den))) return hit;
        }
      }
      return null;
    }
    return target === this.root ? null : walk(this.root);
  };

  /* 'sup' | 'num' | 'den' | null */
  InputModel.prototype.box = function () {
    var p = this.parentOf(this.cur.row);
    return p ? p.slot : null;
  };

  InputModel.prototype.count = function () {
    var n = 0;
    (function walk(r) {
      r.items.forEach(function (it) {
        n++;
        if (it.k === 'sup') walk(it.row);
        if (it.k === 'frac') { walk(it.num); walk(it.den); }
      });
    })(this.root);
    return n;
  };

  InputModel.prototype.isEmpty = function () { return this.root.items.length === 0; };

  InputModel.prototype.exec = function (cmd, arg) {
    var fn = this['cmd_' + cmd];
    if (!fn) return no('Unknown command.');
    return fn.call(this, arg);
  };

  InputModel.prototype.cmd_char = function (c) {
    c = String(c).toLowerCase();
    if (c === '−') c = '-';
    var inSup = this.box() === 'sup';
    if (/^[a-z]$/.test(c) && VARIABLES.indexOf(c) < 0) {
      return no('Only the letters ' + VARIABLES.join(', ') + ' are used here.');
    }
    if (!/^[0-9a-z-]$/.test(c)) return no('That key isn’t used here.');
    // Exponents are whole numbers, so a letter typed in one must be meant for
    // after it: step out first, and x ^ 2 y reads as x²y without an arrow key.
    if (inSup && /^[a-z]$/.test(c)) { this.cmd_leave(); inSup = false; }
    if (inSup && this.cur.row.items.length >= MAX_EXP_ITEMS) return no('That exponent is long enough.');
    if (this.count() >= MAX_ITEMS) return no('The answer box is full.');
    this.cur.row.items.splice(this.cur.i, 0, { k: 'ch', c: c });
    this.cur.i++;
    return ok();
  };

  InputModel.prototype.cmd_sup = function () {
    var r = this.cur.row, i = this.cur.i;
    if (this.box() === 'sup') return no('You are already in an exponent.');
    // Cursor sitting between a base and its exponent: step into the existing one.
    if (r.items[i] && r.items[i].k === 'sup') { this.cur = { row: r.items[i].row, i: 0 }; return ok(); }
    var prev = r.items[i - 1];
    if (!prev || prev.k !== 'ch' || prev.c === '-') {
      return no('Type a number or letter first, then its exponent.');
    }
    if (this.count() >= MAX_ITEMS) return no('The answer box is full.');
    var s = { k: 'sup', row: row() };
    r.items.splice(i, 0, s);
    this.cur = { row: s.row, i: 0 };
    return ok();
  };

  /* Whatever is already typed before the cursor becomes the numerator, so typing
     x ^ 3 → / 8 gives x³ over 8. At the very start, the numerator starts empty. */
  InputModel.prototype.cmd_frac = function () {
    var b = this.box();
    if (b === 'sup') return no('A fraction can’t go inside an exponent.');
    if (b) return no('A fraction can’t go inside a fraction here.');
    if (this.count() >= MAX_ITEMS) return no('The answer box is full.');
    var r = this.cur.row, i = this.cur.i;
    var f = { k: 'frac', num: row(), den: row() };
    if (i === 0) {
      r.items.splice(0, 0, f);
      this.cur = { row: f.num, i: 0 };
    } else {
      f.num.items = r.items.splice(0, i);
      r.items.splice(0, 0, f);
      this.cur = { row: f.den, i: 0 };
    }
    return ok();
  };

  InputModel.prototype.cmd_right = function () {
    var r = this.cur.row, i = this.cur.i, it = r.items[i];
    if (it) {
      if (it.k === 'sup') this.cur = { row: it.row, i: 0 };
      else if (it.k === 'frac') this.cur = { row: it.num, i: 0 };
      else this.cur.i++;
      return ok();
    }
    return this.cmd_leave();
  };

  InputModel.prototype.cmd_left = function () {
    var r = this.cur.row, i = this.cur.i, it = r.items[i - 1];
    if (it) {
      if (it.k === 'sup') this.cur = { row: it.row, i: it.row.items.length };
      else if (it.k === 'frac') this.cur = { row: it.den, i: it.den.items.length };
      else this.cur.i--;
      return ok();
    }
    var p = this.parentOf(r);
    if (!p) return no('At the start.');
    if (p.slot === 'den') this.cur = { row: p.item.num, i: p.item.num.items.length };
    else this.cur = { row: p.row, i: p.idx };
    return ok();
  };

  /* Out of the current box: exponent → after it; numerator → denominator;
     denominator → after the fraction. The keypad ▶ and Tab both end up here. */
  InputModel.prototype.cmd_leave = function () {
    var p = this.parentOf(this.cur.row);
    if (!p) return no('At the end.');
    if (p.slot === 'num') this.cur = { row: p.item.den, i: 0 };
    else this.cur = { row: p.row, i: p.idx + 1 };
    return ok();
  };

  /* Up goes into the numerator, from the denominator or an exponent in it.
     Down steps out of an exponent first; from the numerator it goes to the
     denominator. Beside a fraction on the main line, either goes into it.
     Each lands at the end of the row it enters (Dr. Cole, 2026-09-28). */
  InputModel.prototype.cmd_up = function () {
    var p = this.parentOf(this.cur.row);
    if (p && p.slot === 'sup') p = this.parentOf(p.row);
    if (p && p.slot === 'den') return this.enter(p.item.num);
    var f = !p && this.besideFrac();
    return f ? this.enter(f.num) : no('');
  };

  InputModel.prototype.cmd_down = function () {
    var p = this.parentOf(this.cur.row);
    if (p && p.slot === 'sup') { this.cur = { row: p.row, i: p.idx + 1 }; return ok(); }
    if (p && p.slot === 'num') return this.enter(p.item.den);
    var f = !p && this.besideFrac();
    return f ? this.enter(f.den) : no('');
  };

  InputModel.prototype.enter = function (r) { this.cur = { row: r, i: r.items.length }; return ok(); };

  /* The fraction just before the cursor, else just after it. */
  InputModel.prototype.besideFrac = function () {
    var r = this.cur.row, a = r.items[this.cur.i - 1], b = r.items[this.cur.i];
    return a && a.k === 'frac' ? a : b && b.k === 'frac' ? b : null;
  };

  InputModel.prototype.cmd_home = function () { this.cur = { row: this.root, i: 0 }; return ok(); };
  InputModel.prototype.cmd_end = function () {
    this.cur = { row: this.root, i: this.root.items.length }; return ok();
  };

  InputModel.prototype.cmd_back = function () {
    var r = this.cur.row, i = this.cur.i, prev = r.items[i - 1];
    if (prev) {
      if (prev.k === 'ch') { r.items.splice(i - 1, 1); this.cur.i--; return ok(); }
      if (prev.k === 'sup') {
        if (!prev.row.items.length) { r.items.splice(i - 1, 1); this.cur.i--; return ok(); }
        this.cur = { row: prev.row, i: prev.row.items.length };
        return this.cmd_back();
      }
      // fraction
      if (!prev.num.items.length && !prev.den.items.length) {
        r.items.splice(i - 1, 1); this.cur.i--; return ok();
      }
      this.cur = { row: prev.den, i: prev.den.items.length };
      return prev.den.items.length ? this.cmd_back() : ok();
    }
    var p = this.parentOf(r);
    if (!p) return no('Nothing to delete.');
    if (p.slot === 'sup') {
      if (!r.items.length) p.row.items.splice(p.idx, 1);
      this.cur = { row: p.row, i: p.idx };
      return ok();
    }
    if (p.slot === 'den') {
      if (!r.items.length) {
        // Deleting into an empty denominator undoes the fraction.
        var moved = p.item.num.items;
        p.row.items.splice.apply(p.row.items, [p.idx, 1].concat(moved));
        this.cur = { row: p.row, i: p.idx + moved.length };
      } else {
        this.cur = { row: p.item.num, i: p.item.num.items.length };
      }
      return ok();
    }
    // numerator start
    if (!r.items.length && !p.item.den.items.length) p.row.items.splice(p.idx, 1);
    this.cur = { row: p.row, i: p.idx };
    return ok();
  };

  /* Plain snapshot for tests: 'x^{3}' and '{1}/{8}'. */
  InputModel.prototype.toString = function () {
    function s(r) {
      return r.items.map(function (it) {
        if (it.k === 'ch') return it.c;
        if (it.k === 'sup') return '^{' + s(it.row) + '}';
        return '{' + s(it.num) + '}/{' + s(it.den) + '}';
      }).join('');
    }
    return s(this.root);
  };

  /* ---- keyboard map ---------------------------------------------------------- */
  /* Returns [cmd, arg] or null (null = let the browser handle the key, so Tab at
     the top level still moves focus and there is no keyboard trap). */
  function keyCommand(e, box) {
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    var k = e.key;
    if (k === '^') return ['sup'];
    if (k === '/') return ['frac'];
    if (k === 'ArrowRight') return ['right'];
    if (k === 'ArrowLeft') return ['left'];
    if (k === 'ArrowUp') return ['up'];
    if (k === 'ArrowDown') return ['down'];
    if (k === 'Tab') return box && !e.shiftKey ? ['leave'] : null;
    if (k === 'Backspace') return ['back'];
    if (k === 'Home') return ['home'];
    if (k === 'End') return ['end'];
    if (k === 'Enter') return ['submit'];
    if (k === 'Escape') return null;
    if (k === '-' || k === '−') return ['char', '-'];
    if (k.length === 1 && /[0-9a-zA-Z]/.test(k)) return ['char', k];
    return null;
  }

  /* ---- spoken description ---------------------------------------------------- */
  function speakRow(r, inSup) {
    var words = [], i = 0, items = r.items;
    if (!items.length) return 'blank';
    while (i < items.length) {
      var it = items[i];
      if (it.k === 'ch' && /[0-9]/.test(it.c)) {
        var s = '';
        while (i < items.length && items[i].k === 'ch' && /[0-9]/.test(items[i].c)) s += items[i++].c;
        words.push(s);
        continue;
      }
      if (it.k === 'ch' && it.c === '-') words.push(inSup && i === 0 ? 'negative' : 'minus');
      else if (it.k === 'ch') words.push(it.c);
      else if (it.k === 'sup') words.push('to the power ' + speakRow(it.row, true) + ',');
      else words.push('fraction, ' + speakRow(it.num) + ', over ' + speakRow(it.den) + ', end fraction,');
      i++;
    }
    return words.join(' ').replace(/,$/, '');
  }

  var BOX_WORDS = { sup: 'in exponent', num: 'in numerator', den: 'in denominator' };

  function describe(model) {
    if (model.isEmpty()) return 'empty';
    var where = BOX_WORDS[model.box()] || (model.cur.i === model.root.items.length ? 'at end'
      : model.cur.i === 0 ? 'at start' : 'in the middle');
    return speakRow(model.root) + '; cursor ' + where;
  }

  /* ======================================================================== */
  /* DOM widget                                                                */
  function MathInput(el, opts) {
    this.el = el;
    this.opts = opts || {};
    this.model = new InputModel();
    // The first id in aria-describedby is the live description of the content.
    this.desc = document.getElementById((el.getAttribute('aria-describedby') || '').split(/\s+/)[0]);
    this.echo = opts.echo || null;     // polite live region for edits
    this.echoTimer = 0;
    var self = this;
    el.addEventListener('keydown', function (e) { self.onKey(e); });
    el.addEventListener('focus', function () { self.render(); });
    el.addEventListener('blur', function () { self.render(); });
    // Tapping the box focuses it without summoning a soft keyboard: it is not
    // editable text, so phones leave the on-screen keypad as the way in.
    el.addEventListener('pointerdown', function () { el.focus(); });
    this.render();
  }

  MathInput.prototype.onKey = function (e) {
    var c = keyCommand(e, this.model.box());
    if (!c || this.locked) return;
    e.preventDefault();
    this.run(c[0], c[1]);
  };

  /* Entry point for keys and keypad alike. */
  MathInput.prototype.run = function (cmd, arg) {
    if (cmd === 'submit') { if (this.opts.onSubmit) this.opts.onSubmit(); return { ok: true }; }
    if (this.locked) return no('The answer is locked.');
    var r = this.model.exec(cmd, arg);
    this.render();
    this.say(r.ok ? describe(this.model) : r.msg);
    if (this.opts.onChange) this.opts.onChange(r);
    return r;
  };

  MathInput.prototype.clear = function () { this.model.clear(); this.render(); };

  /* A correct answer locks the box (Mode 1 design §3): keys and keypad do
     nothing until the next problem. Tab still leaves it. */
  MathInput.prototype.setLocked = function (on) {
    this.locked = !!on;
    this.el.classList.toggle('is-locked', this.locked);
    if (this.locked) this.el.setAttribute('aria-readonly', 'true');
    else this.el.removeAttribute('aria-readonly');
    this.render();
  };

  MathInput.prototype.say = function (text) {
    if (this.desc) this.desc.textContent = describe(this.model);
    if (!this.echo || !text) return;
    var echo = this.echo;
    clearTimeout(this.echoTimer);
    // Debounced: a burst of typing is read once, when it pauses.
    this.echoTimer = setTimeout(function () { echo.textContent = text; }, 450);
  };

  MathInput.prototype.render = function () {
    var m = this.model, focused = document.activeElement === this.el && !this.locked;
    var caret = document.createElement('span');
    caret.className = 'caret' + (focused ? ' on' : '');
    caret.setAttribute('aria-hidden', 'true');

    function build(r, cls) {
      var box = document.createElement('span');
      box.className = cls;
      if (!r.items.length) {
        // An empty numerator or denominator holds a dashed slot, so its own
        // border (the fraction bar) shows from the moment / is pressed.
        if (cls !== 'm-num' && cls !== 'm-den') box.classList.add('empty');
        else {
          var slot = document.createElement('span');
          slot.className = 'm-slot-empty empty';
          if (m.cur.row === r) slot.appendChild(caret);
          box.appendChild(slot);
          return box;
        }
      }
      r.items.forEach(function (it, idx) {
        if (m.cur.row === r && m.cur.i === idx) box.appendChild(caret);
        if (it.k === 'ch') {
          var s = document.createElement('span');
          s.className = /[a-z]/.test(it.c) ? 'm-var' : 'm-ch';
          s.textContent = it.c === '-' ? '−' : it.c;
          box.appendChild(s);
        } else if (it.k === 'sup') {
          box.appendChild(build(it.row, 'm-exp'));
        } else {
          var f = document.createElement('span');
          f.className = 'm-frac';
          f.appendChild(build(it.num, 'm-num'));
          f.appendChild(build(it.den, 'm-den'));
          box.appendChild(f);
        }
      });
      if (m.cur.row === r && m.cur.i === r.items.length) box.appendChild(caret);
      return box;
    }

    var content = build(m.root, 'm-row');
    content.setAttribute('aria-hidden', 'true');
    this.el.replaceChildren(content);
    this.el.classList.toggle('is-empty', m.isEmpty());
    if (this.desc) this.desc.textContent = describe(m);
  };

  /* ---- keypad ---------------------------------------------------------------- */
  /* One table for every keypad in the app. `key` is the keyboard equivalent,
     shown on the button and checked by the tests against keyCommand. */
  var KEYPAD = [
    ['7'], ['8'], ['9'], ['x'], ['sup'],
    ['4'], ['5'], ['6'], ['y'], ['frac'],
    ['1'], ['2'], ['3'], ['z'], ['-'],
    ['left'], ['0'], ['right'], ['back'], ['clear'],
  ].map(function (a) {
    var id = a[0];
    if (/^[0-9]$/.test(id)) return { cmd: 'char', arg: id, key: id, label: id, cls: 'k-digit' };
    if (/^[xyz]$/.test(id)) return { cmd: 'char', arg: id, key: id, label: id, cls: 'k-var', name: id };
    return {
      sup:   { cmd: 'sup', key: '^', html: '<span><span class="k-base">x</span><span class="k-sup">n</span></span>',
               name: 'Exponent', cls: 'k-op' },
      frac:  { cmd: 'frac', key: '/', html: '<span class="k-frac"><span></span><span></span></span>',
               name: 'Fraction', cls: 'k-op' },
      '-':   { cmd: 'char', arg: '-', key: '-', label: '−', name: 'Minus', cls: 'k-op' },
      left:  { cmd: 'left', key: 'ArrowLeft', label: '◀', name: 'Move left', cls: 'k-nav' },
      right: { cmd: 'right', key: 'ArrowRight', label: '▶', name: 'Move right, or out of a box', cls: 'k-nav' },
      back:  { cmd: 'back', key: 'Backspace', label: '⌫', name: 'Delete', cls: 'k-nav' },
      clear: { cmd: 'clear', label: 'Clear', name: 'Clear the answer', cls: 'k-nav' },
    }[id];
  });

  var KEY_HINT = { '^': '^', '/': '/', ArrowLeft: '←', ArrowRight: '→ or Tab', Backspace: 'Backspace' };

  function buildKeypad(pad) {
    pad.replaceChildren();
    KEYPAD.forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'key ' + k.cls;
      b.dataset.cmd = k.cmd;
      if (k.arg !== undefined) b.dataset.arg = k.arg;
      if (k.html) b.innerHTML = k.html; else b.textContent = k.label;
      if (k.name) b.setAttribute('aria-label', k.name);
      var hint = KEY_HINT[k.key];
      if (hint) b.title = k.name + ' (key: ' + hint + ')';
      pad.appendChild(b);
    });
  }

  /* Wire a keypad: every [data-cmd] button runs the same command a key would.
     mousedown is cancelled so a pointer user's focus stays in the answer box;
     keyboard users who Tab onto the keypad keep their focus on the button. */
  function bindKeypad(pad, input) {
    pad.addEventListener('mousedown', function (e) {
      if (e.target.closest('[data-cmd]')) e.preventDefault();
    });
    pad.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cmd]');
      if (!b) return;
      input.run(b.dataset.cmd, b.dataset.arg);
    });
  }

  PC.MathInput = {
    InputModel: InputModel, keyCommand: keyCommand, describe: describe,
    speakRow: speakRow, Widget: MathInput, bindKeypad: bindKeypad,
    KEYPAD: KEYPAD, buildKeypad: buildKeypad,
  };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
