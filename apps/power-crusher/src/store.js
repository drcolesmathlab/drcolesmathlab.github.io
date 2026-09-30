/*
 * store.js — progress and settings in localStorage.
 *
 * Keys are namespaced mathlab.power-crusher.* because every Math Lab app shares
 * one storage area (same-origin iframes). Losing progress is not critical
 * (handoff §5: every mode is freely reachable), so every read and write is
 * wrapped: private browsing, blocked storage, a full quota or corrupt JSON all
 * fall back to defaults instead of breaking the app.
 */
(function (PC) {
  'use strict';

  var KEYS = {
    progress: 'mathlab.power-crusher.progress',
    settings: 'mathlab.power-crusher.settings',
  };
  var VERSION = 1;   // new fields are filled from defaults, so Phase 0 saves still load

  var HISTORY_MAX = 5;   // Mode 1 design §5: last 5 correct problems per level

  function defaults(kind) {
    // progress: which modes were opened, the last one, the in-mode history panel
    // (history[mode][level], newest first) and app-wide statistics
    // (stats[mode][level]). Saving the history is Mode 1 design §5 [ASSUMPTION].
    // settings: null reducedMotion means "follow the OS" (Mode 1 design §8).
    return kind === 'progress'
      ? { v: VERSION, visited: {}, lastMode: null, history: {}, stats: {} }
      : { v: VERSION, sound: true, announce: true, reducedMotion: null };
  }

  function isMap(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function count(n) { return typeof n === 'number' && isFinite(n) && n >= 0 ? Math.floor(n) : 0; }

  /* Rebuilt field by field, so anything odd in storage becomes a default
     instead of an exception somewhere in the UI. */
  function cleanStats(all) {
    var out = {};
    if (!isMap(all)) return out;
    Object.keys(all).forEach(function (mode) {
      if (!isMap(all[mode])) return;
      out[mode] = {};
      Object.keys(all[mode]).forEach(function (lvl) {
        var s = all[mode][lvl];
        if (!isMap(s)) return;
        var c = {
          attempts: count(s.attempts), correct: count(s.correct),
          streak: count(s.streak), bestStreak: count(s.bestStreak),
          lastPlayed: typeof s.lastPlayed === 'number' && isFinite(s.lastPlayed) ? s.lastPlayed : null,
        };
        if (c.correct > c.attempts) c.correct = c.attempts;
        out[mode][lvl] = c;
      });
    });
    return out;
  }

  function cleanHistory(all) {
    var out = {};
    if (!isMap(all)) return out;
    Object.keys(all).forEach(function (mode) {
      if (!isMap(all[mode])) return;
      out[mode] = {};
      Object.keys(all[mode]).forEach(function (lvl) {
        var list = all[mode][lvl];
        if (!Array.isArray(list)) return;
        out[mode][lvl] = list.filter(function (e) { return isMap(e) && isMap(e.from) && isMap(e.to); })
          .slice(0, HISTORY_MAX);
      });
    });
    return out;
  }

  function browserStorage() {
    try { return typeof window !== 'undefined' ? window.localStorage : null; } catch (e) { return null; }
  }

  function Store(storage) {
    this.storage = storage === undefined ? browserStorage() : storage;
  }

  Store.prototype.load = function (kind) {
    var d = defaults(kind);
    try {
      var raw = this.storage && this.storage.getItem(KEYS[kind]);
      if (!raw) return d;
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || data.v !== VERSION) return d;
      if (kind === 'progress') {
        if (!isMap(data.visited)) data.visited = {};
        if (typeof data.lastMode !== 'string') data.lastMode = null;
        data.history = cleanHistory(data.history);
        data.stats = cleanStats(data.stats);
      } else {
        if (typeof data.sound !== 'boolean') delete data.sound;
        if (typeof data.announce !== 'boolean') delete data.announce;
        if (typeof data.reducedMotion !== 'boolean') data.reducedMotion = null;
      }
      return Object.assign(d, data);
    } catch (e) {
      return d;
    }
  };

  Store.prototype.save = function (kind, data) {
    try {
      if (!this.storage) return false;
      this.storage.setItem(KEYS[kind], JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  };

  Store.prototype.visit = function (modeId) {
    var p = this.load('progress');
    p.visited[modeId] = true;
    p.lastMode = modeId;
    this.save('progress', p);
    return p;
  };

  /* One submission (Mode 1 design §6). Every submission is an attempt, so wrong
     then right is 2 attempts, 1 correct [ASSUMPTION in the design]. Streak is
     provisional (Dr. Cole, 2026-09-27): a correct answer adds 1, a wrong one
     resets it to 0; skipping changes nothing. No bonus until one is designed. */
  Store.prototype.record = function (modeId, level, correct, now) {
    var p = this.load('progress');
    var m = p.stats[modeId] = p.stats[modeId] || {};
    var s = m[level] = m[level] || { attempts: 0, correct: 0, streak: 0, bestStreak: 0, lastPlayed: null };
    s.attempts++;
    if (correct) {
      s.correct++;
      s.streak++;
      if (s.streak > s.bestStreak) s.bestStreak = s.streak;
    } else {
      s.streak = 0;
    }
    s.lastPlayed = now === undefined ? Date.now() : now;
    this.save('progress', p);
    return s;
  };

  /* Another try on a problem that already counted as correct (a Mixed Practice
     yellow, Mode 7 design §6): it is an attempt, but not a second correct, and it
     leaves the streak alone, right or wrong (Dr. Cole, 2026-09-30). */
  Store.prototype.recordAttempt = function (modeId, level, now) {
    var p = this.load('progress');
    var m = p.stats[modeId] = p.stats[modeId] || {};
    var s = m[level] = m[level] || { attempts: 0, correct: 0, streak: 0, bestStreak: 0, lastPlayed: null };
    s.attempts++;
    s.lastPlayed = now === undefined ? Date.now() : now;
    this.save('progress', p);
    return s;
  };

  /* A correct problem for the history panel: newest first, last 5 per level. */
  Store.prototype.addHistory = function (modeId, level, item) {
    var p = this.load('progress');
    var m = p.history[modeId] = p.history[modeId] || {};
    m[level] = [item].concat(m[level] || []).slice(0, HISTORY_MAX);
    this.save('progress', p);
    return m[level];
  };

  Store.prototype.setting = function (name, value) {
    var s = this.load('settings');
    s[name] = value;
    this.save('settings', s);
    return s;
  };

  PC.Store = { Store: Store, KEYS: KEYS, HISTORY_MAX: HISTORY_MAX };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
