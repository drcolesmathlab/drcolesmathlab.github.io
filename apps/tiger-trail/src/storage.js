/* Storage: settings, leaderboards, stats, achievements (all localStorage). */
(function () {
  'use strict';
  const KEY = 'tigerTrailSave_v1';

  const DEFAULTS = {
    settings: {
      sfx: true,
      music: true,
      volume: 0.7,
      quality: 'high',
      maxTarget: 12,
      gameStyle: 'competitive', // 'competitive' | 'casual'
    },
    // leaderboards: { multiples: [{name, score, date}], factors: [...] }
    leaderboards: { multiples: [], factors: [] },
    // numberStats[mode][target] = { correct, wrong }
    numberStats: { multiples: {}, factors: {} },
    // mastery[mode][target] = array of distinct facts collected (multiplier k
    // for multiples, the factor itself for factors; 1 doesn't count)
    mastery: { multiples: {}, factors: {} },
    lifetime: {
      runs: 0,
      totalScore: 0,
      bestScore: 0,
      totalCorrect: 0,
      totalWrong: 0,
      bestStreak: 0,
      distance: 0,
    },
    achievements: {}, // id -> unlock timestamp
  };

  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // deep-merge with defaults so new fields survive upgrades
        return merge(structuredClone(DEFAULTS), parsed);
      }
    } catch (e) { /* corrupted save -> start fresh */ }
    return structuredClone(DEFAULTS);
  }

  function merge(base, extra) {
    for (const k in extra) {
      if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) &&
          base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        merge(base[k], extra[k]);
      } else {
        base[k] = extra[k];
      }
    }
    return base;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage full/blocked */ }
  }

  const Storage = {
    get settings() { return data.settings; },
    saveSettings() { save(); },

    // --- Leaderboard (top 10 per mode) ---
    getBoard(mode) { return data.leaderboards[mode] || []; },
    qualifies(mode, score) {
      if (score <= 0) return false;
      const board = this.getBoard(mode);
      return board.length < 10 || score > board[board.length - 1].score;
    },
    addScore(mode, name, score) {
      const board = data.leaderboards[mode];
      board.push({ name: (name || 'AAA').toUpperCase().slice(0, 3), score, date: Date.now() });
      board.sort((a, b) => b.score - a.score);
      data.leaderboards[mode] = board.slice(0, 10);
      save();
    },

    // --- Per-number stats ---
    recordAnswer(mode, target, correct) {
      const t = String(target);
      const s = data.numberStats[mode][t] || { correct: 0, wrong: 0 };
      if (correct) s.correct++; else s.wrong++;
      data.numberStats[mode][t] = s;
      if (correct) data.lifetime.totalCorrect++; else data.lifetime.totalWrong++;
    },
    // Returns [{mode, target, correct, wrong, pct, attempts}] sorted by pct
    getSpots() {
      const out = [];
      for (const mode of ['multiples', 'factors']) {
        for (const t in data.numberStats[mode]) {
          const s = data.numberStats[mode][t];
          const attempts = s.correct + s.wrong;
          if (attempts >= 5) {
            out.push({
              mode, target: Number(t),
              correct: s.correct, wrong: s.wrong, attempts,
              pct: Math.round((s.correct / attempts) * 100),
            });
          }
        }
      }
      out.sort((a, b) => a.pct - b.pct);
      return out;
    },

    // --- Fact mastery (cumulative across runs) ---
    /** Records a collected correct value. Returns how many distinct facts are
        now mastered for this target, or null if the value doesn't count. */
    recordMastery(mode, target, value) {
      let fact;
      if (mode === 'multiples') {
        fact = Math.round(value / target); // the multiplier, 1..12
        if (fact < 1 || fact > 12) return null;
      } else {
        if (value <= 1) return null; // everything divides by 1 — no credit
        fact = value;
      }
      const key = String(target);
      const arr = data.mastery[mode][key] || (data.mastery[mode][key] = []);
      if (!arr.includes(fact)) arr.push(fact);
      return arr.length;
    },
    getMasteryCount(mode, target) {
      const arr = data.mastery[mode][String(target)];
      return arr ? arr.length : 0;
    },

    // --- Lifetime ---
    get lifetime() { return data.lifetime; },
    recordRun(result) {
      const lt = data.lifetime;
      lt.runs++;
      lt.totalScore += result.score;
      lt.bestScore = Math.max(lt.bestScore, result.score);
      lt.bestStreak = Math.max(lt.bestStreak, result.bestStreak);
      lt.distance += Math.round(result.distance);
      save();
    },

    // --- Achievements ---
    isUnlocked(id) { return !!data.achievements[id]; },
    unlock(id) {
      if (data.achievements[id]) return false;
      data.achievements[id] = Date.now();
      save();
      return true;
    },
    get achievements() { return data.achievements; },

    resetAll() {
      data = structuredClone(DEFAULTS);
      save();
    },
  };

  window.Storage = Storage;
})();
