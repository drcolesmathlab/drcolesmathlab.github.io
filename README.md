# Dr. Cole's Math Lab

A portfolio site for a set of interactive math apps. The point is that every app is
**actually usable in the page** — not a screenshot, not a video, not an app-store link.

Live at `https://drcolesmathlab.github.io` (once Pages is enabled — see *Deploying* below).

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
index.html                  home — wordmark, hero facts, app grid, about, footer
<slug>.html                 one page per app; embeds the app and explains it
apps/<slug>/                the app itself, self-contained, relative paths only
assets/fonts/               woff2 source files + OFL licence text
assets/og-<slug>.png        1200x630 social preview cards
tools/site.config.js        SINGLE SOURCE OF TRUTH — read this first
tools/apply-site-chrome.js  regenerates every shared region of every page
tools/build-transform-lab.js  vendors Transform Lab (ES modules → one classic script)
tools/vendor-tiger-trail.js   vendors Tiger Trail (copy + five documented patches)
tools/check-external.js     the no-external-origins gate
tools/og-cards.html         card templates
tools/build-og-cards.js     screenshots them into assets/
.nojekyll                   stops Jekyll from reinterpreting anything
```

---

## Adding an app

1. Add an entry to `apps` in [`tools/site.config.js`](tools/site.config.js). Array order
   is display order, and it drives numbering, the prev/next pager, and OG filenames.
2. Copy the app's files into `apps/<slug>/` so its `payload` path resolves. Relative
   paths only; no CDN references.
3. Give its stylesheet a `/* FONTS:START */` … `/* FONTS:END */` marker pair so the
   generator can inject the fonts (an iframe is a separate document — the parent page's
   fonts do not cross the boundary).
4. Copy `transform-lab.html` to `<slug>.html` and rewrite the prose sections. Leave every
   `<!-- NAME:START -->` … `<!-- NAME:END -->` region alone; the generator owns those.
5. Set `published: true` and run:

   ```bash
   node tools/apply-site-chrome.js && node tools/check-external.js && node tools/build-og-cards.js
   ```

Apps with `published: false` show on the home page as a muted "In progress" tile and are
excluded from numbering and the pager — so you can publish a roadmap without dead links.

### What the generator owns

Everything between these markers is regenerated on every run. **Edits inside them are
lost.** Everything outside is hand-authored and never touched.

| Marker | Where | What |
|---|---|---|
| `META` | every page | canonical, OG, Twitter, theme-color |
| `FONTS` | every page + payload CSS | `@font-face` blocks, base64 |
| `CACHE NAME` | payload `sw.js` | service-worker cache version, hashed from the payload |
| `SITE CHROME` | every page | the shared stylesheet |
| `HERO FACTS`, `APP GRID`, `ABOUT` | home | the three generated regions |
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

**Dark mode only, deliberately.** A theme toggle on the chrome would flip the page around
a permanently dark app frame — it would look broken and help nobody. A real one means
editing each app's CSS, which is a different project. Shipping dark-only with verified
contrast and saying why is the more defensible call.

---

## Deploying

This repo is not yet a git repo and Pages is not configured. To publish:

```bash
git init && git add -A && git commit -m "Dr. Cole's Math Lab"
```

Then create `drcolesmathlab.github.io` on GitHub, push to `main`, and set Pages to serve
from `main` / root. The repo name must match the `origin` in `tools/site.config.js`,
because `og:image` and `og:url` have to be absolute `https://` URLs — LinkedIn's crawler
will not resolve a relative path or a `data:` URI, and without them a shared link shows
no preview card at all.

After deploying, paste each URL into LinkedIn's Post Inspector to confirm the card
renders. LinkedIn caches aggressively, so check before you share, not after.

---

## Verifying a change

```bash
node tools/apply-site-chrome.js   # regenerate; fails loudly on a structural problem
node tools/apply-site-chrome.js   # run twice — the second run must produce no diff
node tools/check-external.js      # must report zero external origins
```

Then, manually:

- Open every `.html` from disk with Wi-Fi off, in Chrome, Firefox and Safari. Check the
  headings render in **Nunito, not Helvetica** — that is the check that catches a font
  regression, and it is easy to miss.
- DevTools → Network, sort by domain. Every row must be this origin or `(data:)`.
- Tab through each page with the mouse unplugged: skip link first, skip-past-embed link
  before the frame, and confirm you can get back out of the frame.
- Force `prefers-reduced-motion: reduce` — the logo must stop spinning.
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
