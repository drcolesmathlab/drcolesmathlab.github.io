#!/usr/bin/env node
/*
 * vendor-scientific-notation-explorer.js — copies Scientific Notation Explorer into
 * apps/scientific-notation-explorer/.
 *
 * Upstream is drcolesmathlab/scientific_notation_explorer, built for this site the same
 * way as Power Crusher: classic <script> IIFEs (no ES modules, no build step), no CDN, no
 * fetch, an empty FONTS block for the generator to fill, and localStorage only under
 * mathlab.scientific-notation-explorer.progress and .settings. Nothing is patched; the copy is byte for
 * byte, and this script's job is to copy the right files and prove the rules still hold.
 *
 * ── WHY THE FILE LIST COMES FROM index.html ───────────────────────────────────
 * Upstream also holds Doc's design notes (design/), tests, HANDOFF.md and CLAUDE.md.
 * None of that belongs on a public page. The scripts that ship are exactly the
 * <script src> tags in index.html, in order, so a new level file comes along by itself
 * and the design notes never do.
 *
 * Levels are added upstream as Doc designs them. Re-run this after each one is merged
 * upstream, then run the generator; the site's copy does not update by itself. The app
 * is published: false in site.config.js until Doc says it is ready.
 *
 * Usage:  node tools/vendor-scientific-notation-explorer.js [path-to-upstream-checkout]
 *         (defaults to a sibling checkout at ../scientific_notation_explorer)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const OUT = path.join(REPO, 'apps', 'scientific-notation-explorer');

const SRC = path.resolve(process.argv[2] || path.join(REPO, '..', 'scientific_notation_explorer'));

// The only key the app may write (upstream src/store.js). Also listed in site.config.js.
const STORAGE_KEYS = ['mathlab.scientific-notation-explorer.progress', 'mathlab.scientific-notation-explorer.settings'];

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
  console.log(`Vendoring Scientific Notation Explorer\n  from ${SRC}\n`);

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
    must(!/^(design|tests)\//.test(rel), `design notes and tests must not ship: ${rel}`);
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

  // Every localStorage access goes through store.js, under the one agreed key.
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
