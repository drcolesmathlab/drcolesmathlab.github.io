/*
 * site.config.js — the single source of truth for Dr. Cole's Math Lab.
 *
 * Everything positional on the site is derived from this file: the home card grid,
 * "App 0N / NN" numbering, prev/next pager links, OG image filenames, canonical URLs,
 * footer meta, hero-fact counts, the per-app iframe box, and the honest accessibility
 * paragraph in each page's #limits section.
 *
 * TO ADD AN APP:
 *   1. Add an entry to `apps` below (order in this array is display + pager order).
 *   2. Copy its payload to apps/<slug>/ so `payload` resolves.
 *   3. Create <slug>.html from an existing page as a skeleton.
 *   4. Run: node tools/apply-site-chrome.js
 *
 * Apps with `published: false` are left off the home page and out of the pager, so an
 * app can be staged here before it ships.
 */

module.exports = {
  site: {
    // Served by GitHub Pages here and by a Cloudflare Worker at
    // drcolesmathlab.dr-stock-investing.workers.dev (see wrangler.jsonc). Canonical,
    // og:url and og:image all point here, not at the Worker: LinkedIn's Post Inspector
    // cannot load any page on workers.dev ("We cannot display a preview for this URL"),
    // and workers.dev is Cloudflare's domain, so there is no zone of ours in which to
    // let LinkedInBot through. If a custom domain is attached to the Worker later,
    // check it in Post Inspector first, then change this and re-run the generator.
    origin: 'https://drcolesmathlab.github.io',
    name: "Dr. Cole's Math Lab",
    wordmarkPre: "Dr. Cole's",
    wordmark: 'Math Lab',
    // Shown as the subtitle under the wordmark, where there is room for it.
    tagline: 'Interactive math you can actually use — right here in the browser',
    // Used for og:title and <title>. LinkedIn truncates around 70 characters and the
    // full tagline would push the home title to 84, cutting mid-phrase in the preview
    // card — which is the one place this link is meant to be seen.
    metaTagline: 'interactive math you can actually use',
    // "App 02 / 03" rather than "Game" — not everything here is a game.
    noun: 'App',
    nounPlural: 'apps',
    author: 'Dr. Cole',
    disclaimer:
      'These are teaching demos built to show one idea clearly. They are not a full ' +
      'curriculum and they are not a substitute for instruction or practice.',
  },

  /*
   * Fonts are committed as .woff2 under assets/fonts/ (source of truth + OFL compliance)
   * and inlined into every page as base64 data: URIs by the generator.
   *
   * Why data: URIs and not relative woff2 files — Chrome fetches @font-face in CORS mode,
   * and from a file:// opaque origin that fetch fails silently. The page still renders,
   * just in the fallback face, which is the kind of regression nobody notices. A data:
   * URI has no origin and no CORS check, so it works from disk in every browser.
   *
   * Nunito ships from Google as a VARIABLE font, so one 38KB file covers the whole
   * 400-900 range the design uses — declared with a `font-weight: 400 900` range so the
   * browser interpolates real weights instead of synthesizing fake ones.
   *
   * Space Mono needs both 400 and 700: every coordinate label the app paints onto the
   * canvas uses `bold ...px "Space Mono"`, and canvas text cannot fake a bold cleanly.
   *
   * Sourced from fonts.gstatic.com (latin subset), SIL Open Font License. The license
   * text sits beside the files, which is what OFL requires of a redistributor.
   */
  fonts: [
    { family: 'Nunito', weight: '400 900', style: 'normal', file: 'nunito-variable.woff2' },
    { family: 'Space Mono', weight: 400, style: 'normal', file: 'space-mono-400.woff2' },
    { family: 'Space Mono', weight: 700, style: 'normal', file: 'space-mono-700.woff2' },
  ],

  /*
   * Design tokens. Carried verbatim from Dr. Cole's Transform Lab except --mu, which
   * measured 4.40:1 on --bg and failed WCAG AA for normal text. See README for the
   * full measured contrast table.
   */
  tokens: {
    '--bg': '#050610',
    '--sf': '#0c0b1d',
    '--sf2': '#141328',
    '--tc': '#00d4ff', '--tc2': 'rgba(0,212,255,.12)',
    '--rc': '#00ff7f', '--rc2': 'rgba(0,255,127,.12)',
    '--oc': '#ffcc00', '--oc2': 'rgba(255,204,0,.12)',
    '--dc': '#ff3355', '--dc2': 'rgba(255,51,85,.12)',
    '--ax': '#bb55ff', '--ax2': 'rgba(187,85,255,.12)',
    '--or': '#ff9500', '--or2': 'rgba(255,149,0,.12)',
    '--pre': '#ffffff',
    '--tx': '#eef2ff',
    '--mu': '#7a83a8',
  },

  /*
   * Hero facts on the home page. `count` is substituted with the published app count.
   * Each pairs an icon with text — never an icon alone.
   */
  heroFacts: [
    { icon: 'grid', text: '{count} interactive {apps}' },
    { icon: 'browser', text: 'Runs in your browser' },
    { icon: 'shield', text: 'No sign-up, no tracking' },
  ],

  /*
   * Home-page categories: the filter chips, the card colour and the card glyph.
   * Chips with no apps in them are hidden, so listing a category here costs nothing
   * until an app uses it. Confirm with Dr. Cole before adding a new one.
   *
   * Each has a light and a dark colour pair, because the home page has a theme toggle.
   * `color` is used as text (the card kicker, the "Open" link, the active chip) on
   * `soft` and on the card surface, so it must clear 4.5:1 against both — tools/check-contrast.js
   * enforces that. Colours must stay unique per category (colour is one of three
   * signals, alongside glyph and label, and must not become ambiguous).
   */
  categories: [
    { id: 'algebra',  label: 'Algebra',    glyph: '=',
      light: { color: '#B45309', soft: '#FEF3C7' }, dark: { color: '#F0B429', soft: '#3A2E12' } },
    { id: 'geometry', label: 'Geometry',   glyph: '△',
      light: { color: '#047857', soft: '#D1FAE5' }, dark: { color: '#34D399', soft: '#0F2B22' } },
    { id: 'stats',    label: 'Statistics', glyph: '▦',
      light: { color: '#0E7490', soft: '#CFFAFE' }, dark: { color: '#22D3EE', soft: '#0E2A30' } },
    { id: 'testprep', label: 'Test Prep',  glyph: '◎',
      light: { color: '#BE185D', soft: '#FCE7F3' }, dark: { color: '#F472B6', soft: '#331D28' } },
    { id: 'games',    label: 'Games',      glyph: '⚡',
      light: { color: '#6D28D9', soft: '#EDE9FE' }, dark: { color: '#A78BFA', soft: '#241D3A' } },
  ],

  /*
   * Home-page neutral palette, light and dark. Same contrast rules as above; see
   * tools/check-contrast.js for the exact pairs that are measured.
   *
   * Three values differ from the design mockup, because they measured below AA:
   *   --text-faint light #6B7181 → #5F6576  (was 4.20:1 on --border-soft)
   *   --text-faint dark  #7480A0 → #7F8AA8  (was 4.40:1 on --border-soft)
   *   --on-focus   dark  #FFFFFF → #060810  (white on #60A5FA was 2.54:1)
   * The mockup's --text-decorative (#9AA0AF, 2.6:1) is dropped entirely.
   */
  homeTokens: {
    light: {
      '--bg': '#F7F8FA', '--bg-elevated': '#FFFFFF', '--border': '#E1E4EB', '--border-soft': '#ECEEF2',
      '--text': '#14171F', '--text-soft': '#4B5165', '--text-faint': '#5F6576',
      '--focus': '#1D4ED8', '--on-focus': '#FFFFFF',
    },
    dark: {
      '--bg': '#060810', '--bg-elevated': '#0E111B', '--border': '#1D2233', '--border-soft': '#161A29',
      '--text': '#E9EBF2', '--text-soft': '#8B93A6', '--text-faint': '#7F8AA8',
      '--focus': '#60A5FA', '--on-focus': '#060810',
    },
  },

  apps: [
    {
      slug: 'transform-lab',
      title: 'Transform Lab',
      subtitle: 'Geometric transformations you can drag',
      blurb:
        'Translate, reflect, rotate and dilate shapes on a live coordinate grid — then ' +
        'predict where the image lands before you check your answer.',
      published: true,

      // Category id from `categories` above. Colour + glyph + text label are all
      // derived from it, so colour is never the only signal.
      // dateAdded drives "Newest first" on the home page; ties keep array order.
      // Optional `grade` (e.g. 'Algebra I') adds a grade tag to the home card —
      // left off until Dr. Cole confirms the band for each app.
      category: 'geometry',
      dateAdded: '2026-07-29',
      tags: ['Coordinate plane', 'Transformations', 'Prediction'],

      payload: 'apps/transform-lab/index.html',
      // Tall box: the app scrolls internally and caps its canvas at frameHeight - 240.
      // The 620px floor is measured, not guessed — Challenge mode generates a random
      // chain of transformations and retries 80 times to find one that fits on the
      // canvas. Below roughly 620px of frame height it runs out of attempts and shows
      // only the pre-image. At 620px it generates cleanly.
      frame: { height: 'clamp(620px, 80vh, 940px)' },

      storageKeys: [],
      thirdParty: [],

      a11y: {
        keyboard: 'partial',
        liveRegion: false,
        notes:
          'Mode tabs, level buttons and the x/y coordinate inputs are all real, ' +
          'keyboard-reachable controls with proper labels. But every shape, reflection ' +
          'axis and centre of rotation is moved by dragging, and there is no keyboard ' +
          'equivalent for dragging. The canvas state is not announced to a screen reader.',
      },

      og: {
        title: "Transform Lab — Dr. Cole's Math Lab",
        description:
          'Drag shapes across a coordinate grid to explore translation, reflection, ' +
          'rotation and dilation. Playable in the browser, no sign-up.',
      },

      sections: [
        { id: 'play',          label: 'Play',            heading: 'Try it here' },
        { id: 'how-to-play',   label: 'How it works',    heading: 'How it works' },
        { id: 'skills',        label: 'Skills',          heading: 'What it teaches' },
        { id: 'tips',          label: 'Tips',            heading: 'Tips for getting the most out of it' },
        { id: 'limits',        label: 'Limits',          heading: 'Honest limits' },
      ],
    },

    {
      slug: 'tiger-trail',
      title: 'Tiger Trail',
      subtitle: 'Jungle Math Runner',
      blurb:
        'A 3D endless runner built on multiples and factors. Collect the right number ' +
        'coins, dodge the wrong ones, and keep your speed up as the trail accelerates.',
      published: true,

      category: 'games',
      dateAdded: '2026-07-29',
      tags: ['Multiples', 'Factors', 'Speed recall'],

      payload: 'apps/tiger-trail/index.html',
      // Wide and short: the game fills whatever box it gets and is landscape-preferred.
      frame: { height: 'clamp(440px, 76vh, 800px)' },

      storageKeys: ['tigerTrailSave_v1', 'tt_modes'],
      thirdParty: [
        { name: 'three.js r149', license: 'MIT', path: 'apps/tiger-trail/lib/three.min.js' },
      ],

      a11y: {
        keyboard: 'full',
        liveRegion: false,
        notes:
          'Fully playable with arrow keys, WASD and space, and every menu control is a ' +
          'real button. But it is a reaction game rendered in 3D — the state is visual ' +
          'only, and no amount of live-region text makes it playable without sight.',
      },

      og: {
        title: "Tiger Trail: Jungle Math Runner — Dr. Cole's Math Lab",
        description:
          'A 3D endless runner that drills multiples and factors. Playable in the ' +
          'browser, no sign-up.',
      },

      sections: [
        { id: 'play',          label: 'Play',         heading: 'Play it here' },
        { id: 'how-to-play',   label: 'Controls',     heading: 'How to play' },
        { id: 'rules-scoring', label: 'Scoring',      heading: 'Rules and scoring' },
        { id: 'skills',        label: 'Skills',       heading: 'What it teaches' },
        { id: 'tips',          label: 'Tips',         heading: 'Tips' },
        { id: 'limits',        label: 'Limits',       heading: 'Honest limits' },
      ],
    },

    {
      slug: 'balancing-act',
      title: 'Balancing Act',
      subtitle: 'Solve the linear equations',
      blurb:
        'Solve linear equations the column way, with a stick figure on a balance beam ' +
        'that tips the moment you do something to one side and not the other.',
      published: true,

      category: 'algebra',
      dateAdded: '2026-07-29',
      tags: ['Linear equations', 'Inverse operations', 'Properties of equality'],

      payload: 'apps/balancing-act/index.html',
      // Phone-shaped: the app self-centres at min(560px,100%), so constrain the frame too
      // or you get a 560px column floating in a 1400px black box.
      frame: { width: 'min(560px, 100%)', height: 'clamp(600px, 84vh, 900px)', center: true },

      storageKeys: ['eqBalanceBest', 'eqBalanceSound', 'eqBalanceShowProps'],
      thirdParty: [],

      a11y: {
        keyboard: 'full',
        liveRegion: true,
        notes:
          'this is the closest of the apps here to genuinely accessible. Every control is a ' +
          'real button, the balance-beam graphic is labelled, there is no timer, and the ' +
          'feedback line is a live region, so prompts and right/wrong results are ' +
          'announced. Two gaps remain: the streak readout is not announced (it redraws ' +
          'on every keypress, so announcing it would talk over you constantly), and the ' +
          'beam itself carries information — tipped means unbalanced — that reaches you ' +
          'only through the feedback text, not through the graphic.',
      },

      og: {
        title: "Balancing Act — Dr. Cole's Math Lab",
        description:
          'Solve linear equations with a balance beam that reacts when you break the ' +
          'property of equality. Playable in the browser, no sign-up.',
      },

      sections: [
        { id: 'play',          label: 'Play',       heading: 'Play it here' },
        { id: 'how-to-play',   label: 'Controls',   heading: 'How to play' },
        { id: 'rules-scoring', label: 'Scoring',    heading: 'Rules and scoring' },
        { id: 'skills',        label: 'Skills',     heading: 'What it teaches' },
        { id: 'tips',          label: 'Tips',       heading: 'Tips' },
        { id: 'limits',        label: 'Limits',     heading: 'Honest limits' },
      ],
    },

    {
      slug: 'real-number-monsters',
      title: 'Real Number Monsters',
      subtitle: 'Sort the real number system',
      blurb:
        'Numbers fall from a machine and five hungry monsters wait below. Feed each one ' +
        'to the monster of its most specific set: Natural, Whole, Integer, Rational or ' +
        'Irrational.',
      published: true,

      category: 'games',
      dateAdded: '2026-09-24',
      tags: ['Real number system', 'Rational vs irrational', 'Classifying numbers'],

      // Built, not copied: tools/build-real-number-monsters.js turns the upstream Vite
      // project into one classic script so it runs from file://.
      payload: 'apps/real-number-monsters/index.html',
      // The game reflows to whatever box it gets (layout() in upstream src/bins.js), but
      // five bins plus the machine need vertical room; landscape reads best.
      frame: { height: 'clamp(560px, 80vh, 860px)' },

      storageKeys: ['rnm-best', 'rnm-muted', 'rnm-touchbar'],
      thirdParty: [],

      a11y: {
        keyboard: 'full',
        liveRegion: false,
        notes:
          'Fully playable from the keyboard: arrow keys steer, Space drops, P or Esc ' +
          'pauses, and every menu control is a real button. But the falling number, the ' +
          'bins and the monsters are drawn on a canvas that has no text alternative, and ' +
          'right/wrong feedback is visual and audio only — nothing is announced to a ' +
          'screen reader. The number keeps falling until you pause, so it is timed unless ' +
          'you choose to stop the clock.',
      },

      og: {
        title: "Real Number Monsters — Dr. Cole's Math Lab",
        description:
          'Feed every falling number to the monster of its most specific set: Natural, ' +
          'Whole, Integer, Rational or Irrational. Playable in the browser, no sign-up.',
      },

      sections: [
        { id: 'play',          label: 'Play',       heading: 'Play it here' },
        { id: 'how-to-play',   label: 'Controls',   heading: 'How to play' },
        { id: 'rules-scoring', label: 'Scoring',    heading: 'Rules and scoring' },
        { id: 'skills',        label: 'Skills',     heading: 'What it teaches' },
        { id: 'tips',          label: 'Tips',       heading: 'Tips' },
        { id: 'limits',        label: 'Limits',     heading: 'Honest limits' },
      ],
    },

    {
      slug: 'squares-cubes',
      title: 'Squares & Cubes Explorer',
      subtitle: 'See what the exponent is doing',
      blurb:
        'Set a side length and watch the square or cube build itself, with the notation ' +
        'and the count changing alongside — so n\u00b2 and n\u00b3 stay attached to the ' +
        'shapes they name.',
      published: true,

      category: 'algebra',
      dateAdded: '2026-09-24',
      tags: ['Perfect squares', 'Perfect cubes', 'Square & cube roots'],

      payload: 'apps/squares-cubes/index.html',
      // Three panels side by side, and the cube needs headroom above the counter.
      // Below about 900px the app drops to a single column and gets much taller than
      // any frame worth giving it, which is what the "works best wide" note is for.
      frame: { height: 'clamp(620px, 80vh, 940px)' },

      storageKeys: [],
      thirdParty: [],

      a11y: {
        // 'partial' because rotating the cube is pointer-only. Everything the app
        // actually teaches is reachable without it, but a drag with no keyboard
        // equivalent is a drag with no keyboard equivalent.
        keyboard: 'partial',
        liveRegion: true,
        notes:
          'every control is a real button or a range input, the slider is fully operable ' +
          'with arrow keys, S/C/E/R/D drive the modes from the keyboard, there is no ' +
          'timer, and a live region announces the side length, the total and the notation ' +
          'on every change — so the arithmetic is available without seeing the figures. ' +
          'Two gaps. Rotating the cube is a drag with no keyboard equivalent, though it ' +
          'only changes the viewing angle and R returns it to the opening one. And the ' +
          'figures themselves — the square, the cube, the exploded layers — are ' +
          'decorative to a screen reader: the live region carries the count, but not the ' +
          'shape of it, which is the part the app exists to show.',
      },

      og: {
        title: "Squares & Cubes Explorer — Dr. Cole's Math Lab",
        description:
          'Grow a square or a cube one unit at a time and watch the notation and the ' +
          'count follow. Runs in the browser, no sign-up.',
      },

      sections: [
        { id: 'play',        label: 'Explore',      heading: 'Explore it here' },
        { id: 'how-to-play', label: 'How it works', heading: 'How it works' },
        { id: 'skills',      label: 'Skills',       heading: 'What it teaches' },
        { id: 'tips',        label: 'Tips',         heading: 'Tips for getting the most out of it' },
        { id: 'limits',      label: 'Limits',       heading: 'Honest limits' },
      ],
    },
  ],

  /*
   * The four trust-building cards in the home page's #about section.
   */
  about: [
    {
      icon: 'play',
      title: 'Every app is playable right here',
      body:
        'No download, no app store, no account. Each one loads in the page and runs ' +
        'entirely on your machine.',
    },
    {
      icon: 'book',
      title: 'Built to teach, not just to entertain',
      body:
        'Each app targets a specific skill and makes the underlying structure visible — ' +
        'the grid, the beam, the number line — rather than hiding it behind points.',
    },
    {
      icon: 'offline',
      title: 'Each page stands alone',
      body:
        'No CDN, no external fonts, no analytics, no third-party requests of any kind. ' +
        'Save a page to disk and it still works, offline, years from now.',
    },
    {
      icon: 'scale',
      title: 'Honest about limits',
      body:
        'Every app page has a section saying plainly what it does not cover and where ' +
        'its accessibility falls short. Those sections are not marketing.',
    },
  ],
};
