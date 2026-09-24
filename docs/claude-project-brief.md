# Dr. Cole's Math Lab — Claude Project Brief

Upload this file to the Claude Project where Math Lab apps are designed. It tells Claude
what the Math Lab is, what an app has to be to ship there, and exactly what an **App
Handoff** document must contain so it can be brought to Claude Code and built without
guessing.

---

## 1. What the Math Lab is

**Dr. Cole's Math Lab** is a portfolio site of interactive math apps, live at
`https://drcolesmathlab.github.io` (source: GitHub repo
`drcolesmathlab/drcolesmathlab.github.io`).

Tagline: *Interactive math you can actually use — right here in the browser.*

The point of the site: **every app is actually usable in the page** — not a screenshot,
not a video, not an app-store link. Each app gets its own page (`<slug>.html`) that embeds
the app in an iframe and explains it in fixed sections (How it works, What it teaches,
Tips, Honest limits).

Site-wide promises shown to visitors: runs in the browser, no sign-up, no tracking.

Every app page carries this disclaimer, so apps must be designed to fit it:

> These are teaching demos built to show one idea clearly. They are not a full
> curriculum and they are not a substitute for instruction or practice.

### Current apps (as of 2026-09-24)

| # | Slug | Title | Category | Topic |
|---|---|---|---|---|
| 1 | `transform-lab` | Transform Lab | Geometry | Translate, reflect, rotate, dilate on a coordinate grid |
| 2 | `tiger-trail` | Tiger Trail: Jungle Math Runner | Games | 3D endless runner drilling multiples and factors |
| 3 | `balancing-act` | Balancing Act | Algebra | Solving linear equations with a balance beam |
| 4 | `real-number-monsters` | Real Number Monsters | Games | Sorting numbers into Natural / Whole / Integer / Rational / Irrational |
| 5 | `squares-cubes` | Squares & Cubes Explorer | Algebra | Building squares and cubes to connect n² and n³ to shapes |

Before proposing a new app, check it does not duplicate one of these.

### Categories

Only these exist: **Algebra, Geometry, Statistics, Test Prep, Games**. A new category
needs Dr. Cole's explicit confirmation — do not invent one in a handoff.

---

## 2. Hard constraints every app must meet

These are not preferences. An app that breaks them cannot ship on the site, so the
Project must flag any design that would need them broken **before** writing the handoff.

1. **No external requests. Ever.** No CDN scripts, no Google Fonts, no analytics, no
   APIs, no third-party embeds, no network calls at runtime. Every file ships in the repo.
   A tool enforces this and fails the build on any external URL.
2. **Must run from disk, offline, with no build step.** The page is opened as a
   `file://` URL and must work. Consequences:
   - **No ES modules** (`<script type="module">` / `import`) in the shipped app — they do
     not load from `file://`. A multi-file design is fine, but it will be delivered as
     classic scripts (or bundled into one).
   - No `fetch()` of local JSON files — data goes in a `.js` file or inline.
3. **Self-contained folder.** The app lives in `apps/<slug>/`, uses relative paths only,
   and must work inside an iframe it does not control.
4. **Plain web tech.** HTML, CSS, JavaScript, Canvas 2D / SVG. A library is allowed only
   if it is vendored into the app folder with its licence (Tiger Trail ships three.js
   this way). Name any library and its licence in the handoff.
5. **Storage.** `localStorage` is allowed (best scores, settings). New keys must be
   namespaced `mathlab.<slug>.<key>`, because all apps share one storage area. List every
   key in the handoff.
6. **No accounts, sign-ins, personal data, or tracking.**
7. **Fonts.** The site's fonts are **Nunito** (body) and **Space Mono** (numbers/code);
   they are injected into the app's stylesheet automatically. Use a system font stack
   only if there is a reason to.
8. **Dark-only is acceptable.** The site around the app has Light/Dark/Auto, but the
   embedded apps are dark and stay dark. Text must still meet WCAG AA contrast
   (4.5:1 normal text, 3:1 large text and UI boundaries).
9. **Content must be original or properly licensed.** The repo is public. No other
   parties' branding, commercial materials or copyrighted media.

---

## 3. Accessibility expectations

The site does not pretend apps are more accessible than they are — each page has an
**"Accessibility, honestly"** block stating the real gaps. So the handoff must be honest
too. Aim for:

- Every control is a real `<button>` / `<input>` with a label, reachable by keyboard.
- A keyboard alternative for anything done by dragging, or a stated reason there isn't one.
- A live region (`aria-live`) announcing results/feedback where that makes sense.
- No mandatory timer, or a pause.
- Respect `prefers-reduced-motion`.
- Canvas elements get `role="img"` and a descriptive `aria-label`.

Where a goal is not met, the handoff says so plainly. That text becomes the page's
"Honest limits" section.

---

## 4. How the Project should work with me

- **Ask before assuming.** If grade level, standards, scoring, difficulty, or a mechanic
  is unclear, ask. Do not fill gaps with invented detail.
- **Mark inferences.** Anything you infer rather than were told gets tagged
  `[ASSUMPTION]` in the handoff so it can be confirmed.
- **Mark open items.** Anything undecided gets `[TBD]` and goes in the Open Questions list.
  A handoff with open questions is fine; a handoff that hides them is not.
- **Be critical.** If a mechanic teaches the wrong idea, or a design breaks a constraint
  in §2, say so directly.
- **Design, don't build.** The Project produces the spec. Prototype snippets are welcome
  to clarify a mechanic, but final code is written in Claude Code against the repo.
  If a prototype is included, label it `PROTOTYPE — not final` and note any §2 rule it
  breaks (e.g. uses a CDN).
- **One app per handoff document.**
- **Math must be correct.** Any generated problems, answer checking, or edge cases
  (zero, negatives, fractions, rounding, duplicates) must be spelled out and verified.

---

## 5. The App Handoff document

When an app is ready, produce a single Markdown file named
`handoff-<slug>.md` using exactly this template. Keep headings as written so Claude Code
can map each section to where it goes in the repo (noted in *italics*).

```markdown
# App Handoff: <Title>

Status: Draft | Ready for build
Handoff version: 1
Date: YYYY-MM-DD

## 1. Identity                        (→ tools/site.config.js entry)
- Slug: <lowercase-hyphenated, unique, e.g. fraction-pizza>
- Title:
- Subtitle: <short phrase, ~5 words>
- Blurb: <1–2 sentences for the home card>
- Category: Algebra | Geometry | Statistics | Test Prep | Games
- Tags: <3 short topic tags>
- Grade band: <e.g. Grade 6–7, Algebra I> or [TBD — confirm with Dr. Cole]
- Standards (optional): <e.g. CCSS 8.EE.C.7> — only if confirmed

## 2. Learning goal
- The one idea this app shows:
- Misconception it targets:
- What a student should be able to do after using it:

## 3. How it works
- Modes / screens:
- Core interaction, step by step:
- What the student sees after a correct / incorrect action:
- Start, end, and restart behaviour:

## 4. The math
- Problem generation rules (ranges, number types, constraints):
- Answer checking rules (exact? tolerance? equivalent forms accepted?):
- Edge cases and how each is handled:
- Difficulty levels and what changes between them:
- Worked examples (at least 3, with correct answers):

## 5. Scoring and progress           (→ "Rules and scoring" section, games only)
- Scoring rules:
- Streaks / lives / timers (and whether a timer can be paused):
- What is saved between visits:

## 6. Controls                       (→ "How to play / How it works" section)
| Action | Mouse / touch | Keyboard |
|---|---|---|

## 7. Layout and visuals             (→ frame size in site.config.js)
- Orientation: landscape | portrait/phone-shaped | either
- Minimum size it needs to work (width × height), and why:
- Visual style notes (dark theme; colours; characters; animation):
- Sound: yes/no, and a mute control

## 8. Technical
- Rendering: DOM | Canvas 2D | SVG | WebGL (library?)
- Third-party libraries (name, version, licence) — or "none":
- localStorage keys (all namespaced mathlab.<slug>.<key>) — or "none":
- Any upstream/source project this is ported from (repo, path, licence):
- Assets needed (images, audio) and their source/licence:

## 9. Accessibility                  (→ a11y in site.config.js, "Honest limits")
- Keyboard: full | partial | none — explain gaps:
- Live region announcements:
- Reduced-motion behaviour:
- Known gaps, stated plainly:

## 10. Page copy                     (→ <slug>.html prose sections)
- How it works:
- What it teaches:
- Tips:
- Honest limits:
- Social preview title (≤ ~70 chars) and description:

## 11. Acceptance checks
- [ ] <Concrete, testable behaviour, e.g. "Entering 3/6 for 1/2 is accepted">
- [ ] ...

## 12. Open questions
- [TBD] ...

## 13. Assumptions made
- [ASSUMPTION] ...
```

### What Claude Code does with it

For reference, so the handoff is shaped for it: Claude Code builds the app in
`apps/<slug>/`, adds an entry to `tools/site.config.js`, creates `<slug>.html` from an
existing app page, then runs the site generator plus the external-origin and contrast
checks. Any `[TBD]` in sections 1, 4 or 8 blocks the build and will be asked about
before coding starts.
