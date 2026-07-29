#!/usr/bin/env node
/*
 * build-transform-lab.js — vendor Transform Lab v3.0 into apps/transform-lab/.
 *
 * WHY THIS EXISTS
 * ---------------
 * The upstream app is nine ES modules. ES modules do not load from file:// in any
 * browser (the opaque origin fails the CORS check), so shipping them as-is would
 * break the "open it from disk and it works" promise the whole site is built on.
 * This script concatenates them into one classic <script> that works everywhere.
 *
 * It is a source-to-source transform, not a bundler. Four things have to happen:
 *
 *   1. Strip `import` statements. Five modules use a MULTI-LINE brace form, which a
 *      line-anchored regex silently misses — leaving a syntax error in the output.
 *   2. Rebuild the `Utils` namespace object that `import * as Utils` provided.
 *   3. Strip `export` keywords but keep the declarations. Because everything lands in
 *      one scope, canvas.js's `export let APP_ZOOM` keeps its live-binding semantics
 *      for free: setAppZoom() mutates the same `let` the modules read.
 *   4. Rename the six colliding `export function init()`. main.js already imports them
 *      as initTranslation/initReflection/... so it needs no edit beyond import removal.
 *
 * Everything is asserted. If upstream changes shape, this fails loudly rather than
 * emitting a subtly broken bundle.
 *
 * Usage:  node tools/build-transform-lab.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const OUT = path.join(REPO, 'apps', 'transform-lab');

/*
 * Source exclusively from src/. The sibling css/ and js/ folders in the upstream repo
 * are a stale v1 duplicate, and dist/ is a stale v2.6 build with a hardcoded
 * `/Dr-Coles-Transform-Lab/` base that 404s at any other origin.
 */
const SRC = path.resolve(
  REPO,
  '..',
  'LinkedInShowcase',
  'Math Apps',
  'App - Geometric Transformation',
  'TransformLab_v3_0'
);

// Dependency order. utils first (everything uses it), canvas second (imports utils),
// then the six feature modules, then main.js last — main calls init*() at top level,
// so every declaration must already be evaluated.
const MODULES = ['translation', 'reflection', 'rotation', 'dilation', 'challenge', 'freeform'];
const JS_ORDER = [
  'src/js/utils.js',
  'src/js/canvas.js',
  ...MODULES.map((m) => `src/js/modules/${m}.js`),
  'src/js/main.js',
];

let failures = 0;
function must(cond, msg) {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    failures++;
  }
  return cond;
}

/* Matches both single-line and multi-line import forms, non-greedily up to the
 * terminating `from '...';`. The [\s\S]*? is what handles the brace blocks. */
const IMPORT_RE = /^import\s[\s\S]*?from\s*['"][^'"]+['"];?[ \t]*$/gm;

/* Replace a matched block with the same number of newlines, so line numbers in a
 * stack trace still roughly correspond to the original file. */
const blankOut = (match) => '\n'.repeat((match.match(/\n/g) || []).length);

function pascal(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── 1. Read and transform the JS ──────────────────────────────────────────── */

function buildJs() {
  const chunks = [];

  for (const rel of JS_ORDER) {
    const abs = path.join(SRC, rel);
    must(fs.existsSync(abs), `missing source file: ${rel}`);
    if (!fs.existsSync(abs)) continue;

    let code = fs.readFileSync(abs, 'utf8');
    const base = path.basename(rel, '.js');

    // -- imports --------------------------------------------------------------
    const importCount = (code.match(IMPORT_RE) || []).length;
    code = code.replace(IMPORT_RE, blankOut);
    must(
      !/^\s*import[\s{*]/m.test(code),
      `${rel}: an import statement survived the strip (found ${importCount}, some form unhandled)`
    );
    must(!/import\s*\(/.test(code), `${rel}: dynamic import() is not supported by this build`);
    must(!/import\.meta/.test(code), `${rel}: import.meta is not supported by this build`);

    // -- the six colliding init() ---------------------------------------------
    if (rel.includes('/modules/')) {
      const initMatches = code.match(/^export function init\s*\(/gm) || [];
      must(
        initMatches.length === 1,
        `${rel}: expected exactly one "export function init()", found ${initMatches.length}`
      );
      code = code.replace(/^export function init\s*\(/m, `function init${pascal(base)}(`);
      must(
        !/^export /m.test(code),
        `${rel}: has exports beyond init() — the Utils/global surface may have changed`
      );
    }

    // -- utils namespace ------------------------------------------------------
    if (base === 'utils') {
      // Derive the name list from the source rather than hard-coding it, so a new
      // export upstream is picked up automatically instead of becoming undefined.
      const names = [...code.matchAll(/^export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)]
        .map((m) => m[1]);
      must(names.length > 0, 'utils.js: found no exports to build the Utils namespace from');
      code = stripExports(code);
      code += `\n// Reconstructs the namespace that \`import * as Utils\` provided upstream.\n`;
      code += `const Utils = { ${names.join(', ')} };\n`;
    } else {
      code = stripExports(code);
    }

    chunks.push(`/* ── ${rel} ${'─'.repeat(Math.max(0, 60 - rel.length))} */\n${code.trim()}\n`);
  }

  const banner =
    `/*\n` +
    ` * GENERATED FILE — DO NOT EDIT.\n` +
    ` *\n` +
    ` * Built by tools/build-transform-lab.js from Transform Lab v3.0's src/js/ ES modules,\n` +
    ` * concatenated into one classic script so the app loads from file:// as well as http.\n` +
    ` * Edit the upstream source and re-run the script instead.\n` +
    ` */\n`;

  return `${banner}(function () {\n'use strict';\n\n${chunks.join('\n')}\n})();\n`;
}

/* Strips the `export` keyword while keeping the declaration itself. */
function stripExports(code) {
  return code.replace(/^export\s+(const|let|var|function|class|async)\s/gm, '$1 ');
}

/* ── 2. CSS: drop the Google Fonts @import ─────────────────────────────────── */

function buildCss() {
  const abs = path.join(SRC, 'src/css/styles.css');
  must(fs.existsSync(abs), 'missing src/css/styles.css');
  let css = fs.readFileSync(abs, 'utf8');

  must(
    /@import\s+url\(['"]https:\/\/fonts\.googleapis\.com/.test(css),
    'expected a Google Fonts @import on line 1 — upstream may have changed'
  );
  css = css.replace(/^@import\s+url\([^)]*\);?\s*\n?/gm, '');
  must(!/@import/.test(css), 'an @import survived the strip');
  must(!/https?:\/\//.test(css), 'an absolute URL survived in the CSS');

  // The muted token fails WCAG AA at 4.23:1 on --sf. See README for the full table.
  css = css.replace(/--mu:#6b7498/g, '--mu:#7a83a8');
  must(!/--mu:#6b7498/.test(css), 'the --mu contrast fix did not apply');

  const header =
    `/*\n` +
    ` * Transform Lab styles, vendored from TransformLab_v3_0/src/css/styles.css.\n` +
    ` *\n` +
    ` * Two changes from upstream:\n` +
    ` *   - the Google Fonts @import is removed (fonts are injected as data: URIs by\n` +
    ` *     tools/apply-site-chrome.js, so the page has zero external requests)\n` +
    ` *   - --mu is lightened from #6b7498 to #7a83a8, which raises it from 4.23:1 to\n` +
    ` *     5.22:1 on --sf and clears WCAG AA for normal text\n` +
    ` *\n` +
    ` * The reduced-motion and canvas-focus rules at the end are additions, not upstream.\n` +
    ` */\n\n` +
    `/* FONTS:START */\n/* FONTS:END */\n\n`;

  const additions = `

/* ── Additions for the Math Lab showcase (not upstream) ───────────────────── */

/* The canvases are focusable so keyboard users can reach them in tab order and so
   screen readers announce their aria-label. Canvas has no native focus styling. */
canvas:focus-visible{outline:3px solid var(--tc);outline-offset:3px}

/* Upstream has no reduced-motion guard. Decorative motion is removed and functional
   transitions are collapsed rather than dropped, so state changes stay legible. */
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{
    animation-duration:.01ms !important;
    animation-iteration-count:1 !important;
    transition-duration:.01ms !important;
    scroll-behavior:auto !important;
  }
}
`;

  return header + css.trimEnd() + '\n' + additions;
}

/* ── 3. HTML: relink assets, drop the duplicate wordmark ───────────────────── */

function buildHtml() {
  const abs = path.join(SRC, 'index.html');
  must(fs.existsSync(abs), 'missing index.html');
  let html = fs.readFileSync(abs, 'utf8');

  // Stylesheet + script relinking.
  must(
    html.includes('href="./src/css/styles.css"'),
    'expected the upstream stylesheet link — upstream may have changed'
  );
  html = html.replace('href="./src/css/styles.css"', 'href="styles.css"');

  must(
    /<script type="module" src="\.\/src\/js\/main\.js"><\/script>/.test(html),
    'expected the upstream module script tag — upstream may have changed'
  );
  html = html.replace(
    /<script type="module" src="\.\/src\/js\/main\.js"><\/script>/,
    '<script src="app.js"></script>'
  );
  must(!/type="module"/.test(html), 'a module script tag survived');

  // Title: drop the ⚡ (screen readers announce it as "high voltage sign") and the
  // version number, which means nothing to a visitor.
  html = html.replace(
    /<title>[^<]*<\/title>/,
    "<title>Transform Lab — Dr. Cole's Math Lab</title>"
  );

  // The app's own <header> renders the identical "Dr. Cole's [logo] Transform Lab"
  // wordmark that the showcase page already shows directly above the iframe. Two
  // stacked wordmarks reads as a broken page, and it puts a second <h1> in the
  // embedded document. Keep the subtitle — it's useful orientation inside the frame.
  const headerRe = /<header>[\s\S]*?<\/header>\s*/;
  must(headerRe.test(html), 'could not find the app header block to remove');
  const subtitle = (html.match(/<p class="subtitle">([\s\S]*?)<\/p>/) || [])[1] || '';
  html = html.replace(
    headerRe,
    `<p class="subtitle app-subtitle">${subtitle.trim()}</p>\n\n`
  );
  must(!/<h1>/.test(html), 'an <h1> survived in the embedded app');

  // Canvas accessibility: a bare <canvas> is an empty box to a screen reader and is
  // not reachable by keyboard at all. tabindex + a descriptive label is the cheapest
  // meaningful improvement that does not touch app logic.
  const CANVAS_LABELS = {
    tCanvas: 'Coordinate grid showing a shape and its translated image',
    rfCanvas: 'Coordinate grid showing a shape and its reflected image across an axis',
    roCanvas: 'Coordinate grid showing a shape and its rotated image about a centre point',
    dCanvas: 'Coordinate grid showing a shape and its dilated image about a centre point',
    chCanvas: 'Coordinate grid for the multi-step transformation challenge',
    ffCanvas: 'Coordinate grid sandbox for building and transforming a custom polygon',
  };
  let labelled = 0;
  html = html.replace(/<canvas id="([A-Za-z0-9_]+)"([^>]*)>/g, (m, id, rest) => {
    const label = CANVAS_LABELS[id];
    if (!label) return m;
    labelled++;
    return `<canvas id="${id}"${rest} tabindex="0" role="img" aria-label="${label}">`;
  });
  must(
    labelled === Object.keys(CANVAS_LABELS).length,
    `expected to label ${Object.keys(CANVAS_LABELS).length} canvases, labelled ${labelled}`
  );

  // A visible note inside the frame, so a keyboard user isn't left guessing.
  html = html.replace(
    /<\/body>/,
    `<p class="a11y-note">Mode tabs, level buttons and the coordinate inputs are keyboard-reachable. Moving shapes on the grid requires a pointer — see the accessibility notes on the page around this app.</p>\n</body>`
  );

  must(!/https?:\/\/(?!www\.w3\.org)/.test(html), 'an absolute URL survived in the HTML');
  return html;
}

/* ── main ──────────────────────────────────────────────────────────────────── */

function main() {
  console.log('Building apps/transform-lab/ from TransformLab_v3_0 …');

  if (!fs.existsSync(SRC)) {
    console.error(`\n✗ Source tree not found:\n  ${SRC}\n`);
    process.exit(1);
  }

  const js = buildJs();
  const css = buildCss();
  const html = buildHtml();

  if (failures > 0) {
    console.error(`\n✗ ${failures} assertion(s) failed — nothing written.\n`);
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'app.js'), js);
  fs.writeFileSync(path.join(OUT, 'styles.css'), css);
  fs.writeFileSync(path.join(OUT, 'index.html'), html);

  const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`;
  console.log(`  ✓ app.js      ${kb(js)}`);
  console.log(`  ✓ styles.css  ${kb(css)}`);
  console.log(`  ✓ index.html  ${kb(html)}`);
  console.log('\nNow run: node tools/apply-site-chrome.js  (injects the fonts)\n');
}

main();
