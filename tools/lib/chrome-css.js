/*
 * chrome-css.js — the shared app-page stylesheet (light / dark / auto).
 *
 * Every page carries its own inline copy of this (spec §1: no external stylesheets),
 * so this file is the one source of truth and tools/apply-site-chrome.js injects it
 * between the SITE CHROME markers in each page's <style> block.
 *
 * Theme resolution matches the home page (home-css.js), so one choice covers the site:
 *   <html data-theme="light|dark">   explicit choice from the toggle (persisted)
 *   prefers-color-scheme             "Auto" — no attribute, follows the OS live
 *   light                            the fallback with no media-query support
 *
 * Only the page around the iframe changes. The embedded apps are dark-only, so the
 * frame's letterbox (--frame-bg) stays dark in both themes.
 *
 * Do not hand-edit the copies inside the .html files — they are overwritten.
 */

'use strict';

const { WORDMARK } = require('./home-css.js');

function themeBlock(config, theme) {
  const tokens = theme === 'light' ? config.tokensLight : config.tokens;
  const [a, b, c] = WORDMARK[theme].stops;
  return [
    ...Object.entries(tokens).map(([k, v]) => `  ${k}:${v};`),
    `  --wm:linear-gradient(90deg,${a},${b} 45%,${c});`,
    `  --wm-icon:linear-gradient(135deg,${a},${c});`,
    `  --wm-glow:${a};`,
    `  color-scheme:${theme};`,
  ].join('\n');
}

module.exports = function chromeCss(config) {
  const light = themeBlock(config, 'light');
  const dark = themeBlock(config, 'dark');

  // One rule per app so each iframe gets a box sized to how that app actually behaves.
  const frameRules = config.apps
    .map((a) => {
      const f = a.frame || {};
      const decls = [
        f.height ? `height:${f.height}` : null,
        f.width ? `width:${f.width}` : null,
        f.center ? 'margin-inline:auto' : null,
      ].filter(Boolean).join(';');
      return `.play-frame[data-app="${a.slug}"]{${decls}}`;
    })
    .join('\n');

  return `
/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS
   Carried from Dr. Cole's Transform Lab. One deliberate change: --mu was
   #6b7498, which measures 4.40:1 on --bg and 4.23:1 on --sf — below the 4.5:1
   WCAG AA floor for normal text, and it carries subtitles, card copy, tags and
   footer meta. #7a83a8 measures 5.42:1 / 5.22:1. Full table in README.md.
   The light set is measured by tools/check-contrast.js.
   ═══════════════════════════════════════════════════════════════════════════ */
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
:root{
  --maxw:1080px;
  --scroll-offset:60px;   /* shared by the sticky nav's top and every section's
                             scroll-margin-top, so an anchor jump lands where the
                             nav highlight says it will */
}

*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}

body{
  font-family:'Nunito','Avenir Next','Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif;
  background:var(--bg);color:var(--tx);min-height:100vh;overflow-x:hidden;
  line-height:1.6;-webkit-font-smoothing:antialiased;
}

/* Brand atmosphere: scanline stripes + a soft vignette. Decorative and
   pointer-transparent, sitting behind everything via z-index. */
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:repeating-linear-gradient(0deg,var(--scan) 0,var(--scan) 1px,transparent 1px,transparent 3px)}
body::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:radial-gradient(ellipse at 50% 8%,var(--glow) 0,transparent 55%)}

.wrap{position:relative;z-index:1;width:100%;max-width:var(--maxw);margin:0 auto;padding:0 22px}

/* ── Typography ──────────────────────────────────────────────────────────── */
h2{font-size:clamp(1.35rem,3vw,1.75rem);font-weight:900;letter-spacing:-.4px;color:var(--pre)}
h3{font-size:1.06rem;font-weight:800;color:var(--pre)}
p{color:var(--tx)}
a{color:var(--tc)}
strong{color:var(--pre);font-weight:800}
code,kbd,.mono{font-family:'Space Mono','SF Mono',Consolas,monospace}
kbd{background:var(--sf2);border:1px solid var(--kbd-border);border-radius:5px;
  padding:1px 6px;font-size:.82em;color:var(--pre);white-space:nowrap}

/* ── Accessibility utilities ─────────────────────────────────────────────── */
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* The card grids and pill rows are marked up as lists so assistive tech announces
   "list, 3 items" — but they are styled as grids, so the markers come off. Prose
   lists inside .prose keep theirs. */
.hero-facts,.app-grid,.app-tags,.about-grid,.page-nav ul{list-style:none}

/* The skip link is the first focusable element on every page. It is off-screen
   until focused, then becomes a solid chip in the top-left. */
.skip-link{position:absolute;left:12px;top:-100px;z-index:100;
  background:var(--tc);color:var(--on-tc);font-weight:900;padding:12px 18px;
  border-radius:0 0 10px 10px;text-decoration:none;transition:top .15s}
.skip-link:focus{top:0}

:focus-visible{outline:3px solid var(--tc);outline-offset:3px;border-radius:4px}

/* ── Top bar (app pages only) ────────────────────────────────────────────── */
/* Deliberately NOT sticky. The in-page nav below owns position:sticky, so there
   is exactly one sticky element and the --scroll-offset math stays honest. */
.topbar{border-bottom:1px solid var(--sf2);background:var(--topbar-bg)}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;
  gap:14px;min-height:52px;flex-wrap:wrap}
.topbar a{display:inline-flex;align-items:center;gap:7px;color:var(--mu);
  text-decoration:none;font-weight:800;font-size:.86rem;white-space:nowrap;
  padding:11px 4px;min-height:44px}
.topbar .ico{flex:0 0 auto;width:16px;height:16px}
.topbar a:hover{color:var(--tc)}
.topbar .crumb-meta{color:var(--mu);font-size:.78rem;font-weight:700;
  font-family:'Space Mono','SF Mono',Consolas,monospace;letter-spacing:.3px}
.topbar-end{display:flex;align-items:center;gap:14px;flex-wrap:wrap}

/* Light / Dark / Auto — same buttons and storage key as the home page. Rendered
   hidden and revealed by the THEME BOOT script, so it never shows without JS. */
.theme-toggle{display:flex;border:1px solid var(--sf2);border-radius:10px;overflow:hidden}
.theme-toggle[hidden]{display:none}
.theme-toggle button{display:flex;align-items:center;gap:6px;min-height:44px;
  background:var(--sf);color:var(--mu);border:0;border-inline-end:1px solid var(--sf2);
  padding:0 12px;font:inherit;font-size:.8rem;font-weight:800;cursor:pointer}
.theme-toggle button:last-child{border-inline-end:0}
.theme-toggle button:hover{color:var(--tx)}
.theme-toggle button[aria-pressed="true"]{background:var(--tc);color:var(--on-tc)}
.theme-toggle button:focus-visible{outline-offset:-4px}
.theme-toggle .ico{width:15px;height:15px}

/* ── Header / wordmark ───────────────────────────────────────────────────── */
header.site{text-align:center;padding:26px 0 20px}
.logo{display:inline-flex;align-items:center;gap:10px;margin-bottom:4px;flex-wrap:wrap;justify-content:center}
.logo-pre,.logo h1,.logo .wordmark{
  font-size:clamp(1.8rem,5vw,2.6rem);font-weight:900;letter-spacing:-1px;line-height:1.1;
  background:var(--wm);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.logo-icon{width:36px;height:36px;flex:0 0 36px;
  background:var(--wm-icon);
  clip-path:polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%);
  animation:spin 10s linear infinite;filter:drop-shadow(0 0 8px var(--wm-glow))}
@keyframes spin{to{transform:rotate(360deg)}}
.subtitle{color:var(--mu);font-size:.92rem;font-weight:700;margin-top:6px}

/* ── Hero facts ──────────────────────────────────────────────────────────── */
.hero-facts{display:flex;gap:9px;justify-content:center;flex-wrap:wrap;margin:18px 0 4px}
.hero-fact{display:inline-flex;align-items:center;gap:7px;background:var(--sf);
  border:1px solid var(--sf2);border-radius:50px;padding:7px 15px;
  color:var(--tx);font-size:.8rem;font-weight:700}
.hero-fact .ico{width:15px;height:15px;color:var(--tc);flex:0 0 15px}

/* ── Sections ────────────────────────────────────────────────────────────── */
main{position:relative;z-index:1;display:block}
section{scroll-margin-top:calc(var(--scroll-offset) + 14px);padding:34px 0 6px}
.section-lead{color:var(--mu);font-size:.96rem;margin:8px 0 20px;max-width:66ch}
section > h2 + .section-lead{margin-top:8px}

/* ── In-page nav (app pages) ─────────────────────────────────────────────── */
.page-nav{position:sticky;top:0;z-index:20;background:var(--nav-bg);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--sf2);margin-bottom:6px}
.page-nav ul{display:flex;gap:4px;list-style:none;overflow-x:auto;
  scrollbar-width:none;min-height:var(--scroll-offset);align-items:center}
.page-nav ul::-webkit-scrollbar{display:none}
.page-nav a{display:flex;align-items:center;min-height:44px;padding:0 13px;
  color:var(--mu);text-decoration:none;font-weight:800;font-size:.83rem;
  white-space:nowrap;border-bottom:2px solid transparent}
.page-nav a:hover{color:var(--tx)}
.page-nav a[aria-current="true"]{color:var(--tc);border-bottom-color:var(--tc)}

/* ── App grid (home) ─────────────────────────────────────────────────────── */
.app-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px}
.app{display:flex;flex-direction:column;gap:9px;background:var(--sf);
  border:1px solid var(--sf2);border-radius:14px;padding:19px 19px 17px;
  text-decoration:none;color:inherit;transition:transform .2s,border-color .2s,box-shadow .2s}
a.app:hover{transform:translateY(-3px);border-color:var(--cat);
  box-shadow:0 10px 30px -14px var(--cat)}
.app-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.app-icon{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;
  border-radius:11px;background:var(--cat-soft);color:var(--cat);border:1px solid var(--cat-soft)}
.app-icon .ico{width:20px;height:20px}
.app-num{font-family:'Space Mono','SF Mono',Consolas,monospace;font-size:.76rem;
  font-weight:700;color:var(--mu)}
.app h3{font-size:1.16rem}
.app-sub{color:var(--cat);font-size:.79rem;font-weight:800;
  text-transform:uppercase;letter-spacing:.6px;margin-top:-4px}
.app-blurb{color:var(--mu);font-size:.9rem;flex:1}
.app-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.app-tag{background:var(--sf2);color:var(--tx);border-radius:6px;
  padding:3px 9px;font-size:.72rem;font-weight:700}
.app-open{display:inline-flex;align-items:center;gap:7px;color:var(--cat);
  font-weight:900;font-size:.88rem;margin-top:6px}
.app-open .ico{width:17px;height:17px;transition:transform .2s}
a.app:hover .app-open .ico{transform:translateX(4px)}

/* Roadmap tiles: listed but not yet shipped, so not a link and not a dead end. */
.app.pending{opacity:.62;cursor:default}
.app.pending .app-status{display:inline-flex;align-items:center;gap:6px;
  color:var(--mu);font-weight:900;font-size:.85rem;margin-top:6px}
.app.pending .app-status::before{content:'';width:8px;height:8px;border-radius:50%;
  background:var(--cat);box-shadow:0 0 8px var(--cat)}

/* ── About grid (home) ───────────────────────────────────────────────────── */
/* minmax(380px,1fr) so four cards land as a clean 2x2 rather than an orphaned
   third column at common desktop widths. */
.about-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:14px}
.about-card{background:var(--sf);border:1px solid var(--sf2);border-radius:14px;padding:18px}
.about-card .ico{width:19px;height:19px;color:var(--tc);flex:0 0 19px}
.about-card h3{display:flex;align-items:center;gap:9px;margin-bottom:6px}
.about-card p{color:var(--mu);font-size:.9rem}

/* ── Prose blocks on app pages ───────────────────────────────────────────── */
.prose{background:var(--sf);border:1px solid var(--sf2);border-radius:14px;
  padding:20px 22px;max-width:none}
.prose p + p,.prose ul + p,.prose p + ul,.prose ol + p,.prose p + ol{margin-top:12px}
.prose ul,.prose ol{margin-left:20px;color:var(--tx)}
.prose li{margin:6px 0}
.prose li::marker{color:var(--mu)}
.prose h3{margin:18px 0 7px}
.prose h3:first-child{margin-top:0}
.prose .muted{color:var(--mu);font-size:.92rem}

.callout{border-left:3px solid var(--tc);background:var(--tc2);
  border-radius:0 10px 10px 0;padding:14px 17px;margin:14px 0}
.callout.warn{border-left-color:var(--oc);background:var(--oc2)}

/* ── The embedded app ────────────────────────────────────────────────────── */
.play-lead{color:var(--mu);font-size:.96rem;margin:8px 0 6px;max-width:70ch}

/* An iframe is a single tab stop that drops a keyboard user into a document with
   dozens of controls and no obvious way back. This link, placed BEFORE the frame,
   is the escape hatch. Hidden until focused, then a visible chip. */
.skip-embed{position:absolute;left:-9999px;display:inline-flex;align-items:center;
  gap:7px;font-weight:800;font-size:.85rem;text-decoration:none}
/* :focus, not :focus-visible — a skip link should show whenever it holds focus,
   including when focus was moved programmatically. min-height keeps it at the 44px
   target size; padding alone lands at 43.8px. */
.skip-embed:focus{position:static;left:auto;background:var(--tc);color:var(--on-tc);
  padding:11px 16px;min-height:44px;border-radius:9px;margin:10px 0 0}

.play-frame{position:relative;margin:16px 0 12px;border:1px solid var(--sf2);
  border-radius:14px;overflow:hidden;background:var(--frame-bg);
  box-shadow:0 20px 50px -30px var(--shadow)}
.play-embed{display:block;width:100%;height:100%;border:0}
${frameRules}

.play-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px}
.btn-play-full{display:inline-flex;align-items:center;gap:8px;min-height:44px;
  padding:10px 18px;background:var(--sf);border:1px solid var(--tc);
  border-radius:10px;color:var(--tc);font-weight:900;font-size:.88rem;text-decoration:none}
.btn-play-full:hover{background:var(--tc2)}
.btn-play-full .ico{width:16px;height:16px}
.play-note{color:var(--mu);font-size:.83rem}

/* ── Footer + pager ──────────────────────────────────────────────────────── */
footer.site{position:relative;z-index:1;margin-top:46px;padding-bottom:44px}
.footer-rule{border:0;border-top:1px solid var(--sf2);margin:0 0 22px}
.pager{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
  gap:14px;margin-bottom:24px}
.pager a{display:flex;flex-direction:column;gap:3px;background:var(--sf);
  border:1px solid var(--sf2);border-radius:12px;padding:15px 17px;
  text-decoration:none;color:inherit;min-height:44px}
.pager a:hover{border-color:var(--tc)}
.pager .dir{display:inline-flex;align-items:center;gap:6px;color:var(--mu);
  font-size:.74rem;font-weight:800;text-transform:uppercase;letter-spacing:.7px}
.pager .dir .ico{width:14px;height:14px}
.pager .pt{color:var(--pre);font-weight:800}
.pager .ps{color:var(--mu);font-size:.83rem}
.pager .next{text-align:right}
.pager .next .dir{justify-content:flex-end}
.footer-disclaimer{color:var(--mu);font-size:.85rem;max-width:78ch}
.footer-meta{display:flex;gap:10px;flex-wrap:wrap;align-items:center;
  margin-top:14px;color:var(--mu);font-size:.78rem;
  font-family:'Space Mono','SF Mono',Consolas,monospace}
.footer-meta .sep{opacity:.45}
.footer-back{display:inline-flex;align-items:center;gap:7px;min-height:44px;
  color:var(--tc);font-weight:800;font-size:.87rem;text-decoration:none}
.footer-back .ico{width:16px;height:16px}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width:640px){
  .wrap{padding:0 16px}
  .play-frame{height:clamp(420px,70vh,640px) !important;width:100% !important}
  .about-grid{grid-template-columns:1fr}
  .pager .next{text-align:left}
  .pager .next .dir{justify-content:flex-start}
}
/* At phone width the back link, counter and three labelled buttons don't fit on one
   row. The labels become screen-reader-only; the icons carry the choice visually and
   each button keeps its text name. */
@media (max-width:480px){
  .theme-toggle button{padding:0 11px}
  .theme-toggle button span{position:absolute;width:1px;height:1px;padding:0;margin:-1px;
    overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
}

/* Windows High Contrast / forced colours drops background images, which would leave
   the gradient wordmark as transparent text. */
@media (forced-colors:active){
  .logo-pre,.logo h1,.logo .wordmark{background:none;-webkit-text-fill-color:CanvasText;color:CanvasText}
}

/* ── Reduced motion ──────────────────────────────────────────────────────── */
/* The upstream Transform Lab has no guard on its spinning logo — that gap is not
   carried forward. Functional transitions collapse to near-zero rather than being
   removed, so state changes stay perceivable. */
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .logo-icon{animation:none}
  *,*::before,*::after{
    animation-duration:.01ms !important;
    animation-iteration-count:1 !important;
    transition-duration:.01ms !important;
  }
  a.app:hover{transform:none}
  a.app:hover .app-open .ico{transform:none}
}
`.trim();
};
