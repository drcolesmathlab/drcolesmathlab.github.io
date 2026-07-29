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

function main() {
  console.log('Vendoring apps/balancing-act/ …');

  if (!fs.existsSync(SRC)) {
    console.error(`\n✗ Source tree not found:\n  ${SRC}\n`);
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
  must(
    copied.every((f) => COPY.includes(f)),
    `unexpected files in apps/balancing-act/: ${copied.filter((f) => !COPY.includes(f)).join(', ')}`
  );
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
   * every keypad press, so announcing it would talk over the player constantly.
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
  console.log('  ✓ verified no tpt-package material was copied');
  console.log('\nNow run: node tools/apply-site-chrome.js\n');
}

main();
