/*
 * crush.js — the stage where expanded form is crushed into exponential form.
 *
 *   show(host, tree)          draw the problem (3 · 3 · 3 · 3), sized to fit, and keep
 *                             it fitted whenever the stage's width changes
 *   crush(host, tree, opts)   the factors slide together and become 3⁴; with
 *                             opts.plan, Mode 1 Level 4's group-then-crush,
 *                             one of Mode 2's vertical crushes (plan.type
 *                             'cancel', 'vertical' or 'columns'), Mode 3's
 *                             outer exponent crush (plan.type 'outer', which
 *                             Mode 4 runs on a fraction too), Mode 4
 *                             Level 1's copies crush (plan.type 'copies'),
 *                             or Mode 5 Level 4's zero powers becoming 1
 *                             (plan.type 'zero'), or Mode 6's Level 2 unfold
 *                             and cancel (plan.type 'expand') and Levels 3
 *                             and 4's powers crossing the bar (plan.type
 *                             'cross'), or Mode 7's one crush from any
 *                             mixed problem straight to its answer
 *                             (plan.type 'all')
 *   mismatch(host)            the factors flash red and shake; nothing crushes
 *   reset(host)               clear the red highlight (after the student edits)
 *
 * Reduced motion (Mode 1 design §8, Mode 2 design §8): crush's opts.reduce
 * makes the crush an instant swap; the shake is CSS, and html.reduce-motion
 * turns it into a static red highlight. Mode 2 Level 1's highlight then shows
 * on every canceled pair at once, held a moment before the swap so it is seen,
 * and so does Mode 3's on every exponent, and Mode 4 Levels 2 to 4's (Mode 5
 * design §9.5). Mode 4 Level 1 (plan.lit 'answer') swaps first, and lights
 * the answer's exponents for the same time. Mode 5 (plan.lit 'problem')
 * lights the whole problem, holds, then swaps (Mode 5 design §3). Mode 6
 * does too (plan.lit 'cross' lights the flipped exponents after the swap for
 * another HOLD_MS; 'expanded' shows the unfolded fraction with its canceling
 * pairs lit). Mode 7 (plan.lit 'problem') does what Mode 5 does.
 * The stage's spoken label always matches what is drawn.
 */
(function (PC) {
  'use strict';

  var MIN_PX = 14;

  /* Shrink the drawing until it fits the stage's width (10 · 10 · … is long). */
  function fit(host) {
    host.style.fontSize = '';
    var inner = host.firstElementChild;
    if (!inner) return;
    var room = host.clientWidth - 8, need = inner.scrollWidth;
    if (need > room && room > 0) {
      var px = parseFloat(getComputedStyle(host).fontSize) * room / need;
      host.style.fontSize = Math.max(MIN_PX, Math.floor(px)) + 'px';
    }
  }

  /* A window resize changes the room, so refit whenever the stage's width
     changes. Only the width: fitting changes the stage's height (its min-height
     is in em). A crush in flight is left alone; its result, 3⁴, is short. */
  var WATCHED = 'pcWatched';
  function watch(host) {
    if (host[WATCHED]) return;
    host[WATCHED] = true;
    var last = -1;
    function check() {
      var w = host.clientWidth;
      if (w === last) return;
      last = w;
      if (w > 0 && !host.classList.contains('is-crushing')) fit(host);
    }
    if (typeof ResizeObserver === 'function') new ResizeObserver(check).observe(host);
    else if (typeof window === 'object') window.addEventListener('resize', check);
  }

  /* Each drawing gets a new token, so a crush still running when the student
     moves on can't draw its result over the next problem. */
  var TOKEN = 'pcToken';

  /* Drawn while the stage is hidden (a mode's first load), there is no width to
     fit yet. The stage is shown in the same task, possibly at the width it had
     before, so the resize watch may never fire: fit again on the next frame. */
  function show(host, tree) {
    var token = host[TOKEN] = (host[TOKEN] || 0) + 1;
    host.classList.remove('is-crushed', 'is-wrong', 'is-crushing');
    host.style.minHeight = '';
    PC.Render.into(host, tree);
    fit(host);
    watch(host);
    if (!host.clientWidth && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () { if (host[TOKEN] === token) fit(host); });
    }
  }

  function swap(host, tree) {
    host.classList.remove('is-crushing', 'is-wrong');
    PC.Render.into(host, tree);
    host.style.fontSize = '';
    host.classList.add('is-crushed');
  }

  /* Resolves when the result is on screen. */
  function crush(host, tree, opts) {
    var reduce = opts && opts.reduce, plan = opts && opts.plan;
    var top = host.firstElementChild, can = !!top && typeof top.animate === 'function';
    if (reduce && plan && plan.lit === 'answer') return litAnswer(host, tree);
    if (reduce && plan && plan.lit === 'problem') {
      if (plan.type === 'all') holdHeight(host);
      return litProblem(host, tree);
    }
    if (reduce && plan && plan.lit === 'cross') return litCross(host, tree, plan);
    if (reduce && plan && plan.lit === 'expanded') return litExpanded(host, tree, plan);
    if (plan && plan.type === 'all' && can) return all(host, tree);
    if (plan && plan.type === 'cross' && can) return cross(host, tree, plan);
    if (plan && plan.type === 'expand' && can) return expand(host, tree, plan);
    if (plan && plan.type === 'zero' && can) return zero(host, tree, plan);
    if (plan && plan.type === 'copies' && can) return copies(host, tree, plan);
    if (plan && plan.type === 'cancel' && can) return cancel(host, tree, plan, reduce);
    if (plan && plan.type === 'outer' && can) return outer(host, tree, reduce);
    var mul = host.querySelector('.m-mul');
    if (reduce || !can || (!plan && !mul)) {
      swap(host, tree);
      if (plan) fit(host);
      return Promise.resolve();
    }
    if (plan && plan.type === 'vertical') return vertical(host, tree);
    if (plan && plan.type === 'columns') return columns(host, tree, plan);
    if (plan) return group(host, tree, plan);
    host.classList.remove('is-wrong');
    host.classList.add('is-crushing');
    var token = host[TOKEN];
    var box = mul.getBoundingClientRect();
    var mid = box.left + box.width / 2;
    var anims = [];
    Array.prototype.forEach.call(mul.children, function (el) {
      var r = el.getBoundingClientRect();
      if (el.classList.contains('m-op')) {
        anims.push(el.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.2)' }],
          { duration: 220, easing: 'ease-in', fill: 'forwards' }));
      } else {
        var dx = mid - (r.left + r.width / 2);
        anims.push(el.animate([
          { transform: 'translateX(0) scale(1)' },
          { transform: 'translateX(' + dx + 'px) scale(.92)', offset: 0.8 },
          { transform: 'translateX(' + dx + 'px) scale(.55)', opacity: 0 },
        ], { duration: 520, easing: 'cubic-bezier(.55,0,.8,.2)', fill: 'forwards' }));
      }
    });
    return Promise.all(anims.map(function (a) { return a.finished; })).catch(function () {}).then(function () {
      if (host[TOKEN] !== token) return;
      swap(host, tree);
      pop(host);
    });
  }

  /* The result lands: it grows in, and its exponents spring up. */
  function pop(host) {
    var pow = host.querySelector('.m-pow') || host.firstElementChild, exp = host.querySelector('.m-exp');
    if (pow) pow.animate([{ transform: 'scale(1.5)', opacity: 0.2 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 340, easing: 'cubic-bezier(.2,1.5,.4,1)' });
    if (exp) exp.animate([{ transform: 'translateY(.5em) scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 380, delay: 90, easing: 'cubic-bezier(.2,1.6,.4,1)', fill: 'backwards' });
  }

  /* ---- Level 4: group, then crush (Level 4 spec §4) ------------------------ */
  /* plan = { order, groups }: `order` is the key of each drawn factor, term by
     term ('c', 'x', …); `groups` are the bases in answer order, each with the
     factors it gathers (`from`) and what they crush into (`to`).
       1. Every factor slides to its base's group (FLIP: drawn in the grouped
          layout, then animated from where it was). A base in one term only
          slides into place and never merges.
       2. All groups crush at once (Dr. Cole, 2026-09-27), like crush() above.
       3. The answer is drawn, and each part grows out of its group's place. */
  var SLIDE_MS = 480, CRUSH_MS = 520;

  function isOp(el) { return el.classList.contains('m-op'); }
  function kids(el) { return Array.prototype.slice.call(el.children); }
  function centre(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function done(anims) {
    return Promise.all(anims.map(function (a) { return a.finished; })).catch(function () {});
  }

  /* The drawn factors of 3x²y³z · 4x⁵z⁶, in order: 3, x², y³, z, 4, x⁵, z⁶. */
  function factorEls(mul) {
    var out = [];
    kids(mul).forEach(function (term) {
      if (isOp(term)) return;
      if (term.classList.contains('m-mul')) kids(term).forEach(function (f) { if (!isOp(f)) out.push(f); });
      else out.push(term);
    });
    return out;
  }

  /* A copy of the "·" between the terms (or a parenthesis), left where it was
     so it can fade. */
  function ghost(host, el, hostBox) {
    var r = el.getBoundingClientRect(), g = el.cloneNode(true);
    g.style.position = 'absolute';
    g.style.fontSize = getComputedStyle(el).fontSize;   // a tall parenthesis stays tall
    g.style.left = (r.left - hostBox.left - host.clientLeft) + 'px';
    g.style.top = (r.top - hostBox.top - host.clientTop) + 'px';
    g.style.margin = '0';
    g.setAttribute('aria-hidden', 'true');
    return g;
  }

  function group(host, tree, plan) {
    host.classList.remove('is-wrong');
    host.classList.add('is-crushing');
    var token = host[TOKEN];
    var hostBox = host.getBoundingClientRect();
    var mul = host.firstElementChild;
    var olds = factorEls(mul), first = olds.map(function (el) { return centre(el.getBoundingClientRect()); });
    var ghosts = kids(mul).filter(isOp).map(function (el) { return ghost(host, el, hostBox); });

    // 1. The grouped layout: 3 · 4  x²x⁵  y³  zz⁶.
    var row = document.createElement('span');
    row.className = 'm-mul m-groups';
    row.setAttribute('aria-hidden', 'true');
    var members = [], newOps = [], boxes = [], index = {};
    plan.groups.forEach(function (g, gi) {
      index[g.key] = gi;
      var box = document.createElement('span');
      box.className = 'm-group-of';
      var d = PC.Render.draw(g.from.length === 1 ? g.from[0] : { t: 'mul', factors: g.from, dot: g.key === 'c' });
      box.appendChild(d);
      row.appendChild(box);
      boxes.push(box);
      if (g.from.length === 1) { members.push([d]); return; }
      members.push(kids(d).filter(function (el) { return !isOp(el); }));
      kids(d).filter(isOp).forEach(function (el) { newOps.push(el); });
    });
    host.replaceChildren(row);
    fit(host);
    ghosts.forEach(function (g) { host.appendChild(g); });

    var seen = {}, anims = [];
    plan.order.forEach(function (key, i) {
      var gi = index[key], mi = seen[key] = (seen[key] === undefined ? 0 : seen[key] + 1);
      var el = members[gi] && members[gi][mi];
      if (!el || !first[i]) return;
      var last = centre(el.getBoundingClientRect());
      var dx = first[i].x - last.x, dy = first[i].y - last.y;
      anims.push(el.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
        { duration: SLIDE_MS, easing: 'cubic-bezier(.45,0,.2,1)' }));
    });
    ghosts.forEach(function (g) {
      anims.push(g.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.2)' }],
        { duration: 220, easing: 'ease-in', fill: 'forwards' }));
    });
    newOps.forEach(function (el) {
      anims.push(el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }],
        { duration: SLIDE_MS, fill: 'backwards' }));
    });

    return done(anims).then(function () {
      if (host[TOKEN] !== token) return;
      ghosts.forEach(function (g) { g.remove(); });
      // 2. Every group of two or more crushes into its middle, all at once.
      var centers = boxes.map(function (b) { return centre(b.getBoundingClientRect()); });
      var squeeze = [];
      boxes.forEach(function (b, gi) {
        if (members[gi].length < 2) return;
        var inner = b.firstElementChild;
        kids(inner).forEach(function (el) {
          if (isOp(el)) {
            squeeze.push(el.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.2)' }],
              { duration: 220, easing: 'ease-in', fill: 'forwards' }));
            return;
          }
          var dx = centers[gi].x - centre(el.getBoundingClientRect()).x;
          squeeze.push(el.animate([
            { transform: 'translateX(0) scale(1)' },
            { transform: 'translateX(' + dx + 'px) scale(.92)', offset: 0.8 },
            { transform: 'translateX(' + dx + 'px) scale(.55)', opacity: 0 },
          ], { duration: CRUSH_MS, easing: 'cubic-bezier(.55,0,.8,.2)', fill: 'forwards' }));
        });
      });
      return done(squeeze).then(function () {
        if (host[TOKEN] !== token) return;
        // 3. The answer, each part growing out of where its group was.
        swap(host, tree);
        fit(host);
        var parts = host.firstElementChild.classList.contains('m-mul')
          ? kids(host.firstElementChild).filter(function (el) { return !isOp(el); }) : [host.firstElementChild];
        parts.forEach(function (el, gi) {
          if (!centers[gi]) return;
          var at = centre(el.getBoundingClientRect());
          var dx = centers[gi].x - at.x, dy = centers[gi].y - at.y;
          var merged = members[gi].length > 1;
          el.animate([
            { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + (merged ? 1.5 : 1) + ')', opacity: merged ? 0.2 : 1 },
            { transform: 'none', opacity: 1 },
          ], { duration: 420, easing: 'cubic-bezier(.2,1.3,.4,1)' });
        });
        Array.prototype.forEach.call(host.querySelectorAll('.m-exp'), function (exp) {
          exp.animate([{ transform: 'translateY(.5em) scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }],
            { duration: 380, delay: 90, easing: 'cubic-bezier(.2,1.6,.4,1)', fill: 'backwards' });
        });
      });
    });
  }

  /* ---- Mode 2: vertical crushes (Mode 2 design §4 to §7) ------------------ */
  var SWEEP_MS = 300, HOLD_MS = 700, CANCEL_MS = 460;

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* The drawn factors in a numerator or denominator, and the "·" between them. */
  function items(part) {
    var c = part.firstElementChild;
    if (!c) return [];
    return c.classList.contains('m-mul') ? kids(c).filter(function (el) { return !isOp(el); }) : [c];
  }
  function dots(part) {
    var c = part.firstElementChild;
    return c && c.classList.contains('m-mul') ? kids(c).filter(isOp) : [];
  }
  function fade(el) {
    return el.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.2)' }],
      { duration: 220, easing: 'ease-in', fill: 'forwards' });
  }
  /* A fraction bar is its denominator's top border: fade it out. */
  function fadeBar(el, ms) {
    return el.animate([{ borderTopColor: getComputedStyle(el).borderTopColor }, { borderTopColor: 'rgba(0, 0, 0, 0)' }],
      { duration: ms, easing: 'ease-in', fill: 'forwards' });
  }
  /* Pushed vertically onto the bar at `barY`, squashed, and gone. */
  function squash(el, barY, ms) {
    var dy = barY - centre(el.getBoundingClientRect()).y;
    return el.animate([
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: 'translateY(' + dy + 'px) scale(.9, .7)', opacity: 1, offset: 0.7 },
      { transform: 'translateY(' + dy + 'px) scale(.5, .15)', opacity: 0 },
    ], { duration: ms, easing: 'cubic-bezier(.55,0,.8,.2)', fill: 'forwards' });
  }

  /* Level 1 (design §4): 3 · 3 · 3 · 3 · 3 over 3 · 3 · 3.
       1. A highlight sweeps left to right over the canceling pairs, the top
          and bottom factor of each pair lighting together [ASSUMPTION §4].
       2. The pairs are pushed together onto the bar and destroyed; the
          denominator and its bar go with them (no "/1" is left).
       3. What is left on top crushes into one power where it lands: 3². */
  function cancel(host, tree, plan, reduce) {
    var token = host[TOKEN], frac = host.firstElementChild;
    var num = frac.querySelector('.m-num'), den = frac.querySelector('.m-den');
    var tops = items(num), bottoms = items(den), n = plan.pairs;
    host.classList.remove('is-wrong');
    host.classList.add('is-crushing');
    function light(i) {
      if (host[TOKEN] !== token) return;
      tops[i].classList.add('is-lit');
      bottoms[i].classList.add('is-lit');
    }
    var i;
    if (reduce) {
      for (i = 0; i < n; i++) light(i);
      return wait(HOLD_MS).then(function () { if (host[TOKEN] === token) { swap(host, tree); fit(host); } });
    }
    for (i = 0; i < n; i++) setTimeout(light.bind(null, i), i * SWEEP_MS);
    return wait(n * SWEEP_MS + 200).then(function () {
      if (host[TOKEN] !== token) return;
      var bar = den.getBoundingClientRect().top;
      var anims = tops.slice(0, n).concat(bottoms).map(function (el) { return squash(el, bar, CANCEL_MS); });
      // The "·" beside a canceled factor goes with it (the i-th sits after factor i).
      dots(num).slice(0, n).concat(dots(den)).forEach(function (el) { anims.push(fade(el)); });
      anims.push(fadeBar(den, CANCEL_MS));
      return done(anims).then(function () {
        if (host[TOKEN] !== token) return;
        var mid = centre(host.getBoundingClientRect()), squeeze = [];
        tops.slice(n).forEach(function (el) {
          var c = centre(el.getBoundingClientRect()), dx = mid.x - c.x, dy = mid.y - c.y;
          squeeze.push(el.animate([
            { transform: 'translate(0, 0) scale(1)' },
            { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.92)', offset: 0.8 },
            { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.55)', opacity: 0 },
          ], { duration: CRUSH_MS, easing: 'cubic-bezier(.55,0,.8,.2)', fill: 'forwards' }));
        });
        dots(num).slice(n).forEach(function (el) { squeeze.push(fade(el)); });
        return done(squeeze).then(function () {
          if (host[TOKEN] !== token) return;
          swap(host, tree);
          fit(host);
          pop(host);
        });
      });
    });
  }

  /* Levels 2 and 3 (design §5, §6): top and bottom are pushed together onto
     the bar and land as one power, even a negative or zero one (x⁻², x⁰). */
  function vertical(host, tree) {
    var token = host[TOKEN], frac = host.firstElementChild;
    var num = frac.querySelector('.m-num'), den = frac.querySelector('.m-den');
    host.classList.remove('is-wrong');
    host.classList.add('is-crushing');
    var bar = den.getBoundingClientRect().top;
    var anims = [squash(num, bar, CRUSH_MS), squash(den, bar, CRUSH_MS), fadeBar(den, CRUSH_MS * 0.6)];
    return done(anims).then(function () {
      if (host[TOKEN] !== token) return;
      swap(host, tree);
      fit(host);
      pop(host);
    });
  }

  /* Level 4 (design §7): 12x⁵y²z over 4x²z⁶.
     plan = { order, columns, land }: `order` is [key, 0 top | 1 bottom] for
     each drawn factor; `columns` are the bases in answer order, each with its
     factor on top and below (either may be null); `land` says which column
     each drawn part of the answer grows out of.
       1. Every factor slides into its base's column (FLIP), top factors above
          the bar and bottom factors below: 12 x⁵ y² z over 4 x² · z⁶.
       2. Every column with a base top and bottom crushes vertically at once
          (design §7). A base on one side only stays put, on its side: one
          only below stays below (Dr. Cole, 2026-09-27).
       3. The answer is drawn, and each part grows out of its column. */
  function columns(host, tree, plan) {
    host.classList.remove('is-wrong');
    host.classList.add('is-crushing');
    var token = host[TOKEN], frac = host.firstElementChild;
    var olds = items(frac.querySelector('.m-num')).concat(items(frac.querySelector('.m-den')));
    var first = olds.map(function (el) { return centre(el.getBoundingClientRect()); });

    // 1. The columns: a grid, top row above the bar, bottom row below it.
    var grid = document.createElement('span');
    grid.className = 'm-cols';
    grid.setAttribute('aria-hidden', 'true');
    var cols = plan.columns.map(function (c, i) {
      var col = {};
      ['top', 'bottom'].forEach(function (side, row) {
        var cell = document.createElement('span');
        cell.className = 'm-cell m-cell-' + side;
        cell.style.gridColumn = String(i + 1);
        cell.style.gridRow = String(row + 1);
        if (c[side]) cell.appendChild(PC.Render.draw(c[side]));
        grid.appendChild(cell);
        col[side] = cell.firstElementChild;
        col[side + 'Cell'] = cell;
      });
      return col;
    });
    var index = {};
    plan.columns.forEach(function (c, i) { index[c.key] = i; });
    host.replaceChildren(grid);
    fit(host);

    var anims = [];
    plan.order.forEach(function (o, i) {
      var el = cols[index[o[0]]][o[1] ? 'bottom' : 'top'];
      if (!el || !first[i]) return;
      var last = centre(el.getBoundingClientRect());
      anims.push(el.animate([{ transform: 'translate(' + (first[i].x - last.x) + 'px,' + (first[i].y - last.y) + 'px)' },
        { transform: 'none' }], { duration: SLIDE_MS, easing: 'cubic-bezier(.45,0,.2,1)' }));
    });

    return done(anims).then(function () {
      if (host[TOKEN] !== token) return;
      // 2. Every column crushes at once. Where each column's result will grow from:
      var from = cols.map(function (c) {
        var t = c.topCell.getBoundingClientRect(), b = c.bottomCell.getBoundingClientRect();
        var x = t.left + t.width / 2;
        if (c.top && c.bottom) return { x: x, y: b.top, merged: true };
        var r = c.top ? t : b;
        return { x: x, y: r.top + r.height / 2, merged: false };
      });
      var squeeze = [];
      cols.forEach(function (c, i) {
        if (c.top && c.bottom) {
          squeeze.push(squash(c.top, from[i].y, CRUSH_MS), squash(c.bottom, from[i].y, CRUSH_MS));
        }
        squeeze.push(fadeBar(c.bottomCell, CRUSH_MS * 0.6));
      });
      return done(squeeze).then(function () {
        if (host[TOKEN] !== token) return;
        // 3. The answer, each part growing out of its column.
        swap(host, tree);
        fit(host);
        var top = host.firstElementChild, parts;
        if (top.classList.contains('m-frac')) parts = items(top.querySelector('.m-num')).concat(items(top.querySelector('.m-den')));
        else if (top.classList.contains('m-mul')) parts = kids(top).filter(function (el) { return !isOp(el); });
        else parts = [top];
        parts.forEach(function (el, i) {
          var f = from[plan.land[i]];
          if (!f) return;
          var at = centre(el.getBoundingClientRect());
          el.animate([
            { transform: 'translate(' + (f.x - at.x) + 'px,' + (f.y - at.y) + 'px) scale(' + (f.merged ? 1.5 : 1) + ')', opacity: f.merged ? 0.2 : 1 },
            { transform: 'none', opacity: 1 },
          ], { duration: 420, easing: 'cubic-bezier(.2,1.3,.4,1)' });
        });
        Array.prototype.forEach.call(host.querySelectorAll('.m-exp'), function (exp) {
          exp.animate([{ transform: 'translateY(.5em) scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }],
            { duration: 380, delay: 90, easing: 'cubic-bezier(.2,1.6,.4,1)', fill: 'backwards' });
        });
      });
    });
  }

  /* ---- Mode 3: the outer exponent (Mode 3 design §5 to §7) ----------------- */
  /* (x²)³, (x⁻²)³ or (3x²y)⁴, and Mode 4's fractions, (x²/5³)⁴ or
     (2x³y/3z²)² (Mode 4 design §5, §7), where it goes to the top and the
     bottom at once:
       1. The parentheses fade.
       2. The outer exponent goes to every base's exponent at once: each factor
          moves apart to make room (FLIP), and a copy of the outer exponent
          flies from where it was to beside each one. A base with a hidden 1,
          or a coefficient, gets one too.
       3. Every pair crushes into one at once. A coefficient that becomes a
          plain number (3 → 81) crushes whole.
       4. The answer is drawn, and each part grows out of its factor's place.
     Reduced motion: every exponent lights at once, held, then the answer
     swaps in (design §5). */
  var PAREN_MS = 240;

  function outer(host, tree, reduce) {
    var token = host[TOKEN], pow = host.firstElementChild;
    host.classList.remove('is-wrong');
    host.classList.add('is-crushing');
    if (reduce) {
      Array.prototype.forEach.call(host.querySelectorAll('.m-exp'), function (el) { el.classList.add('is-lit'); });
      return wait(HOLD_MS).then(function () { if (host[TOKEN] === token) { swap(host, tree); fit(host); } });
    }
    var grp = pow.firstElementChild, exp = pow.lastElementChild;
    var inner = kids(grp).filter(function (el) { return !el.classList.contains('m-paren'); })[0];
    var frac = inner.classList.contains('m-frac');
    var sides = frac ? [items(inner.querySelector('.m-num')), items(inner.querySelector('.m-den'))]
      : [inner.classList.contains('m-mul') ? kids(inner).filter(function (el) { return !isOp(el); }) : [inner]];
    var olds = [].concat.apply([], sides);
    var hostBox = host.getBoundingClientRect();
    var first = olds.map(function (el) { return centre(el.getBoundingClientRect()); });
    var from = centre(exp.getBoundingClientRect());
    var ghosts = kids(grp).filter(function (el) { return el.classList.contains('m-paren'); })
      .map(function (el) { return ghost(host, el, hostBox); });

    // The spread layout: x² ³  y ³, each factor with the outer exponent beside
    // it; for a fraction, a row of them on top and a row below the bar.
    var slots = [];
    var rows = sides.map(function (els) {
      var row = document.createElement('span');
      row.className = 'm-mul m-spread';
      els.forEach(function (el) {
        var slot = document.createElement('span');
        slot.className = 'm-slot';
        var f = el.cloneNode(true), got = exp.cloneNode(true);
        got.classList.add('m-got');
        slot.appendChild(f);
        slot.appendChild(got);
        row.appendChild(slot);
        slots.push({ el: slot, f: f, got: got });
      });
      return row;
    });
    var layout = rows[0];
    if (frac) {
      layout = document.createElement('span');
      layout.className = 'm-frac';
      ['m-num', 'm-den'].forEach(function (cls, i) {
        var part = document.createElement('span');
        part.className = cls;
        part.appendChild(rows[i]);
        layout.appendChild(part);
      });
    }
    layout.setAttribute('aria-hidden', 'true');
    host.replaceChildren(layout);
    fit(host);
    ghosts.forEach(function (g) { host.appendChild(g); });

    var anims = ghosts.map(function (g) {
      return g.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.4)' }],
        { duration: PAREN_MS, easing: 'ease-in', fill: 'forwards' });
    });
    function slide(el, p) {
      var at = centre(el.getBoundingClientRect());
      anims.push(el.animate([{ transform: 'translate(' + (p.x - at.x) + 'px,' + (p.y - at.y) + 'px)' }, { transform: 'none' }],
        { duration: SLIDE_MS, delay: PAREN_MS * 0.6, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'backwards' }));
    }
    slots.forEach(function (s, i) { slide(s.f, first[i]); slide(s.got, from); });

    return done(anims).then(function () {
      if (host[TOKEN] !== token) return;
      ghosts.forEach(function (g) { g.remove(); });
      var parts = tree.t === 'div' ? factorsOf(tree.num).concat(factorsOf(tree.den)) : factorsOf(tree);
      var centers = slots.map(function (s) { return centre(s.el.getBoundingClientRect()); });
      var squeeze = [];
      slots.forEach(function (s, i) {
        // The pair is the factor's own exponent (if shown) and the one it got;
        // a coefficient becoming a plain number crushes whole.
        var own = s.f.classList.contains('m-pow') ? s.f.lastElementChild : null;
        var pair = parts[i] && parts[i].t === 'num' ? [s.f, s.got] : own ? [own, s.got] : [s.got];
        var boxes = pair.map(function (el) { return el.getBoundingClientRect(); });
        var left = Math.min.apply(null, boxes.map(function (b) { return b.left; }));
        var right = Math.max.apply(null, boxes.map(function (b) { return b.right; }));
        pair.forEach(function (el, j) {
          var dx = (left + right) / 2 - centre(boxes[j]).x;
          squeeze.push(el.animate([
            { transform: 'translateX(0) scale(1)' },
            { transform: 'translateX(' + dx + 'px) scale(.92)', offset: 0.8 },
            { transform: 'translateX(' + dx + 'px) scale(.55)', opacity: 0 },
          ], { duration: CRUSH_MS, easing: 'cubic-bezier(.55,0,.8,.2)', fill: 'forwards' }));
        });
      });
      return done(squeeze).then(function () {
        if (host[TOKEN] !== token) return;
        swap(host, tree);
        fit(host);
        var drawn = drawnParts(host.firstElementChild);
        drawn.forEach(function (el, i) {
          if (!centers[i]) return;
          var at = centre(el.getBoundingClientRect());
          el.animate([
            { transform: 'translate(' + (centers[i].x - at.x) + 'px,' + (centers[i].y - at.y) + 'px) scale(1.3)', opacity: 0.2 },
            { transform: 'none', opacity: 1 },
          ], { duration: 420, easing: 'cubic-bezier(.2,1.3,.4,1)' });
        });
        Array.prototype.forEach.call(host.querySelectorAll('.m-exp'), function (el) {
          el.animate([{ transform: 'translateY(.5em) scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }],
            { duration: 380, delay: 90, easing: 'cubic-bezier(.2,1.6,.4,1)', fill: 'backwards' });
        });
      });
    });
  }

  function factorsOf(t) { return t.t === 'mul' ? t.factors : [t]; }

  /* The drawn parts of an answer: its factors, top then bottom for a fraction. */
  function drawnParts(top) {
    if (top.classList.contains('m-frac')) return items(top.querySelector('.m-num')).concat(items(top.querySelector('.m-den')));
    return top.classList.contains('m-mul') ? kids(top).filter(function (el) { return !isOp(el); }) : [top];
  }

  /* ---- Mode 4 (Mode 4 design §4 to §7) ------------------------------------- */
  /* Reduced motion: the answer swaps in at once, its exponents lit, and the
     light is held HOLD_MS (design §4, §5). */
  function litAnswer(host, tree) {
    var token = host[TOKEN];
    swap(host, tree);
    fit(host);
    var exps = host.querySelectorAll('.m-exp');
    Array.prototype.forEach.call(exps, function (el) { el.classList.add('is-lit'); });
    return wait(HOLD_MS).then(function () {
      if (host[TOKEN] !== token) return;
      Array.prototype.forEach.call(exps, function (el) { el.classList.remove('is-lit'); });
    });
  }

  /* Level 1 (design §4): (x²/5³)(x²/5³)(x²/5³). plan.joined is the one
     fraction the copies make, x²x²x² over 5³ · 5³ · 5³.
       1. The parentheses fade. Every top slides into one row above one bar,
          every bottom into one row below it (FLIP), and the copies' bars
          slide in to join it.
       2. Mode 1's crush runs on the top row and the bottom row at once.
       3. The answer is drawn, x⁶/5⁹, and pops in. */
  function copies(host, tree, plan) {
    var token = host[TOKEN], mul = host.firstElementChild;
    host.classList.remove('is-wrong');
    host.classList.add('is-crushing');
    var hostBox = host.getBoundingClientRect();
    var fracs = Array.prototype.slice.call(mul.querySelectorAll('.m-frac'));
    var first = [[], []], bars = [];
    fracs.forEach(function (f) {
      first[0].push(centre(f.querySelector('.m-num').firstElementChild.getBoundingClientRect()));
      first[1].push(centre(f.querySelector('.m-den').firstElementChild.getBoundingClientRect()));
      var den = f.querySelector('.m-den'), cs = getComputedStyle(den);
      bars.push({ box: den.getBoundingClientRect(), border: cs.borderTopWidth + ' solid ' + cs.borderTopColor });
    });
    var ghosts = Array.prototype.map.call(mul.querySelectorAll('.m-paren'), function (el) { return ghost(host, el, hostBox); });
    var barGhosts = bars.map(function (b) {
      var g = document.createElement('span');
      g.setAttribute('aria-hidden', 'true');
      g.style.cssText = 'position:absolute;height:0;border-top:' + b.border + ';width:' + b.box.width + 'px;left:' +
        (b.box.left - hostBox.left - host.clientLeft) + 'px;top:' + (b.box.top - hostBox.top - host.clientTop) + 'px';
      return g;
    });

    // 1. One fraction.
    var joined = PC.Render.draw(plan.joined);
    joined.setAttribute('aria-hidden', 'true');
    host.replaceChildren(joined);
    fit(host);
    ghosts.concat(barGhosts).forEach(function (g) { host.appendChild(g); });
    var num = joined.querySelector('.m-num'), den = joined.querySelector('.m-den');
    var rows = [items(num), items(den)];
    var anims = ghosts.map(function (g) {
      return g.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.4)' }],
        { duration: PAREN_MS, easing: 'ease-in', fill: 'forwards' });
    });
    rows.forEach(function (els, side) {
      els.forEach(function (el, i) {
        var at = centre(el.getBoundingClientRect()), p = first[side][i];
        if (!p) return;
        anims.push(el.animate([{ transform: 'translate(' + (p.x - at.x) + 'px,' + (p.y - at.y) + 'px)' }, { transform: 'none' }],
          { duration: SLIDE_MS, delay: PAREN_MS * 0.6, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'backwards' }));
      });
    });
    dots(num).concat(dots(den)).forEach(function (el) {
      anims.push(el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }],
        { duration: SLIDE_MS + PAREN_MS, fill: 'backwards' }));
    });
    // The bars slide onto the one bar and fade into it as it appears.
    var bar = den.getBoundingClientRect(), barMid = centre(bar);
    barGhosts.forEach(function (g, i) {
      var b = centre(bars[i].box);
      anims.push(g.animate([{ transform: 'none', opacity: 1 },
        { transform: 'translate(' + (barMid.x - b.x) + 'px,' + (bar.top - bars[i].box.top) + 'px)', opacity: 0 }],
        { duration: SLIDE_MS, delay: PAREN_MS * 0.6, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' }));
    });
    var color = getComputedStyle(den).borderTopColor;
    anims.push(den.animate([{ borderTopColor: 'rgba(0, 0, 0, 0)' }, { borderTopColor: 'rgba(0, 0, 0, 0)', offset: 0.5 }, { borderTopColor: color }],
      { duration: SLIDE_MS + PAREN_MS * 0.6, easing: 'ease-in' }));

    return done(anims).then(function () {
      if (host[TOKEN] !== token) return;
      ghosts.concat(barGhosts).forEach(function (g) { g.remove(); });
      // 2. Each row crushes into its middle, top and bottom at once.
      var squeeze = [];
      [num, den].forEach(function (part, side) {
        var mid = centre(part.getBoundingClientRect()).x;
        rows[side].forEach(function (el) {
          var dx = mid - centre(el.getBoundingClientRect()).x;
          squeeze.push(el.animate([
            { transform: 'translateX(0) scale(1)' },
            { transform: 'translateX(' + dx + 'px) scale(.92)', offset: 0.8 },
            { transform: 'translateX(' + dx + 'px) scale(.55)', opacity: 0 },
          ], { duration: CRUSH_MS, easing: 'cubic-bezier(.55,0,.8,.2)', fill: 'forwards' }));
        });
        dots(part).forEach(function (el) { squeeze.push(fade(el)); });
      });
      return done(squeeze).then(function () {
        if (host[TOKEN] !== token) return;
        // 3. x⁶ over 5⁹.
        swap(host, tree);
        fit(host);
        drawnParts(host.firstElementChild).forEach(function (el) {
          el.animate([{ transform: 'scale(1.5)', opacity: 0.2 }, { transform: 'scale(1)', opacity: 1 }],
            { duration: 340, easing: 'cubic-bezier(.2,1.5,.4,1)' });
        });
        Array.prototype.forEach.call(host.querySelectorAll('.m-exp'), function (el) {
          el.animate([{ transform: 'translateY(.5em) scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }],
            { duration: 380, delay: 90, easing: 'cubic-bezier(.2,1.6,.4,1)', fill: 'backwards' });
        });
      });
    });
  }

  /* ---- Mode 5 (Mode 5 design §3 to §7) -------------------------------------- */
  /* Reduced motion, every level (design §3): the whole problem lights, the
     light is held HOLD_MS, then the answer swaps in. */
  function lightProblem(host) {
    host.classList.remove('is-wrong');
    Array.prototype.forEach.call(host.querySelectorAll('.m-ch, .m-var, .m-exp, .m-op, .m-paren, .m-den'),
      function (el) { el.classList.add('is-lit'); });
  }

  function litProblem(host, tree) {
    var token = host[TOKEN];
    lightProblem(host);
    return wait(HOLD_MS).then(function () { if (host[TOKEN] === token) { swap(host, tree); fit(host); } });
  }

  /* Level 4 (design §7, as proposed there; Dr. Cole, 2026-09-28). plan.mid is
     the problem with only zero powers left (x⁰y⁰, 5⁰x⁰, or 5x⁰ itself), and
     plan.first the crush that gets there, if any: a fraction's vertical crush
     (3⁴/3⁴ → 3⁰, as at Level 3) or the outer exponent's ((5x)⁰ → 5⁰x⁰).
       1. plan.first runs, and its result is held a moment.
       2. Each zero power crushes into 1, all at once: 1 · 1, or 5 · 1.
       3. The 1s go, leaving the value: 1 (the first 1 stays when all are 1s),
          or the coefficient, 5. */
  var ZERO_HOLD_MS = 360, ONE_MS = 340;

  function zero(host, tree, plan) {
    var token = host[TOKEN];
    var first = plan.first ? crush(host, plan.mid, { plan: plan.first }) : Promise.resolve();
    return first.then(function () {
      if (host[TOKEN] !== token) return;
      return wait(plan.first ? ZERO_HOLD_MS : 0).then(function () {
        if (host[TOKEN] !== token) return;
        host.classList.remove('is-wrong', 'is-crushed');
        host.classList.add('is-crushing');
        // 2. Each zero power shrinks into its middle and becomes 1.
        var parts = factorsOf(plan.mid), els = drawnParts(host.firstElementChild);
        var isZero = parts.map(function (f) { return f.t === 'pow' && f.exp === 0; });
        var at = els.map(function (el) { return centre(el.getBoundingClientRect()); });
        var anims = [];
        els.forEach(function (el, i) {
          if (!isZero[i]) return;
          anims.push(el.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.3)', opacity: 0 }],
            { duration: CANCEL_MS, easing: 'cubic-bezier(.55,0,.8,.2)', fill: 'forwards' }));
        });
        return done(anims).then(function () {
          if (host[TOKEN] !== token) return;
          var ones = parts.map(function (f, i) { return isZero[i] ? { t: 'num', v: 1 } : f; });
          var onesTree = ones.length === 1 ? ones[0] : { t: 'mul', factors: ones, dot: true };
          PC.Render.into(host, onesTree);
          fit(host);
          var now = drawnParts(host.firstElementChild);
          var grow = now.map(function (el, i) {
            var c = centre(el.getBoundingClientRect()), dx = at[i] ? at[i].x - c.x : 0;
            return el.animate([
              { transform: 'translateX(' + dx + 'px) scale(' + (isZero[i] ? 1.5 : 1) + ')', opacity: isZero[i] ? 0.2 : 1 },
              { transform: 'none', opacity: 1 },
            ], { duration: ONE_MS, easing: 'cubic-bezier(.2,1.5,.4,1)' });
          });
          return done(grow).then(function () { return wait(ZERO_HOLD_MS); }).then(function () {
            if (host[TOKEN] !== token) return;
            // 3. Every 1 but the one that stays, and the dots, go.
            var keep = isZero.indexOf(false);
            if (keep < 0) keep = 0;
            var from = centre(now[keep].getBoundingClientRect());
            var go = now.filter(function (el, i) { return i !== keep; }).concat(dots(host))
              .map(function (el) {
                return el.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-.4em) scale(.4)', opacity: 0 }],
                  { duration: ONE_MS, easing: 'ease-in', fill: 'forwards' });
              });
            return done(go).then(function () {
              if (host[TOKEN] !== token) return;
              swap(host, tree);
              fit(host);
              var el = host.firstElementChild, c = centre(el.getBoundingClientRect());
              el.animate([{ transform: 'translate(' + (from.x - c.x) + 'px,' + (from.y - c.y) + 'px) scale(1.3)', opacity: 0.6 },
                { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,1.3,.4,1)' });
            });
          });
        });
      });
    });
  }

  /* ---- Mode 6 (Mode 6 design §3 to §7) -------------------------------------- */
  var DIP_MS = 460, EMERGE_MS = 460, UNFOLD_MS = 320, UNFOLD_HOLD_MS = 500;

  /* Level 2, reduced motion (design §5): the fraction unfolded, x · x over
     x · x · x · x · x, with every canceling pair lit; held HOLD_MS, then
     1/(x · x · x) swaps in. The pairs carry the meaning, so they stay visible. */
  function litExpanded(host, tree, plan) {
    var token = host[TOKEN];
    host.classList.remove('is-wrong');
    PC.Render.into(host, plan.mid);
    fit(host);
    var frac = host.firstElementChild;
    var tops = items(frac.querySelector('.m-num')), bottoms = items(frac.querySelector('.m-den'));
    for (var i = 0; i < plan.pairs; i++) { tops[i].classList.add('is-lit'); bottoms[i].classList.add('is-lit'); }
    return wait(HOLD_MS).then(function () { if (host[TOKEN] === token) { swap(host, tree); fit(host); } });
  }

  /* Level 2 (design §5): x²/x⁵.
       1. The exponents let go and each power unfolds: (x · x) over (x · x · x ·
          x · x).
       2. A highlight sweeps over the canceling pairs, top and bottom together.
       3. The pairs are pushed onto the bar and destroyed; the factors left
          below slide together and a 1 appears on top. It stops there, at
          1/(x · x · x): never 1/x³ or x⁻³. */
  function expand(host, tree, plan) {
    var token = host[TOKEN];
    host.classList.remove('is-wrong');
    host.classList.add('is-crushing');
    return done(Array.prototype.map.call(host.querySelectorAll('.m-exp'), fade)).then(function () {
      if (host[TOKEN] !== token) return;
      PC.Render.into(host, plan.mid);
      fit(host);
      var frac = host.firstElementChild;
      var num = frac.querySelector('.m-num'), den = frac.querySelector('.m-den');
      var unfold = [];
      [num, den].forEach(function (part) {
        var fs = items(part), from = centre(fs[0].getBoundingClientRect());
        fs.forEach(function (el, i) {
          if (!i) return;
          var at = centre(el.getBoundingClientRect());
          unfold.push(el.animate([
            { transform: 'translate(' + (from.x - at.x) + 'px, 0) scale(.4)', opacity: 0 },
            { transform: 'none', opacity: 1 },
          ], { duration: UNFOLD_MS, delay: i * 40, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' }));
        });
        dots(part).forEach(function (el, i) {
          unfold.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: UNFOLD_MS, delay: (i + 1) * 40, fill: 'backwards' }));
        });
      });
      return done(unfold).then(function () { return wait(UNFOLD_HOLD_MS); }).then(function () {
        if (host[TOKEN] !== token) return;
        var tops = items(num), bottoms = items(den), n = plan.pairs, i;
        function light(k) {
          if (host[TOKEN] !== token) return;
          tops[k].classList.add('is-lit');
          bottoms[k].classList.add('is-lit');
        }
        for (i = 0; i < n; i++) setTimeout(light.bind(null, i), i * SWEEP_MS);
        return wait(n * SWEEP_MS + 200).then(function () {
          if (host[TOKEN] !== token) return;
          var bar = den.getBoundingClientRect().top;
          var anims = tops.concat(bottoms.slice(0, n)).map(function (el) { return squash(el, bar, CANCEL_MS); });
          // Each canceled factor's "·" goes with it; the bar stays, since factors are left below.
          dots(num).concat(dots(den).slice(0, n)).forEach(function (el) { anims.push(fade(el)); });
          return done(anims).then(function () {
            if (host[TOKEN] !== token) return;
            var left = bottoms.slice(n).map(function (el) { return centre(el.getBoundingClientRect()); });
            swap(host, tree);
            fit(host);
            var end = host.firstElementChild;
            var slides = items(end.querySelector('.m-den')).map(function (el, k) {
              var at = centre(el.getBoundingClientRect());
              return el.animate([{ transform: 'translate(' + (left[k].x - at.x) + 'px,' + (left[k].y - at.y) + 'px)' }, { transform: 'none' }],
                { duration: SLIDE_MS, easing: 'cubic-bezier(.45,0,.2,1)' });
            });
            slides.push(end.querySelector('.m-num').firstElementChild.animate(
              [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'none' }],
              { duration: SLIDE_MS, easing: 'cubic-bezier(.2,1.5,.4,1)' }));
            dots(end.querySelector('.m-den')).forEach(function (el) {
              slides.push(el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], { duration: SLIDE_MS }));
            });
            return done(slides);
          });
        });
      });
    });
  }

  /* The drawn parts whose exponent flipped, once the answer is on screen: what
     is emphasized after they land (design §3). A part whose exponent is a
     hidden 1 has no exponent to light, so the part itself is lit. */
  function flipped(host, plan) {
    var parts = drawnParts(host.firstElementChild), out = [];
    plan.to.forEach(function (k, i) {
      if (!plan.flips[k] || !parts[i]) return;
      var exp = parts[i].classList.contains('m-pow') ? parts[i].lastElementChild : null;
      out.push(exp && exp.classList.contains('m-exp') ? exp : parts[i]);
    });
    return out;
  }

  /* Levels 3 and 4, reduced motion (design §6, §7): the problem lights, is
     held HOLD_MS, then the answer swaps in with the new exponents lit for
     HOLD_MS more, so the sign change is still marked. */
  function litCross(host, tree, plan) {
    var token = host[TOKEN];
    lightProblem(host);
    return wait(HOLD_MS).then(function () {
      if (host[TOKEN] !== token) return;
      swap(host, tree);
      fit(host);
      var lit = flipped(host, plan);
      lit.forEach(function (el) { el.classList.add('is-lit'); });
      return wait(HOLD_MS).then(function () { lit.forEach(function (el) { el.classList.remove('is-lit'); }); });
    });
  }

  /* Levels 3 and 4 (design §3, §6, §7): every power with a negative exponent
     crosses the bar at once, and its sign flips as it crosses.
     plan = { from, to, flips }: `from` is the key of each drawn part of the
     problem and `to` of the answer, top then bottom ('one' is a 1 with
     nothing to multiply); `flips` says which cross, 'down' or 'up'.
       1. The answer is drawn. A bar that the problem lacked fades in as the
          power dips into it, and then a 1 pops in above; a bar (and a lone 1)
          it had that the answer lacks fade out. Powers that stay slide to
          their place (FLIP) once the crossing power is out of their way.
       2. Each crossing power dips into the bar, squashed flat, still with its
          negative exponent, and is gone: it is never below a bar while it
          moves with the minus on it (1/x⁻³ is x³, not a step toward 1/x³).
       3. Its positive twin grows out of the bar into its place.
       4. The new exponents are emphasized at once. */
  function cross(host, tree, plan) {
    var token = host[TOKEN], top = host.firstElementChild;
    host.classList.remove('is-wrong');
    host.classList.add('is-crushing');
    var hostBox = host.getBoundingClientRect();
    // A fraction that becomes one line would shrink the stage and clip the
    // powers still crossing it, so it keeps its height until the next problem.
    host.style.minHeight = host.offsetHeight + 'px';
    var olds = drawnParts(top), oldEl = {}, oldAt = {};
    plan.from.forEach(function (k, i) {
      if (!olds[i]) return;
      oldEl[k] = olds[i];
      oldAt[k] = centre(olds[i].getBoundingClientRect());
    });
    var oldDen = top.classList.contains('m-frac') ? top.querySelector('.m-den') : null;
    var oldBarY = oldDen ? oldDen.getBoundingClientRect().top : null;

    // Copies of what leaves its place: the crossing powers, and a 1 that goes.
    var ghosts = {};
    plan.from.forEach(function (k) {
      var el = oldEl[k];
      if (!el || (!plan.flips[k] && plan.to.indexOf(k) >= 0)) return;
      var g = ghost(host, el, hostBox);
      if (el.closest('.m-frac')) g.classList.add('m-ghost-frac');
      ghosts[k] = g;
    });
    // The problem's bar, when the answer has none (5/x⁻² → 5x²).
    var barGhost = null;
    if (oldDen && tree.t !== 'div') {
      var b = oldDen.getBoundingClientRect(), cs = getComputedStyle(oldDen);
      barGhost = document.createElement('span');
      barGhost.setAttribute('aria-hidden', 'true');
      barGhost.style.cssText = 'position:absolute;height:0;border-top:' + cs.borderTopWidth + ' solid ' + cs.borderTopColor +
        ';width:' + b.width + 'px;left:' + (b.left - hostBox.left - host.clientLeft) + 'px;top:' + (b.top - hostBox.top - host.clientTop) + 'px';
    }

    // 1. The answer, laid out.
    var layout = PC.Render.draw(tree);
    layout.setAttribute('aria-hidden', 'true');
    host.replaceChildren(layout);
    fit(host);
    Object.keys(ghosts).forEach(function (k) { host.appendChild(ghosts[k]); });
    if (barGhost) host.appendChild(barGhost);
    var news = drawnParts(layout), newEl = {}, newAt = {};
    plan.to.forEach(function (k, i) {
      if (!news[i]) return;
      newEl[k] = news[i];
      newAt[k] = centre(news[i].getBoundingClientRect());
    });
    var den = layout.classList.contains('m-frac') ? layout.querySelector('.m-den') : null;
    var barY = den ? den.getBoundingClientRect().top : oldBarY !== null ? oldBarY : centre(layout.getBoundingClientRect()).y;

    var anims = [];
    plan.to.forEach(function (k) {
      var el = newEl[k];
      if (!el) return;
      if (!oldEl[k]) {   // the 1 that appears with the bar
        anims.push(el.animate([{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'none' }],
          { duration: EMERGE_MS * 0.7, delay: DIP_MS * 0.9, easing: 'cubic-bezier(.2,1.5,.4,1)', fill: 'backwards' }));
      } else if (plan.flips[k]) {   // 3. grows out of the bar, where its twin went into it
        anims.push(el.animate([
          { transform: 'translate(' + (oldAt[k].x - newAt[k].x) + 'px, ' + (barY - newAt[k].y) + 'px) scale(.9, .15)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ], { duration: EMERGE_MS, delay: DIP_MS, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'backwards' }));
      } else {   // stays on its side, sliding to its new place
        anims.push(el.animate([
          { transform: 'translate(' + (oldAt[k].x - newAt[k].x) + 'px,' + (oldAt[k].y - newAt[k].y) + 'px)' },
          { transform: 'none' },
        ], { duration: SLIDE_MS, delay: DIP_MS * 0.75, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'backwards' }));
      }
    });
    // 2. Each crossing power dips into the bar, negative exponent and all.
    Object.keys(ghosts).forEach(function (k) {
      var g = ghosts[k];
      if (!plan.flips[k]) { anims.push(fade(g)); return; }
      var end = 'translate(0, ' + (barY - oldAt[k].y) + 'px)';
      anims.push(g.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: end + ' scale(.9, .7)', opacity: 1, offset: 0.75 },
        { transform: end + ' scale(.5, .1)', opacity: 0 },
      ], { duration: DIP_MS, easing: 'ease-in', fill: 'forwards' }));
    });
    if (den && !oldDen) {   // a new bar fades in
      anims.push(den.animate([{ borderTopColor: 'rgba(0, 0, 0, 0)' }, { borderTopColor: getComputedStyle(den).borderTopColor }],
        { duration: DIP_MS * 0.7, delay: DIP_MS * 0.3, easing: 'ease-in', fill: 'backwards' }));
    }
    if (barGhost) anims.push(barGhost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DIP_MS, easing: 'ease-in', fill: 'forwards' }));

    return done(anims).then(function () {
      if (host[TOKEN] !== token) return;
      Object.keys(ghosts).forEach(function (k) { ghosts[k].remove(); });
      if (barGhost) barGhost.remove();
      swap(host, tree);
      fit(host);
      // 4. The new exponents are emphasized at once.
      var lit = flipped(host, plan);
      lit.forEach(function (el) { el.classList.add('is-lit'); });
      setTimeout(function () { lit.forEach(function (el) { el.classList.remove('is-lit'); }); }, HOLD_MS);
      return done(lit.map(function (el) {
        return el.animate([{ transform: 'scale(1.7)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,1.6,.4,1)' });
      }));
    });
  }

  /* ---- Mode 7 (Mode 7 design §7) -------------------------------------------- */
  /* Any mixed problem: (2x³y⁻²)³/(4x²), (x/y)³ · y⁵, 3² · 3⁻⁴. One crush from the
     problem straight to the answer, with no steps between (design §7):
       1. Every part slides to the middle of the problem and shrinks, as in Mode 1's
          crush. The dots and parentheses fade, and the fraction bars with them.
       2. The answer is drawn, and each part of it pops in, its exponents springing up.
     The stage keeps its height, so a fraction becoming a line doesn't move the page
     (Mode 6's lesson); it is let go at the next problem, in show(). Reduced motion:
     the problem lights, holds HOLD_MS, then the answer swaps in (litProblem). */
  function holdHeight(host) { host.style.minHeight = host.offsetHeight + 'px'; }

  function all(host, tree) {
    var token = host[TOKEN], top = host.firstElementChild;
    host.classList.remove('is-wrong');
    host.classList.add('is-crushing');
    holdHeight(host);
    var mid = centre(top.getBoundingClientRect()), anims = [];
    Array.prototype.forEach.call(host.querySelectorAll('.m-ch, .m-var, .m-exp, .m-op, .m-paren'), function (el) {
      // An exponent moves whole; its own digits go with it.
      if (!el.classList.contains('m-exp') && el.closest('.m-exp')) return;
      if (isOp(el) || el.classList.contains('m-paren')) { anims.push(fade(el)); return; }
      var at = centre(el.getBoundingClientRect()), dx = mid.x - at.x, dy = mid.y - at.y;
      // Fully opaque until the last fifth, so a part is never half-faded while it is still travelling.
      anims.push(el.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(.92)', opacity: 1, offset: 0.8 },
        { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(.55)', opacity: 0 },
      ], { duration: CRUSH_MS, easing: 'cubic-bezier(.55,0,.8,.2)', fill: 'forwards' }));
    });
    Array.prototype.forEach.call(host.querySelectorAll('.m-den'), function (den) { anims.push(fadeBar(den, CRUSH_MS * 0.6)); });
    return done(anims).then(function () {
      if (host[TOKEN] !== token) return;
      swap(host, tree);
      fit(host);
      drawnParts(host.firstElementChild).forEach(function (el) {
        el.animate([{ transform: 'scale(1.5)', opacity: 0.2 }, { transform: 'scale(1)', opacity: 1 }],
          { duration: 340, easing: 'cubic-bezier(.2,1.5,.4,1)' });
      });
      Array.prototype.forEach.call(host.querySelectorAll('.m-exp'), function (el) {
        el.animate([{ transform: 'translateY(.5em) scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: 380, delay: 90, easing: 'cubic-bezier(.2,1.6,.4,1)', fill: 'backwards' });
      });
    });
  }

  /* Restarted on every wrong answer, so a second wrong answer shakes again. */
  function mismatch(host) {
    host.classList.remove('is-wrong');
    void host.offsetWidth;
    host.classList.add('is-wrong');
  }

  function reset(host) { host.classList.remove('is-wrong'); }

  PC.Crush = { show: show, crush: crush, mismatch: mismatch, reset: reset, fit: fit };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
