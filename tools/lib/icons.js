/*
 * icons.js — inline SVG icon set.
 *
 * Every icon here is decorative: each one is always rendered next to a visible text
 * label, so they all carry aria-hidden="true" (WCAG: an icon that duplicates adjacent
 * text should not be announced twice). This is also why category colour is never the
 * only signal — a category is always colour + icon + text.
 *
 * All paths use currentColor so a single CSS colour drives the icon.
 */

'use strict';

const P = (d, extra = '') =>
  `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}${extra}</svg>`;

const ICONS = {
  // Category marks
  triangle: P('<path d="M12 3 21 20H3Z"/><circle cx="12" cy="3" r="1.4" fill="currentColor"/>'),
  bolt: P('<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>'),
  equals: P('<path d="M4 9h16M4 15h16"/>'),

  // Hero facts
  grid: P('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  browser: P('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><circle cx="6.5" cy="6.5" r=".6" fill="currentColor"/>'),
  shield: P('<path d="M12 3 20 6v6c0 4.4-3.2 7.8-8 9-4.8-1.2-8-4.6-8-9V6Z"/><path d="m9 12 2 2 4-4"/>'),

  // About cards
  play: P('<circle cx="12" cy="12" r="9"/><path d="m10 8.5 6 3.5-6 3.5Z" fill="currentColor" stroke="none"/>'),
  book: P('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>'),
  offline: P('<path d="M3 3l18 18"/><path d="M5.5 10.5a9 9 0 0 1 3.2-2.1"/><path d="M12 4a12 12 0 0 1 8 3"/><path d="M8.8 14.2a5 5 0 0 1 1.6-1.1"/><circle cx="12" cy="18.5" r="1.1" fill="currentColor" stroke="none"/>'),
  scale: P('<path d="M12 4v16M6 20h12M4 8h16M4 8l-2 5a3 3 0 0 0 6 0Z"/><path d="M20 8l2 5a3 3 0 0 1-6 0Z"/>'),

  // Chrome
  arrowRight: P('<path d="M5 12h13"/><path d="m13 6 6 6-6 6"/>'),
  arrowLeft: P('<path d="M19 12H6"/><path d="m11 6-6 6 6 6"/>'),
  external: P('<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
};

function icon(name) {
  if (!ICONS[name]) throw new Error(`icons.js: unknown icon "${name}"`);
  return ICONS[name];
}

module.exports = { icon, ICONS };
