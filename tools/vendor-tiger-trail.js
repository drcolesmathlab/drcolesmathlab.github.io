#!/usr/bin/env node
/*
 * vendor-tiger-trail.js — copies Tiger Trail into apps/tiger-trail/ and patches it.
 *
 * Unlike Transform Lab, this app needs no code transformation: it is already classic
 * scripts with window globals, relative paths, system fonts, and zero CDN references,
 * and it already runs from file://. The upstream `web-dist/tiger-trail-web/` folder is
 * byte-identical to the project root and is the intended distribution artifact.
 *
 * So this script is a copy plus five documented patches. It exists rather than a bare
 * `cp -R` so the patches are reproducible and reviewable, and so re-vendoring after an
 * upstream change cannot silently drop one.
 *
 * Usage:  node tools/vendor-tiger-trail.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const OUT = path.join(REPO, 'apps', 'tiger-trail');

const SRC = path.resolve(
  REPO,
  '..',
  'LinkedInShowcase',
  'Math Apps',
  'Game Tiger Trail Multiples and Factors',
  'web-dist',
  'tiger-trail-web'
);

/* Copy these and only these. The upstream project also contains desktop/ (1.6 GB of
   Electron output) and mobile/ (326 MB of Capacitor + Xcode), neither of which has any
   unique game code — both consume copies of these same files. */
const COPY = [
  'index.html',
  'style.css',
  'sw.js',
  'manifest.webmanifest',
  'lib/three.min.js',
  'src/storage.js',
  'src/audio.js',
  'src/mathgen.js',
  'src/tiger.js',
  'src/world.js',
  'src/game.js',
  'src/ui.js',
  'src/main.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon-maskable.svg',
  'icons/apple-touch-icon.png',
];

let failures = 0;
function must(cond, msg) {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    failures++;
  }
  return cond;
}

const THREE_LICENSE = `three.js
Copyright © 2010-2023 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

--
Vendored into this repository (not loaded from a CDN) at apps/tiger-trail/lib/three.min.js,
r149, the classic UMD build. The @license header at the top of that file is preserved.
`;

function main() {
  console.log('Vendoring apps/tiger-trail/ …');

  if (!fs.existsSync(SRC)) {
    console.error(`\n✗ Source tree not found:\n  ${SRC}\n`);
    process.exit(1);
  }

  /* ── copy ──────────────────────────────────────────────────────────────── */
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

  /* ── 1. manifest: the one absolute path in the whole app ───────────────── */
  const manifestPath = path.join(OUT, 'manifest.webmanifest');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  must(manifest.id === '/', 'expected manifest "id" to be "/" — upstream may have changed');
  // "/" would claim the whole origin and collide with any other PWA here. start_url and
  // scope are already correctly relative and resolve against the manifest's own URL.
  manifest.id = './';
  manifest.name = "Tiger Trail: Jungle Math Runner — Dr. Cole's Math Lab";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  /* ── 2. service worker: hand the cache name to the generator ───────────── */
  /*
   * The worker is cache-first with a hardcoded version string. Ship a payload change
   * without bumping it and every prior visitor keeps the old build forever, with no
   * signal anything is wrong — the single highest-consequence failure mode in the repo.
   *
   * Rather than write that down as a rule someone has to remember, the cache name is
   * derived from a hash of the payload by tools/apply-site-chrome.js. Change any file
   * in this folder and the cache name changes with it, automatically.
   */
  const swPath = path.join(OUT, 'sw.js');
  let sw = fs.readFileSync(swPath, 'utf8');
  must(/const CACHE = 'tiger-trail-v1';/.test(sw), 'expected the upstream CACHE constant');
  sw = sw.replace(
    /\/\* Service worker[\s\S]*?const CACHE = 'tiger-trail-v1';/,
    `/* Service worker: precaches every asset so Tiger Trail runs fully offline once
   loaded, and so it keeps working if this page is opened with no connection.

   The cache name below is GENERATED from a hash of everything in this folder by
   tools/apply-site-chrome.js. Do not hand-edit it and do not replace it with a
   literal — deriving it is what makes it impossible to ship a payload change that
   leaves previous visitors stuck on a stale cached build.

   Scope note: a worker's maximum scope is its own directory, so this one can only
   ever control /apps/tiger-trail/. It cannot cache or shadow the rest of the site. */
/* CACHE NAME:START */
const CACHE = 'tiger-trail-0000000000';
/* CACHE NAME:END */`
  );
  fs.writeFileSync(swPath, sw);

  /* ── 3. stylesheet: font markers + brand typeface on the UI ────────────── */
  const cssPath = path.join(OUT, 'style.css');
  let css = fs.readFileSync(cssPath, 'utf8');
  must(!/@import|https?:\/\//.test(css), 'unexpected external reference in style.css');
  must(
    /font-family: "Avenir Next", "Segoe UI", system-ui, sans-serif;/.test(css),
    'expected the upstream font stack — upstream may have changed'
  );
  // Nunito on the HTML menu/HUD overlays only. The 3D scene draws its own textures on
  // generated canvases and is untouched — the jungle art direction is the game's, not
  // the site's, and is deliberately left alone.
  css = css.replace(
    /font-family: "Avenir Next", "Segoe UI", system-ui, sans-serif;/g,
    `font-family: 'Nunito', "Avenir Next", "Segoe UI", system-ui, sans-serif;`
  );
  css =
    `/*\n` +
    ` * Tiger Trail styles, vendored from web-dist/tiger-trail-web/style.css.\n` +
    ` *\n` +
    ` * Changes from upstream:\n` +
    ` *   - Nunito prepended to the UI font stack so the menus match the site wordmark\n` +
    ` *     (the 3D scene is untouched — its textures are generated in code)\n` +
    ` *   - a prefers-reduced-motion guard on the HTML overlays\n` +
    ` *\n` +
    ` * The palette is deliberately NOT harmonised to the Math Lab tokens: the jungle\n` +
    ` * greens are the game's art direction, not site chrome.\n` +
    ` */\n\n` +
    `/* FONTS:START */\n/* FONTS:END */\n\n` +
    css.trimEnd() +
    `

/* ── Additions for the Math Lab showcase (not upstream) ───────────────────── */

/* The game loop itself is the point and is left alone; this collapses the menu and
   HUD transitions only. */
@media (prefers-reduced-motion: reduce){
  .screen,.menu-panel,button,#hud,#countdown{
    animation-duration:.01ms !important;
    animation-iteration-count:1 !important;
    transition-duration:.01ms !important;
  }
}
`;
  fs.writeFileSync(cssPath, css);

  /* ── 4. index.html: title + canvas label ───────────────────────────────── */
  const htmlPath = path.join(OUT, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  html = html.replace(
    /<title>[^<]*<\/title>/,
    "<title>Tiger Trail: Jungle Math Runner — Dr. Cole's Math Lab</title>"
  );

  // A bare <canvas> is an empty box to a screen reader. Keyboard play already works
  // (the handlers are on `window`, not the canvas), so no tabindex is needed here —
  // adding one would insert a focus stop that does nothing.
  must(/<canvas id="game-canvas"><\/canvas>/.test(html), 'expected the game canvas element');
  html = html.replace(
    '<canvas id="game-canvas"></canvas>',
    '<canvas id="game-canvas" role="img" aria-label="3D view of the jungle trail: the tiger runs down one of three lanes collecting numbered coins"></canvas>'
  );

  must(!/https?:\/\/(?!www\.w3\.org)/.test(html), 'an absolute URL survived in the HTML');
  fs.writeFileSync(htmlPath, html);

  /* ── 5. three.js licence ───────────────────────────────────────────────── */
  const three = fs.readFileSync(path.join(OUT, 'lib', 'three.min.js'), 'utf8').slice(0, 200);
  must(/@license/.test(three), 'the three.js @license header is missing from the bundle');
  fs.writeFileSync(path.join(OUT, 'lib', 'LICENSE-three.txt'), THREE_LICENSE);

  if (failures) {
    console.error(`\n✗ ${failures} assertion(s) failed.\n`);
    process.exit(1);
  }

  let bytes = 0;
  for (const rel of COPY) bytes += fs.statSync(path.join(OUT, rel)).size;
  console.log(`  ✓ ${COPY.length} files, ${(bytes / 1024).toFixed(0)} KB`);
  console.log('  ✓ manifest id, service-worker cache marker, fonts, title, canvas label, licence');
  console.log('\nNow run: node tools/apply-site-chrome.js\n');
}

main();
