# Dr. Cole's Math Lab

A portfolio site for a set of interactive math apps. The point is that every app is
**actually usable in the page** — not a screenshot, not a video, not an app-store link.

Live at `https://drcolesmathlab.github.io` (GitHub Pages, canonical) and
`https://drcolesmathlab.dr-stock-investing.workers.dev` (Cloudflare Worker). See
*Deploying* below for why the canonical host is GitHub Pages.

---

## The one rule

> **No external-origin requests. Every asset ships in this repository. Every page renders
> correctly from a checkout, offline, with no build step.**

No CDN scripts. No Google Fonts. No analytics. No third-party anything. A page that
depends on a CDN can break invisibly months later, with no way to hotfix a link someone
already shared — and the whole value of this site is that shared links keep working.

`node tools/check-external.js` enforces this, and the chrome generator runs the same
check on every page it writes. Both exit non-zero on a violation.

---

## Layout

```
index.html                  home — search, category filter, sort, light/dark/auto theme
<slug>.html                 one page per app; embeds the app and explains it
apps/<slug>/                the app itself, self-contained, relative paths only
assets/fonts/               woff2 source files + OFL licence text
assets/og-<slug>.png        1200x630 social preview cards
tools/site.config.js        SINGLE SOURCE OF TRUTH — read this first
tools/apply-site-chrome.js  regenerates every shared region of every page
tools/lib/home-css.js       the home page stylesheet (light / dark / auto)
tools/lib/chrome-css.js     the app-page stylesheet (dark only)
tools/check-contrast.js     measures every home colour pair against WCAG AA
tools/build-transform-lab.js  vendors Transform Lab (ES modules → one classic script)
tools/vendor-tiger-trail.js   vendors Tiger Trail (copy + five documented patches)
tools/vendor-balancing-act.js vendors Balancing Act (copies six files BY NAME — see below)
tools/build-real-number-monsters.js  builds Real Number Monsters (Vite → one classic script)
tools/vendor-squares-cubes.js vendors Squares & Cubes Explorer (lifts its inline <style> into styles.css)
tools/check-external.js     the no-external-origins gate
tools/og-cards.html         card templates
tools/build-og-cards.js     screenshots them into assets/
.nojekyll                   stops Jekyll from reinterpreting anything
_headers                    Cloudflare response headers (GitHub Pages ignores it)
_redirects                  Cloudflare rewrites: / and apps/tiger-trail/ → their index.html
wrangler.jsonc              Cloudflare Worker config (static assets, no script)
.assetsignore               what the Worker must NOT publish — .git, tools/, README …
```

---

## Adding an app

1. Add an entry to `apps` in [`tools/site.config.js`](tools/site.config.js). Array order
   drives the prev/next pager and OG filenames. Give it a `category` id from
   `categories` (algebra, geometry, stats, testprep, games — confirm with Dr. Cole before
   adding a new one) and a `dateAdded` (`YYYY-MM-DD`), which drives "Newest first" on the
   home page. `grade` is optional and adds a grade tag to the home card; leave it off
   until the band is confirmed.
2. Copy the app's files into `apps/<slug>/` so its `payload` path resolves. Relative
   paths only; no CDN references.
3. Give its stylesheet a `/* FONTS:START */` … `/* FONTS:END */` marker pair so the
   generator can inject the fonts (an iframe is a separate document — the parent page's
   fonts do not cross the boundary).
4. Copy `transform-lab.html` to `<slug>.html` and rewrite the prose sections. Leave every
   `<!-- NAME:START -->` … `<!-- NAME:END -->` region alone; the generator owns those.
5. Set `published: true` and run:

   ```bash
   node tools/apply-site-chrome.js && node tools/check-external.js && node tools/check-contrast.js && node tools/build-og-cards.js
   ```

Apps with `published: false` are left off the home page and out of the pager.

There is deliberately **no add/edit UI on the site** — no button, form or admin panel.
The app list changes only by editing `site.config.js` and redeploying.

### What the generator owns

Everything between these markers is regenerated on every run. **Edits inside them are
lost.** Everything outside is hand-authored and never touched.

| Marker | Where | What |
|---|---|---|
| `META` | every page | canonical, OG, Twitter, theme-color |
| `FONTS` | every page + payload CSS | `@font-face` blocks, base64 |
| `CACHE NAME` | payload `sw.js` | service-worker cache version, hashed from the payload |
| `SITE CHROME` | app pages | the dark app-page stylesheet |
| `HOME CHROME`, `THEME BOOT`, `THEME TOGGLE` | home | light/dark/auto stylesheet, pre-paint theme script, toggle buttons |
| `HERO FACTS`, `CHIPS`, `APP GRID`, `ABOUT`, `HOME SCRIPT` | home | fact pills, filter chips, cards, about cards, search/filter/sort script |
| `TOPBAR`, `PAGENAV`, `PLAY`, `A11Y`, `SCROLLSPY` | app pages | chrome + embed + a11y statement |
| `FOOTER` | every page | pager, disclaimer, footer meta |

The generator is idempotent — run it twice, get no diff. That property is worth
protecting; it's what makes it safe to run on every edit.

### What it refuses to do

`apply-site-chrome.js` fails loudly rather than emitting a broken site. It stops on:
duplicate slugs; two apps sharing a category colour (colour has to stay a unique signal);
a `localStorage` key claimed by two apps (same-origin iframes share one storage area, so
those really would collide); a missing payload; a `<slug>.html` with no config entry;
`#play` not being the first section; a page without exactly one `<h1>`, without a skip
link, or without `<main id="main">`; a skip-past-embed link that appears *after* its
iframe; and any external URL in the output.

---

## Why the apps are in iframes

Spec §1 originally asked for one self-contained `.html` file per page. That was written
for hand-built 30 KB arcade games. These are full-screen applications, and inlining them
into a shared page breaks them in six independent ways:

| Problem | Where |
|---|---|
| `window.Storage` is overwritten, shadowing the DOM interface | Tiger Trail `src/storage.js:161` |
| six `export function init()` in one scope | Transform Lab `src/js/modules/*.js` |
| canvas sized from `window.innerHeight` — correct in a frame, wrong on a long page | `canvas.js:64`, `game.js:97` |
| `*`, `body`, `h1` styled directly, plus two `position:fixed` full-viewport overlays | Transform Lab `styles.css` |
| `<style>` injected into `document.head` at runtime | `canvas.js:89` |
| document-level `touchmove` `preventDefault` would kill page scrolling on mobile | Tiger Trail `main.js:33` |

An iframe fixes all six with **zero edits to app internals**, and lets each app keep its
own `<h1>` without breaking the one-per-page rule.

A relative, same-repo iframe has no third-party dependency, no DNS, no version drift —
it satisfies the *rationale* of the original rule completely. So the promise is restated
as the one at the top of this file, which is a promise this repo can actually keep.

**Do not add a `sandbox` attribute to the iframes.** It creates an opaque origin, which
kills `localStorage` (saved scores) and blocks the `AudioContext` unlock gesture. The
only "safe" value would be `allow-scripts allow-same-origin allow-popups allow-modals`,
which is equivalent to omitting it. So it is omitted deliberately.

---

## Why the fonts are base64 `data:` URIs

Chrome fetches `@font-face` in CORS mode. From a `file://` page the origin is opaque, the
fetch fails, and the browser quietly falls back to the next family in the stack. The page
still renders — just in the wrong typeface. That is a regression nobody notices, and it
would have silently broken the offline-from-disk promise for the most common browser.

A `data:` URI has no origin and no CORS check, so it works everywhere. Cost is ~76 KB of
base64 per page, which gzips down substantially over the wire.

The `.woff2` files stay committed under `assets/fonts/` as the source of truth. That is
also what satisfies the OFL requirement that the licence travel with a redistributed font
— see [`LICENSE-apps.md`](LICENSE-apps.md).

Nunito ships from Google as a **variable** font, so one 38 KB file covers the whole
400–900 range and the browser interpolates real weights instead of faking them. Space
Mono needs both 400 and 700, because every coordinate label the app paints onto the
canvas uses `bold …px "Space Mono"` and canvas text cannot fake a bold cleanly.

---

## Colour contrast

Measured, not assumed. WCAG 2.1 AA needs **4.5:1** for normal text and **3:1** for large
text (≥24 px, or ≥19 px bold) and for UI-component boundaries.

| Token | Hex | Role | on `--bg` | on `--sf` | on `--sf2` |
|---|---|---|---|---|---|
| `--pre` | `#ffffff` | headings | 20.19:1 | 19.42:1 | 18.20:1 |
| `--tx` | `#eef2ff` | body text | 18.06:1 | 17.37:1 | 16.28:1 |
| `--rc` | `#00ff7f` | green accent | 15.01:1 | 14.44:1 | 13.53:1 |
| `--oc` | `#ffcc00` | gold accent | 13.36:1 | 12.85:1 | 12.04:1 |
| `--tc` | `#00d4ff` | cyan accent | 11.41:1 | 10.97:1 | 10.28:1 |
| `--or` | `#ff9500` | orange accent | 9.18:1 | 8.83:1 | 8.28:1 |
| `--dc` | `#ff3355` | red accent | 5.63:1 | 5.42:1 | 5.08:1 |
| `--ax` | `#bb55ff` | purple accent | 5.63:1 | 5.42:1 | 5.08:1 |
| `--mu` | `#7a83a8` | muted text | 5.42:1 | 5.22:1 | 4.89:1 |

**One token was changed from the source brand.** `--mu` was `#6b7498`, which measures
**4.40 / 4.23 / 3.97** — below the 4.5:1 floor on all three surfaces. It carries
subtitles, card copy, tags and footer meta, so it is the single most-used text colour
after `--tx`. Lightened to `#7a83a8`. Everything else is carried over unchanged.

Passing the ratio is not the same as being readable: the saturated neons are used as
accents, borders, badges and large headings, not as small paragraph text.

---

## Accessibility

The site chrome — everything on the page outside the iframe — is held to WCAG 2.1 AA:
skip link as the first focusable element, a **skip-past-embed** link before every iframe
(an iframe is one tab stop that drops a keyboard user into a document with dozens of
controls and no obvious way back), landmark elements, one `<h1>` per page, real heading
hierarchy, visible focus rings, 44 px touch targets, verified contrast, and full
`prefers-reduced-motion` support including the spinning logo the source app never
guarded.

The apps themselves are existing projects and do not all meet that bar. Rather than
paper over it, each page carries a generated **"Accessibility, honestly"** block naming
the specific gaps — sourced from `a11y` in the config so it cannot drift from what was
actually tested. For Transform Lab that means saying plainly that dragging a shape has
no keyboard equivalent and canvas state is not announced.

Cheap, attribute-only improvements *were* made to the vendored app: `tabindex="0"`,
`role="img"` and a descriptive `aria-label` on each of the six canvases, a
reduced-motion guard, and a visible note about what needs a pointer.

**The home page has a Light / Dark / Auto toggle; app pages are dark only.** The home
page has no iframe, so it gets a real theme toggle: the choice is saved in
`localStorage` (`mathlab.home.theme`), a tiny script in `<head>` applies it before first
paint so it never flashes, and Auto follows `prefers-color-scheme` live. The app pages
stay dark on purpose. A theme toggle there would flip the page around a permanently dark
app frame, which would look broken and help nobody. A real one means editing each app's
CSS, which is a different project.

The home page also has search (across name, subtitle, description, category and topic
tags), multi-select category chips with per-category counts, and a Newest / A→Z /
By-category sort. The count is announced through an `aria-live` region. It is progressive
enhancement: with JavaScript off, every card still renders and the controls are hidden.
Chips for categories with no apps are not rendered.

The home palette comes from the design mockup, checked by `node tools/check-contrast.js`
(66 pairs, both themes). Three mockup values failed AA and were changed: `--text-faint`
(light and dark, 4.20 and 4.40:1 on `--border-soft`) and the pressed-button text in dark
mode (white on `#60A5FA` was 2.54:1, now `#060810`). The mockup's decorative grey
(`#9AA0AF`, 2.6:1) is not used.

---

## Deploying

The same `main` branch is served two ways, with no build step:

- **GitHub Pages: `https://drcolesmathlab.github.io` (canonical).** `site.origin` in
  `tools/site.config.js` points here, so canonical, `og:url` and `og:image` all do too.
- **Cloudflare Worker: `https://drcolesmathlab.dr-stock-investing.workers.dev`.** Static
  assets only — no script. Every page works here, but **share the github.io links**:
  LinkedIn's Post Inspector cannot load any page on `workers.dev` ("We cannot display a
  preview for this URL"), so a shared workers.dev link gets no card. The likely cause is
  Cloudflare's bot protection treating LinkedInBot as a bad bot; `workers.dev` is
  Cloudflare's domain, not ours, so there is nowhere to add a rule letting it through.
  A custom domain on the Worker would give us that zone (see below).

### How the Cloudflare Worker is set up

The dashboard project (**Workers & Pages → drcolesmathlab**) is connected to this repo
and redeploys on every push to `main`. Build settings: **no build command**, deploy
command **`npx wrangler deploy`**. Everything else lives in committed files:

- **`wrangler.jsonc`** — Worker name `drcolesmathlab` (must match the dashboard), assets
  served from the repo root, `workers_dev` on, **preview URLs off**. Without this file,
  `wrangler deploy` generates its own config on the build machine — and that generated
  config is what published `.git/` as public files on the very first deploy.
- **`.assetsignore`** — because the Worker serves the repo root, *anything not listed
  here is public*. It excludes `.git`, `tools/`, `README.md`, `wrangler.jsonc`, the dot
  files and `.wrangler/`. **Never remove `.git` from it.** `LICENSE-apps.md` and
  `assets/fonts/OFL-*.txt` are deliberately public (the OFL requires the licence to
  travel with the fonts).
- **`html_handling: "none"`** — every file is served at exactly its own path, with no
  automatic `/foo.html → /foo` redirects. Cloudflare's default does redirect, and in a
  local `wrangler dev` test that broke the embedded app frames and left Tiger Trail's
  frame without a working service worker. The site's URLs are the real file paths, the
  same as from disk and on GitHub Pages.
- **`_redirects`** — with `html_handling: "none"` a directory URL doesn't map to its
  `index.html` by itself, so `/` and `/apps/tiger-trail/` (which Tiger Trail's service
  worker precaches) are rewritten — status `200`, not a redirect. If you add another app
  with a service worker that caches `./`, add a line for it.
- **`_headers`** — `nosniff`, a referrer policy, `SAMEORIGIN` framing, and revalidation
  for `.html` and Tiger Trail's `sw.js`. Don't use `X-Frame-Options: DENY`; the app
  pages frame their own apps.

To check a change the way Cloudflare will serve it, run `npx wrangler dev` from the repo
root and open `http://localhost:8787`. `/.git/config`, `/tools/…` and `/README.md` must
all be 404.

Preview (non-`main`) branch builds are **switched off** in the dashboard (**Settings →
Build → Previews Base → Builds for Preview branches**). With preview URLs off they only
ever failed, which put a red *Workers Builds* check on every PR.

**Custom domain later:** add it in the Worker's **Settings → Domains & Routes**, confirm a
page on it passes LinkedIn's Post Inspector (allow LinkedInBot in the zone's security
settings if it doesn't), then set
`site.origin` to it, run `node tools/apply-site-chrome.js`, update the URLs in
`tools/og-cards.html`, re-render the cards and commit.

Before sharing a new or changed URL, paste it into LinkedIn's Post Inspector to confirm
the card renders. LinkedIn caches aggressively, so check before you share, not after.

`tools/build-og-cards.js` needs a desktop Chrome/Chromium with Nunito available (a Mac
has it via the page's font stack). On a headless Linux box the cards render in a
fallback font, so check the PNGs before committing them.

---

## Verifying a change

```bash
node tools/apply-site-chrome.js   # regenerate; fails loudly on a structural problem
node tools/apply-site-chrome.js   # run twice — the second run must produce no diff
node tools/check-external.js      # must report zero external origins
node tools/check-contrast.js      # every home colour pair, both themes, must pass AA
```

Then, manually:

- Open every `.html` from disk with Wi-Fi off, in Chrome, Firefox and Safari. Check the
  headings render in **Nunito, not Helvetica** — that is the check that catches a font
  regression, and it is easy to miss.
- DevTools → Network, sort by domain. Every row must be this origin or `(data:)`.
- Tab through each page with the mouse unplugged: skip link first, skip-past-embed link
  before the frame, and confirm you can get back out of the frame.
- Force `prefers-reduced-motion: reduce` — the logo must stop spinning.
- Home page: try each theme button, reload (the choice must stick), then pick Auto and
  flip the OS theme (the page must follow). Search "factors", toggle chips, change sort,
  and check the "N of M apps shown" line updates. Turn JS off — all cards must still show.
- Run axe DevTools or Lighthouse. Expect findings *inside* the iframe; record them in the
  `#limits` copy rather than hiding them.
- Check 375 / 768 / 1280 / 1920 px widths.

---

## Notes carried forward

- **Transform Lab is built, not copied.** Its upstream is nine ES modules, and ES modules
  do not load from `file://` in any browser. `tools/build-transform-lab.js` concatenates
  them into one classic script. It sources exclusively from `src/` — the upstream repo
  also has a stale v1 `css/`+`js/` duplicate and a stale v2.6 `dist/` hardcoded to
  `/Dr-Coles-Transform-Lab/` that would 404 here.
- **Challenge mode needs vertical room.** It generates a random chain of transformations
  and retries 80 times to find one that fits the canvas. Below roughly 620 px of frame
  height it runs out of attempts and shows only the starting shape. That is why the frame
  floor in the config is 620 px and not the 560 px originally planned — measured, not
  guessed. The behaviour is inherited from upstream and reproduces there too.
- **Service-worker cache names are derived, not written.** Tiger Trail ships a
  cache-first service worker. The classic failure mode is shipping a payload change
  without bumping its version constant, which leaves every previous visitor on the old
  build permanently with no signal anything is wrong. So the version is not a rule
  anyone has to remember: `apply-site-chrome.js` hashes everything in the app folder and
  writes the cache name between the `CACHE NAME` markers in `sw.js`. Change any file and
  the cache name changes with it. Do not replace it with a literal.

  Scope is also safe by construction: a worker's maximum scope is its own directory, so
  one at `apps/tiger-trail/sw.js` can never reach the rest of the site. Registration is
  guarded to `http(s)`, so it no-ops when the page is opened from disk. If you add
  another app with a worker, keep it in the app folder and give it the same markers.
- **Namespace new localStorage keys** as `mathlab.<slug>.<key>`. Same-origin iframes all
  share one storage area. The existing apps happen not to collide; the generator asserts
  it stays that way.
- **Never `cp -R` the Balancing Act source folder.** Its upstream `tpt-package/` holds
  ~69 MB of video plus another party's commercial branding and Terms-of-Use PDFs, and
  this repo is public. `tools/vendor-balancing-act.js` copies six files by name and then
  asserts nothing else came along — keep it that way if you ever re-vendor.
- **Real Number Monsters is built, not copied.** Upstream
  (`drstockinvesting/real-number-monsters`) is a Vite project of ES modules, and Vite's
  normal output is a `type="module"` script, which does not load from `file://`.
  `tools/build-real-number-monsters.js` runs upstream's own Vite (so `npm ci` in a sibling
  checkout at `../real-number-monsters` first, or set `RNM_SRC`) with an override config
  that emits one classic IIFE `game.js`, a `game.css`, and an `index.html` with a `defer`
  script and no `crossorigin`. No game code is changed. The stylesheet is deliberately
  `game.css`, not `style.css`: the game uses a system font stack everywhere, so the
  generator's base64 font injection would be ~76 KB of dead weight. Its storage keys
  (`rnm-best`, `rnm-muted`, `rnm-touchbar`) are kept as upstream wrote them; they are
  already prefixed and listed in the config for the collision check. After any upstream
  change, re-run the script — the site's copy does not update by itself.
