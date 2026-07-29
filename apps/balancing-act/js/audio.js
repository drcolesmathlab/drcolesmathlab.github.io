/* audio.js — tiny Web Audio synth for UI feedback (no external files).
   Exposes window.Sound: click / valid / invalid / win / lose, plus a
   persisted on/off toggle. All sounds are triggered by user gestures, so the
   AudioContext is created lazily and resumed on first use. */
(function () {
  'use strict';

  let ctx = null;
  let master = null;
  let enabled = load();

  function load() {
    try { return localStorage.getItem('eqBalanceSound') !== '0'; } catch (e) { return true; }
  }
  function save() {
    try { localStorage.setItem('eqBalanceSound', enabled ? '1' : '0'); } catch (e) {}
  }

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // one voice: a tone with an amplitude envelope, optional pitch glide,
  // optional low-pass (for a rounder, brassier timbre) and optional vibrato.
  function voice(o) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (o.delay || 0);
    const dur = o.dur;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);

    let node = osc;
    if (o.cutoff) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.cutoff;
      node.connect(lp); node = lp;
    }

    const peak = o.gain || 0.12;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g); g.connect(master);

    if (o.vibrato) {
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      lfo.frequency.value = o.vibrato;
      lfoGain.gain.value = o.vibratoDepth || 12;
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
      lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    }

    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  // note frequencies (equal temperament)
  const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G6 = 1567.98;

  const Sound = {
    isEnabled: function () { return enabled; },
    setEnabled: function (v) { enabled = !!v; save(); if (enabled) ac(); },
    toggle: function () { this.setEnabled(!enabled); return enabled; },

    // soft click for a button press
    click: function () {
      if (!enabled) return;
      voice({ freq: 190, type: 'triangle', dur: 0.05, gain: 0.07, cutoff: 900 });
    },
    // light, quick ascending chime for a valid step
    valid: function () {
      if (!enabled) return;
      voice({ freq: C5, type: 'sine', dur: 0.11, gain: 0.11, delay: 0.00 });
      voice({ freq: E5, type: 'sine', dur: 0.11, gain: 0.11, delay: 0.05 });
      voice({ freq: G5, type: 'sine', dur: 0.14, gain: 0.11, delay: 0.10 });
    },
    // soft, quick buzzer for an invalid step
    invalid: function () {
      if (!enabled) return;
      voice({ freq: 180, to: 100, type: 'sawtooth', dur: 0.20, gain: 0.09, cutoff: 700, attack: 0.005 });
    },
    // short victorious trumpeting for a correct solution
    win: function () {
      if (!enabled) return;
      const notes = [C5, E5, G5, C6];
      notes.forEach((f, i) => voice({
        freq: f, type: 'sawtooth', dur: 0.16, gain: 0.10, cutoff: 2600, delay: i * 0.10
      }));
      // held final note with a little shimmer
      voice({ freq: C6, type: 'sawtooth', dur: 0.42, gain: 0.11, cutoff: 3000, delay: 0.40 });
      voice({ freq: E6, type: 'sawtooth', dur: 0.42, gain: 0.06, cutoff: 3000, delay: 0.40 });
    },
    // woozy, dizzy descending wobble for a wrong solution
    lose: function () {
      if (!enabled) return;
      voice({ freq: 520, to: 150, type: 'sine', dur: 0.75, gain: 0.11, vibrato: 11, vibratoDepth: 30 });
      voice({ freq: 528, to: 140, type: 'sine', dur: 0.75, gain: 0.07, vibrato: 9, vibratoDepth: 26 });
    }
  };

  window.Sound = Sound;
})();
