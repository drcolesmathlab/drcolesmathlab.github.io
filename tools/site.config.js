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
 * Apps with `published: false` render as a muted "In progress" tile on the home page
 * and are excluded from numbering and the pager chain, so you can list a roadmap
 * without shipping dead links.
 */

module.exports = {
  site: {
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

  apps: [
    {
      slug: 'transform-lab',
      title: 'Transform Lab',
      subtitle: 'Geometric transformations you can drag',
      blurb:
        'Translate, reflect, rotate and dilate shapes on a live coordinate grid — then ' +
        'predict where the image lands before you check your answer.',
      published: true,

      // Colour + icon + text label, always all three. Colour alone is never the signal.
      category: { key: 'geometry', label: 'Geometry', token: '--rc', icon: 'triangle' },
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

      category: { key: 'arcade', label: 'Speed & arcade', token: '--ax', icon: 'bolt' },
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
      published: false,

      category: { key: 'algebra', label: 'Algebra', token: '--oc', icon: 'equals' },
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
          'Every control is a real button, the balance-beam graphic is labelled, and ' +
          'score and prompt changes are announced to a screen reader.',
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
