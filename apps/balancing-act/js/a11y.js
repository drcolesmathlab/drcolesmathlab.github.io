/* a11y.js — screen-reader, keyboard and focus support for Balancing Act.
 *
 * Not upstream: added for the Math Lab site. tools/vendor-balancing-act.js keeps
 * this file and re-links it on every re-vendor, so the game's own four scripts
 * stay byte-for-byte upstream. Nothing here changes a rule of the game — it only
 * reads what the game draws, names the controls, says aloud what the picture
 * shows, and moves focus around the two overlays.
 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);

  // ---- speech: turn the ledger's math into words a screen reader says well
  // (most screen readers skip brackets and read "−" as "dash" by default).
  function words(s) {
    return s
      .replace(/\u00a0/g, ' ')
      .replace(/(^|[=(]\s*)−/g, '$1 negative ')   // a leading sign is a sign, not subtraction
      .replace(/−/g, ' minus ')
      .replace(/\+/g, ' plus ')
      .replace(/=/g, ' equals ')
      .replace(/×/g, ' times ')
      .replace(/(\d|x)\s*\(/g, '$1 times (')
      .replace(/\(/g, ' open bracket ')
      .replace(/\)/g, ' close bracket ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  // Raw text of a ledger node, with stacked fractions read as "a over b".
  function mathText(node) {
    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeType !== 1 || node.classList.contains('sr-only')) return '';
    if (node.classList.contains('frac')) {
      const num = mathText(node.querySelector(':scope > .fnum')).trim();
      const den = mathText(node.querySelector(':scope > .fden')).trim();
      return ' ' + (/[+−] /.test(num) ? 'the quantity ' + num + ', all' : num) + ' over ' + den + ' ';
    }
    return Array.from(node.childNodes).map(mathText).join('');
  }
  const colOf = el => parseInt(el.style.gridColumn, 10) || 0;

  // ---- ledger model, read back from the grid game.js draws (see renderLedger)
  // The grid's DOM order is row order: an equation row, then for each step an
  // operation row, its rule/label row, and the equation row it produced.
  function ledgerRows() {
    const rows = new Map();
    for (const el of $('#ledger').children) {
      if (el.classList.contains('sr-only')) continue;
      const r = parseInt(el.style.gridRow, 10);
      if (!rows.has(r)) rows.set(r, []);
      rows.get(r).push(el);
    }
    return Array.from(rows.keys()).sort((a, b) => a - b).map(k => rows.get(k));
  }
  function speakEq(cells) {
    return words(cells.slice().sort((a, b) => colOf(a) - colOf(b)).map(mathText).join(' '));
  }
  function describeOp(cell) {
    if (!cell || cell.classList.contains('dim')) return '';
    const t = cell.textContent.replace(/\s+/g, ' ').trim();
    if (t === '✎') return 'rewritten';
    let m = t.match(/^([+−]) ?\(?(−?)([\dx]+)\)?$/);
    if (m) return (m[1] === '+' ? 'add ' : 'subtract ') + (m[2] ? 'negative ' : '') + m[3];
    const f = cell.querySelector('.op > .frac > .fden');
    if (f) return 'divide by ' + words(f.textContent.trim());
    m = t.match(/^(−?\d+)\(/);
    if (m) return 'multiply by ' + words(m[1]);
    return words(t);
  }
  function readLedger() {
    const model = { start: '', steps: [], current: '' };
    let step = null;
    ledgerRows().forEach(cells => {
      if (cells[0].classList.contains('rulewrap')) {
        const lab = cells[0].querySelector('.proplabel');
        if (step && lab && !lab.classList.contains('hide')) step.label = lab.textContent.trim();
        return;
      }
      if (cells.some(c => c.classList.contains('eqsign'))) {
        const eq = speakEq(cells);
        if (step) { step.result = eq; model.steps.push(step); step = null; } else model.start = eq;
        if (cells.some(c => c.classList.contains('current'))) model.current = eq;
        return;
      }
      step = {
        left: describeOp(cells.find(c => c.classList.contains('l'))),
        right: describeOp(cells.find(c => c.classList.contains('r'))),
        label: '', result: ''
      };
    });
    return model;
  }
  function stepText(s) {
    if (s.left === 'rewritten') return 'Left side rewritten.';
    if (s.right === 'rewritten') return 'Right side rewritten.';
    return 'Left: ' + (s.left || 'nothing yet') + '. Right: ' + (s.right || 'nothing yet') + '.';
  }

  // A plain-text copy of the work for screen readers. The visual grid reads as
  // a jumble of single cells, so it is hidden from them and this list stands in.
  function mirrorLedger(model) {
    const el = $('#ledger');
    const ol = document.createElement('ol');
    ol.className = 'sr-only';
    const add = t => { const li = document.createElement('li'); li.textContent = t; ol.appendChild(li); };
    add('Starting equation: ' + model.start + '.');
    model.steps.forEach((s, i) => {
      add('Step ' + (i + 1) + '. ' + stepText(s) + (s.label ? ' ' + s.label + '.' : '') + ' Result: ' + s.result + '.');
    });
    for (const c of el.children) c.setAttribute('aria-hidden', 'true');
    el.appendChild(ol);
  }

  // ---- what the picture shows
  let tilt = 0, fallen = false, newRound = false;
  function balanceText() {
    return tilt === 0 ? 'Balanced.' : 'Unbalanced, tipped to the ' + (tilt < 0 ? 'left' : 'right') + '.';
  }
  function labelScene() {
    $('#scene').setAttribute('aria-label', fallen
      ? 'Stick Man has fallen off the beam.'
      : tilt === 0
        ? 'Balance beam, level. Stick Man is balanced.'
        : 'Balance beam, tipped down on the ' + (tilt < 0 ? 'left' : 'right') + '. Stick Man is wobbling.');
  }
  // game.js calls Character.* through the global at call time, so wrapping the
  // methods here (this script loads after it) sees every tilt, fall and reset.
  function after(name, fn) {
    const orig = window.Character[name];
    window.Character[name] = function () { const r = orig.apply(this, arguments); fn.apply(null, arguments); return r; };
  }
  after('setTilt', deg => { tilt = deg; labelScene(); });
  after('fall', () => { fallen = true; labelScene(); });
  after('reset', () => { tilt = 0; fallen = false; newRound = true; labelScene(); });

  function previewText() {
    const t = $('#previewText').textContent.trim();
    if (t[0] === '✎') {
      const e = t.slice(1).trim();
      return e === '…' ? 'Rewrite: nothing typed yet' : 'Rewrite: ' + words(e);
    }
    if (t === '▢') return 'Nothing entered';
    const m = t.match(/^([+−×/]) (.*)$/);
    if (!m) return 'Entered: ' + words(t);
    const OP = { '+': 'add', '−': 'subtract', '×': 'multiply by', '/': 'divide by' };
    return 'Entered: ' + OP[m[1]] + ' ' + (m[2] === '▢' ? 'no number yet' : words(m[2]));
  }

  // ---- announcements: one polite live region, outside #app so it still
  // speaks while #app is inert. Each check says the single most useful thing.
  let live, flip = false;
  function announce(t) {
    live.textContent = t + (flip ? '\u00a0' : '');   // force a change so repeats are re-read
    flip = !flip;
  }
  let last = { steps: [], sig: '', current: '', preview: '' }, pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(check, 0);   // after game.js has finished updating tilt and HUD
  }
  const filled = s => (s.left ? 1 : 0) + (s.right ? 1 : 0);
  function check() {
    pending = false;
    const m = readLedger();
    const snap = { steps: m.steps, sig: m.steps.map(s => s.left + '|' + s.right).join(';'), current: m.current, preview: previewText() };
    $('#srPreview').textContent = snap.preview;
    const prev = last;
    last = snap;
    if (overlayOpen()) { newRound = false; return; }
    if (newRound) {
      newRound = false;
      const streak = +$('#streakVal').textContent;
      announce((streak ? 'Streak ' + streak + '. ' : '') + 'New equation: ' + m.current + '.');
      return;
    }
    if (snap.sig !== prev.sig) {
      const a = prev.steps, b = m.steps;
      const undone = b.length < a.length ||
        (b.length === a.length && filled(b[b.length - 1]) < filled(a[a.length - 1]));
      let what = 'Undone.';
      if (!undone) {
        const s = b[b.length - 1], p = b.length === a.length ? a[a.length - 1] : { left: '', right: '' };
        if (s.left === 'rewritten' || s.right === 'rewritten') what = stepText(s);
        else what = [s.left !== p.left && s.left ? 'Left: ' + s.left + '.' : '',
                     s.right !== p.right && s.right ? 'Right: ' + s.right + '.' : ''].join(' ').trim();
      }
      announce(what + ' Now ' + m.current + '. ' + balanceText());
      return;
    }
    if (snap.preview !== prev.preview) announce(snap.preview);
  }

  // ---- overlays: real dialogs, background made inert, focus moved in and out
  let menu, over, app, open = null;
  const isOpen = el => !el.classList.contains('hide');
  function overlayOpen() { return isOpen(menu) || isOpen(over); }
  function syncOverlays(first) {
    const now = isOpen(over) ? over : isOpen(menu) ? menu : null;
    app.inert = !!now;
    if (now === open) return;
    const was = open;
    open = now;
    if (first) return;   // page load: never pull focus into an embedded iframe
    if (now === over) $('#btnRetry').focus();
    else if (now === menu) menu.querySelector('[data-mode]').focus();
    else if (was && (document.activeElement === document.body || was.contains(document.activeElement))) {
      $('#ledger').focus({ preventScroll: true });
    }
  }

  // ---- keyboard
  // Single-character shortcuts can be switched off (WCAG 2.1.4); the setting
  // lives on the menu and persists like the game's own sound setting.
  const CHAR_KEYS = /^[0-9+\-*/xsn]$/;
  let keysOn = true;
  try { keysOn = localStorage.getItem('mathlab.balancing-act.keys') !== '0'; } catch (e) {}
  // Which element the keyboard last moved focus to. :focus-visible can't tell
  // us: Chrome turns it on for a clicked button as soon as any key is pressed.
  let byPointer = false, kbFocused = null;
  document.addEventListener('pointerdown', () => { byPointer = true; }, true);
  document.addEventListener('focusin', e => { kbFocused = byPointer ? null : e.target; byPointer = false; }, true);
  // Capture on window runs before game.js's document listener, so stopping the
  // event here keeps it from the game while leaving the browser's own action.
  window.addEventListener('keydown', e => {
    byPointer = false;
    if (e.metaKey || e.ctrlKey || e.altKey || !menu) return;
    // The game is locked behind an overlay anyway; let Enter press the focused button.
    if (overlayOpen()) { e.stopPropagation(); return; }
    // Enter on a button reached by keyboard presses that button; after a click
    // it still submits, exactly as before.
    const a = document.activeElement;
    if (e.key === 'Enter' && a && a.tagName === 'BUTTON' && a === kbFocused) { e.stopPropagation(); return; }
    if (!keysOn && CHAR_KEYS.test(e.key)) e.stopPropagation();
  }, true);

  // ---- names and states for controls whose label is a symbol
  const KEY_NAMES = { '/': 'divide', '*': 'multiply', '-': 'subtract', '+': 'add',
    back: 'Backspace', sign: 'negative', x: 'variable x' };
  const TOGGLES = ['/', '*', '-', '+', 'sign', 'simplify'];

  function init() {
    menu = $('#menu'); over = $('#gameover'); app = $('#app');

    app.setAttribute('role', 'main');
    $('#hud').setAttribute('role', 'group');   // a <header> inside main would read as a stray banner
    $('#hud').setAttribute('aria-label', 'Score and settings');
    const h1 = document.createElement('h1');
    h1.className = 'sr-only';
    h1.textContent = 'Balancing Act';
    app.insertBefore(h1, app.firstChild);

    document.querySelectorAll('#keypad [data-k]').forEach(b => {
      if (KEY_NAMES[b.dataset.k]) b.setAttribute('aria-label', KEY_NAMES[b.dataset.k]);
    });
    $('#applyL').setAttribute('aria-label', 'Apply to left side');
    $('#applyR').setAttribute('aria-label', 'Apply to right side');
    const syncPressed = () => TOGGLES.forEach(k => {
      const b = $('#keypad [data-k="' + k + '"]');
      b.setAttribute('aria-pressed', String(b.classList.contains('sel') || b.classList.contains('on')));
    });
    new MutationObserver(syncPressed).observe($('#keypad'), { subtree: true, attributes: true, attributeFilter: ['class'] });
    syncPressed();
    const sound = $('#soundToggle');
    const syncSound = () => sound.setAttribute('aria-label', 'Sound: ' + (sound.classList.contains('on') ? 'on' : 'off'));
    new MutationObserver(syncSound).observe(sound, { attributes: true, attributeFilter: ['class'] });
    syncSound();

    // the input preview: the visible glyphs are hidden, a spoken copy stands in
    $('#previewText').setAttribute('aria-hidden', 'true');
    const sp = document.createElement('span');
    sp.id = 'srPreview';
    sp.className = 'sr-only';
    $('#preview').appendChild(sp);

    const ledger = $('#ledger');
    ledger.setAttribute('role', 'region');
    ledger.setAttribute('aria-label', 'The work');
    ledger.tabIndex = 0;   // it scrolls, so a keyboard has to be able to reach it

    live = document.createElement('div');
    live.className = 'sr-only';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    document.body.appendChild(live);

    // Rebuild the spoken copy whenever game.js redraws the grid (it empties
    // and refills #ledger each time, which also removes the previous copy).
    new MutationObserver(records => {
      const redrawn = records.some(r => Array.from(r.addedNodes).some(n => !n.classList || !n.classList.contains('sr-only')));
      if (!redrawn) return;
      mirrorLedger(readLedger());
      schedule();
    }).observe(ledger, { childList: true });
    new MutationObserver(schedule).observe($('#previewText'), { childList: true, characterData: true, subtree: true });

    // dialogs
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-label', 'Balancing Act');
    menu.querySelector('.tag').id = 'menuTag';
    menu.querySelector('.how').id = 'menuHow';
    menu.setAttribute('aria-describedby', 'menuTag menuHow');
    over.setAttribute('role', 'alertdialog');
    over.setAttribute('aria-modal', 'true');
    over.querySelector('h1').id = 'goTitle';
    over.querySelector('p').id = 'goText';
    over.querySelector('.final').id = 'goFinal';
    over.setAttribute('aria-labelledby', 'goTitle');
    over.setAttribute('aria-describedby', 'goText goFinal');
    const watch = new MutationObserver(() => syncOverlays(false));
    watch.observe(menu, { attributes: true, attributeFilter: ['class'] });
    watch.observe(over, { attributes: true, attributeFilter: ['class'] });
    syncOverlays(true);

    // keyboard-shortcut switch, on the menu under the mode buttons
    const kb = document.createElement('button');
    kb.id = 'keysToggle';
    kb.type = 'button';
    kb.className = 'btn c-dim small';
    const setKeys = () => {
      kb.textContent = 'Keyboard shortcuts: ' + (keysOn ? 'ON' : 'OFF');
      kb.classList.toggle('on', keysOn);
    };
    kb.addEventListener('click', () => {
      keysOn = !keysOn;
      try { localStorage.setItem('mathlab.balancing-act.keys', keysOn ? '1' : '0'); } catch (e) {}
      setKeys();
    });
    setKeys();
    menu.querySelector('.modes').insertAdjacentElement('afterend', kb);

    labelScene();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
