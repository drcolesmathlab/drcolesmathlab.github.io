#!/usr/bin/env node
/*
 * build-real-number-monsters.js — vendor Real Number Monsters into apps/real-number-monsters/.
 *
 * WHY THIS EXISTS
 * ---------------
 * Upstream (github.com/drstockinvesting/real-number-monsters) is a Vite project written
 * as ES modules. ES modules do not load from file:// in any browser, and Vite's normal
 * build emits `<script type="module" crossorigin>`, which fails from disk for the same
 * reason. So this runs upstream's own Vite with an override config that emits:
 *
 *   index.html   upstream markup, script tag rewritten to a classic `defer` script
 *   game.js      the whole game as ONE classic IIFE (no module, no chunks, no preload)
 *   game.css     upstream src/styles.css, minified
 *
 * No game code is edited. Everything is asserted afterwards; if upstream changes shape
 * this fails loudly rather than emitting a page that silently breaks from disk.
 *
 * FONTS: the game deliberately uses the system stack ("Trebuchet MS", "Segoe UI",
 * Verdana) on both its DOM and its canvas, and never names Nunito or Space Mono. So the
 * stylesheet is named game.css, which the chrome generator does not fill with fonts —
 * injecting ~76 KB of base64 the game never uses would be pure dead weight.
 *
 * STORAGE KEYS are left as upstream wrote them (rnm-best, rnm-muted, rnm-touchbar).
 * They are already prefixed, and listed in site.config.js so the generator's collision
 * check covers them.
 *
 * Usage:
 *   (cd ../real-number-monsters && npm ci)       # once, for upstream's Vite
 *   node tools/build-real-number-monsters.js
 *
 * Set RNM_SRC to point at a checkout somewhere other than ../real-number-monsters.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const OUT = path.join(REPO, 'apps', 'real-number-monsters');
const SRC = path.resolve(process.env.RNM_SRC || path.join(REPO, '..', 'real-number-monsters'));

let failures = 0;
function must(cond, msg) {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    failures++;
  }
  return cond;
}

/* Vite ships as ESM; load it from upstream's own node_modules so this repo stays
 * dependency-free. */
async function loadVite() {
  const entry = path.join(SRC, 'node_modules', 'vite', 'dist', 'node', 'index.js');
  if (!fs.existsSync(entry)) {
    console.error(`✗ Vite not found at ${entry}\n  Run: (cd ${SRC} && npm ci)`);
    process.exit(1);
  }
  return import(pathToFileURL(entry).href);
}

/* Turn Vite's module script into a classic deferred one. `defer` keeps the original
 * timing (upstream loads it as a module at the end of <body>, which is also deferred),
 * and dropping `crossorigin` avoids a CORS-mode fetch that fails from file://. */
const classicScripts = {
  name: 'mathlab-classic-scripts',
  enforce: 'post',
  transformIndexHtml(html) {
    return html
      .replace(/<script type="module" crossorigin src="\.\/game\.js"><\/script>/, '<script defer src="./game.js"></script>')
      .replace(/(<link rel="stylesheet") crossorigin (href="\.\/game\.css">)/, '$1 $2');
  },
};

function upstreamCommit() {
  try {
    return execFileSync('git', ['-C', SRC, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function main() {
  console.log(`Vendoring Real Number Monsters from ${SRC} …\n`);
  must(fs.existsSync(path.join(SRC, 'index.html')), `upstream index.html not found in ${SRC}`);
  must(fs.existsSync(path.join(SRC, 'src', 'main.js')), 'upstream src/main.js not found');
  if (failures) process.exit(1);

  const { build } = await loadVite();
  await build({
    root: SRC,
    configFile: false,
    base: './',
    logLevel: 'warn',
    plugins: [classicScripts],
    build: {
      outDir: OUT,
      emptyOutDir: true,
      assetsDir: '',
      modulePreload: false,
      cssCodeSplit: false,
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          format: 'iife',
          inlineDynamicImports: true,
          entryFileNames: 'game.js',
          assetFileNames: (info) => (/\.css$/.test(info.name || info.names?.[0] || '') ? 'game.css' : '[name][extname]'),
        },
      },
    },
  });

  /* -- assertions --------------------------------------------------------- */
  const files = fs.readdirSync(OUT).sort();
  must(
    JSON.stringify(files) === JSON.stringify(['game.css', 'game.js', 'index.html']),
    `expected exactly game.css, game.js, index.html — got ${files.join(', ')}`
  );

  const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  must(html.includes('<script defer src="./game.js"></script>'), 'index.html: classic game.js script tag missing');
  must(html.includes('<link rel="stylesheet" href="./game.css">'), 'index.html: game.css link missing or still crossorigin');
  must(!/type="module"/.test(html), 'index.html: still has a module script');
  must(!/crossorigin/.test(html), 'index.html: still has a crossorigin attribute');
  must(!/modulepreload/.test(html), 'index.html: still has a modulepreload link');

  const js = fs.readFileSync(path.join(OUT, 'game.js'), 'utf8');
  must(!/^\s*(import|export)\s/m.test(js), 'game.js: still contains import/export statements');
  must(!/import\(/.test(js), 'game.js: contains a dynamic import()');
  for (const key of ['rnm-best', 'rnm-muted', 'rnm-touchbar']) {
    must(js.includes(`"${key}"`) || js.includes(`'${key}'`), `game.js: storage key ${key} not found — update site.config.js storageKeys`);
  }

  if (failures) {
    console.error(`\n✗ ${failures} problem(s) — the vendored build is not safe to ship.\n`);
    process.exit(1);
  }

  // Stamp the upstream commit so it is obvious which build is on the site.
  const stamp = `<!-- Vendored from real-number-monsters @ ${upstreamCommit()} by tools/build-real-number-monsters.js. Do not edit; re-run the script. -->\n`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html.replace(/^(<!doctype html>\n)/i, `$1${stamp}`));

  for (const f of files) {
    const kb = (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1);
    console.log(`  ✓ apps/real-number-monsters/${f}  (${kb} KB)`);
  }
  console.log('\nNext: node tools/apply-site-chrome.js && node tools/check-external.js\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
