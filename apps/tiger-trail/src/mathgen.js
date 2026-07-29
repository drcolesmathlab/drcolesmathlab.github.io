/* Math content generation for Multiples and Factors modes.
   Deck-based: no fact repeats within a round, and targets cycle through the
   whole curriculum (multiples of 2–12, factors of numbers up to 144) before
   any target repeats. */
(function () {
  'use strict';

  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function factorsOf(n) {
    const out = [];
    for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i);
    return out;
  }

  // Factor-rich targets. The full list reaches 144 so the whole 12×12 fact
  // grid gets assessed; the easy list stays within the 9×9 grid. A few primes
  // are mixed in for prime recognition (their only factors are 1 and themselves).
  const FACTOR_TARGETS_EASY = [12, 16, 18, 20, 24, 27, 28, 30, 32, 36];
  const FACTOR_TARGETS_FULL = [
    7, 11, 13,
    12, 16, 18, 20, 24, 27, 28, 30, 32, 36, 40, 42, 44, 45, 48, 50,
    54, 56, 60, 63, 64, 66, 70, 72, 77, 80, 81, 84, 88, 90, 96, 99,
    100, 108, 110, 120, 121, 126, 132, 144,
  ];

  // Collection goals per round: a round ends once this many correct values are
  // COLLECTED (not just shown). Factors mode requires every factor for small
  // targets — primes need both 1 and themselves — capped so 144 doesn't drag.
  const MULTIPLES_GOAL = 8;
  const FACTORS_GOAL_CAP = 6;

  /** A plausible wrong answer (near-misses preferred). */
  function rawWrong(mode, target, maxTarget) {
    let guard = 0;
    if (mode === 'multiples') {
      while (guard++ < 50) {
        let n;
        if (Math.random() < 0.6) {
          // near-miss: a multiple plus/minus a small offset
          n = target * randInt(1, 12) + (Math.random() < 0.5 ? 1 : -1) * randInt(1, Math.max(1, target - 1));
        } else {
          n = randInt(2, target * 12);
        }
        if (n >= 2 && n % target !== 0) return n;
      }
      return target + 1;
    }
    // factors mode
    while (guard++ < 50) {
      let n;
      if (Math.random() < 0.6) {
        // near-miss: a real factor nudged by 1
        const f = factorsOf(target).filter(x => x > 2);
        n = (f.length ? f[randInt(0, f.length - 1)] : 4) + (Math.random() < 0.5 ? 1 : -1);
      } else {
        n = randInt(2, target - 1);
      }
      if (n >= 2 && n < target && target % n !== 0) return n;
    }
    for (let n = target - 1; n >= 2; n--) if (target % n !== 0) return n;
    return target + 1;
  }

  const MathGen = {
    /** Per-run state: target deck + per-round value decks. */
    createRun(mode, maxTarget) {
      return { mode, maxTarget, targetDeck: [], prevTarget: null, round: null };
    },

    /** Advance to the next target and build its round decks. */
    nextTarget(state) {
      if (!state.targetDeck.length) {
        const pool = state.mode === 'multiples'
          ? Array.from({ length: state.maxTarget - 1 }, (_, i) => i + 2) // 2..maxTarget
          : (state.maxTarget >= 12 ? FACTOR_TARGETS_FULL : FACTOR_TARGETS_EASY).slice();
        state.targetDeck = shuffle(pool);
        // don't serve the same target twice in a row across a reshuffle
        const d = state.targetDeck;
        if (d.length > 1 && d[d.length - 1] === state.prevTarget) {
          [d[0], d[d.length - 1]] = [d[d.length - 1], d[0]];
        }
      }
      const t = state.targetDeck.pop();
      state.prevTarget = t;
      const allCorrect = state.mode === 'multiples'
        ? Array.from({ length: 12 }, (_, i) => t * (i + 1))
        : factorsOf(t);
      state.round = {
        target: t,
        allCorrect,
        correctDeck: shuffle(allCorrect.slice()),
        collected: new Set(),
        recent: [], // last few draws — likely still on screen
        usedWrong: new Set(),
        // the round ends once this many corrects are COLLECTED
        goal: state.mode === 'multiples'
          ? MULTIPLES_GOAL
          : Math.min(FACTORS_GOAL_CAP, allCorrect.length),
      };
      return t;
    },

    /** How many correct collections finish the current round. */
    roundGoal(state) { return state.round ? state.round.goal : MULTIPLES_GOAL; },

    /** Tell the round a correct value was actually collected. */
    noteCollected(state, value) { if (state.round) state.round.collected.add(value); },

    /** False only when every correct value has been collected (safety net —
        the goal should end the round first). */
    hasCorrect(state) {
      if (!state.round) return false;
      return state.round.correctDeck.length > 0 ||
        state.round.allCorrect.some(v => !state.round.collected.has(v));
    },

    /** Draw the next correct value. A collected value never reappears, but
        values the player let slip past come back so the goal stays reachable. */
    drawCorrect(state) {
      const r = state.round;
      if (!r.correctDeck.length) {
        // refill with uncollected values, avoiding ones likely still on screen
        let pool = r.allCorrect.filter(v => !r.collected.has(v) && !r.recent.includes(v));
        if (!pool.length) pool = r.allCorrect.filter(v => !r.collected.has(v));
        r.correctDeck = shuffle(pool);
      }
      const v = r.correctDeck.pop(); // undefined if everything was collected
      if (v !== undefined) {
        r.recent.push(v);
        if (r.recent.length > 3) r.recent.shift();
      }
      return v;
    },

    drawWrong(state) {
      const r = state.round;
      for (let i = 0; i < 60; i++) {
        const n = rawWrong(state.mode, r.target, state.maxTarget);
        if (!r.usedWrong.has(n)) { r.usedWrong.add(n); return n; }
      }
      return rawWrong(state.mode, r.target, state.maxTarget);
    },

    isCorrect(mode, target, n) {
      return mode === 'multiples' ? n % target === 0 : target % n === 0;
    },

    targetLabel(mode) {
      return mode === 'multiples' ? 'MULTIPLES OF' : 'FACTORS OF';
    },

    factorsOf,
    FACTOR_TARGETS: FACTOR_TARGETS_FULL,
  };

  window.MathGen = MathGen;
})();
