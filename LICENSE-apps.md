# Provenance and third-party licences

Everything served from this repository, and where it came from.

---

## Fonts

Both families are licensed under the **SIL Open Font License, Version 1.1**, which
permits redistribution of the font files provided the licence travels with them. The
full licence text for each is committed alongside the files.

| File | Family | Source | Licence |
|---|---|---|---|
| `assets/fonts/nunito-variable.woff2` | Nunito (variable, 400–900) | Google Fonts, latin subset | [`OFL-Nunito.txt`](assets/fonts/OFL-Nunito.txt) |
| `assets/fonts/space-mono-400.woff2` | Space Mono Regular | Google Fonts, latin subset | [`OFL-SpaceMono.txt`](assets/fonts/OFL-SpaceMono.txt) |
| `assets/fonts/space-mono-700.woff2` | Space Mono Bold | Google Fonts, latin subset | [`OFL-SpaceMono.txt`](assets/fonts/OFL-SpaceMono.txt) |

These files are also embedded as base64 `data:` URIs inside every `.html` page and inside
each app's stylesheet — see the README for why. The embedded copies are the same font
data under the same licence; the committed `.woff2` files and the licence texts are what
satisfy the OFL's redistribution requirement.

Nunito — Copyright 2014 The Nunito Project Authors.
Space Mono — Copyright 2016 The Space Mono Project Authors.

---

## Apps

### Transform Lab — `apps/transform-lab/`

Original work by Dr. Cole. Vendored from `TransformLab_v3_0` by
`tools/build-transform-lab.js`, which converts its ES modules into a single classic
script so it loads from `file://`.

No third-party runtime code. No libraries, no frameworks. All drawing is Canvas 2D
written from scratch; all iconography is emoji plus one CSS `clip-path` shape. The
upstream project uses Vite as a dev dependency only — nothing from it ships here.

Changes from upstream, all documented in the build script:

- Google Fonts `@import` removed; fonts injected as `data:` URIs
- `--mu` lightened from `#6b7498` to `#7a83a8` for WCAG AA contrast
- the app's own duplicate `Dr. Cole's Transform Lab` wordmark removed, since the page
  around it already carries the site wordmark
- `tabindex`, `role="img"` and descriptive `aria-label` added to all six canvases
- a `prefers-reduced-motion` guard added (upstream has none)

### Tiger Trail: Jungle Math Runner — `apps/tiger-trail/`

Original work by Dr. Cole. Vendored from `web-dist/tiger-trail-web/` by
`tools/vendor-tiger-trail.js`.

**Contains three.js r149** — `apps/tiger-trail/lib/three.min.js`, ~594 KB, the classic
UMD build, **MIT licensed**. Its `@license` header is preserved in the shipped file and
the full licence text is committed as
[`apps/tiger-trail/lib/LICENSE-three.txt`](apps/tiger-trail/lib/LICENSE-three.txt).

> This is a deliberate, documented exception to the original "build every game loop from
> scratch, no libraries" rule. That rule's purpose was to stop a CDN dependency from
> breaking a shared link later. A vendored, committed, licence-attributed library that
> works offline honours that purpose exactly — and a 3D runner is not something you write
> from scratch. The rule is restated as: **no CDN-loaded libraries.**

Beyond three.js there is no third-party code. Every 3D model, texture and sound is
generated procedurally at runtime — there is not a single image or audio file in the
payload. The only binary assets are five PWA icons.

Changes from upstream, all applied by the vendoring script:

- manifest `id` changed from `/` to `./` — `/` would claim the whole origin and collide
  with any other PWA served from it
- the service-worker cache name replaced with a marker region, so its version is derived
  from a hash of the payload instead of hand-maintained
- Nunito prepended to the UI font stack, and the font `@font-face` markers added
- a `prefers-reduced-motion` guard on the HTML menu and HUD overlays
- `role="img"` and a descriptive `aria-label` on the game canvas
- page title namespaced to the site

The jungle palette is deliberately **not** harmonised to the Math Lab tokens — it is the
game's art direction, not site chrome.

---

## Planned apps

Listed on the home page as "In progress" and not yet vendored. Recorded here so the
licensing position is settled before it lands.

### Balancing Act: Solve the Linear Equations

Original work by Dr. Cole. No third-party runtime code; the character is inline SVG and
all audio is synthesised with the Web Audio API.

**Its `tpt-package/` directory must never be copied into this repository.** It contains
commercial classroom material published under the "ThriveForge Academy" name, including
another party's logo, Terms-of-Use PDFs, and ~69 MB of gameplay video. This repository is
public in order to serve GitHub Pages. Copy the six source files by name — `index.html`,
`style.css`, and the four files in `js/` — never the folder.

---

## This site

The site chrome, page copy, build tooling and OG card templates in this repository are
original work by Dr. Cole.
