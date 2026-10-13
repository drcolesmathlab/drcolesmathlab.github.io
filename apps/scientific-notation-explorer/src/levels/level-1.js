/*
 * Level 1: Effects of Powers of 10 on Products
 * Design: design/levels/level-1-powers-of-10.md
 *
 * The one exploration here, "Powers of 10", was built from Doc's spec in the build
 * session of 2026-10-12, and recorded as Decided in the design file on 2026-10-13. Add
 * further activities as the design is settled, and build only what the design tags
 * Decided. See src/levels.js for the activity contract.
 */
SNE.Levels.register({
  id: 'powers-of-10',
  number: 1,
  title: 'Effects of Powers of 10 on Products',
  skill: 'See what multiplying a number by different powers of 10 does to it.',
  design: 'design/levels/level-1-powers-of-10.md',
  activities: {
    explorations: [
      {
        id: 'powers-of-ten',
        title: 'Powers of 10',
        summary: 'See a power of 10 as a number, as an exponent and as repeated factors of 10. Part 2 adds a coefficient.',
        mount: SNE.PowersOfTen.mount,
      },
    ],
    challenges: [],
    games: [],
  },
});
