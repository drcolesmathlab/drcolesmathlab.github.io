#!/usr/bin/env node
/*
 * check-external.js — fails if anything in the repo references an external origin.
 *
 * This is the gate on the one promise the whole site rests on: every page renders
 * correctly from a checkout, offline, with no third-party requests, forever.
 *
 * A DevTools Network-tab check catches this too, but only for pages you remember to
 * open, on the day you remember to look. This catches a re-introduced Google Fonts
 * @import the moment it lands, which is the difference between a five-second fix and
 * a silent regression discovered by whoever opened your link on a plane.
 *
 * What is allowed:
 *   - the site's own origin (in canonical/OG/Twitter meta, where absolute URLs are
 *     mandatory — LinkedIn's crawler will not resolve a relative path)
 *   - http://www.w3.org/... namespace declarations in inline SVG, which are
 *     identifiers, not fetched resources
 *
 * Everything else is a failure.
 *
 * Usage:  node tools/check-external.js       (exit 0 = clean, 1 = problems found)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./site.config.js');

const REPO = path.resolve(__dirname, '..');
const EXTS = new Set(['.html', '.css', '.js', '.webmanifest', '.json', '.svg']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'assets']);

const ALLOWED = [
  config.site.origin,
  'http://www.w3.org/',
  'https://www.w3.org/',
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(abs, out);
    } else if (EXTS.has(path.extname(entry.name))) {
      out.push(abs);
    }
  }
  return out;
}

function main() {
  const files = walk(REPO);
  const problems = [];

  for (const abs of files) {
    const rel = path.relative(REPO, abs);
    let src = fs.readFileSync(abs, 'utf8');

    // Base64 font payloads are enormous and contain no URLs; drop them so the scan
    // stays fast and the line numbers below stay meaningful.
    src = src.replace(/base64,[A-Za-z0-9+/=]+/g, 'base64,<stripped>');

    const lines = src.split('\n');
    lines.forEach((line, i) => {
      // Absolute URLs.
      for (const m of line.matchAll(/\bhttps?:\/\/[^\s"'<>()]+/g)) {
        if (ALLOWED.some((a) => m[0].startsWith(a))) continue;
        problems.push({ rel, line: i + 1, kind: 'external URL', text: m[0] });
      }
      // Protocol-relative URLs (//cdn.example.com/…) — easy to miss, resolve to
      // https at a real origin. Skipping comments and the // of a full URL.
      for (const m of line.matchAll(/(?:src|href)\s*=\s*["']\/\/[^"']+/g)) {
        problems.push({ rel, line: i + 1, kind: 'protocol-relative URL', text: m[0] });
      }
      // A CSS @import of anything remote.
      for (const m of line.matchAll(/@import\s+url\(\s*['"]?(https?:)?\/\//g)) {
        problems.push({ rel, line: i + 1, kind: 'remote @import', text: m[0] });
      }
    });
  }

  console.log(`Scanned ${files.length} files for external references.\n`);

  if (!problems.length) {
    console.log('  ✓ No external origins. Every page is self-contained.\n');
    process.exit(0);
  }

  for (const p of problems) {
    console.error(`  ✗ ${p.rel}:${p.line}  ${p.kind}: ${p.text}`);
  }
  console.error(`\n✗ ${problems.length} external reference(s) found.\n`);
  process.exit(1);
}

main();
