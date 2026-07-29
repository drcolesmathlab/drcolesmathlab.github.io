/* character.js — neon balance guy: tilt, wobble, fall, celebrate */
(function () {
  'use strict';
  let scene, stage, tiltG, guy, fallen, stars, loadL, loadR;

  function init() {
    scene = document.getElementById('scene');
    stage = document.getElementById('stage');
    tiltG = document.getElementById('tiltG');
    guy = document.getElementById('guy');
    fallen = document.getElementById('fallen');
    stars = document.getElementById('stars');
    loadL = document.getElementById('loadL');
    loadR = document.getElementById('loadR');
  }

  // Weight on the side that got heavier — binary: either loaded or not.
  function setLoad(el, on) {
    el.style.opacity = on ? '.95' : '0';
    el.style.transform = on ? 'scaleY(1)' : 'scaleY(.25)';
  }

  function setTilt(deg) {
    tiltG.style.transform = 'rotate(' + deg + 'deg)';
    const tipped = Math.abs(deg) > 0.5;
    guy.classList.toggle('wobble', tipped);
    scene.classList.toggle('warn', tipped);
    setLoad(loadL, deg < -0.5); // deg<0 => left end dips
    setLoad(loadR, deg > 0.5);
  }

  function fall(done) {
    guy.classList.remove('wobble');
    setLoad(loadL, 0); setLoad(loadR, 0);
    scene.classList.remove('warn');
    scene.classList.add('crashed');
    tiltG.style.transform = 'rotate(40deg)';
    guy.classList.add('fall');
    setTimeout(function () {
      guy.style.visibility = 'hidden';
      fallen.classList.remove('hide');
      stars.classList.remove('hide');
      stage.classList.add('shake');
    }, 700);
    setTimeout(function () {
      stage.classList.remove('shake');
      if (done) done();
    }, 1500);
  }

  function celebrate() {
    scene.classList.add('win');
    guy.classList.remove('wobble');
    guy.classList.add('jump');
    setTimeout(function () {
      scene.classList.remove('win');
      guy.classList.remove('jump');
    }, 900);
  }

  function reset() {
    tiltG.style.transform = 'rotate(0deg)';
    setLoad(loadL, 0); setLoad(loadR, 0);
    guy.classList.remove('fall', 'wobble', 'jump');
    guy.style.visibility = '';
    fallen.classList.add('hide');
    stars.classList.add('hide');
    scene.classList.remove('warn', 'win', 'crashed');
    stage.classList.remove('shake');
  }

  window.Character = { init: init, setTilt: setTilt, fall: fall, celebrate: celebrate, reset: reset };
})();
