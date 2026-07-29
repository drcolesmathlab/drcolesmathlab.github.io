/* UI: screen navigation, HUD, leaderboard, stats, achievements, settings. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let game = null;
  let selectedMode = 'multiples';
  let settingsReturn = 'menu';   // where the settings Back button goes
  let bannerTimer = null;
  let comboTimer = null;
  let pendingResult = null;
  let currentBoard = 'multiples';

  const SCREENS = ['menu', 'howto', 'leaderboard', 'stats', 'settings', 'pause', 'gameover'];

  function showScreen(name) {
    for (const s of SCREENS) $(`screen-${s}`).classList.toggle('visible', s === name);
    $('hud').classList.toggle('hidden', !(name === null));
    if (name !== null) $('target-intro').classList.add('hidden');
  }
  function hideAllScreens() { showScreen(null); }

  const UI = {
    init(g) {
      game = g;

      // ----- main menu -----
      const modeBtns = document.querySelectorAll('.btn-mode');
      const selectMode = (m) => {
        selectedMode = m;
        modeBtns.forEach(b => b.classList.toggle('selected', b.dataset.mode === m));
      };
      modeBtns.forEach(b => b.addEventListener('click', () => { GameAudio.sfx.click(); selectMode(b.dataset.mode); }));
      selectMode('multiples');

      // casual / competitive toggle (persisted)
      const styleBtns = document.querySelectorAll('.btn-style');
      const selectStyle = (st) => {
        Storage.settings.gameStyle = st;
        Storage.saveSettings();
        styleBtns.forEach(b => b.classList.toggle('selected', b.dataset.style === st));
      };
      styleBtns.forEach(b => b.addEventListener('click', () => { GameAudio.sfx.click(); selectStyle(b.dataset.style); }));
      selectStyle(Storage.settings.gameStyle || 'competitive');

      $('btn-start').addEventListener('click', () => { GameAudio.sfx.click(); this.startGame(); });
      $('btn-leaderboard').addEventListener('click', () => { GameAudio.sfx.click(); this.renderBoard(currentBoard); showScreen('leaderboard'); });
      $('btn-stats').addEventListener('click', () => { GameAudio.sfx.click(); this.renderStats(); showScreen('stats'); });
      $('btn-settings').addEventListener('click', () => { GameAudio.sfx.click(); settingsReturn = 'menu'; showScreen('settings'); });
      $('btn-howto').addEventListener('click', () => { GameAudio.sfx.click(); showScreen('howto'); });

      // back buttons
      document.querySelectorAll('.back-btn').forEach(b => b.addEventListener('click', () => {
        GameAudio.sfx.click();
        if (b.closest('#screen-settings') && settingsReturn === 'pause') showScreen('pause');
        else showScreen('menu');
      }));

      // ----- leaderboard tabs -----
      document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
        GameAudio.sfx.click();
        document.querySelectorAll('.tab-btn').forEach(x => x.classList.toggle('active', x === b));
        this.renderBoard(b.dataset.board);
      }));

      // ----- settings -----
      const s = Storage.settings;
      $('set-sfx').checked = s.sfx;
      $('set-music').checked = s.music;
      $('set-volume').value = Math.round(s.volume * 100);
      $('set-quality').value = s.quality;
      $('set-range').value = String(s.maxTarget);
      $('set-sfx').addEventListener('change', e => { s.sfx = e.target.checked; Storage.saveSettings(); game.applySettings(); GameAudio.sfx.click(); });
      $('set-music').addEventListener('change', e => {
        s.music = e.target.checked; Storage.saveSettings();
        if (!s.music) GameAudio.stopMusic();
        else if (game.state === 'running' || game.state === 'paused' || game.state === 'countdown') GameAudio.startMusic();
      });
      $('set-volume').addEventListener('input', e => { s.volume = e.target.value / 100; Storage.saveSettings(); game.applySettings(); });
      $('set-quality').addEventListener('change', e => { s.quality = e.target.value; Storage.saveSettings(); game.applySettings(); });
      $('set-range').addEventListener('change', e => { s.maxTarget = Number(e.target.value); Storage.saveSettings(); });
      $('btn-reset-data').addEventListener('click', () => {
        if (confirm('Erase ALL scores, stats, achievements and settings?')) {
          Storage.resetAll();
          location.reload();
        }
      });

      // ----- in-game buttons -----
      $('btn-pause').addEventListener('click', () => this.pauseGame());
      $('btn-game-settings').addEventListener('click', () => {
        GameAudio.sfx.click();
        game.pause();
        settingsReturn = 'pause';
        showScreen('settings');
      });
      $('btn-exit').addEventListener('click', () => { GameAudio.sfx.click(); game.pause(); game.endRun(true); });
      $('btn-resume').addEventListener('click', () => this.resumeGame());
      $('btn-pause-settings').addEventListener('click', () => { GameAudio.sfx.click(); settingsReturn = 'pause'; showScreen('settings'); });
      $('btn-pause-exit').addEventListener('click', () => { GameAudio.sfx.click(); game.endRun(true); });

      // ----- game over -----
      $('btn-play-again').addEventListener('click', () => { GameAudio.sfx.click(); this.startGame(); });
      $('btn-gameover-menu').addEventListener('click', () => { GameAudio.sfx.click(); game.backToMenu(); showScreen('menu'); });
      $('initials-input').addEventListener('input', e => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      });
      $('btn-save-score').addEventListener('click', () => {
        const name = $('initials-input').value || 'AAA';
        Storage.addScore(pendingResult.mode, name, pendingResult.score);
        GameAudio.sfx.highScore();
        $('initials-entry').classList.add('hidden');
        $('gameover-buttons').classList.remove('hidden');
      });
    },

    startGame() {
      hideAllScreens();
      game.backToMenu();           // clean slate
      game.startRun(selectedMode);
    },

    pauseGame() {
      if (game.state !== 'running') return;
      GameAudio.sfx.click();
      game.pause();
      showScreen('pause');
    },
    resumeGame() {
      GameAudio.sfx.click();
      hideAllScreens();
      game.resume();
    },

    // ----- HUD -----
    updateTarget(label, target) {
      $('hud-target-label').textContent = label;
      $('hud-target').textContent = target;
    },
    updateScore(score) { $('hud-score').textContent = score; },
    updateLives(lives) {
      $('hud-lives').textContent = lives === Infinity
        ? '🌴' // casual: no lives to lose
        : '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
    },

    showCountdown(v) {
      const el = $('countdown');
      el.classList.remove('hidden');
      if (el.textContent !== String(v)) {
        el.textContent = v;
        el.style.animation = 'none';
        void el.offsetWidth; // restart pulse
        el.style.animation = '';
      }
    },
    hideCountdown() { $('countdown').classList.add('hidden'); },

    banner(text, ms = 1600) {
      const el = $('hud-banner');
      el.textContent = text;
      el.classList.remove('hidden');
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => el.classList.add('hidden'), ms);
    },
    combo(text) {
      const el = $('hud-combo');
      el.textContent = text;
      el.classList.remove('hidden');
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
      clearTimeout(comboTimer);
      comboTimer = setTimeout(() => el.classList.add('hidden'), 1200);
    },
    achievementToast(a) {
      this.banner(`🏅 Achievement: ${a.name}!`, 2400);
    },

    /** Big target reveal in the center of the screen, then it flies up and
        docks into the HUD target box. */
    targetIntro(label, value) {
      const el = $('target-intro');
      clearTimeout(this._tiDock);
      clearTimeout(this._tiHide);
      el.querySelector('.ti-label').textContent = label;
      el.querySelector('.ti-value').textContent = value;
      el.classList.add('hidden');
      el.classList.remove('dock');
      void el.offsetWidth; // restart pop-in animation
      el.classList.remove('hidden');
      this._tiDock = setTimeout(() => {
        el.classList.add('dock');
        this.updateTarget(label, value);
      }, 1200);
      this._tiHide = setTimeout(() => el.classList.add('hidden'), 1850);
    },

    scorePop(x, y, text, good) {
      const el = document.createElement('div');
      el.className = `score-pop ${good ? 'good' : 'bad'}`;
      el.textContent = text;
      el.style.left = `${Math.min(Math.max(x, 70), window.innerWidth - 70)}px`;
      el.style.top = `${Math.min(Math.max(y, 80), window.innerHeight - 60)}px`;
      if (!good) el.style.fontSize = '1.05rem';
      $('popup-layer').appendChild(el);
      setTimeout(() => el.remove(), 1050);
    },

    flash(good) {
      const app = $('app');
      app.classList.remove('flash-good', 'flash-bad');
      void app.offsetWidth;
      app.classList.add(good ? 'flash-good' : 'flash-bad');
    },
    shake() {
      const app = $('app');
      app.classList.remove('shake');
      void app.offsetWidth;
      app.classList.add('shake');
    },

    // ----- game over -----
    showGameOver(result) {
      pendingResult = result;
      $('gameover-title').textContent = result.casual
        ? '🌴 Trail Complete!'
        : (result.correct >= 15 ? '🌟 Great Run!' : 'Game Over');
      $('gameover-score').textContent = result.score;
      const acc = result.correct + result.wrong > 0
        ? Math.round((result.correct / (result.correct + result.wrong)) * 100) : 0;
      $('gameover-detail').innerHTML =
        `✅ ${result.correct} correct &nbsp; ❌ ${result.wrong} wrong &nbsp; ⚠️ ${result.missed || 0} missed &nbsp; (${acc}% accuracy)<br>` +
        `🔥 Best streak: ${result.bestStreak} &nbsp; 🏃 Distance: ${Math.round(result.distance)} m`;
      const qualifies = !result.casual && Storage.qualifies(result.mode, result.score);
      $('initials-entry').classList.toggle('hidden', !qualifies);
      $('gameover-buttons').classList.toggle('hidden', qualifies);
      if (qualifies) {
        GameAudio.sfx.highScore();
        $('initials-input').value = '';
        setTimeout(() => $('initials-input').focus(), 300);
      }
      showScreen('gameover');
    },

    // ----- leaderboard -----
    renderBoard(mode) {
      currentBoard = mode;
      const list = $('leaderboard-list');
      list.innerHTML = '';
      const board = Storage.getBoard(mode);
      if (!board.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'No scores yet — be the first!';
        list.appendChild(li);
        return;
      }
      board.forEach((e, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="board-rank">${i + 1}.</span>` +
          `<span class="board-name">${e.name}</span>` +
          `<span class="board-score">${e.score}</span>`;
        list.appendChild(li);
      });
    },

    // ----- stats & achievements -----
    renderStats() {
      const lt = Storage.lifetime;
      const total = lt.totalCorrect + lt.totalWrong;
      const acc = total ? Math.round((lt.totalCorrect / total) * 100) : 0;
      $('lifetime-stats').innerHTML = [
        ['Runs', lt.runs],
        ['Best Score', lt.bestScore],
        ['Correct', lt.totalCorrect],
        ['Wrong', lt.totalWrong],
        ['Accuracy', `${acc}%`],
        ['Best Streak', lt.bestStreak],
      ].map(([k, v]) => `<div class="lt-stat"><b>${v}</b>${k}</div>`).join('');

      const spots = Storage.getSpots();
      const label = (s) => `${s.mode === 'multiples' ? 'Multiples of' : 'Factors of'} ${s.target}`;
      const row = (s, cls) =>
        `<div class="spot ${cls}"><span>${label(s)}</span>` +
        `<span class="pct">${s.pct}% <small>(${s.correct}/${s.attempts})</small></span></div>`;

      const trouble = spots.filter(s => s.pct < 70).slice(0, 6);
      const success = spots.filter(s => s.pct >= 85).slice(-6).reverse();
      $('trouble-spots').innerHTML = trouble.length
        ? trouble.map(s => row(s, 'bad')).join('')
        : '<div class="spot-empty">No trouble spots — keep playing to find out!</div>';
      $('success-spots').innerHTML = success.length
        ? success.map(s => row(s, 'good')).join('')
        : '<div class="spot-empty">Collect more numbers to reveal your strengths.</div>';

      const GROUP_TITLES = { general: '🌟 Adventure', mult: '✖️ Multiplication Mastery', fact: '➗ Factor Mastery' };
      let lastGroup = null;
      $('achievement-list').innerHTML = window.ACHIEVEMENTS.map(a => {
        const got = Storage.isUnlocked(a.id);
        let html = '';
        if (a.group !== lastGroup) {
          lastGroup = a.group;
          html += `<div class="ach-group">${GROUP_TITLES[a.group] || ''}</div>`;
        }
        let progress = '';
        if (a.mastery) {
          const cur = Math.min(
            Storage.getMasteryCount(a.mastery.mode, a.mastery.target),
            a.mastery.total
          );
          const pct = Math.round((cur / a.mastery.total) * 100);
          progress = `<div class="ach-progress"><div class="ach-bar"><div class="ach-fill" style="width:${pct}%"></div></div>` +
            `<span class="ach-count">${cur}/${a.mastery.total}</span></div>`;
        }
        html += `<div class="ach ${got ? '' : 'locked'}">` +
          `<span class="ach-icon">${got ? a.icon : (a.mastery ? a.icon : '🔒')}</span>` +
          `<div class="ach-body"><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div>${progress}</div></div>`;
        return html;
      }).join('');
    },
  };

  window.UI = UI;
})();
