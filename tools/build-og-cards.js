#!/usr/bin/env node
/*
 * build-og-cards.js — renders tools/og-cards.html and screenshots each 1200x630 card
 * into assets/og-<slug>.png using local headless Chrome.
 *
 * These images are the only reason a shared link shows a preview card on LinkedIn.
 * LinkedIn's crawler will not resolve a relative path or a data: URI, which is why
 * the og:image meta the generator writes is an absolute https URL — and why these
 * files have to actually exist at that path once the repo is deployed.
 *
 * Chrome is used only as a build tool here; nothing at runtime depends on it, and the
 * generated PNGs are committed so the site never needs a build step to serve.
 *
 * Usage:  node tools/build-og-cards.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const config = require('./site.config.js');

const REPO = path.resolve(__dirname, '..');
const OUT = path.join(REPO, 'assets');
const CARDS = path.join(__dirname, 'og-cards.html');

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (fs.existsSync(p)) return p;
  return null;
}

function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.error(
      '\n✗ No local Chrome/Chromium/Edge found. Checked:\n' +
        CHROME_CANDIDATES.map((p) => `    ${p}`).join('\n') +
        '\n\n  Install one, or open tools/og-cards.html in any browser, set the window to\n' +
        '  1200x630, and save each card manually to assets/og-<slug>.png.\n'
    );
    process.exit(1);
  }

  if (!fs.existsSync(CARDS)) {
    console.error(`\n✗ Missing ${path.relative(REPO, CARDS)}\n`);
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });

  const targets = [
    { slug: 'home', hash: 'home' },
    ...config.apps.filter((a) => a.published).map((a) => ({ slug: a.slug, hash: a.slug })),
  ];

  console.log(`Rendering ${targets.length} OG cards with:\n  ${chrome}\n`);

  for (const t of targets) {
    const out = path.join(OUT, `og-${t.slug}.png`);
    const url = `file://${CARDS}#${t.hash}`;
    try {
      execFileSync(
        chrome,
        [
          '--headless',
          '--disable-gpu',
          '--hide-scrollbars',
          '--force-device-scale-factor=1',
          '--window-size=1200,630',
          '--default-background-color=00000000',
          `--screenshot=${out}`,
          '--virtual-time-budget=3000',
          url,
        ],
        { stdio: 'pipe' }
      );
    } catch (e) {
      console.error(`  ✗ ${t.slug}: chrome failed — ${e.message.split('\n')[0]}`);
      process.exitCode = 1;
      continue;
    }

    if (!fs.existsSync(out)) {
      console.error(`  ✗ ${t.slug}: no file written`);
      process.exitCode = 1;
      continue;
    }
    console.log(`  ✓ assets/og-${t.slug}.png  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  }

  console.log(
    '\nCards are committed as real files — the og:image meta points at absolute\n' +
      'https URLs, so they only resolve once the repo is deployed to Pages.\n'
  );
}

main();
