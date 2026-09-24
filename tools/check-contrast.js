#!/usr/bin/env node
/*
 * check-contrast.js — measures every colour pair the home page and the app pages
 * actually use, in both themes, against WCAG 2.1 AA. Exits non-zero on any failure.
 *
 * The build spec says the mockup palette "was checked", and also says to re-check
 * rather than assume. This is the re-check, and it runs from config so it cannot
 * drift from what ships: change a colour in site.config.js and this re-measures it.
 *
 *   text      4.5:1   body copy, labels, chips, links, kickers
 *   large     3.0:1   the wordmark (≥ 24 px bold)
 *   graphic   3.0:1   glyphs, focus rings, UI boundaries that identify a control
 *
 * Usage:  node tools/check-contrast.js
 */

'use strict';

const config = require('./site.config.js');

function lum(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const MIN = { text: 4.5, large: 3, graphic: 3 };
let failures = 0;
const rows = [];

function check(theme, what, fg, bg, kind) {
  const r = ratio(fg, bg);
  const ok = r >= MIN[kind];
  if (!ok) failures++;
  rows.push(`  ${ok ? '✓' : '✗'} ${theme.padEnd(5)} ${r.toFixed(2).padStart(5)}:1  (${kind} ≥ ${MIN[kind]})  ${what}  ${fg} on ${bg}`);
}

// Wordmark gradient stops, per theme — the exact values home-css.js ships. Each
// stop is large bold text on --bg.
const { WORDMARK } = require('./lib/home-css.js');

for (const theme of ['light', 'dark']) {
  const t = config.homeTokens[theme];
  const surfaces = { '--bg': t['--bg'], '--bg-elevated': t['--bg-elevated'], '--border-soft': t['--border-soft'] };

  for (const fg of ['--text', '--text-soft', '--text-faint']) {
    for (const [sn, sv] of Object.entries(surfaces)) check(theme, `${fg} on ${sn}`, t[fg], sv, 'text');
  }
  // Focus ring is drawn outside the control, on the page background or a card.
  check(theme, 'focus ring on --bg', t['--focus'], t['--bg'], 'graphic');
  check(theme, 'focus ring on --bg-elevated', t['--focus'], t['--bg-elevated'], 'graphic');
  // Pressed theme button: white text on the focus colour.
  check(theme, 'pressed toggle text', t['--on-focus'], t['--focus'], 'text');

  for (const c of config.categories) {
    const { color, soft } = c[theme];
    check(theme, `${c.id} glyph on soft`, color, soft, 'graphic');
    check(theme, `${c.id} kicker/link on card`, color, t['--bg-elevated'], 'text');
    check(theme, `${c.id} active chip text on soft`, color, soft, 'text');
  }
  for (const s of Object.values(WORDMARK[theme]).flat()) check(theme, 'wordmark gradient stop', s, t['--bg'], 'large');
}

// App pages (chrome-css.js). Dark is `tokens`, light is `tokensLight`. The accents
// other than --tc are only borders and tints today, but they are measured as text so
// they stay safe to use in page copy.
for (const [theme, t] of [['light', config.tokensLight], ['dark', config.tokens]]) {
  const surfaces = { '--bg': t['--bg'], '--sf': t['--sf'], '--sf2': t['--sf2'] };
  for (const fg of ['--pre', '--tx', '--mu']) {
    for (const [sn, sv] of Object.entries(surfaces)) check(theme, `app ${fg} on ${sn}`, t[fg], sv, 'text');
  }
  for (const fg of ['--tc', '--rc', '--oc', '--dc', '--ax', '--or']) {
    for (const sn of ['--bg', '--sf']) check(theme, `app ${fg} on ${sn}`, t[fg], surfaces[sn], 'text');
  }
  check(theme, 'app focus ring on --bg', t['--tc'], t['--bg'], 'graphic');
  check(theme, 'app focus ring on --sf', t['--tc'], t['--sf'], 'graphic');
  // Skip links and the pressed theme button: --on-tc on --tc.
  check(theme, 'app pressed toggle / skip link text', t['--on-tc'], t['--tc'], 'text');
  for (const s of WORDMARK[theme].stops) check(theme, 'app wordmark gradient stop', s, t['--bg'], 'large');
}

console.log(rows.join('\n'));
if (failures) {
  console.error(`\n✗ ${failures} pair(s) below the WCAG 2.1 AA minimum.\n`);
  process.exit(1);
}
console.log(`\n✓ All ${rows.length} pairs pass WCAG 2.1 AA on the home and app pages, in both themes.\n`);
