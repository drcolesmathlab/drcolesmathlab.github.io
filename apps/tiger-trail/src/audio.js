/* Procedural audio: all SFX + music synthesized with Web Audio (no asset files). */
(function () {
  'use strict';

  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.connect(masterGain);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.35;
      musicGain.connect(masterGain);
      applySettings();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function applySettings() {
    if (!ctx) return;
    const s = window.Storage.settings;
    masterGain.gain.value = s.volume;
    sfxGain.gain.value = s.sfx ? 1 : 0;
  }

  // --- tone helpers ---
  function tone(freq, time, dur, { type = 'sine', vol = 0.5, dest = null, slide = 0 } = {}) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), time + dur);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g).connect(dest || sfxGain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  function noise(time, dur, { vol = 0.3, freq = 1000, q = 1, dest = null } = {}) {
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = freq;
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filt).connect(g).connect(dest || sfxGain);
    src.start(time);
  }

  // --- public SFX ---
  const SFX = {
    correct(streak) {
      ensureCtx();
      const t = ctx.currentTime;
      // ascending major arpeggio, pitched up with streak for extra delight
      const base = 523.25 * Math.pow(1.0595, Math.min(streak || 0, 12)); // C5 climbing
      [0, 4, 7, 12].forEach((semi, i) => {
        tone(base * Math.pow(1.0595, semi), t + i * 0.06, 0.28, { type: 'triangle', vol: 0.4 });
      });
      noise(t, 0.15, { vol: 0.12, freq: 6000, q: 0.7 }); // sparkle
    },
    wrong() {
      ensureCtx();
      const t = ctx.currentTime;
      tone(180, t, 0.32, { type: 'sawtooth', vol: 0.4, slide: -80 });
      tone(120, t + 0.02, 0.36, { type: 'square', vol: 0.25, slide: -50 });
    },
    miss() {
      // soft "womp" — a gentle nudge, not the harsh wrong-answer buzz
      ensureCtx();
      const t = ctx.currentTime;
      tone(280, t, 0.22, { type: 'sine', vol: 0.28, slide: -120 });
      tone(140, t + 0.05, 0.25, { type: 'triangle', vol: 0.18, slide: -50 });
    },
    crash() {
      ensureCtx();
      const t = ctx.currentTime;
      noise(t, 0.35, { vol: 0.5, freq: 400, q: 0.5 });
      tone(90, t, 0.4, { type: 'sawtooth', vol: 0.4, slide: -40 });
    },
    jump() {
      ensureCtx();
      tone(320, ctx.currentTime, 0.22, { type: 'sine', vol: 0.3, slide: 260 });
    },
    roll() {
      // tumbling whoosh
      ensureCtx();
      const t = ctx.currentTime;
      noise(t, 0.3, { vol: 0.22, freq: 800, q: 0.7 });
      tone(240, t, 0.3, { type: 'sine', vol: 0.15, slide: -130 });
    },
    lane() {
      ensureCtx();
      noise(ctx.currentTime, 0.08, { vol: 0.15, freq: 2200, q: 1.5 });
    },
    click() {
      ensureCtx();
      tone(700, ctx.currentTime, 0.07, { type: 'triangle', vol: 0.25 });
    },
    newTarget() {
      ensureCtx();
      const t = ctx.currentTime;
      [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.09, 0.25, { type: 'triangle', vol: 0.35 }));
    },
    achievement() {
      ensureCtx();
      const t = ctx.currentTime;
      [659, 784, 988, 1319].forEach((f, i) => tone(f, t + i * 0.1, 0.4, { type: 'triangle', vol: 0.35 }));
    },
    gameOver() {
      ensureCtx();
      const t = ctx.currentTime;
      [392, 330, 262, 196].forEach((f, i) => tone(f, t + i * 0.18, 0.4, { type: 'triangle', vol: 0.35 }));
    },
    highScore() {
      ensureCtx();
      const t = ctx.currentTime;
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, t + i * 0.11, 0.35, { type: 'triangle', vol: 0.4 }));
    },
  };

  // --- background music: gentle pentatonic marimba loop with soft percussion ---
  const SCALE = [262, 294, 330, 392, 440, 523, 587, 659]; // C major pentatonic-ish
  const PATTERN = [0, 2, 4, 5, 4, 2, 3, 1, 0, 2, 5, 7, 5, 4, 2, 3];

  function scheduleMusicBar() {
    if (!ctx) return;
    const s = window.Storage.settings;
    if (!s.music) return;
    const t0 = ctx.currentTime + 0.05;
    const beat = 0.21;
    for (let i = 0; i < 16; i++) {
      const t = t0 + i * beat;
      const note = SCALE[PATTERN[(musicStep + i) % PATTERN.length]];
      // marimba: short triangle with a soft octave
      tone(note, t, 0.3, { type: 'triangle', vol: 0.16, dest: musicGain });
      if (i % 4 === 0) tone(note / 2, t, 0.5, { type: 'sine', vol: 0.12, dest: musicGain });
      // shaker
      if (i % 2 === 1) noise(t, 0.05, { vol: 0.05, freq: 7000, q: 1, dest: musicGain });
      // soft jungle drum
      if (i % 8 === 0) tone(98, t, 0.25, { type: 'sine', vol: 0.2, slide: -40, dest: musicGain });
      if (i % 8 === 4) tone(74, t, 0.25, { type: 'sine', vol: 0.16, slide: -30, dest: musicGain });
    }
    musicStep = (musicStep + 16) % PATTERN.length;
  }

  const Audio = {
    sfx: SFX,
    startMusic() {
      ensureCtx();
      this.stopMusic();
      scheduleMusicBar();
      musicTimer = setInterval(scheduleMusicBar, 16 * 210);
    },
    stopMusic() {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    },
    applySettings,
    unlock() { ensureCtx(); }, // call on first user gesture
  };

  window.GameAudio = Audio;
})();
