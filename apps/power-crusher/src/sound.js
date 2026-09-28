/*
 * sound.js — the reward chime and the mismatch buzz (Mode 1 design §7).
 *
 * Synthesised with the Web Audio API: no audio files, nothing to fetch or
 * license, and it works from file://. These stand in until Dr. Cole's generated
 * sounds replace them. Both are under half a second so repeated practice stays
 * quick. Sound is never the only signal; every result is also shown.
 *
 * The AudioContext is created on the first play, which always follows a click
 * or Enter, so browsers' autoplay rules allow it. Any failure is silent.
 */
(function (PC) {
  'use strict';

  var ctx = null;

  function context() {
    if (!ctx) {
      var AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(function () {});
    return ctx;
  }

  /* One note: an oscillator through a gain envelope (quick attack, smooth decay). */
  function note(c, out, o) {
    var t = c.currentTime + o.at;
    var osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + o.dur + 0.02);
  }

  var SOUNDS = {
    // Rising major arpeggio, C6 E6 G6 C7: bright and short.
    reward: function (c, out) {
      [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) {
        note(c, out, { type: 'triangle', f: f, at: i * 0.07, dur: 0.22 + (i === 3 ? 0.14 : 0), vol: 0.22 });
      });
    },
    // Low falling buzz, softened by a low-pass filter so it isn't harsh.
    buzz: function (c, out) {
      var lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900;
      lp.connect(out);
      note(c, lp, { type: 'sawtooth', f: 140, to: 95, at: 0, dur: 0.3, vol: 0.28 });
      note(c, lp, { type: 'square', f: 70, to: 55, at: 0, dur: 0.3, vol: 0.12 });
    },
  };

  function play(name) {
    try {
      var c = context();
      if (!c || !SOUNDS[name]) return false;
      SOUNDS[name](c, c.destination);
      return true;
    } catch (e) {
      return false;
    }
  }

  PC.Sound = { play: play, NAMES: Object.keys(SOUNDS) };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
