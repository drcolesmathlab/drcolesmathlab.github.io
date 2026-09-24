#!/usr/bin/env node
/*
 * vendor-squares-cubes.js — copies Squares & Cubes Explorer into apps/squares-cubes/.
 *
 * Upstream is drstockinvesting/exploration_perfect_squares_and_cubes, and it is a
 * single self-contained index.html: markup, one inline <style>, one inline <script>,
 * no images, no dependencies, no network calls of any kind.
 *
 * ── WHY THE STYLESHEET IS SPLIT OUT ───────────────────────────────────────────
 * The one transformation this script performs is lifting that inline <style> into
 * styles.css and linking it. It looks like a step backwards for an app whose whole
 * selling point is being one file you can double-click — and upstream stays one file,
 * deliberately. But apply-site-chrome.js injects the @font-face blocks by rewriting
 * a payload stylesheet, and it only looks for apps/<slug>/styles.css or style.css:
 *
 *     for (const name of ['styles.css', 'style.css']) {
 *       const abs = path.join(appsDir, slug, name);
 *       if (!fs.existsSync(abs)) continue;      // <- silently skips a single-file app
 *
 * Vendored as one file, the app keeps whatever base64 it happened to arrive with, and
 * the day the site's fonts change it is the one app that quietly does not follow. That
 * is exactly the class of silent drift the service-worker cache name was derived to
 * avoid. Splitting the stylesheet puts the fonts back under the generator's ownership,
 * which is worth more here than the one-file property the site does not rely on.
 *
 * The split is safe because the app reads no styles back from the DOM: its script only
 * ever sets geometry (--u, --rx, --ry, --fit, widths, transforms) and toggles classes.
 *
 * Usage:  node tools/vendor-squares-cubes.js [path-to-upstream-checkout]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const OUT = path.join(REPO, 'apps', 'squares-cubes');

const SRC = path.resolve(
  process.argv[2] || path.join(REPO, '..', 'exploration_perfect_squares_and_cubes')
);

let failures = 0;
function must(cond, msg) {
  if (!cond) { console.error(`  ✗ ${msg}`); failures++; }
  return cond;
}

function main() {
  console.log(`Vendoring Squares & Cubes Explorer\n  from ${SRC}\n`);

  const srcFile = path.join(SRC, 'index.html');
  if (!must(fs.existsSync(srcFile), `upstream index.html not found at ${srcFile}`)) {
    process.exit(1);
  }

  const src = fs.readFileSync(srcFile, 'utf8');

  /* -- lift the inline stylesheet ------------------------------------------ */
  const style = src.match(/<style>\n([\s\S]*?)\n<\/style>\n/);
  if (!must(style, 'upstream index.html has no inline <style> block to lift')) {
    process.exit(1);
  }

  const css = style[1] + '\n';
  const html = src.replace(style[0], '<link rel="stylesheet" href="styles.css">\n');

  /*
   * The markers are what apply-site-chrome.js fills. Upstream already carries them
   * (it inlines the same two faces so it renders from disk on its own), so this is
   * an assertion rather than a fixup — if a future upstream drops them, the fonts
   * would silently stop tracking the site and this is where that gets caught.
   */
  must(/\/\* FONTS:START \*\//.test(css) && /\/\* FONTS:END \*\//.test(css),
       'lifted stylesheet has no FONTS markers — apply-site-chrome.js could not own its fonts');

  /* -- assert it really is self-contained ---------------------------------- */
  const scrubbed = html.replace(/<!--[\s\S]*?-->/g, '');
  must(!/\bhttps?:\/\//.test(scrubbed), 'index.html references an external URL');
  must(!/<script[^>]+src=/.test(html), 'index.html loads an external script');
  must(!/localStorage|sessionStorage|indexedDB/.test(html),
       'index.html now uses storage — give it mathlab.squares-cubes.* keys and list them in site.config.js');

  if (failures) {
    console.error(`\n✗ ${failures} problem(s); nothing written.\n`);
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  fs.writeFileSync(path.join(OUT, 'styles.css'), css);

  /* Nothing else may come along: upstream is one file plus a README. */
  const extra = fs.readdirSync(OUT).filter((f) => !['index.html', 'styles.css'].includes(f));
  must(!extra.length, `unexpected files in apps/squares-cubes/: ${extra.join(', ')}`);

  console.log('  ✓ apps/squares-cubes/index.html');
  console.log('  ✓ apps/squares-cubes/styles.css');
  console.log('\nNow run: node tools/apply-site-chrome.js && node tools/check-external.js\n');
  process.exit(failures ? 1 : 0);
}

main();
