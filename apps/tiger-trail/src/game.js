/* Core game: loop, lanes, spawning, collisions, scoring, lives, difficulty. */
(function () {
  'use strict';

  const LANES = [-3.4, 0, 3.4];
  const SPAWN_Z = -135;
  const DESPAWN_Z = 14;
  const GRAVITY = 28;
  const JUMP_V = 11;
  const ROLL_TIME = 0.55;   // seconds for a full forward tumble
  const START_SPEED = 13;
  const MAX_SPEED = 30;
  const SPEED_RAMP = 0.22;      // units/sec^2
  const CASUAL_SPEED = 11;      // casual style: constant speed, never ramps
  // round length (correct answers collected per target) lives in MathGen:
  // 8 for multiples, all factors up to a cap of 6 for factors mode

  const ACHIEVEMENTS = [
    { id: 'first_run', icon: '🐾', name: 'First Steps', desc: 'Finish your first run' },
    { id: 'score_500', icon: '🍌', name: 'Jungle Snack', desc: 'Score 500 in one run' },
    { id: 'score_1500', icon: '🥭', name: 'Jungle Feast', desc: 'Score 1,500 in one run' },
    { id: 'score_4000', icon: '👑', name: 'Jungle Royalty', desc: 'Score 4,000 in one run' },
    { id: 'streak_10', icon: '🔥', name: 'On Fire', desc: 'Get 10 correct in a row' },
    { id: 'streak_20', icon: '⚡', name: 'Math Lightning', desc: 'Get 20 correct in a row' },
    { id: 'correct_25', icon: '🎯', name: 'Sharp Claws', desc: '25 correct answers in one run' },
    { id: 'no_miss_1000', icon: '🛡️', name: 'Untouchable', desc: 'Score 1,000 without losing a life' },
    { id: 'both_modes', icon: '🧭', name: 'Explorer', desc: 'Play both Multiples and Factors' },
    { id: 'max_speed', icon: '💨', name: 'Full Sprint', desc: 'Reach top speed' },
    { id: 'targets_5', icon: '🔄', name: 'Shape Shifter', desc: 'Clear 5 targets in one run' },
    { id: 'lifetime_250', icon: '🏆', name: 'Math Master', desc: '250 correct answers (lifetime)' },
  ];
  ACHIEVEMENTS.forEach(a => { a.group = 'general'; });
  // fact-mastery achievements with visible progress (cumulative across runs)
  for (let t = 2; t <= 12; t++) {
    ACHIEVEMENTS.push({
      id: `mult_master_${t}`, icon: '✖️', group: 'mult',
      name: `Multiples of ${t} Master`,
      desc: `Collect every multiple from ${t}×1 to ${t}×12`,
      mastery: { mode: 'multiples', target: t, total: 12 },
    });
  }
  for (const n of MathGen.FACTOR_TARGETS) {
    const total = MathGen.factorsOf(n).filter(f => f > 1).length;
    if (total < 2) continue; // primes get no mastery badge — nothing to master
    ACHIEVEMENTS.push({
      id: `fact_master_${n}`, icon: '➗', group: 'fact',
      name: `Factors of ${n} Master`,
      desc: `Find all ${total} factors of ${n} (1 is a freebie — it doesn't count)`,
      mastery: { mode: 'factors', target: n, total },
    });
  }
  window.ACHIEVEMENTS = ACHIEVEMENTS;

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 300);
      this.camera.position.set(0, 5.4, 8.6);
      this.camera.lookAt(0, 1.6, -7);

      this.world = new JungleWorld.World(this.scene, Storage.settings.quality);
      this.tiger = new Tiger();
      this.tiger.group.position.set(0, 0, 0);
      this.scene.add(this.tiger.group);

      // particle pool for collect/hit bursts
      this.particles = [];
      const pGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
      for (let i = 0; i < 40; i++) {
        const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true }));
        m.visible = false;
        this.scene.add(m);
        this.particles.push({ mesh: m, life: 0, vel: new THREE.Vector3() });
      }

      this.objects = [];      // active coins/logs
      this.state = 'menu';    // menu | countdown | running | paused | gameover
      this.lane = 1;
      this.tigerY = 0;
      this.velY = 0;
      this.airborne = false;
      this.lastTime = 0;

      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.bindInput();
      requestAnimationFrame((t) => this.frame(t));
    }

    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    applySettings() {
      this.world.setQuality(Storage.settings.quality);
      this.renderer.shadowMap.enabled = Storage.settings.quality === 'high';
      GameAudio.applySettings();
    }

    // ===== input =====
    bindInput() {
      window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        const k = e.code;
        if (this.state === 'running') {
          if (k === 'ArrowLeft' || k === 'KeyA') this.moveLane(-1);
          else if (k === 'ArrowRight' || k === 'KeyD') this.moveLane(1);
          else if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') { e.preventDefault(); this.jump(); }
          else if (k === 'ArrowDown' || k === 'KeyS') { e.preventDefault(); this.roll(); }
          else if (k === 'KeyP' || k === 'Escape') UI.pauseGame();
        } else if (this.state === 'paused' && (k === 'KeyP' || k === 'Escape')) {
          UI.resumeGame();
        }
        if (k === 'Space' && this.state !== 'menu') e.preventDefault();
      });

      // touch: swipe left/right = lane, swipe up = jump
      let tx = 0, ty = 0, tt = 0, swiped = false;
      this.canvas.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        tx = t.clientX; ty = t.clientY; tt = performance.now(); swiped = false;
      }, { passive: true });
      this.canvas.addEventListener('touchmove', (e) => {
        if (swiped || this.state !== 'running') return;
        const t = e.changedTouches[0];
        const dx = t.clientX - tx, dy = t.clientY - ty;
        if (Math.abs(dx) < 28 && Math.abs(dy) < 28) return;
        swiped = true;
        if (Math.abs(dx) > Math.abs(dy)) this.moveLane(dx > 0 ? 1 : -1);
        else if (dy < 0) this.jump();
        else this.roll();
      }, { passive: true });

    }

    moveLane(dir) {
      const next = Math.min(2, Math.max(0, this.lane + dir));
      if (next !== this.lane) {
        this.lane = next;
        GameAudio.sfx.lane();
      }
    }

    jump() {
      if (!this.airborne) {
        this.airborne = true;
        this.velY = JUMP_V;
        GameAudio.sfx.jump();
      }
    }

    roll() {
      if (this.rollT > 0) return;
      this.rollT = ROLL_TIME;
      // mid-air roll slams the tiger back to the ground, Subway Surfers style
      if (this.airborne) this.velY = Math.min(this.velY, -20);
      GameAudio.sfx.roll();
    }

    // ===== run lifecycle =====
    startRun(mode) {
      this.mode = mode;
      this.casual = Storage.settings.gameStyle === 'casual';
      this.score = 0;
      this.lives = 3;
      this.streak = 0;
      this.introT = 0;
      this.run = { correct: 0, wrong: 0, missed: 0, bestStreak: 0, distance: 0, targetsCleared: 0, livesLost: 0 };
      this.speed = this.casual ? CASUAL_SPEED : START_SPEED;
      this.lane = 1;
      this.tigerY = 0; this.velY = 0; this.airborne = false;
      this.invuln = 0;
      this.correctSinceTarget = 0;
      this.nextSpawnIn = 16;
      this.mathState = MathGen.createRun(mode, Storage.settings.maxTarget);
      this.target = MathGen.nextTarget(this.mathState);
      this.maxSpeedHit = false;
      this.waveId = 0;
      this.rollT = 0;
      this.tiger.setRoll(0);

      for (const o of this.objects) this.scene.remove(o.group);
      this.objects = [];
      this.world.reset();
      this.tiger.group.position.set(LANES[1], 0, 0);
      this.tiger.group.rotation.y = 0;

      UI.updateTarget(MathGen.targetLabel(mode), '–'); // revealed by the intro card
      UI.updateScore(0);
      UI.updateLives(this.casual ? Infinity : 3);

      // countdown 3..2..1
      this.state = 'countdown';
      this.countdownT = 3;
      UI.showCountdown(3);
      if (Storage.settings.music) GameAudio.startMusic();

      // achievement: both modes played (competitive only)
      if (!this.casual) {
        const played = JSON.parse(localStorage.getItem('tt_modes') || '{}');
        played[mode] = true;
        localStorage.setItem('tt_modes', JSON.stringify(played));
        if (played.multiples && played.factors) this.unlock('both_modes');
      }
    }

    unlock(id) {
      if (this.casual) return; // casual runs don't earn achievements
      const a = ACHIEVEMENTS.find(x => x.id === id);
      if (!a) return; // e.g. prime factor targets have no mastery badge
      if (Storage.unlock(id)) {
        UI.achievementToast(a);
        GameAudio.sfx.achievement();
      }
    }

    endRun(exited) {
      this.state = 'gameover';
      GameAudio.stopMusic();
      if (!exited) GameAudio.sfx.gameOver();

      const result = {
        mode: this.mode,
        casual: this.casual,
        score: Math.floor(this.score),
        correct: this.run.correct,
        wrong: this.run.wrong,
        missed: this.run.missed,
        bestStreak: this.run.bestStreak,
        distance: this.run.distance,
        targetsCleared: this.run.targetsCleared,
      };
      // casual runs are open-ended, so they don't count toward lifetime
      // records (best score, distance) — answer stats still accumulate
      if (!this.casual) Storage.recordRun(result);

      // run-end achievements
      this.unlock('first_run');
      if (result.score >= 500) this.unlock('score_500');
      if (result.score >= 1500) this.unlock('score_1500');
      if (result.score >= 4000) this.unlock('score_4000');
      if (result.correct >= 25) this.unlock('correct_25');
      if (result.targetsCleared >= 5) this.unlock('targets_5');
      if (Storage.lifetime.totalCorrect >= 250) this.unlock('lifetime_250');

      UI.showGameOver(result);
    }

    // ===== spawning =====
    spawnWave() {
      // out of unique correct values for this target -> move on to a new one
      if (!MathGen.hasCorrect(this.mathState)) {
        this.advanceTarget();
        return;
      }
      const wave = ++this.waveId;
      const r = Math.random();
      const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
      // numbers dominate — obstacles are seasoning, not the meal
      if (r < 0.68) {
        // numbers: 1 correct + 1-2 wrong
        this.spawnCoin(lanes[0], true, wave);
        this.spawnCoin(lanes[1], false, wave);
        if (Math.random() < 0.45) this.spawnCoin(lanes[2], false, wave);
      } else if (r < 0.85) {
        // obstacle wave: a vine gate to roll under, or 1-2 logs to jump
        if (Math.random() < 0.4) {
          this.spawnVine(lanes[0], wave);
        } else {
          this.spawnLog(lanes[0], wave);
          if (Math.random() < 0.5) this.spawnLog(lanes[1], wave);
        }
      } else {
        // mixed: obstacle + correct coin
        if (Math.random() < 0.35) this.spawnVine(lanes[0], wave);
        else this.spawnLog(lanes[0], wave);
        this.spawnCoin(lanes[1], true, wave);
        if (Math.random() < 0.35) this.spawnCoin(lanes[2], false, wave);
      }
    }

    spawnCoin(lane, isCorrect, wave) {
      const value = isCorrect
        ? MathGen.drawCorrect(this.mathState)
        : MathGen.drawWrong(this.mathState);
      if (value === undefined) return; // round fully collected; next wave advances
      const group = JungleWorld.makeNumberCoin(value);
      group.position.set(LANES[lane], 1.05, SPAWN_Z - Math.random() * 2);
      this.scene.add(group);
      this.objects.push({ group, type: 'coin', lane, value, isCorrect, wave, done: false, inert: false, bobPhase: Math.random() * 6 });
    }

    /** Each wave is one question: once any coin in it is taken (or its log is
        hit), the rest of the wave can no longer be collected or count as missed. */
    settleWave(wave) {
      for (const o of this.objects) {
        if (o.type === 'coin' && o.wave === wave && !o.done) o.inert = true;
      }
    }

    advanceTarget() {
      this.correctSinceTarget = 0;
      this.run.targetsCleared++;
      this.target = MathGen.nextTarget(this.mathState);
      GameAudio.sfx.newTarget();
      this.startTargetIntro();
    }

    /** Big center-screen target reveal: clear the path and hold spawns
        until the number docks at the top of the screen. */
    startTargetIntro() {
      this.introT = 1.9;
      this.nextSpawnIn = 18;
      this.clearPathObjects();
      UI.targetIntro(MathGen.targetLabel(this.mode), this.target);
    }

    clearPathObjects() {
      for (const o of this.objects) this.scene.remove(o.group);
      this.objects = [];
    }

    spawnLog(lane, wave) {
      const group = JungleWorld.makeLog();
      group.position.set(LANES[lane], 0, SPAWN_Z - Math.random() * 2);
      this.scene.add(group);
      this.objects.push({ group, type: 'log', lane, wave, done: false });
    }

    spawnVine(lane, wave) {
      const group = JungleWorld.makeVine();
      group.position.set(LANES[lane], 0, SPAWN_Z - Math.random() * 2);
      this.scene.add(group);
      this.objects.push({ group, type: 'vine', lane, wave, done: false });
    }

    // ===== effects =====
    burst(pos, color) {
      let used = 0;
      for (const p of this.particles) {
        if (p.life > 0) continue;
        p.life = 0.7;
        p.mesh.visible = true;
        p.mesh.material.color.setHex(color);
        p.mesh.material.opacity = 1;
        p.mesh.position.copy(pos);
        p.vel.set((Math.random() - 0.5) * 7, 3 + Math.random() * 5, (Math.random() - 0.5) * 7);
        if (++used >= 12) break;
      }
    }

    screenPos(worldPos) {
      const v = worldPos.clone().project(this.camera);
      return {
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight,
      };
    }

    // ===== collisions & outcomes =====
    collectCoin(o) {
      o.done = true;
      this.settleWave(o.wave); // one answer per wave
      Storage.recordAnswer(this.mode, this.target, o.isCorrect);
      const sp = this.screenPos(o.group.position);

      if (o.isCorrect) {
        MathGen.noteCollected(this.mathState, o.value);
        this.streak++;
        this.run.correct++;
        this.run.bestStreak = Math.max(this.run.bestStreak, this.streak);
        const mult = this.streak >= 10 ? 3 : this.streak >= 5 ? 2 : 1;
        const pts = 10 * mult;
        this.score += pts;
        GameAudio.sfx.correct(this.streak);
        UI.flash(true);
        UI.scorePop(sp.x, sp.y, `+${pts}`, true);
        if (mult > 1) UI.combo(`${this.streak} STREAK! ×${mult}`);
        this.burst(o.group.position, 0xffd54f);
        if (this.streak === 10) this.unlock('streak_10');
        if (this.streak === 20) this.unlock('streak_20');

        // cumulative fact mastery -> per-target achievements (competitive only)
        const mastered = this.casual ? null : Storage.recordMastery(this.mode, this.target, o.value);
        if (mastered !== null) {
          const total = this.mode === 'multiples'
            ? 12
            : MathGen.factorsOf(this.target).filter(f => f > 1).length;
          if (mastered >= total) {
            this.unlock(`${this.mode === 'multiples' ? 'mult' : 'fact'}_master_${this.target}`);
          }
        }

        this.correctSinceTarget++;
        if (this.correctSinceTarget >= MathGen.roundGoal(this.mathState)) this.advanceTarget();
      } else {
        this.streak = 0;
        this.run.wrong++;
        GameAudio.sfx.wrong();
        UI.flash(false);
        UI.shake();
        const why = this.mode === 'multiples'
          ? `${o.value} is not a multiple of ${this.target}`
          : `${o.value} is not a factor of ${this.target}`;
        UI.scorePop(sp.x, sp.y, `✖ ${why}`, false);
        this.burst(o.group.position, 0xd84315);
        if (this.casual) this.score = Math.max(0, this.score - 10); // points, not lives
        else this.loseLife();
      }
      this.scene.remove(o.group);
      UI.updateScore(Math.floor(this.score));
    }

    hitLog(o) {
      o.done = true;
      this.settleWave(o.wave); // crashing answers the wave — no extra miss penalty
      this.streak = 0;
      GameAudio.sfx.crash();
      UI.flash(false);
      UI.shake();
      const sp = this.screenPos(o.group.position);
      UI.scorePop(sp.x, sp.y, '✖ CRASH!', false);
      this.burst(o.group.position, 0x8d6e44);
      this.scene.remove(o.group);
      this.invuln = 1.2;
      this.loseLife();
    }

    hitVine(o) {
      o.done = true;
      this.settleWave(o.wave);
      this.streak = 0;
      GameAudio.sfx.crash();
      UI.flash(false);
      UI.shake();
      const sp = this.screenPos(o.group.position);
      UI.scorePop(sp.x, sp.y, '✖ TANGLED! Roll under vines!', false);
      this.burst(o.group.position, 0x66bb6a);
      this.scene.remove(o.group);
      this.invuln = 1.2;
      this.loseLife();
    }

    loseLife() {
      if (this.casual) return; // no lives in casual — crash feedback is enough
      this.lives--;
      this.run.livesLost++;
      UI.updateLives(this.lives);
      if (this.lives <= 0) this.endRun(false);
    }

    // ===== main loop =====
    frame(t) {
      requestAnimationFrame((t2) => this.frame(t2));
      const dt = Math.min((t - this.lastTime) / 1000, 0.05);
      this.lastTime = t;

      if (this.state === 'countdown') {
        this.countdownT -= dt;
        const n = Math.ceil(this.countdownT);
        UI.showCountdown(n > 0 ? n : 'GO!');
        this.tiger.update(dt, START_SPEED * 0.4, false);
        if (this.countdownT <= -0.5) {
          UI.hideCountdown();
          this.state = 'running';
          this.startTargetIntro(); // reveal the first target front and center
        }
      } else if (this.state === 'running') {
        this.tick(dt);
      } else if (this.state === 'menu') {
        // idle tiger trot behind the menu
        this.tiger.update(dt, 6, false);
        this.world.update(dt, 4);
      }

      this.renderer.render(this.scene, this.camera);
    }

    tick(dt) {
      // speed ramp (casual holds a calm, constant pace)
      if (!this.casual) {
        this.speed = Math.min(MAX_SPEED, this.speed + SPEED_RAMP * dt);
        if (this.speed >= MAX_SPEED && !this.maxSpeedHit) { this.maxSpeedHit = true; this.unlock('max_speed'); }
      }
      this.run.distance += this.speed * dt;
      if (this.invuln > 0) this.invuln -= dt;

      // small trickle of distance points
      this.score += this.speed * dt * 0.06;

      // tiger lane glide + jump physics
      const targetX = LANES[this.lane];
      const tg = this.tiger.group;
      tg.position.x += (targetX - tg.position.x) * Math.min(1, dt * 12);
      tg.rotation.y = (targetX - tg.position.x) * -0.08;
      tg.rotation.z = (targetX - tg.position.x) * -0.05;

      if (this.airborne) {
        this.velY -= GRAVITY * dt;
        this.tigerY += this.velY * dt;
        if (this.tigerY <= 0) { this.tigerY = 0; this.velY = 0; this.airborne = false; }
      }
      tg.position.y = this.tigerY;
      this.tiger.update(dt, this.speed, this.airborne);
      // forward tumble
      if (this.rollT > 0) {
        this.rollT -= dt;
        const p = 1 - Math.max(0, this.rollT) / ROLL_TIME;
        this.tiger.setRoll(-p * Math.PI * 2);
        if (this.rollT <= 0) this.tiger.setRoll(0);
      }
      // blink while invulnerable
      tg.visible = this.invuln > 0 ? Math.floor(this.invuln * 12) % 2 === 0 : true;

      // camera follows lane slightly
      this.camera.position.x += (tg.position.x * 0.42 - this.camera.position.x) * Math.min(1, dt * 6);

      // world + spawning (held while the target intro is on screen)
      this.world.update(dt, this.speed);
      if (this.introT > 0) {
        this.introT -= dt;
      } else {
        this.nextSpawnIn -= this.speed * dt;
        if (this.nextSpawnIn <= 0) {
          this.spawnWave();
          // gap shrinks a bit as speed grows, keeps reaction time fair;
          // casual waves sit farther apart to leave room for thought
          this.nextSpawnIn = this.casual
            ? 31 + Math.random() * 8
            : 19 + Math.random() * 8 + (this.speed - START_SPEED) * 0.35;
        }
      }

      // move & collide objects
      for (let i = this.objects.length - 1; i >= 0; i--) {
        const o = this.objects[i];
        o.group.position.z += this.speed * dt;
        if (o.type === 'coin') {
          o.bobPhase += dt * 3;
          o.group.position.y = 1.05 + Math.sin(o.bobPhase) * 0.12;
          o.group.userData.coinMesh.rotation.z = Math.sin(o.bobPhase * 0.7) * 0.18;
          if (o.flashT > 0) { // missed coin blinks red as it leaves
            o.flashT -= dt;
            o.group.visible = Math.floor(o.flashT * 14) % 2 === 0;
            if (o.flashT <= 0) o.group.visible = true;
          }
        }
        const z = o.group.position.z;
        if (!o.done && !o.inert && z > -1.0 && z < 1.1 && o.lane === this.lane) {
          if (o.type === 'coin' && this.tigerY < 1.25) this.collectCoin(o);
          else if (o.type === 'log' && this.tigerY < 0.95 && this.invuln <= 0) this.hitLog(o);
          else if (o.type === 'vine' && this.rollT <= 0 && this.invuln <= 0) this.hitVine(o);
          if (this.state !== 'running') return; // run ended inside handler
        }
        // letting a correct number slip past costs points
        if (o.type === 'coin' && o.isCorrect && !o.done && !o.inert && !o.missed && z > 1.6) {
          o.missed = true;
          o.flashT = 0.6;
          this.score = Math.max(0, this.score - 5);
          this.run.missed++;
          this.streak = 0;
          GameAudio.sfx.miss();
          JungleWorld.tintCoinRed(o.group);
          const sp = this.screenPos(o.group.position);
          UI.scorePop(sp.x, sp.y, `-5 missed ${o.value}!`, false);
          UI.updateScore(Math.floor(this.score));
        }
        if (z > DESPAWN_Z || o.done) {
          if (!o.done) this.scene.remove(o.group);
          this.objects.splice(i, 1);
        }
      }

      // particles
      for (const p of this.particles) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.vel.y -= 14 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.position.z += this.speed * dt;
        p.mesh.rotation.x += dt * 9;
        p.mesh.rotation.y += dt * 7;
        p.mesh.material.opacity = Math.max(0, p.life / 0.7);
        if (p.life <= 0) p.mesh.visible = false;
      }

      // mid-run achievement: untouchable
      if (this.run.livesLost === 0 && this.score >= 1000) this.unlock('no_miss_1000');

      UI.updateScore(Math.floor(this.score));
    }

    pause() { if (this.state === 'running') this.state = 'paused'; }
    resume() { if (this.state === 'paused') this.state = 'running'; }
    backToMenu() {
      this.state = 'menu';
      GameAudio.stopMusic();
      for (const o of this.objects) this.scene.remove(o.group);
      this.objects = [];
      this.tiger.group.position.set(0, 0, 0);
      this.tigerY = 0; this.airborne = false;
      this.tiger.group.visible = true;
      this.camera.position.x = 0;
    }
  }

  window.Game = Game;
})();
