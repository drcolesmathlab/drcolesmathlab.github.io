/*
 * home-css.js — the home page stylesheet (light / dark / auto).
 *
 * The app pages keep the dark-only SITE CHROME sheet in chrome-css.js — they frame
 * permanently dark apps, and a light theme around a dark iframe would look broken.
 * The home page has no iframe, so it gets its own sheet with a real theme toggle.
 *
 * Theme resolution, in order:
 *   <html data-theme="light|dark">   explicit choice from the toggle (persisted)
 *   prefers-color-scheme             "Auto" — no attribute, follows the OS live
 *   light                            the fallback with no media-query support
 *
 * Injected between the HOME CHROME markers in index.html by apply-site-chrome.js.
 * Do not hand-edit the copy inside index.html — it is overwritten.
 */

'use strict';

// Wordmark gradient stops. Exported so tools/check-contrast.js measures these exact
// values — each stop is large bold text on --bg and must clear 3:1.
const WORDMARK = {
  light: { pre: ['#0E7490', '#047857'], mid: ['#047857', '#4D7C0F'], post: ['#BE185D', '#9D174D'] },
  dark: { pre: ['#22D3EE', '#4ADE80'], mid: ['#4ADE80', '#A3E635'], post: ['#F472B6', '#FDA4AF'] },
};

function themeBlock(config, theme) {
  const lines = Object.entries(config.homeTokens[theme]).map(([k, v]) => `  ${k}:${v};`);
  for (const c of config.categories) {
    lines.push(`  --${c.id}:${c[theme].color}; --${c.id}-soft:${c[theme].soft};`);
  }
  const w = WORDMARK[theme];
  lines.push(
    `  --wm-pre:linear-gradient(90deg,${w.pre.join(',')});`,
    `  --wm-mid:linear-gradient(90deg,${w.mid.join(',')});`,
    `  --wm-post:linear-gradient(90deg,${w.post.join(',')});`,
    `  color-scheme:${theme};`
  );
  return lines.join('\n');
}

function homeCss(config) {
  const light = themeBlock(config, 'light');
  const dark = themeBlock(config, 'dark');

  return `
/* ── Theme tokens ────────────────────────────────────────────────────────── */
:root{
${light}
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
${dark.replace(/^/gm, '  ')}
  }
}
:root[data-theme="dark"]{
${dark}
}

/* ── Base ────────────────────────────────────────────────────────────────── */
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-padding-top:9rem}
body{
  margin:0;background:var(--bg);color:var(--text);
  font-family:'Nunito',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  font-size:1rem;line-height:1.5;-webkit-font-smoothing:antialiased;
}
.mono,.count,.idx,.result-meta,.footer-meta{font-family:'Space Mono',ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}
a{color:inherit}
.wrap{max-width:67.5rem;margin-inline:auto;padding-inline:1.25rem}
/* .grid and .grid > li set display, which would otherwise beat the hidden attribute
   the filter script toggles — filtered-out cards would stay on screen. */
[hidden]{display:none !important}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.ico{width:1em;height:1em;flex-shrink:0}

.skip-link{
  position:absolute;left:.75rem;top:-4rem;z-index:100;
  background:var(--focus);color:var(--on-focus);padding:.65rem 1rem;border-radius:.5rem;
  font-weight:800;text-decoration:none;
}
.skip-link:focus{top:.75rem}

a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{
  outline:2px solid var(--focus);outline-offset:2px;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
header.site{
  position:sticky;top:0;z-index:20;
  background:var(--bg);border-bottom:1px solid var(--border-soft);
}
@supports (backdrop-filter:blur(1px)){
  header.site{background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(10px)}
}
.brand-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;padding-block:.6rem}
.brand{display:flex;align-items:center;gap:.6rem;font-weight:800;font-size:1.02rem;letter-spacing:-.01em;text-decoration:none;min-height:2.75rem}
.gem{width:.95em;height:.95em;flex-shrink:0}

.theme-toggle{display:flex;border:1px solid var(--border);border-radius:.6rem;overflow:hidden}
.theme-toggle button{
  display:flex;align-items:center;gap:.4rem;min-height:2.75rem;
  background:var(--bg-elevated);color:var(--text-soft);
  border:0;border-inline-end:1px solid var(--border);
  padding:0 .8rem;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer;
}
.theme-toggle button:last-child{border-inline-end:0}
.theme-toggle button[aria-pressed="true"]{background:var(--focus);color:var(--on-focus)}
.theme-toggle button:focus-visible{outline-offset:-4px}

/* ── Hero ────────────────────────────────────────────────────────────────── */
.hero{padding-block:3.5rem 2rem;text-align:center}
.wordmark{
  margin:0;display:flex;align-items:center;justify-content:center;gap:.35em;flex-wrap:wrap;
  font-size:clamp(2rem,5vw,3rem);font-weight:900;letter-spacing:-.02em;line-height:1.15;
}
.wordmark .grad{background-clip:text;-webkit-background-clip:text;color:transparent}
.wordmark .w-pre{background-image:var(--wm-pre)}
.wordmark .w-mid{background-image:var(--wm-mid)}
.wordmark .w-post{background-image:var(--wm-post)}
/* Windows High Contrast / forced colours drops background images, which would leave
   transparent text. Fall back to the system text colour. */
@media (forced-colors:active){.wordmark .grad{color:CanvasText;background:none}}
.tagline{margin:.9rem auto 0;max-width:44ch;color:var(--text-soft);font-size:1.05rem}
.hero-facts{display:flex;flex-wrap:wrap;gap:.6rem;justify-content:center;margin:1.5rem 0 0;padding:0;list-style:none}
.hero-fact{
  display:flex;align-items:center;gap:.45rem;border:1px solid var(--border);background:var(--bg-elevated);
  padding:.45rem .9rem;border-radius:999px;font-size:.85rem;color:var(--text-soft);
}

/* ── Section headings ────────────────────────────────────────────────────── */
h2{font-size:1.5rem;font-weight:900;letter-spacing:-.01em;margin:0 0 .35rem}
.section-lead{color:var(--text-soft);font-size:.95rem;max-width:60ch;margin:0 0 1.25rem}

/* ── Controls ────────────────────────────────────────────────────────────── */
.controls{position:sticky;top:3.9rem;z-index:15;background:var(--bg);padding-block:.75rem 1rem}
.search-row{display:flex;gap:.6rem;flex-wrap:wrap}
.search-box{position:relative;flex:1;min-width:12rem}
.search-box .ico{position:absolute;left:.8rem;top:50%;transform:translateY(-50%);color:var(--text-faint);pointer-events:none}
.search-box input{
  width:100%;min-height:2.75rem;padding:.6rem .9rem .6rem 2.4rem;
  border-radius:.6rem;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);
  font:inherit;font-size:.95rem;
}
.search-box input::placeholder{color:var(--text-faint);opacity:1}
.sort-select{
  min-height:2.75rem;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);
  border-radius:.6rem;padding:0 .75rem;font:inherit;font-size:.88rem;cursor:pointer;
}
.chip-rail{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem}
.chip{
  display:inline-flex;align-items:center;gap:.4rem;min-height:2.75rem;
  border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-soft);
  padding:0 .9rem;border-radius:999px;font:inherit;font-size:.85rem;font-weight:800;cursor:pointer;white-space:nowrap;
}
.chip .count{font-size:.75rem;font-weight:400}
.chip .chip-glyph{font-weight:900}
.chip[aria-pressed="true"]{color:var(--text);border-color:var(--text);background:var(--border-soft)}
.chip[data-cat][aria-pressed="true"]{color:var(--cat);border-color:var(--cat);background:var(--cat-soft)}
/* Pressed state is also shown by a check mark, so it never relies on colour alone. */
.chip .chip-check{display:none}
.chip[aria-pressed="true"] .chip-check{display:inline}
/* Chips are rendered for no-JS readers too, but do nothing without the script. */
.no-js .controls{display:none}

.result-meta{margin:.25rem 0 0;font-size:.8rem;color:var(--text-faint);min-height:1.2em}

/* ── Grid ────────────────────────────────────────────────────────────────── */
.grid{list-style:none;margin:0;padding:1rem 0 3.5rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,16rem),1fr));gap:1rem}
.grid > li{display:flex}
.card{
  position:relative;flex:1;
  background:var(--bg-elevated);border:1px solid var(--border);border-radius:.9rem;padding:1.25rem;
  display:flex;flex-direction:column;gap:.75rem;min-height:12.5rem;
}
.card:focus-within{outline:2px solid var(--focus);outline-offset:2px}
.card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem}
.glyph{
  width:2.4rem;height:2.4rem;border-radius:.55rem;display:flex;align-items:center;justify-content:center;
  font-size:1.15rem;font-weight:900;background:var(--cat-soft);color:var(--cat);
}
.idx{font-size:.8rem;color:var(--text-faint);padding-top:.25rem}
.card h3{font-weight:900;font-size:1.1rem;letter-spacing:-.01em;margin:0}
.card-kicker{font-size:.74rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin:.15rem 0 0;color:var(--text-soft)}
.card-kicker .cat{color:var(--cat)}
.card-desc{font-size:.9rem;color:var(--text-soft);line-height:1.55;flex:1;margin:0}
.card-tags{display:flex;flex-wrap:wrap;gap:.4rem;list-style:none;margin:0;padding:0}
.tag{font-size:.75rem;padding:.2rem .55rem;border-radius:.4rem;background:var(--border-soft);color:var(--text-soft);border:1px solid var(--border)}
.open-link{
  display:inline-flex;align-items:center;gap:.35rem;min-height:2.75rem;
  font-size:.9rem;font-weight:800;color:var(--cat);text-decoration:underline;text-underline-offset:3px;
}
.open-link:focus-visible{outline:none}
/* The whole card is the hit area; the link text stays the accessible name. */
.open-link::after{content:"";position:absolute;inset:0;border-radius:.9rem}

.empty-state{text-align:center;color:var(--text-soft);padding-block:2.5rem 3.5rem}
.empty-state h3{color:var(--text);margin:0 0 .5rem;font-size:1.1rem}
.empty-state p{margin:0}

/* ── About ───────────────────────────────────────────────────────────────── */
#about{padding-block:1rem 3rem}
.about-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;list-style:none;margin:1.25rem 0 0;padding:0}
.about-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:.9rem;padding:1.35rem}
.about-card h3{display:flex;align-items:center;gap:.55rem;font-size:1rem;font-weight:900;margin:0 0 .4rem}
.about-card h3 .ico{color:var(--focus);width:1.1em;height:1.1em}
.about-card p{margin:0;font-size:.9rem;color:var(--text-soft);line-height:1.55}

/* ── Footer ──────────────────────────────────────────────────────────────── */
footer.site{border-top:1px solid var(--border-soft);padding-block:1.4rem 2.75rem;color:var(--text-faint);font-size:.82rem}
footer.site p{margin:0 0 .4rem}
.footer-meta .sep{margin-inline:.45rem}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width:40rem){
  .about-grid{grid-template-columns:1fr}
  .hero{padding-block:2.5rem 1.5rem}
  .controls{position:static}
  .theme-toggle button{padding:0 .6rem}
}

/* ── Reduced motion ──────────────────────────────────────────────────────── */
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none !important;transition:none !important;scroll-behavior:auto !important}
}
`;
}

module.exports = { homeCss, WORDMARK };
