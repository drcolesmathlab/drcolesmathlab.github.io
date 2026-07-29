#!/usr/bin/env node
/*
 * apply-site-chrome.js — regenerates every shared region of every page.
 *
 * Because spec §1 forbids external stylesheets, the site chrome cannot live in one
 * site.css — each page carries its own inline copy. This script is what keeps those
 * copies identical: it owns a set of marker-delimited regions in each .html file and
 * rewrites them from tools/site.config.js on every run.
 *
 * Regions it owns (everything between the markers is generated; edits are lost):
 *
 *   <!-- META:START -->        canonical, OG and Twitter tags
 *   /* FONTS:START *\/         @font-face blocks with base64 data: URIs
 *   /* SITE CHROME:START *\/   the shared stylesheet
 *   <!-- TOPBAR:START -->      "back to all apps" bar + "App 0N / NN"   (app pages)
 *   <!-- PAGENAV:START -->     the sticky in-page section nav            (app pages)
 *   <!-- PLAY:START -->        the iframe embed block                    (app pages)
 *   <!-- A11Y:START -->        the honest accessibility statement        (app pages)
 *   <!-- APP GRID:START -->    the home page card grid                   (home)
 *   <!-- HERO FACTS:START -->  the home page fact pills                  (home)
 *   <!-- ABOUT:START -->       the home page about cards                 (home)
 *   <!-- FOOTER:START -->      pager, disclaimer, footer meta
 *
 * Everything outside the markers is hand-authored page content and is never touched.
 *
 * The script is idempotent: run it twice and the second run produces no diff.
 *
 * Usage:  node tools/apply-site-chrome.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..');
const config = require('./site.config.js');
const chromeCss = require('./lib/chrome-css.js');
const { icon } = require('./lib/icons.js');

/* ── assertion harness ─────────────────────────────────────────────────────── */

let failures = 0;
function must(cond, msg, where = '') {
  if (!cond) {
    failures++;
    console.error(`  ✗ ${where ? `[${where}] ` : ''}${msg}`);
  }
  return cond;
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Copy has to read correctly at one app as well as at ten — the site starts at one. */
const plural = (n, one, many) => (n === 1 ? one : many);

/* Replaces the body of a marker region, leaving the markers themselves in place.
 * Returns null when the marker pair isn't present, so the caller can decide whether
 * that's an error (app pages need TOPBAR) or fine (home has no TOPBAR). */
/* Every file under `dir`, as paths relative to it, recursively. */
function listFiles(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(abs, base, out);
    else out.push(path.relative(base, abs));
  }
  return out;
}

function fillRegion(src, name, body, comment = 'html') {
  const open = comment === 'css' ? `/* ${name}:START */` : `<!-- ${name}:START -->`;
  const close = comment === 'css' ? `/* ${name}:END */` : `<!-- ${name}:END -->`;
  const i = src.indexOf(open);
  const j = src.indexOf(close);
  if (i === -1 || j === -1 || j < i) return null;
  return src.slice(0, i + open.length) + '\n' + body.trimEnd() + '\n' + src.slice(j);
}

/* ── fonts → base64 data: URIs ─────────────────────────────────────────────── */

/*
 * Why data: URIs and not relative woff2 files:
 * Chrome fetches @font-face in CORS mode. From a file:// page the origin is opaque,
 * the fetch fails, and the browser quietly falls back to the next family in the stack.
 * The page still renders — just in the wrong typeface — which is the kind of
 * regression nobody notices. A data: URI has no origin and no CORS check.
 *
 * The .woff2 files stay committed under assets/fonts/ as the source of truth, which
 * is also what satisfies the OFL requirement that the licence travel with the font.
 */
function buildFontCss() {
  const blocks = [];
  let total = 0;

  for (const f of config.fonts) {
    const abs = path.join(REPO, 'assets', 'fonts', f.file);
    if (!must(fs.existsSync(abs), `font file missing: assets/fonts/${f.file}`, 'fonts')) continue;

    const buf = fs.readFileSync(abs);
    must(buf.slice(0, 4).toString('latin1') === 'wOF2', `${f.file} is not a valid woff2`, 'fonts');
    total += buf.length;

    blocks.push(
      `@font-face{\n` +
        `  font-family:'${f.family}';\n` +
        `  font-weight:${f.weight};\n` +
        `  font-style:${f.style || 'normal'};\n` +
        `  font-display:swap;\n` +
        `  src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2');\n` +
        `}`
    );
  }

  const header =
    `/* Nunito + Space Mono, SIL Open Font License, inlined as base64 so the page has\n` +
    `   zero external requests and renders correctly opened straight from disk.\n` +
    `   Source files and licence text: assets/fonts/. Regenerate with\n` +
    `   node tools/apply-site-chrome.js — do not hand-edit. */`;

  return { css: `${header}\n${blocks.join('\n')}`, bytes: total };
}

/* ── head meta ─────────────────────────────────────────────────────────────── */

function buildMeta(page) {
  const { origin, name } = config.site;
  // The home page advertises the bare origin, not /index.html. Both resolve, but the
  // bare form is what gets pasted into a post — and if og:url disagrees with the URL
  // someone shared, LinkedIn canonicalises to the og:url and the shared link shows the
  // uglier variant.
  const url = page.kind === 'home' ? `${origin}/` : `${origin}/${page.file}`;
  const img = `${origin}/assets/og-${page.ogSlug}.png`;
  return [
    `<link rel="canonical" href="${url}">`,
    `<meta name="description" content="${esc(page.description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(name)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(page.title)}">`,
    `<meta name="twitter:description" content="${esc(page.description)}">`,
    `<meta name="twitter:image" content="${img}">`,
    `<meta name="theme-color" content="${config.tokens['--bg']}">`,
  ].join('\n');
}

/* ── home page regions ─────────────────────────────────────────────────────── */

function buildHeroFacts(published) {
  const n = published.length;
  const noun = plural(n, config.site.noun, config.site.nounPlural).toLowerCase();
  return config.heroFacts
    .map(
      (f) =>
        `<li class="hero-fact">${icon(f.icon)}<span>${esc(
          f.text.replace('{count}', n).replace('{apps}', noun)
        )}</span></li>`
    )
    .join('\n');
}

function buildAppGrid(apps) {
  let n = 0;
  return apps
    .map((a) => {
      const style = `--cat:var(${a.category.token});--cat-soft:var(${a.category.token}2)`;
      // Colour is never the only signal: every tile carries the category icon and the
      // category name as text alongside the colour.
      const head =
        `  <div class="app-top">\n` +
        `    <span class="app-icon">${icon(a.category.icon)}</span>\n` +
        `    <span class="app-num">${a.published ? String(++n).padStart(2, '0') : '&mdash;'}</span>\n` +
        `  </div>\n` +
        `  <h3>${esc(a.title)}</h3>\n` +
        `  <p class="app-sub">${esc(a.category.label)} &middot; ${esc(a.subtitle)}</p>\n` +
        `  <p class="app-blurb">${esc(a.blurb)}</p>\n` +
        `  <ul class="app-tags">${a.tags.map((t) => `<li class="app-tag">${esc(t)}</li>`).join('')}</ul>`;

      if (!a.published) {
        return (
          `<li class="app pending" style="${style}">\n${head}\n` +
          `  <p class="app-status">In progress</p>\n</li>`
        );
      }
      return (
        `<li><a class="app" href="${a.slug}.html" style="${style}">\n${head}\n` +
        `  <span class="app-open">Open ${esc(a.title)}${icon('arrowRight')}</span>\n` +
        `</a></li>`
      );
    })
    .join('\n');
}

function buildAbout() {
  return config.about
    .map(
      (c) =>
        `<li class="about-card">\n` +
        `  <h3>${icon(c.icon)}<span>${esc(c.title)}</span></h3>\n` +
        `  <p>${esc(c.body)}</p>\n</li>`
    )
    .join('\n');
}

/* ── app page regions ──────────────────────────────────────────────────────── */

function buildTopbar(app, index, total) {
  const num = String(index + 1).padStart(2, '0');
  return (
    `<div class="wrap">\n` +
    `  <a href="index.html">${icon('arrowLeft')}<span>All ${esc(config.site.nounPlural)}</span></a>\n` +
    `  <span class="crumb-meta">${esc(config.site.noun)} ${num} / ${String(total).padStart(2, '0')}</span>\n` +
    `</div>`
  );
}

function buildPageNav(app) {
  const items = app.sections
    .map((s) => `    <li><a href="#${s.id}">${esc(s.label)}</a></li>`)
    .join('\n');
  return `<div class="wrap">\n  <ul>\n${items}\n  </ul>\n</div>`;
}

function buildPlay(app) {
  const next = app.sections[1];
  return (
    `<a class="skip-embed" href="#${next.id}">Skip past the interactive app</a>\n\n` +
    `<div class="play-frame" data-app="${app.slug}">\n` +
    `  <iframe class="play-embed"\n` +
    `          src="${app.payload}"\n` +
    `          title="${esc(app.title)} — ${esc(app.subtitle)}"\n` +
    `          allow="fullscreen"\n` +
    `          referrerpolicy="no-referrer"\n` +
    `          loading="lazy"></iframe>\n` +
    `</div>\n\n` +
    `<p class="play-actions">\n` +
    `  <a class="btn-play-full" href="${app.payload}" target="_blank" rel="noopener">` +
    `<span>Open full screen</span>${icon('external')}` +
    `<span class="sr-only"> (opens in a new tab)</span></a>\n` +
    // An embedded document does not receive key events until it holds focus. Saying so
    // costs one line and saves the "the keys don't work" moment.
    `  <span class="play-note">Click or tab into the app first so it receives your ` +
    `keyboard. Works best on a screen at least 900&nbsp;px wide.</span>\n` +
    `</p>`
  );
}

/*
 * Scroll-spy for the sticky section nav.
 *
 * Keyed off --scroll-offset, the same custom property the nav's `top` and every
 * section's `scroll-margin-top` use — keeping all three in sync is what makes an
 * anchor jump land on the section the nav says is current.
 *
 * It picks the LAST section whose top has crossed the line just under the sticky nav.
 * An earlier IntersectionObserver version picked the first still-intersecting section
 * instead, which is off by one: a section that has only just scrolled out still
 * overlaps the top of the observation band and beats the section actually being read.
 *
 * Progressive enhancement — without the script the nav is still a working anchor list.
 */
function buildScrollSpy(app) {
  const ids = app.sections.map((s) => s.id);
  return `<script>
(function () {
  var nav = document.querySelector('.page-nav');
  if (!nav) return;

  var ids = ${JSON.stringify(ids)};
  var links = {}, sections = [];
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    var a = nav.querySelector('a[href="#' + id + '"]');
    if (el && a) { links[id] = a; sections.push(el); }
  });
  if (!sections.length) return;

  var offset = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--scroll-offset'), 10
  ) || 60;

  var current = null, ticking = false;

  function update() {
    ticking = false;
    var line = offset + 16;
    var pick = sections[0];
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= line) pick = sections[i];
    }
    // The last section is often short enough that its top never reaches the line,
    // so at the bottom of the page select it explicitly.
    if (window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 2) {
      pick = sections[sections.length - 1];
    }
    if (pick.id === current) return;
    if (current && links[current]) links[current].removeAttribute('aria-current');
    current = pick.id;
    links[current].setAttribute('aria-current', 'true');
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  update();
})();
</script>`;
}

/*
 * The accessibility statement. Generated from config so it cannot drift from what
 * was actually measured, and worded to state the gaps rather than imply they aren't
 * there — an employer reading a portfolio can tell the difference.
 */
function buildA11y(app) {
  const parts = [];
  parts.push(
    `<h3>Accessibility, honestly</h3>`,
    `<p>The page around this app meets <strong>WCAG 2.1 AA</strong>: a skip link as the ` +
      `first focusable element, a "skip past the interactive app" link before the frame so ` +
      `keyboard users are never trapped inside it, verified colour contrast on every token ` +
      `pair, visible focus rings, 44&nbsp;px touch targets, and full ` +
      `<code>prefers-reduced-motion</code> support.</p>`,
    `<p>The app itself is an existing project embedded here, and it does not meet that bar ` +
      `in full. Specifically: ${esc(app.a11y.notes)}</p>`
  );

  if (app.storageKeys.length) {
    parts.push(
      `<p class="muted">This app saves progress in your browser's local storage ` +
        `(<code>${app.storageKeys.map(esc).join('</code>, <code>')}</code>). Nothing is sent ` +
        `anywhere. Safari clears script-written storage after about a week without a visit, ` +
        `so saved scores can disappear there — that is a browser policy, not a bug I can fix.</p>`
    );
  } else {
    parts.push(
      `<p class="muted">This app stores nothing — no local storage, no cookies, no analytics, ` +
        `no network requests of any kind.</p>`
    );
  }

  if (app.thirdParty.length) {
    parts.push(
      `<p class="muted">Third-party code: ` +
        app.thirdParty.map((t) => `${esc(t.name)} (${esc(t.license)})`).join(', ') +
        `, vendored into this repository rather than loaded from a CDN.</p>`
    );
  }

  return parts.join('\n');
}

/* ── footer ────────────────────────────────────────────────────────────────── */

function buildFooter(page, published) {
  const out = [];

  if (page.kind === 'app') {
    const i = published.findIndex((a) => a.slug === page.app.slug);
    const prev = i > 0 ? published[i - 1] : null;
    const next = i < published.length - 1 ? published[i + 1] : null;

    if (prev || next) {
      const cards = [];
      if (prev) {
        cards.push(
          `  <a class="prev" href="${prev.slug}.html">\n` +
            `    <span class="dir">${icon('arrowLeft')}<span>Previous</span></span>\n` +
            `    <span class="pt">${esc(prev.title)}</span>\n` +
            `    <span class="ps">${esc(prev.subtitle)}</span>\n  </a>`
        );
      }
      if (next) {
        cards.push(
          `  <a class="next" href="${next.slug}.html">\n` +
            `    <span class="dir"><span>Next</span>${icon('arrowRight')}</span>\n` +
            `    <span class="pt">${esc(next.title)}</span>\n` +
            `    <span class="ps">${esc(next.subtitle)}</span>\n  </a>`
        );
      }
      out.push(`<nav class="pager" aria-label="More ${esc(config.site.nounPlural)}">\n${cards.join('\n')}\n</nav>`);
    }

    out.push(
      `<p><a class="footer-back" href="index.html">${icon('arrowLeft')}` +
        `<span>Back to all ${esc(config.site.nounPlural)}</span></a></p>`
    );
  }

  out.push(`<p class="footer-disclaimer">${esc(config.site.disclaimer)}</p>`);

  const meta = [esc(config.site.name)];
  if (page.kind === 'app') {
    const i = published.findIndex((a) => a.slug === page.app.slug);
    meta.push(
      `${esc(config.site.noun)} ${i + 1} of ${published.length} — ${esc(page.app.title)}`
    );
  } else {
    meta.push(
      `${published.length} ${esc(
        plural(published.length, config.site.noun, config.site.nounPlural).toLowerCase()
      )}`
    );
  }
  meta.push('No tracking, no third-party requests');

  out.push(
    `<p class="footer-meta">` +
      meta.join('<span class="sep">·</span>') +
      `</p>`
  );

  return out.join('\n');
}

/* ── driver ────────────────────────────────────────────────────────────────── */

function main() {
  console.log("Applying site chrome for Dr. Cole's Math Lab …\n");

  /* -- config sanity, before touching any file ----------------------------- */
  const slugs = new Set();
  const tokens = new Set();
  const storage = new Map();
  for (const a of config.apps) {
    must(!slugs.has(a.slug), `duplicate slug "${a.slug}"`, 'config');
    slugs.add(a.slug);
    must(!tokens.has(a.category.token), `two apps share category colour ${a.category.token} — colour must stay a unique per-category signal`, 'config');
    tokens.add(a.category.token);
    for (const k of a.storageKeys) {
      must(
        !storage.has(k),
        `localStorage key "${k}" is used by both ${storage.get(k)} and ${a.slug} — same-origin iframes share one storage area, so these would collide`,
        'config'
      );
      storage.set(k, a.slug);
    }
    must(a.sections.length > 0 && a.sections[0].id === 'play', `${a.slug}: #play must be the first section`, 'config');
  }

  const published = config.apps.filter((a) => a.published);
  must(published.length > 0, 'no published apps', 'config');

  for (const a of published) {
    must(fs.existsSync(path.join(REPO, a.payload)), `${a.slug}: payload not found at ${a.payload}`, 'config');
    must(fs.existsSync(path.join(REPO, `${a.slug}.html`)), `${a.slug}: page not found at ${a.slug}.html`, 'config');
  }

  // Every <slug>.html at the repo root must correspond to a published app.
  for (const f of fs.readdirSync(REPO).filter((f) => f.endsWith('.html'))) {
    if (f === 'index.html') continue;
    const slug = f.replace(/\.html$/, '');
    must(
      published.some((a) => a.slug === slug),
      `${f} has no published entry in site.config.js — add one or delete the page`,
      'config'
    );
  }

  if (failures) {
    console.error(`\n✗ ${failures} config problem(s) — nothing written.\n`);
    process.exit(1);
  }

  const fonts = buildFontCss();
  const css = chromeCss(config);

  /* -- the page list ------------------------------------------------------- */
  const pages = [
    {
      kind: 'home',
      file: 'index.html',
      ogSlug: 'home',
      title: `${config.site.name} — ${config.site.metaTagline}`,
      description:
        `${published.length} interactive math ` +
        `${plural(published.length, 'app', 'apps')} you can use right in the browser — ` +
        `no download, no sign-up, no tracking. Built by ${config.site.author}.`,
    },
    ...published.map((a, i) => ({
      kind: 'app',
      app: a,
      index: i,
      file: `${a.slug}.html`,
      ogSlug: a.slug,
      title: a.og.title,
      description: a.og.description,
    })),
  ];

  /* -- rewrite each page --------------------------------------------------- */
  for (const page of pages) {
    const abs = path.join(REPO, page.file);
    const before = fs.readFileSync(abs, 'utf8');
    let html = before;
    const where = page.file;

    const apply = (name, body, comment, required) => {
      const next = fillRegion(html, name, body, comment);
      if (next === null) {
        must(!required, `missing ${name}:START / ${name}:END markers`, where);
        return;
      }
      html = next;
    };

    apply('META', buildMeta(page), 'html', true);
    apply('FONTS', fonts.css, 'css', true);
    apply('SITE CHROME', css, 'css', true);
    apply('FOOTER', buildFooter(page, published), 'html', true);

    if (page.kind === 'home') {
      apply('HERO FACTS', buildHeroFacts(published), 'html', true);
      apply('APP GRID', buildAppGrid(config.apps), 'html', true);
      apply('ABOUT', buildAbout(), 'html', true);
    } else {
      apply('TOPBAR', buildTopbar(page.app, page.index, published.length), 'html', true);
      apply('PAGENAV', buildPageNav(page.app), 'html', true);
      apply('PLAY', buildPlay(page.app), 'html', true);
      apply('A11Y', buildA11y(page.app), 'html', true);
      apply('SCROLLSPY', buildScrollSpy(page.app), 'html', true);
    }

    /* -- structural assertions on the finished page ----------------------- */
    const h1s = (html.match(/<h1[\s>]/g) || []).length;
    must(h1s === 1, `expected exactly one <h1>, found ${h1s}`, where);
    must(/<html lang="en">/.test(html), 'missing <html lang="en">', where);
    must(/class="skip-link"/.test(html), 'missing the skip link', where);
    must(/<main[\s>]/.test(html), 'missing <main> landmark', where);
    must(/id="main"/.test(html), 'missing id="main" for the skip link target', where);

    // No external origins anywhere. This is the rule the whole site rests on, so it
    // is checked here as well as in check-external.js — cheap, and it fails at the
    // moment a stray CDN reference is introduced rather than months later.
    const urls = html.match(/\bhttps?:\/\/[^\s"'<>()]+/g) || [];
    for (const u of urls) {
      const ok = u.startsWith(config.site.origin) || u.startsWith('http://www.w3.org/');
      must(ok, `external URL in markup: ${u}`, where);
    }

    if (page.kind === 'app') {
      must(/id="play"/.test(html), 'missing #play section', where);
      must(/class="skip-embed"/.test(html), 'missing the skip-past-embed link', where);
      for (const s of page.app.sections) {
        must(new RegExp(`id="${s.id}"`).test(html), `missing section #${s.id}`, where);
      }
      // The skip-embed link has to come before the iframe or it is useless.
      must(
        html.indexOf('class="skip-embed"') < html.indexOf('<iframe'),
        'the skip-past-embed link must appear before the iframe',
        where
      );
    }

    if (failures) continue;

    const changed = html !== before;
    fs.writeFileSync(abs, html);
    console.log(`  ${changed ? '✓ updated' : '· unchanged'}  ${page.file}`);
  }

  /* -- payload stylesheets ------------------------------------------------- */
  /*
   * Each embedded app is a separate document, so it needs its own copy of the
   * @font-face rules — the parent page's fonts do not cross the iframe boundary.
   * Any stylesheet under apps/ carrying FONTS markers gets filled here.
   */
  const appsDir = path.join(REPO, 'apps');
  if (fs.existsSync(appsDir)) {
    for (const slug of fs.readdirSync(appsDir)) {
      for (const name of ['styles.css', 'style.css']) {
        const abs = path.join(appsDir, slug, name);
        if (!fs.existsSync(abs)) continue;
        const before = fs.readFileSync(abs, 'utf8');
        const next = fillRegion(before, 'FONTS', fonts.css, 'css');
        if (next === null) {
          must(false, `apps/${slug}/${name} has no FONTS markers — the embedded app would fall back to system fonts`, 'payload');
          continue;
        }
        // Strip comments and the base64 payloads before checking — a comment that
        // mentions @import is documentation, not a reference.
        const live = next
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/data:font\/woff2;base64,[A-Za-z0-9+/=]+/g, '');
        must(!/@import/.test(live), `apps/${slug}/${name} has an @import`, 'payload');
        must(!/https?:\/\//.test(live), `apps/${slug}/${name} references an external URL`, 'payload');
        if (next !== before) fs.writeFileSync(abs, next);
        console.log(`  ${next !== before ? '✓ updated' : '· unchanged'}  apps/${slug}/${name}`);
      }
    }
  }

  /* -- service-worker cache names ------------------------------------------ */
  /*
   * A cache-first service worker with a hardcoded version string is the nastiest
   * failure mode available here: ship a payload change without bumping it and every
   * previous visitor keeps the old build permanently, with nothing to indicate it.
   *
   * So the version is not a rule anyone has to remember — it is derived from a hash of
   * the payload. Change any file in the app folder and the cache name changes with it.
   */
  for (const slug of fs.existsSync(appsDir) ? fs.readdirSync(appsDir) : []) {
    const swPath = path.join(appsDir, slug, 'sw.js');
    if (!fs.existsSync(swPath)) continue;

    const dir = path.join(appsDir, slug);
    const hash = crypto.createHash('sha256');
    // sw.js is excluded from its own hash — including it would be self-referential.
    for (const rel of listFiles(dir).filter((f) => f !== 'sw.js').sort()) {
      hash.update(rel);
      hash.update(fs.readFileSync(path.join(dir, rel)));
    }
    const name = `${slug}-${hash.digest('hex').slice(0, 10)}`;

    const before = fs.readFileSync(swPath, 'utf8');
    const next = fillRegion(before, 'CACHE NAME', `const CACHE = '${name}';`, 'css');
    if (next === null) {
      must(false, `apps/${slug}/sw.js has no CACHE NAME markers — its cache version cannot be derived`, 'sw');
      continue;
    }
    if (next !== before) fs.writeFileSync(swPath, next);
    console.log(`  ${next !== before ? '✓ updated' : '· unchanged'}  apps/${slug}/sw.js  (cache: ${name})`);
  }

  if (failures) {
    console.error(`\n✗ ${failures} problem(s) found.\n`);
    process.exit(1);
  }

  console.log(
    `\n  fonts inlined: ${(fonts.bytes / 1024).toFixed(1)} KB raw ` +
      `→ ~${((fonts.bytes * 4) / 3 / 1024).toFixed(0)} KB base64 per page`
  );
  console.log(`  ${published.length} published, ${config.apps.length - published.length} in progress\n`);
  console.log('Done. Now run: node tools/check-external.js\n');
}

main();
