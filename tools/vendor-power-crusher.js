#!/usr/bin/env node
/*
 * vendor-power-crusher.js — copies Power Crusher into apps/power-crusher/.
 *
 * Upstream is drcolesmathlab/power-crusher. It was built for this site from the start:
 * classic <script> IIFEs (no ES modules, no build step), no CDN, no fetch, Web Audio
 * tones instead of sound files, an empty FONTS block for the generator to fill, and
 * localStorage only under mathlab.power-crusher.*. So nothing is patched: the copy is
 * byte-for-byte (apply-site-chrome.js fills the FONTS block afterwards), and this
 * script's job is to copy the right files and prove the rules still hold.
 *
 * ── WHY THE FILE LIST COMES FROM index.html ───────────────────────────────────
 * Upstream also holds a developer test bench (sandbox.html, src/sandbox.js), its tests,
 * design notes and CLAUDE.md. None of that belongs on a public page. The scripts that
 * ship are exactly the <script src> tags in index.html, in order, so a new upstream
 * module comes along by itself and the test bench never does.
 *
 * The app is still being built, one mode per phase. Re-run this after each phase is
 * merged upstream, then run the generator; the site's copy does not update by itself.
 *
 * Usage:  node tools/vendor-power-crusher.js [path-to-upstream-checkout]
 *         (defaults to a sibling checkout at ../power-crusher)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const OUT = path.join(REPO, 'apps', 'power-crusher');

const SRC = path.resolve(process.argv[2] || path.join(REPO, '..', 'power-crusher'));

// The only keys the app may write (upstream src/store.js). Also listed in site.config.js.
const STORAGE_KEYS = ['mathlab.power-crusher.progress', 'mathlab.power-crusher.settings'];

let failures = 0;
function must(cond, msg) {
  if (!cond) { console.error(`  ✗ ${msg}`); failures++; }
  return cond;
}

function stop() {
  console.error(`\n✗ ${failures} problem(s); nothing written.\n`);
  process.exit(1);
}

function main() {
  console.log(`Vendoring Power Crusher\n  from ${SRC}\n`);

  const indexPath = path.join(SRC, 'index.html');
  if (!must(fs.existsSync(indexPath), `upstream index.html not found at ${indexPath}`)) stop();
  const html = fs.readFileSync(indexPath, 'utf8');

  /* -- the file list ------------------------------------------------------- */
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => {
    const attrs = m[1];
    must(!/type\s*=\s*["']?module/.test(attrs), 'index.html has a module script — it would not load from file://');
    const src = /\bsrc\s*=\s*"([^"]+)"/.exec(attrs);
    return src ? src[1] : null;
  });
  must(scripts.length > 0 && scripts.every(Boolean), 'index.html has an inline <script> — expected src files only');
  const sheets = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  must(sheets.length === 1 && sheets[0] === 'styles.css', `expected one stylesheet, styles.css; found ${sheets.join(', ') || 'none'}`);

  const copy = ['index.html', ...sheets, ...scripts.filter(Boolean)];
  for (const rel of copy) {
    must(/^[\w./-]+$/.test(rel) && !rel.includes('..') && !/^\//.test(rel), `not a plain relative path: ${rel}`);
    must(!/sandbox/i.test(rel), `the developer test bench must not ship: ${rel}`);
    must(fs.existsSync(path.join(SRC, rel)), `missing source file: ${rel}`);
  }
  if (failures) stop();

  /* -- the rules, checked on the source before anything is written --------- */
  const noComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rel of copy) {
    const text = fs.readFileSync(path.join(SRC, rel), 'utf8');
    const live = noComments(text);
    must(!/\bhttps?:\/\//.test(live), `${rel} references an absolute URL`);
    if (rel.endsWith('.js')) {
      must(!/\bfetch\s*\(|XMLHttpRequest|\bimport\s*\(|^\s*(import|export)\s/m.test(live),
           `${rel} makes a network request or uses ES modules`);
      must(!/sessionStorage|indexedDB|document\.cookie/.test(live), `${rel} uses storage other than localStorage`);
    }
    if (rel.endsWith('.css')) must(!/@import/.test(live), `${rel} has an @import`);
  }

  const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
  must(/\/\* FONTS:START \*\//.test(css) && /\/\* FONTS:END \*\//.test(css),
       'styles.css has no FONTS markers — apply-site-chrome.js could not give the frame its fonts');

  // Every localStorage access goes through store.js, under the two agreed keys.
  const store = fs.readFileSync(path.join(SRC, 'src', 'store.js'), 'utf8');
  const used = [...noComments(store).matchAll(/'(mathlab\.[\w.-]+)'/g)].map((m) => m[1]);
  must(used.length && used.every((k) => STORAGE_KEYS.includes(k)) && STORAGE_KEYS.every((k) => used.includes(k)),
       `src/store.js uses ${used.join(', ') || 'no mathlab.* keys'}; expected ${STORAGE_KEYS.join(', ')} ` +
       '— update STORAGE_KEYS here and storageKeys in site.config.js');
  for (const rel of copy.filter((f) => f.endsWith('.js') && f !== 'src/store.js')) {
    must(!/localStorage/.test(noComments(fs.readFileSync(path.join(SRC, rel), 'utf8'))),
         `${rel} touches localStorage directly — every access must go through src/store.js`);
  }
  if (failures) stop();

  /* -- write --------------------------------------------------------------- */
  // A clean copy each time, so a file deleted upstream does not linger here.
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const rel of copy) {
    const to = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(SRC, rel), to);
  }

  let bytes = 0;
  for (const rel of copy) bytes += fs.statSync(path.join(OUT, rel)).size;

  let rev = 'unknown';
  try {
    rev = execFileSync('git', ['-C', SRC, 'log', '-1', '--format=%h %s'], { encoding: 'utf8' }).trim();
  } catch (e) { /* not a git checkout; the copy is still valid */ }

  console.log(`  ✓ ${copy.length} files, ${(bytes / 1024).toFixed(0)} KB`);
  console.log(`  ✓ no external URLs, no modules, no fetch; storage only via src/store.js`);
  console.log(`  ✓ upstream at ${rev}`);
  console.log('\nNow run: node tools/apply-site-chrome.js && node tools/check-external.js\n');
}

main();
