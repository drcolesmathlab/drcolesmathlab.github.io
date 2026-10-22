# Balancing Act: changes to port upstream

The Math Lab copy of Balancing Act has gameplay changes that the upstream project
(`LinkedInShowcase/Math Apps/Game-Balancing App Equation Solver/`) does not have yet.
`tools/vendor-balancing-act.js` refuses to re-vendor until upstream has them, so a
re-vendor can't silently bring back the old rules.

## What is in here

| File | Goes to (upstream) | What it does |
|---|---|---|
| `losing-rules.patch` | `js/game.js`, `index.html` | The losing rules, the WIPEOUT reason line and its three buttons, and the × / ÷ work-log fix |
| `wipeout-panel.css` | end of `style.css` | Makes WIPEOUT a panel over the work log instead of a full-screen overlay |
| `number-modes.patch` | `js/algebra.js`, `js/game.js`, `index.html` | Integer, Decimal and Fraction Modes. Apply **after** `losing-rules.patch` |
| `number-modes.css` | end of `style.css` | The mode row on the menu, the decimal point / fraction bar key, struck fractions |
| `cancel-only-when-all-cancel.patch` | `js/algebra.js` | A × / ÷ step strikes the factor only when it cancels every term. Apply **after** `number-modes.patch` |

`losing-rules.patch` is made against the upstream files exactly as they were last
vendored, so it applies cleanly as long as upstream `js/game.js` and the menu and WIPEOUT
parts of `index.html` have not changed since. `number-modes.patch` is made against those
files with `losing-rules.patch` applied, so it goes second.

What the patch changes:

- **Two ways to lose.** SUBMIT a wrong x, or take a next step while the figure is tipped.
  While a move is half done, the only allowed step is the same operation and number on
  the other side; a different one there loses at once. SIMPLIFY and SUBMIT count as
  steps. Backspace undo does not.
- **A rewrite that changes a side's value** tips the figure and is labelled Invalid.
- **WIPEOUT** says which step broke the run and offers Last Valid Step (back to the last
  level point), Retry (same equation) and New Game (new equation). All three reset the
  streak.
- **Bug fix:** a × or ÷ step drew both sides with the first side's number.
- **Menu how-to text** says the next step must match.

What the number-modes patch changes:

- **Three number modes** in a row along the bottom of the menu: Integer (the original
  game, unchanged), Decimal and Fraction. Each has 1-step, 2-step, Multi-step and
  Endless, with its own bests. The chosen mode is remembered
  (`mathlab.balancing-act.numbers`). No mode is labelled by difficulty.
- **Decimal Mode.** Equations use the same shapes as Integer Mode, with numbers to the
  hundredths (at least one not whole) and answers that end by the thousandths. A `.` key
  appears. The student picks each step and the app does the arithmetic; a value that
  would repeat is shown as a fraction, never rounded.
- **Fraction Mode.** Integer numerators and denominators, in every form: (2/3)x, 2x/3,
  1/2, (x + 1)/4, fractions on both sides, all stacked. An `a/b` key types a fraction
  (on a keyboard, `/` right after a number). Students may clear the fractions with any
  common multiple, or solve with the fractions. Answers can be any rational number,
  fully reduced. The menu shows a pro tip about the LCM in this mode.
- **Exact arithmetic everywhere.** The balance check works in fractions, so decimals
  never drift, and 0.5 typed on one side matches .50 on the other.

What the cancel patch changes:

- **No strike-through while a factor still has to be distributed.** Multiplying
  x/5 + 3 by 5 used to show 5(x/5 + 3) with both 5s struck, which leaves nothing to
  multiply the 3 by. Now the work log strikes the factor and the coefficient only
  when the factor cancels every term on that side (5 · x/5, or 3(x + 2) ÷ 3). The
  same holds for ÷: (5x + 15) ÷ 5 strikes nothing.

## How to apply

From the upstream folder, with this repository checked out next to it at
`../../drcolesmathlab.github.io` (adjust the path to wherever it is):

```sh
cd "LinkedInShowcase/Math Apps/Game-Balancing App Equation Solver"
P=../../../drcolesmathlab.github.io/docs/balancing-act-upstream

patch -p1 --dry-run < "$P/losing-rules.patch"   # check first: no output but "checking file"
patch -p1 < "$P/losing-rules.patch"
cat "$P/wipeout-panel.css" >> style.css

patch -p1 --dry-run < "$P/number-modes.patch"
patch -p1 < "$P/number-modes.patch"
cat "$P/number-modes.css" >> style.css

patch -p1 --dry-run < "$P/cancel-only-when-all-cancel.patch"
patch -p1 < "$P/cancel-only-when-all-cancel.patch"
```

If the upstream folder is a git repository, `git apply` works too, in the same order.

Then open `index.html` from upstream and play a round: subtract on one side only, then
take any other step. The figure should fall and WIPEOUT should name the step. Then pick
FRACTION on the menu and start a round: the equation should have stacked fractions and
the keypad an `a/b` key.

## Then re-vendor

From this repository:

```sh
node tools/vendor-balancing-act.js
node tools/apply-site-chrome.js
git diff --stat
```

The vendor script now sees the rules, the number modes and the cancel fix upstream and
goes ahead.
`git diff` should show no change to `apps/balancing-act/js/algebra.js`, `game.js` or
`index.html`; `style.css` gains the panel and number-mode rules, which `a11y.css` also
has, so nothing looks different.

If the dry run reports a failed hunk, upstream has changed since the last vendor. Port
the failed part by hand from `apps/balancing-act/js/game.js` (the section headed
`losing`), or for the number modes from `js/algebra.js` (the sections headed `number
modes` and `Decimal and Fraction Mode generators`) and `js/game.js`, rather than
forcing the patch.

`number-modes.patch` was checked with a dry run against the vendored copies here, not
against the upstream folder itself (it isn't in this repository). Its `index.html` hunks
only touch the keypad and the menu, which the vendor script never edits, so they should
apply the same upstream.
