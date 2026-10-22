#!/usr/bin/env node
/*
 * vendor-balancing-act.js — copies Balancing Act into apps/balancing-act/ and patches it.
 *
 * Like Tiger Trail this needs no code transformation: four classic IIFE scripts, no CDN,
 * no external fonts, no images (the character is inline SVG), all audio synthesised with
 * the Web Audio API. It already runs from file://.
 *
 * ── WHY THE FILE LIST IS EXPLICIT ─────────────────────────────────────────────
 * Never `cp -R` the upstream folder. It contains `tpt-package/`: ~69 MB of gameplay
 * video, another party's commercial branding ("ThriveForge Academy"), and Terms-of-Use
 * PDFs for a paid classroom product. This repository is public in order to serve GitHub
 * Pages, so copying that folder would publish someone else's commercial assets.
 *
 * `server.js` is also skipped — it is a local dev static server, and nothing in the app
 * makes a network request of any kind.
 *
 * ── LOCAL FILES ───────────────────────────────────────────────────────────────
 * `a11y.css` and `js/a11y.js` are not upstream. They hold the accessibility layer
 * (screen-reader announcements, dialog focus, control names, contrast, target size,
 * zoom reflow) and live only in this repository. A re-vendor leaves them alone and
 * re-links them, so the upstream files stay untouched and nothing is lost.
 *
 * Usage:  node tools/vendor-balancing-act.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const OUT = path.join(REPO, 'apps', 'balancing-act');

const SRC = path.resolve(
  REPO,
  '..',
  'LinkedInShowcase',
  'Math Apps',
  'Game-Balancing App Equation Solver'
);

// By name, never by directory. See the note above.
const COPY = [
  'index.html',
  'style.css',
  'js/algebra.js',
  'js/audio.js',
  'js/character.js',
  'js/game.js',
];

// Ours, not upstream: kept across re-vendors and linked into index.html below.
const LOCAL = ['a11y.css', 'js/a11y.js'];

let failures = 0;
function must(cond, msg) {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    failures++;
  }
  return cond;
}

/*
 * Palette harmonisation. The two palettes are the same family — arcade neon on
 * near-black — but the hexes differ, and eight pixels below the site chrome that
 * difference reads as a mistake rather than a choice.
 *
 * Every pair passes WCAG AA before and after; this is cosmetic, not a fix. The one
 * genuine improvement is --dim, which goes from 4.61:1 to 5.22:1 on the panel surface.
 *
 * Deliberately NOT changed: the monospace font stack. It does real work aligning the
 * equation ledger into columns, which is the whole pedagogical point of the app.
 */
const PALETTE = [
  ['--bg: #04040a',      '--bg: #050610'],   // Math Lab --bg
  ['--panel: #0a0a16',   '--panel: #0c0b1d'], // --sf
  ['--edge: #17172e',    '--edge: #141328'],  // --sf2
  ['--cyan: #2ee6ff',    '--cyan: #00d4ff'],  // --tc
  ['--magenta: #ff47e0', '--magenta: #bb55ff'], // --ax
  ['--green: #49ff6e',   '--green: #00ff7f'], // --rc
  ['--yellow: #ffe94a',  '--yellow: #ffcc00'], // --oc
  ['--red: #ff3b5c',     '--red: #ff3355'],   // --dc
  ['--text: #d7f6ff',    '--text: #eef2ff'],  // --tx
  ['--dim: #5f7ca6',     '--dim: #7a83a8'],   // --mu
];

// WIPEOUT: upstream's full-screen dialog, and ours (see the HTML_RULES note in main).
const GAMEOVER_UPSTREAM = [
  '<div id="gameover" class="overlay hide">',
  '  <h1 class="title red">WIPEOUT!</h1>',
  '  <p>He hit the ground… the answer was <b id="goAnswer" class="glow-yel"></b></p>',
  '  <div class="final">STREAK <b id="goScore">0</b> · BEST <b id="goBest">0</b></div>',
  '  <div class="row">',
  '    <button id="btnRetry" class="btn c-green">TRY AGAIN</button>',
  '    <button id="btnGoMenu" class="btn c-dim">MENU</button>',
  '  </div>',
  '</div>',
].join('\n');
const GAMEOVER_OURS = [
  '<div id="gameover" class="overlay hide">',
  '  <div class="go-card">',
  '    <h1 class="title red">WIPEOUT!</h1>',
  '    <p id="goReason"></p>',
  '    <p>He hit the ground… the answer was <b id="goAnswer" class="glow-yel"></b></p>',
  '    <div class="final">STREAK <b id="goScore">0</b> · BEST <b id="goBest">0</b></div>',
  '    <div class="row">',
  '      <button id="btnLastValid" class="btn c-yel">LAST VALID STEP</button>',
  '      <button id="btnRetry" class="btn c-green">RETRY</button>',
  '      <button id="btnNewGame" class="btn c-cyan">NEW GAME</button>',
  '    </div>',
  '  </div>',
  '</div>',
].join('\n');

function main() {
  console.log('Vendoring apps/balancing-act/ …');

  if (!fs.existsSync(SRC)) {
    console.error(`\n✗ Source tree not found:\n  ${SRC}\n`);
    process.exit(1);
  }

  /*
   * The losing rules are ours, in game.js itself: SUBMIT a wrong x, or take a next
   * step while the figure is tipped, and the run ends, with the WIPEOUT screen saying
   * why. They are too woven into the step logic to patch in here, so a re-vendor of
   * an upstream game.js without them would silently bring back the old rule (only a
   * wrong answer loses). Apply docs/balancing-act-upstream/ upstream first; this
   * stops before anything is overwritten.
   */
  const upGame = path.join(SRC, 'js/game.js');
  if (fs.existsSync(upGame) && !fs.readFileSync(upGame, 'utf8').includes('function tippedReason(')) {
    console.error(
      '\n✗ Upstream js/game.js lacks the Math Lab losing rules (function tippedReason).\n' +
      '  Apply docs/balancing-act-upstream/ to the upstream folder (see its README), then re-run.\n' +
      '  Nothing was copied.\n'
    );
    process.exit(1);
  }

  /*
   * The number modes (Integer, Decimal, Fraction) are ours too, across algebra.js,
   * game.js and index.html. An upstream algebra.js without them would silently take
   * the Decimal and Fraction Modes away. Same remedy: apply docs/balancing-act-upstream/
   * number-modes.patch and number-modes.css upstream first.
   */
  const upAlgebra = path.join(SRC, 'js/algebra.js');
  if (fs.existsSync(upAlgebra) && !fs.readFileSync(upAlgebra, 'utf8').includes('function setNumbers(')) {
    console.error(
      '\n✗ Upstream js/algebra.js lacks the Math Lab number modes (function setNumbers).\n' +
      '  Apply docs/balancing-act-upstream/ to the upstream folder (see its README), then re-run.\n' +
      '  Nothing was copied.\n'
    );
    process.exit(1);
  }

  /*
   * A × / ÷ step strikes the factor only when it cancels every term on the side:
   * 5(x/5 + 3) can't strike the 5, because the 3 still needs it. An upstream
   * algebra.js without this would bring back the struck 5. Same remedy: apply
   * docs/balancing-act-upstream/cancel-only-when-all-cancel.patch upstream first.
   */
  if (fs.existsSync(upAlgebra) && !fs.readFileSync(upAlgebra, 'utf8').includes('shown.every(t => cancelsToUnit(')) {
    console.error(
      '\n✗ Upstream js/algebra.js still strikes a factor that has to be distributed (renderCancelSide).\n' +
      '  Apply docs/balancing-act-upstream/ to the upstream folder (see its README), then re-run.\n' +
      '  Nothing was copied.\n'
    );
    process.exit(1);
  }

  for (const rel of COPY) {
    const from = path.join(SRC, rel);
    if (!must(fs.existsSync(from), `missing source file: ${rel}`)) continue;
    const to = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
  if (failures) {
    console.error(`\n✗ ${failures} file(s) missing — stopping.\n`);
    process.exit(1);
  }

  // Belt and braces: prove none of the excluded material came along.
  const copied = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else copied.push(path.relative(OUT, abs));
    }
  })(OUT);
  const known = COPY.concat(LOCAL);
  must(
    copied.every((f) => known.includes(f)),
    `unexpected files in apps/balancing-act/: ${copied.filter((f) => !known.includes(f)).join(', ')}`
  );
  for (const rel of LOCAL) must(copied.includes(rel), `missing local file ${rel} — the accessibility layer would be lost`);
  must(
    !copied.some((f) => /tpt|thriveforge|\.mov$|\.pdf$/i.test(f)),
    'commercial TPT material must never be vendored into this public repository'
  );

  /* ── stylesheet: fonts, palette, reduced motion ────────────────────────── */
  const cssPath = path.join(OUT, 'style.css');
  let css = fs.readFileSync(cssPath, 'utf8');
  must(!/@import|https?:\/\//.test(css), 'unexpected external reference in style.css');

  for (const [from, to] of PALETTE) {
    must(css.includes(from), `expected "${from}" in style.css — upstream palette may have changed`);
    css = css.split(from).join(to);
  }
  // The one hardcoded colour outside :root — the top-of-page glow behind the beam.
  must(css.includes('#0a0a1e'), 'expected the body radial-gradient colour');
  css = css.replace('#0a0a1e', '#101024');

  css =
    `/*\n` +
    ` * Balancing Act styles, vendored from the upstream project's style.css.\n` +
    ` *\n` +
    ` * Changes from upstream:\n` +
    ` *   - palette remapped to the Math Lab tokens (same family, different hexes —\n` +
    ` *     cosmetic, since every pair already passed AA; --dim improves 4.61 -> 5.22)\n` +
    ` *   - a prefers-reduced-motion guard on the tilt/fall/dazed animations\n` +
    ` *\n` +
    ` * The monospace font stack is deliberately kept: it aligns the equation ledger\n` +
    ` * into columns, which is the point of the column method this app teaches.\n` +
    ` */\n\n` +
    `/* FONTS:START */\n/* FONTS:END */\n\n` +
    css.trimEnd() +
    `

/* ── Additions for the Math Lab showcase (not upstream) ───────────────────── */

/* The beam tilt is informative — it shows the equation is unbalanced — so it is
   collapsed to near-instant rather than removed. The decorative dazed-stars spin
   is switched off entirely. */
@media (prefers-reduced-motion: reduce){
  #stars{display:none}
  *,*::before,*::after{
    animation-duration:.01ms !important;
    animation-iteration-count:1 !important;
    transition-duration:.01ms !important;
  }
}
`;
  fs.writeFileSync(cssPath, css);

  /* ── index.html: title, theme-color, live region ───────────────────────── */
  const htmlPath = path.join(OUT, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  html = html.replace(
    /<title>[^<]*<\/title>/,
    "<title>Balancing Act — Dr. Cole's Math Lab</title>"
  );

  must(/content="#04040a"/.test(html), 'expected the upstream theme-color');
  html = html.replace('content="#04040a"', 'content="#050610"');

  /*
   * The live region. #message is already the app's single feedback channel — it
   * carries "correct", "not balanced", and the property-of-equality names — and it
   * only changes on meaningful events. Marking it role="status" means every one of
   * those messages is announced, with no change to a line of JavaScript.
   *
   * The STREAK/BEST readout is deliberately NOT a live region: updateHud() runs on
   * every keypad press, so announcing it would talk over the player constantly. js/a11y.js
   * says the streak once per new equation instead.
   */
  must(/<div id="message">/.test(html), 'expected the #message element');
  html = html.replace(
    '<div id="message">',
    '<div id="message" role="status" aria-live="polite" aria-atomic="true">'
  );

  must(
    /<svg id="scene"[^>]*role="img"[^>]*aria-label=/.test(html),
    'expected the scene SVG to already carry role="img" and aria-label'
  );
  // The accessibility layer: its stylesheet after the game's, its script after game.js
  // (it wraps window.Character, so it must load after character.js).
  must(html.includes('<link rel="stylesheet" href="style.css">'), 'expected the style.css link');
  html = html.replace(
    '<link rel="stylesheet" href="style.css">',
    '<link rel="stylesheet" href="style.css">\n<link rel="stylesheet" href="a11y.css">'
  );
  must(html.includes('<script src="js/game.js"></script>'), 'expected the game.js script tag');
  html = html.replace(
    '<script src="js/game.js"></script>',
    '<script src="js/game.js"></script>\n<script src="js/a11y.js"></script>'
  );

  // The losing rules (see game.js): the menu's how-to says the next step must match,
  // and WIPEOUT becomes a panel over the work log with a line saying which rule ended
  // the run and three ways back in: Last Valid Step, Retry, New Game.
  const HTML_RULES = [
    [
      'then <b>match it on the other side</b> before he tips too far.',
      "then <b>match it on the other side</b> as your very next step.\n" +
        "    Any other step while he's tipped knocks him off the line.",
    ],
    ['A wrong answer knocks him off the line!', 'A wrong answer knocks him off too!'],
    [GAMEOVER_UPSTREAM, GAMEOVER_OURS],
  ];
  // Once docs/balancing-act-upstream/ is applied upstream these are already in
  // place, so each rule is skipped when its result is already there.
  for (const [from, to] of HTML_RULES) {
    if (html.includes(to)) continue;
    must(html.includes(from), `expected "${from}" in index.html — upstream text may have changed`);
    html = html.replace(from, to);
  }

  must(!/https?:\/\/(?!www\.w3\.org)/.test(html), 'an absolute URL survived in the HTML');
  fs.writeFileSync(htmlPath, html);

  if (failures) {
    console.error(`\n✗ ${failures} assertion(s) failed.\n`);
    process.exit(1);
  }

  let bytes = 0;
  for (const rel of COPY) bytes += fs.statSync(path.join(OUT, rel)).size;
  console.log(`  ✓ ${COPY.length} files, ${(bytes / 1024).toFixed(0)} KB`);
  console.log('  ✓ palette, fonts, title, theme-color, live region, reduced motion');
  console.log(`  ✓ kept and linked ${LOCAL.join(', ')}`);
  console.log('  ✓ verified no tpt-package material was copied');
  console.log('\nNow run: node tools/apply-site-chrome.js\n');
}

main();
