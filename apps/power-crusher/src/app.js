/*
 * app.js — the shell: home, mode screens, routing, Stats and Settings, and the
 * Phase 0 answer-box preview (shown for modes that have no levels yet).
 *
 * Routes are URL hashes (#mode/quotient), so the browser's Back button works
 * and any mode can be linked to directly. Every mode is reachable from home
 * with nothing locked (handoff §3). On each navigation, focus moves to the new
 * screen's heading so keyboard and screen-reader users land where the content is.
 */
(function (PC) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var store = new PC.Store.Store();
  var MODES = PC.Modes.MODES;

  var input, activity, current = null, exampleIdx = 0, firstRoute = true;

  /* ---- settings (Mode 1 design §8) ------------------------------------------- */
  var osReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function settings() { return store.load('settings'); }

  /* Reduced motion follows the OS until the student sets it here. */
  function reduceMotion() {
    var s = settings();
    return s.reducedMotion === null ? !!(osReduce && osReduce.matches) : s.reducedMotion;
  }

  function applyMotion() {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion());
  }

  function renderSettings() {
    var s = settings();
    $('setSound').checked = s.sound;
    $('setAnnounce').checked = s.announce;
    $('setMotion').checked = reduceMotion();
    $('motionNote').textContent = s.reducedMotion === null
      ? 'Following your device setting until you change it here.'
      : 'Crushes swap instantly and nothing shakes when this is on.';
  }

  /* ---- stats (Mode 1 design §6) ---------------------------------------------- */
  function pct(s) { return s.attempts ? Math.round(100 * s.correct / s.attempts) + '%' : '—'; }
  function when(t) {
    if (t === null || t === undefined) return '—';
    try { return new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
    catch (e) { return new Date(t).toLocaleString(); }
  }

  function renderStats() {
    var all = store.load('progress').stats;
    var body = $('statsBody');
    body.replaceChildren();
    var table = document.createElement('table');
    table.className = 'stats';
    var cap = document.createElement('caption');
    cap.className = 'sr-only';
    cap.textContent = 'Statistics by mode and level';
    table.appendChild(cap);
    var head = table.createTHead().insertRow();
    ['Mode', 'Level', 'Attempts', 'Correct', 'Accuracy', 'Streak', 'Best streak', 'Last played'].forEach(function (h) {
      var th = document.createElement('th');
      th.scope = 'col';
      th.textContent = h;
      head.appendChild(th);
    });
    var tb = table.createTBody();
    MODES.forEach(function (m) {
      var levels = PC.Activity.levelsFor(m.id);
      if (!levels) return;
      levels.forEach(function (l) {
        var s = (all[m.id] && all[m.id][l.n]) || { attempts: 0, correct: 0, streak: 0, bestStreak: 0, lastPlayed: null };
        var tr = tb.insertRow();
        var th = document.createElement('th');
        th.scope = 'row';
        th.textContent = m.title;
        tr.appendChild(th);
        ['Level ' + l.n + ' · ' + l.title, s.attempts, s.correct, pct(s), s.streak, s.bestStreak, when(s.lastPlayed)]
          .forEach(function (v) { tr.insertCell().textContent = String(v); });
      });
    });
    body.appendChild(table);
    var note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'Other modes appear here once their levels are ready. ' +
      'Streak counts correct answers in a row; a wrong answer resets it.';
    body.appendChild(note);
  }

  /* ---- dialogs --------------------------------------------------------------- */
  var opener = null;
  function openDialog(id, render) {
    var d = $(id);
    render();
    opener = document.activeElement;
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    d.querySelector('[data-close]').focus();
  }
  function bindDialog(id) {
    var d = $(id);
    d.querySelector('[data-close]').addEventListener('click', function () {
      if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
    });
    d.addEventListener('close', function () { if (opener && opener.focus) opener.focus(); opener = null; });
    // A click on the backdrop closes it too. The dialog is the panel, so a click on
    // its own padding also targets it; only a click outside its box counts.
    d.addEventListener('click', function (e) {
      if (e.target !== d || typeof d.close !== 'function') return;
      var r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    });
  }

  /* ---- home ------------------------------------------------------------------ */
  function renderHome() {
    var progress = store.load('progress');
    var list = $('modeList');
    list.replaceChildren();
    MODES.forEach(function (m) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'mode-card' + (m.id === 'mixed' ? ' is-mixed' : '');
      a.href = '#mode/' + m.id;
      var visited = !!progress.visited[m.id];
      a.innerHTML =
        '<span class="num" aria-hidden="true">' + m.number + '</span>' +
        '<span><span class="name"></span>' +
        '<span class="meta' + (visited ? ' visited' : '') + '">' +
        (visited ? '✓ Visited' : (m.id === 'mixed' ? 'All six together' : 'Property ' + m.number)) +
        '</span></span>';
      a.querySelector('.name').textContent = m.title;
      // One clear name per link: "3. Power of a Power, visited".
      a.setAttribute('aria-label', m.number + '. ' + m.title + (visited ? ', visited' : ''));
      li.appendChild(a);
      list.appendChild(li);
    });

    var last = progress.lastMode && PC.Modes.byId(progress.lastMode);
    var cont = $('continue');
    if (last) {
      cont.replaceChildren();
      var link = document.createElement('a');
      link.className = 'btn primary';
      link.href = '#mode/' + last.id;
      link.textContent = 'Pick up where you left off: ' + last.title;
      cont.appendChild(link);
      cont.hidden = false;
    } else {
      cont.hidden = true;
    }
  }

  /* ---- mode screen ----------------------------------------------------------- */
  function renderMode(m) {
    current = m;
    exampleIdx = 0;
    $('modeEyebrow').textContent = m.id === 'mixed'
      ? 'Mode ' + m.number + ' · all properties' : 'Property ' + m.number + ' of ' + (MODES.length - 1);
    $('modeH').textContent = m.title;
    store.visit(m.id);
    var live = activity.open(m);
    $('activity').hidden = !live;
    $('levelNav').hidden = !live;
    $('preview').hidden = live;
    // A mode with levels is finished (Modes 1–6 end at Level 4), so it has no status
    // line; the level buttons say what is there (Dr. Cole, 2026-09-28).
    $('statusNote').hidden = live;
    if (live) return;
    $('statusHead').textContent = 'This mode is still being designed.';
    $('statusText').textContent = m.id === 'mixed'
      ? 'Its practice sets arrive in a later update.'
      : 'Its activities arrive in a later update.';
    $('nextBtn').hidden = m.examples.length < 2;
    showExample();
  }

  function showExample() {
    var ex = current.examples[exampleIdx];
    PC.Render.into($('problem'), ex);
    input.clear();
    var fb = $('feedback');
    fb.textContent = '';
    fb.className = 'feedback';
  }

  function submit() {
    if (!current) return;
    var ex = current.examples[exampleIdx];
    var r = PC.Check.check(input.model.root, ex, current.policy);
    var fb = $('feedback');
    var msg = PC.Check.message(r);
    fb.className = 'feedback ' + (r.correct ? 'good' : r.status === 'invalid' ? '' : 'bad');
    // The icon is text, so right/wrong is never carried by colour alone.
    fb.textContent = (r.correct ? '✓ ' : r.status === 'invalid' ? '' : '✗ ') + msg;
  }

  /* ---- routing --------------------------------------------------------------- */
  function route() {
    var h = location.hash.replace(/^#/, '');
    var match = /^mode\/([a-z-]+)$/.exec(h);
    var m = match && PC.Modes.byId(match[1]);
    $('home').hidden = !!m;
    $('mode').hidden = !m;
    $('homeBtn').hidden = !m;
    if (m) renderMode(m); else { current = null; renderHome(); }
    document.title = (m ? m.title + ' — ' : '') + 'Power Crusher — Dr. Cole’s Math Lab';
    // Don't steal focus on first load (the page may be embedded mid-scroll);
    // after that, every navigation lands on the new heading.
    if (!firstRoute) {
      var hd = m ? $('modeH') : $('homeH');
      hd.focus();
      window.scrollTo(0, 0);
    }
    firstRoute = false;
  }

  function init() {
    applyMotion();
    if (osReduce) {
      var follow = function () { applyMotion(); };
      if (osReduce.addEventListener) osReduce.addEventListener('change', follow);
      else if (osReduce.addListener) osReduce.addListener(follow);
    }
    activity = new PC.Activity.Activity({ store: store, settings: settings, reduce: reduceMotion });
    PC.MathInput.buildKeypad($('keypad'));
    input = new PC.MathInput.Widget($('answer'), { echo: $('answerEcho'), onSubmit: submit });
    PC.MathInput.bindKeypad($('keypad'), input);
    $('submitBtn').addEventListener('click', submit);
    $('nextBtn').addEventListener('click', function () {
      exampleIdx = (exampleIdx + 1) % current.examples.length;
      showExample();
      $('answer').focus();
    });
    $('homeBtn').addEventListener('click', function () { location.hash = ''; });

    bindDialog('statsDlg');
    bindDialog('settingsDlg');
    $('homeStatsBtn').addEventListener('click', function () { openDialog('statsDlg', renderStats); });
    $('modeStatsBtn').addEventListener('click', function () { openDialog('statsDlg', renderStats); });
    $('settingsBtn').addEventListener('click', function () { openDialog('settingsDlg', renderSettings); });
    $('setSound').addEventListener('change', function (e) { store.setting('sound', e.target.checked); });
    $('setAnnounce').addEventListener('change', function (e) { store.setting('announce', e.target.checked); });
    $('setMotion').addEventListener('change', function (e) {
      store.setting('reducedMotion', e.target.checked);
      applyMotion();
      renderSettings();
    });
    window.addEventListener('hashchange', route);
    route();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.PowerCrusher);
