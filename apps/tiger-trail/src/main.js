/* Bootstrap: create the game, wire the UI, unlock audio on first gesture. */
(function () {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const game = new Game(canvas);
  UI.init(game);
  window.game = game; // handy for debugging from the console

  // Browsers require a user gesture before audio can start.
  const unlock = () => {
    GameAudio.unlock();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // Enter saves initials on the game-over screen.
  document.getElementById('initials-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-save-score').click();
  });

  // Register the service worker for offline play + PWA install. Only runs when
  // served over http(s); silently skipped on file:// (double-click) and Electron.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode unavailable; game still works */ });
    });
  }

  // Keep the page from scrolling/zooming on mobile.
  document.addEventListener('touchmove', (e) => {
    if (e.target.closest('.menu-panel')) return; // allow scrolling inside panels
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) e.preventDefault();
  });
})();
