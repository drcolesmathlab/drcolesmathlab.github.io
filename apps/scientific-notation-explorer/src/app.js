/*
 * app.js — the shell: home (all six levels), a level's screen, an activity's screen,
 * and the Progress dialog.
 *
 * Routes are URL hashes, so the browser's Back button works and a teacher can link
 * straight to any level or activity:
 *   #                                  home
 *   #level/<levelId>                   a level: its explorations, challenges and games
 *   #level/<levelId>/<type>/<actId>    one activity
 * Every level is reachable from home with nothing locked and no warnings
 * (design/01-design-principles.md, Structure). On each navigation focus moves to the
 * new screen's heading, so keyboard and screen-reader users land where the content is.
 */
(function (SNE) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var store = new SNE.Store.Store();
  var Levels = SNE.Levels;

  var cleanup = null, firstRoute = true;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function announce(text) {
    var a = $('announce');
    a.textContent = '';
    // A fresh text node after a tick, so repeating the same message is read again.
    setTimeout(function () { a.textContent = text; }, 30);
  }

  function tally(t) {
    return t.total ? t.right + ' right, ' + t.wrong + ' wrong' : 'Not tried yet';
  }

  /* ---- home -------------------------------------------------------------------- */
  function renderHome() {
    var list = $('levelList');
    list.replaceChildren();
    Levels.all().forEach(function (level) {
      var li = el('li', 'level-card');
      var a = el('a', 'level-link');
      a.href = '#level/' + level.id;
      a.appendChild(el('span', 'level-num', 'Level ' + level.number));
      a.appendChild(el('span', 'level-title', level.title));
      li.appendChild(a);
      li.appendChild(el('p', 'level-skill', level.skill));
      li.appendChild(el('p', 'level-meta',
        Levels.isBuilt(level) ? tally(store.totals(level.id)) : 'Being designed — nothing to try yet'));
      list.appendChild(li);
    });
  }

  /* ---- a level ----------------------------------------------------------------- */
  function renderLevel(level) {
    $('levelEyebrow').textContent = 'Level ' + level.number;
    $('levelH').textContent = level.title;
    $('levelSkill').textContent = level.skill;

    var body = $('levelBody');
    body.replaceChildren();
    Levels.TYPES.forEach(function (type) {
      var sec = el('section', 'panel type');
      var h = el('h3', 'type-h', type.label);
      h.id = 'type-' + type.key;
      sec.setAttribute('aria-labelledby', h.id);
      sec.appendChild(h);
      sec.appendChild(el('p', 'type-about', type.about));

      var acts = level.activities[type.key];
      if (!acts.length) {
        sec.appendChild(el('p', 'empty', 'Not designed yet.'));
      } else {
        var ul = el('ul', 'acts');
        acts.forEach(function (act) {
          var li = el('li');
          var a = el('a', 'act-link', act.title);
          a.href = '#level/' + level.id + '/' + type.key + '/' + act.id;
          li.appendChild(a);
          if (act.summary) li.appendChild(el('span', 'act-summary', act.summary));
          li.appendChild(el('span', 'act-meta', tally(store.totals(level.id, act.id))));
          ul.appendChild(li);
        });
        sec.appendChild(ul);
      }
      body.appendChild(sec);
    });
  }

  /* ---- an activity --------------------------------------------------------------- */
  function renderActivity(level, type, act) {
    $('actBack').href = '#level/' + level.id;
    $('actBack').textContent = '← Level ' + level.number + ': ' + level.title;
    $('actEyebrow').textContent = type.label.replace(/s$/, '');
    $('actH').textContent = act.title;
    var stage = $('actStage');
    stage.replaceChildren();
    var api = Object.freeze({
      level: level,
      record: function (right) { return store.record(level.id, act.id, !!right); },
      announce: announce,
      soundOn: function () { return store.settings().sound; },
    });
    var out = act.mount(stage, api);
    cleanup = typeof out === 'function' ? out : null;
  }

  /* ---- progress dialog ----------------------------------------------------------- */
  function renderProgress() {
    var body = $('progressBody');
    body.replaceChildren();
    var table = el('table', 'stats');
    var cap = el('caption', 'sr-only', 'Right, wrong and total answers for each level');
    table.appendChild(cap);
    var head = el('tr');
    ['Level', 'Right', 'Wrong', 'Total'].forEach(function (t, i) {
      var th = el('th', i ? 'num' : '', t);
      th.scope = 'col';
      head.appendChild(th);
    });
    var thead = el('thead');
    thead.appendChild(head);
    table.appendChild(thead);

    var tbody = el('tbody');
    function row(label, t, cls) {
      var tr = el('tr', cls || '');
      var th = el('th', '', label);
      th.scope = 'row';
      tr.appendChild(th);
      [t.right, t.wrong, t.total].forEach(function (n) { tr.appendChild(el('td', 'num', String(n))); });
      tbody.appendChild(tr);
    }
    Levels.all().forEach(function (level) {
      row(level.number + '. ' + level.title, store.totals(level.id));
    });
    row('All levels', store.totals(), 'sum');
    table.appendChild(tbody);
    body.appendChild(table);
  }

  /* ---- routing -------------------------------------------------------------------- */
  function show(id) {
    ['home', 'level', 'activity'].forEach(function (s) { $(s).hidden = s !== id; });
  }

  function focusHeading(id) {
    if (firstRoute) return;   // on load, leave focus where the browser puts it
    var h = $(id);
    if (h) h.focus();
  }

  function route() {
    if (cleanup) { try { cleanup(); } catch (e) { /* a broken cleanup must not block navigation */ } cleanup = null; }

    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var level = parts[0] === 'level' ? Levels.get(parts[1]) : null;
    var type = level && parts[2] ? Levels.TYPES.find(function (t) { return t.key === parts[2]; }) : null;
    var act = type ? level.activities[type.key].find(function (a) { return a.id === parts[3]; }) : null;

    if (act) {
      store.visit(level.id);
      renderActivity(level, type, act);
      show('activity');
      document.title = act.title + ' — Scientific Notation Explorer';
      focusHeading('actH');
    } else if (level) {
      // An unknown activity in a known level falls back to the level, not to home.
      store.visit(level.id);
      renderLevel(level);
      show('level');
      document.title = 'Level ' + level.number + ': ' + level.title + ' — Scientific Notation Explorer';
      focusHeading('levelH');
    } else {
      renderHome();
      show('home');
      document.title = "Scientific Notation Explorer — Dr. Cole's Math Lab";
      focusHeading('homeH');
    }
    firstRoute = false;
  }

  /* ---- wiring --------------------------------------------------------------------- */
  function init() {
    $('progressBtn').addEventListener('click', function () {
      renderProgress();
      $('progressDlg').showModal();
    });
    $('settingsBtn').addEventListener('click', function () {
      $('setSound').checked = store.settings().sound;
      $('settingsDlg').showModal();
    });
    $('setSound').addEventListener('change', function (e) { store.setting('sound', e.target.checked); });
    document.querySelectorAll('dialog [data-close]').forEach(function (b) {
      b.addEventListener('click', function () { b.closest('dialog').close(); });
    });
    window.addEventListener('hashchange', route);
    route();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.SNE);
