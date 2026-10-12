/*
 * levels.js — the level registry and the activity contract.
 *
 * Levels are containers, not progression (design/01-design-principles.md, Structure):
 * completing one unlocks nothing, and every level is open from the start. The registry
 * therefore holds no gating fields at all — no "requires", no "unlocked", no order
 * checks beyond display order. Do not add any.
 *
 * Each level file in src/levels/ calls SNE.Levels.register({...}) once. The level's
 * `number` is its place in the current order, which Doc may change: to reorder, change
 * the numbers. The `id` is permanent, because saved progress is keyed by it.
 *
 * ── A LEVEL ──────────────────────────────────────────────────────────────────
 *   id         'powers-of-10'           permanent; saved progress is keyed by it
 *   number     1                        position in the current order
 *   title      'Effects of Powers of 10 on Products'
 *   skill      one sentence, Decided wording from the level's design file
 *   design     'design/levels/level-1-powers-of-10.md'
 *   activities { explorations: [], challenges: [], games: [] }
 *
 * ── AN ACTIVITY ──────────────────────────────────────────────────────────────
 *   id         'times-ten'              unique within its level; stats are keyed by it
 *   title      'What does ×10 do?'
 *   summary    one line shown in the level's list
 *   mount      function (el, api) { ... return optionalCleanup; }
 *
 *   mount() builds the activity inside `el`. `api` gives it:
 *     api.record(right)   count one checked answer (true = right, false = wrong)
 *     api.announce(text)  read a message to screen readers (polite live region)
 *     api.level           the level definition, read-only
 *   If mount returns a function, it is called when the student leaves the activity.
 *
 * What an activity says after a miss, what a hint is and how retries work are not
 * designed yet (design/02-feedback-spec.md). Each activity will implement its own
 * feedback from its level's design file; there is deliberately no shared feedback
 * engine here until the feedback spec says what should be shared.
 */
(function (SNE) {
  'use strict';

  /* The three activity types and what each promises (01-design-principles.md,
     Activity types; all Decided). Order here is display order. */
  var TYPES = [
    { key: 'explorations', label: 'Explorations', about: 'Open-ended. Try anything, as often as you like.' },
    { key: 'challenges',   label: 'Challenges',   about: 'Pick your own level of challenge. Help is always the same, and nothing is taken away.' },
    { key: 'games',        label: 'Games',        about: 'Games have penalties.' },
  ];

  var levels = [];

  function fail(msg) { throw new Error('SNE.Levels: ' + msg); }

  function checkActivity(level, type, a, seen) {
    if (!a || typeof a !== 'object') fail(level.id + ': ' + type + ' entry is not an object');
    if (typeof a.id !== 'string' || !/^[a-z0-9-]+$/.test(a.id)) fail(level.id + ': activity id must be lower-case-kebab, got ' + a.id);
    if (seen[a.id]) fail(level.id + ': duplicate activity id ' + a.id);
    seen[a.id] = true;
    if (typeof a.title !== 'string' || !a.title) fail(level.id + '/' + a.id + ': missing title');
    if (typeof a.mount !== 'function') fail(level.id + '/' + a.id + ': missing mount(el, api)');
  }

  function register(def) {
    if (!def || typeof def !== 'object') fail('register() needs a level object');
    if (typeof def.id !== 'string' || !/^[a-z0-9-]+$/.test(def.id)) fail('level id must be lower-case-kebab, got ' + def.id);
    if (levels.some(function (l) { return l.id === def.id; })) fail('duplicate level id ' + def.id);
    if (typeof def.number !== 'number' || def.number < 1 || def.number % 1) fail(def.id + ': number must be a positive whole number');
    if (levels.some(function (l) { return l.number === def.number; })) fail(def.id + ': another level already has number ' + def.number);
    ['title', 'skill', 'design'].forEach(function (k) {
      if (typeof def[k] !== 'string' || !def[k]) fail(def.id + ': missing ' + k);
    });

    var acts = def.activities || {};
    Object.keys(acts).forEach(function (k) {
      if (!TYPES.some(function (t) { return t.key === k; })) fail(def.id + ': unknown activity type ' + k);
    });
    var seen = {};
    var activities = {};
    TYPES.forEach(function (t) {
      var list = acts[t.key] || [];
      if (!Array.isArray(list)) fail(def.id + ': activities.' + t.key + ' must be an array');
      list.forEach(function (a) { checkActivity(def, t.key, a, seen); });
      activities[t.key] = list.slice();
    });

    levels.push(Object.freeze({
      id: def.id, number: def.number, title: def.title, skill: def.skill, design: def.design,
      activities: Object.freeze(activities),
    }));
    levels.sort(function (a, b) { return a.number - b.number; });
  }

  function all() { return levels.slice(); }
  function get(id) { return levels.find(function (l) { return l.id === id; }) || null; }

  /* A level with no activities of any type has not been built yet. */
  function isBuilt(level) {
    return TYPES.some(function (t) { return level.activities[t.key].length > 0; });
  }

  SNE.Levels = { TYPES: TYPES, register: register, all: all, get: get, isBuilt: isBuilt };
})(typeof window !== 'undefined' ? (window.SNE = window.SNE || {}) : (globalThis.SNE = globalThis.SNE || {}));
