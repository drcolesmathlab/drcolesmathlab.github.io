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

The patch is made against the upstream files exactly as they were last vendored, so it
applies cleanly as long as upstream `js/game.js` and the menu and WIPEOUT parts of
`index.html` have not changed since.

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

## How to apply

From the upstream folder, with this repository checked out next to it at
`../../drcolesmathlab.github.io` (adjust the path to wherever it is):

```sh
cd "LinkedInShowcase/Math Apps/Game-Balancing App Equation Solver"
P=../../../drcolesmathlab.github.io/docs/balancing-act-upstream

patch -p1 --dry-run < "$P/losing-rules.patch"   # check first: no output but "checking file"
patch -p1 < "$P/losing-rules.patch"
cat "$P/wipeout-panel.css" >> style.css
```

If the upstream folder is a git repository, `git apply "$P/losing-rules.patch"` works too.

Then open `index.html` from upstream and play a round: subtract on one side only, then
take any other step. The figure should fall and WIPEOUT should name the step.

## Then re-vendor

From this repository:

```sh
node tools/vendor-balancing-act.js
node tools/apply-site-chrome.js
git diff --stat
```

The vendor script now sees the rules upstream and goes ahead. `git diff` should show no
change to `apps/balancing-act/js/game.js` or `index.html`; `style.css` gains the panel
rules, which `a11y.css` also has, so nothing looks different.

If the dry run reports a failed hunk, upstream has changed since the last vendor. Port
the failed part by hand from `apps/balancing-act/js/game.js` (the section headed
`losing`) rather than forcing the patch.
