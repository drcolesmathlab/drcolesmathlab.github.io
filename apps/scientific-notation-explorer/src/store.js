/*
 * store.js — progress tracking and settings in localStorage.
 *
 * What is tracked (design/01-design-principles.md, Tracking): right, wrong and totals,
 * with no consequence attached outside games. So this file only counts. Nothing here
 * locks, unlocks or recommends anything (Navigation is free: no gates).
 *
 * Shape:  stats[levelId][activityId] = { right, wrong, lastPlayed }
 * The total for any row is right + wrong; it is derived, never stored, so it cannot drift.
 *
 * Settings (mathlab.scientific-notation-explorer.settings) hold one choice so far: sound on
 * or off, on by default (Doc, 2026-10-14). The shape follows Power Crusher's settings key.
 *
 * Keys are namespaced mathlab.scientific-notation-explorer.* because every Math Lab app
 * shares one storage area (same-origin iframes). These two are the only keys this app
 * writes, and every storage access in the app goes through this file — the site's vendor
 * script checks both. Every read and write is wrapped: private browsing, blocked storage, a
 * full quota or corrupt JSON all fall back to an empty record instead of breaking the app.
 */
(function (SNE) {
  'use strict';

  var KEY = 'mathlab.scientific-notation-explorer.progress';
  var SETTINGS_KEY = 'mathlab.scientific-notation-explorer.settings';
  var VERSION = 1;

  function settingsDefaults() { return { v: VERSION, sound: true }; }

  function defaults() { return { v: VERSION, visited: {}, lastLevel: null, stats: {} }; }

  function isMap(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function count(n) { return typeof n === 'number' && isFinite(n) && n >= 0 ? Math.floor(n) : 0; }

  /* Rebuilt field by field, so anything odd in storage becomes a zero instead of an
     exception somewhere in the UI. */
  function cleanStats(all) {
    var out = {};
    if (!isMap(all)) return out;
    Object.keys(all).forEach(function (level) {
      if (!isMap(all[level])) return;
      out[level] = {};
      Object.keys(all[level]).forEach(function (act) {
        var s = all[level][act];
        if (!isMap(s)) return;
        out[level][act] = {
          right: count(s.right),
          wrong: count(s.wrong),
          lastPlayed: typeof s.lastPlayed === 'number' && isFinite(s.lastPlayed) ? s.lastPlayed : null,
        };
      });
    });
    return out;
  }

  function blank() { return { right: 0, wrong: 0, lastPlayed: null }; }

  function sum(rows) {
    var t = { right: 0, wrong: 0, total: 0 };
    rows.forEach(function (r) { t.right += r.right; t.wrong += r.wrong; });
    t.total = t.right + t.wrong;
    return t;
  }

  function browserStorage() {
    try { return typeof window !== 'undefined' ? window.localStorage : null; } catch (e) { return null; }
  }

  /* `storage` is injectable so the tests can run without a browser. */
  function Store(storage) {
    this.storage = storage === undefined ? browserStorage() : storage;
    this.memory = null;   // the last setting chosen, for when storage can't keep it
  }

  Store.prototype.load = function () {
    var d = defaults();
    try {
      var raw = this.storage && this.storage.getItem(KEY);
      if (!raw) return d;
      var data = JSON.parse(raw);
      if (!isMap(data) || data.v !== VERSION) return d;
      return {
        v: VERSION,
        visited: isMap(data.visited) ? data.visited : {},
        lastLevel: typeof data.lastLevel === 'string' ? data.lastLevel : null,
        stats: cleanStats(data.stats),
      };
    } catch (e) {
      return d;
    }
  };

  Store.prototype.save = function (data) {
    try {
      if (!this.storage) return false;
      this.storage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  };

  Store.prototype.visit = function (levelId) {
    var p = this.load();
    p.visited[levelId] = true;
    p.lastLevel = levelId;
    this.save(p);
  };

  /* The one call an activity makes: one checked answer, right or wrong. */
  Store.prototype.record = function (levelId, activityId, right) {
    var p = this.load();
    var lvl = p.stats[levelId] || (p.stats[levelId] = {});
    var s = lvl[activityId] || (lvl[activityId] = blank());
    if (right) s.right++; else s.wrong++;
    s.lastPlayed = Date.now();
    this.save(p);
    return { right: s.right, wrong: s.wrong, total: s.right + s.wrong };
  };

  Store.prototype.settings = function () {
    var d = this.memory ? { v: VERSION, sound: this.memory.sound } : settingsDefaults();
    try {
      var raw = this.storage && this.storage.getItem(SETTINGS_KEY);
      if (!raw) return d;
      var data = JSON.parse(raw);
      if (!isMap(data) || data.v !== VERSION) return d;
      return { v: VERSION, sound: typeof data.sound === 'boolean' ? data.sound : d.sound };
    } catch (e) {
      return d;
    }
  };

  /* Change one setting. Unknown names and values of the wrong type are ignored. */
  Store.prototype.setting = function (name, value) {
    var s = this.settings();
    if (!(name in s) || name === 'v' || typeof value !== typeof s[name]) return s;
    s[name] = value;
    this.memory = { v: VERSION, sound: s.sound };
    try { if (this.storage) this.storage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* kept in memory for this visit */ }
    return s;
  };

  /* Totals for one activity, one level, or (no arguments) the whole app. */
  Store.prototype.totals = function (levelId, activityId) {
    var stats = this.load().stats;
    if (levelId === undefined) {
      var rows = [];
      Object.keys(stats).forEach(function (l) {
        Object.keys(stats[l]).forEach(function (a) { rows.push(stats[l][a]); });
      });
      return sum(rows);
    }
    var lvl = stats[levelId] || {};
    if (activityId === undefined) {
      return sum(Object.keys(lvl).map(function (a) { return lvl[a]; }));
    }
    return sum([lvl[activityId] || blank()]);
  };

  SNE.Store = { Store: Store, KEY: KEY, SETTINGS_KEY: SETTINGS_KEY };
})(typeof window !== 'undefined' ? (window.SNE = window.SNE || {}) : (globalThis.SNE = globalThis.SNE || {}));
