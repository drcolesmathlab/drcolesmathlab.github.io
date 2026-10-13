/*
 * Level 2: Converting Standard to Scientific
 * Design: design/levels/level-2-standard-to-scientific.md
 *
 * The one exploration here, "Scientific Notation" (Part 1), was designed by Doc in Claude
 * Code on 2026-10-13. Add activities to the arrays below as the design is settled. Build only what the
 * design file tags Decided. See src/levels.js for the activity contract.
 */
SNE.Levels.register({
  id: 'standard-to-scientific',
  number: 2,
  title: 'Converting Standard to Scientific',
  skill: 'Convert numbers written in standard form into scientific notation.',
  design: 'design/levels/level-2-standard-to-scientific.md',
  activities: {
    explorations: [
      {
        id: 'scientific-notation',
        title: 'Scientific Notation',
        summary: 'Find the power of 10 that makes the scientific notation equal the number in standard form.',
        mount: SNE.SciNotation.mount,
      },
    ],
    challenges: [],
    games: [],
  },
});
