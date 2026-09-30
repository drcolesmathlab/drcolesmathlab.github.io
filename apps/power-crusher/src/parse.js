/*
 * parse.js — turns the math input's model into an expression tree, plus the
 * structural facts the checker grades formatting on.
 *
 * Input model (owned by mathinput.js):
 *   row  = { items: [item, ...] }
 *   item = { k: 'ch', c: '3' | 'x' | '-' }
 *        | { k: 'sup',  row: row }                  exponent box
 *        | { k: 'frac', num: row, den: row }        fraction box (top level only)
 *        | { k: 'group', row: row }                  parentheses (Mixed Practice's workspace):
 *                                                    one level; a fraction may sit inside one
 *                                                    that is on the main line
 *
 * A row reads as a product. A run of digits is one number, each letter is one
 * variable, and an exponent box attaches to the number or letter before it.
 *
 * Why facts are read from the typed structure and not the normal form: the
 * normal form of (1/8)x⁻³ and 1/(8x³) is identical — the difference Mixed mode
 * grades is entirely in how it was written.
 */
(function (PC) {
  'use strict';
  var E = PC.Expr, R = PC.Rational;

  var DIGIT = /^[0-9]$/, LETTER = /^[a-z]$/;
  var MAX_NUMBER = 1e15;   // longer literals can't be exact in a Number

  function parse(model) {
    var errors = [];
    var records = [];       // every number / variable factor, with where it sits
    var fracs = [];         // { numRecs, denRecs }
    var topKinds = [];      // kinds of top-level factors, in order
    var negative = false;
    var oneFactor = false;  // a plain 1 multiplied by something else in one row: 1x³
    var groupLeft = false;  // parentheses left in the answer: (x²)³

    function err(code) { if (errors.indexOf(code) < 0) errors.push(code); }

    function readExponent(row) {
      if (!row.items.length) { err('EMPTY_BOX'); return null; }
      var s = '';
      for (var i = 0; i < row.items.length; i++) {
        var it = row.items[i];
        if (it.k !== 'ch') { err('EXPONENT_NOT_INTEGER'); return null; }
        s += it.c;
      }
      if (!/^-?[0-9]+$/.test(s)) { err('EXPONENT_NOT_INTEGER'); return null; }
      var n = parseInt(s, 10);
      return n === 0 ? 0 : n;   // no -0
    }

    /* Returns an array of factor nodes for the row. `inGroup` marks the row inside
       parentheses: what is in there isn't a top-level factor of the answer. */
    function readRow(row, level, inGroup) {
      var out = [], items = row.items, i = 0, plainOne = false;
      var atTop = level === 'top' && !inGroup;
      while (i < items.length) {
        var it = items[i], rec = null, node = null;
        if (it.k === 'ch' && DIGIT.test(it.c)) {
          var s = '';
          while (i < items.length && items[i].k === 'ch' && DIGIT.test(items[i].c)) s += items[i++].c;
          var v = Number(s);
          if (v > MAX_NUMBER) err('NUMBER_TOO_LONG');
          node = E.N(v);
          rec = { kind: 'num', base: String(v), value: v, exp: null, level: level };
        } else if (it.k === 'ch' && LETTER.test(it.c)) {
          i++;
          node = E.V(it.c);
          rec = { kind: 'var', base: it.c, exp: null, level: level };
        } else if (it.k === 'ch' && it.c === '-') {
          i++;
          if (level === 'top' && out.length === 0 && !negative && topKinds.length === 0) negative = true;
          else err('MISPLACED_MINUS');
          continue;
        } else if (it.k === 'sup') {
          i++;
          err('EXPONENT_WITHOUT_BASE');
          continue;
        } else if (it.k === 'frac') {
          i++;
          if (level !== 'top') { err('NESTED_FRACTION'); continue; }
          if (!it.num.items.length || !it.den.items.length) err('EMPTY_BOX');
          var before = records.length;
          var numF = readRow(it.num, 'num');
          var mid = records.length;
          var denF = readRow(it.den, 'den');
          fracs.push({ numRecs: records.slice(before, mid), denRecs: records.slice(mid) });
          out.push(E.D(product(numF), product(denF)));
          if (atTop) topKinds.push('frac');
          continue;
        } else if (it.k === 'group') {
          i++;
          groupLeft = true;
          if (inGroup) { err('NESTED_GROUP'); continue; }
          if (!it.row.items.length) err('EMPTY_BOX');
          node = E.G(product(readRow(it.row, level, true)));
          // An exponent box directly after the ")" belongs to the whole group.
          if (i < items.length && items[i].k === 'sup') {
            var ge = readExponent(items[i].row);
            i++;
            if (ge !== null) node = E.P(node, ge);
          }
          out.push(node);
          if (atTop) topKinds.push('group');
          continue;
        } else {
          i++;
          err('UNKNOWN_SYMBOL');
          continue;
        }
        // An exponent box directly after a number or letter belongs to it.
        if (i < items.length && items[i].k === 'sup') {
          var e = readExponent(items[i].row);
          i++;
          if (e !== null) { node = E.P(node, e); rec.exp = e; }
        }
        if (rec.kind === 'num' && rec.value === 1 && rec.exp === null) plainOne = true;
        records.push(rec);
        out.push(node);
        if (atTop) topKinds.push(rec.kind);
      }
      // A lone 1 is a whole answer or a numerator (1/x²); a 1 beside anything else is
      // multiplication by 1 (Mode 7 design §6).
      if (plainOne && out.length > 1) oneFactor = true;
      return out;
    }

    function product(factors) {
      if (factors.length === 0) return E.N(1);   // only reachable with EMPTY_BOX already set
      return factors.length === 1 ? factors[0] : { t: 'mul', factors: factors };
    }

    var top = readRow(model, 'top');
    if (!model.items.length || (!top.length && !errors.length)) err('EMPTY');
    if (negative && !top.length) err('MISPLACED_MINUS');

    var tree = null;
    if (!errors.length) {
      tree = product(top);
      if (negative) tree = { t: 'neg', inner: tree };
    }
    var f = facts(records, fracs, topKinds, negative, oneFactor);
    f.groupLeft = groupLeft;
    return { tree: tree, errors: errors, facts: f };
  }

  /* ---- structural facts ------------------------------------------------------ */
  function constValue(recs) {
    // Integer value of the constants in one level, or null if an exponent is negative.
    var v = R.ONE;
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (r.kind !== 'num') continue;
      var e = r.exp === null ? 1 : r.exp;
      if (e < 0) return null;
      try { v = R.mul(v, R.pow(R.make(r.value), e)); } catch (x) { return null; }
    }
    return v;
  }

  function facts(records, fracs, topKinds, negative, oneFactor) {
    var f = {
      negativeSign: negative,
      constantPower: false,     // 2³ left unevaluated (exponent other than 1)
      negativeExponent: false,
      zeroExponent: false,
      exponentOne: false,       // x¹ (or 5¹)
      repeatedBase: false,      // x²x³, x³/x, 2³·2⁴
      uncombinedConstants: false, // two separate constants in one level
      factorOutsideFraction: false, // (1/8)x³, or two fractions side by side
      notLowestTerms: false,    // 2x/4
      denominatorOne: false,    // x/1
      oneFactor: !!oneFactor,   // 1x³ (a plain 1 multiplied by something)
      variableOrder: true,      // alphabetical within every level
    };
    var varSeen = {}, numPow = {}, numPlain = {}, perLevel = {};

    records.forEach(function (r) {
      if (r.exp !== null) {
        if (r.exp < 0) f.negativeExponent = true;
        if (r.exp === 0) f.zeroExponent = true;
        if (r.exp === 1) f.exponentOne = true;
        if (r.kind === 'num' && r.exp !== 1) f.constantPower = true;
      }
      if (r.kind === 'var') {
        if (varSeen[r.base]) f.repeatedBase = true;
        varSeen[r.base] = true;
      } else {
        // A repeated constant only counts as a repeated *base* when a power is
        // involved (2³·2⁴, 2³/2); 2 and 4 in 2x/4 are a lowest-terms matter.
        if (r.exp !== null ? (numPow[r.base] || numPlain[r.base]) : numPow[r.base]) f.repeatedBase = true;
        if (r.exp !== null) numPow[r.base] = true; else numPlain[r.base] = true;
      }
      perLevel[r.level] = perLevel[r.level] || { nums: 0, vars: [] };
      if (r.kind === 'num') perLevel[r.level].nums++;
      else perLevel[r.level].vars.push(r.base);
    });

    fracs.forEach(function (fr) {
      // Levels are per fraction; perLevel lumps num/den across fractions, which
      // only matters when there are two fractions — already an error of its own.
      var nv = constValue(fr.numRecs), dv = constValue(fr.denRecs);
      if (nv && dv && nv.d === 1n && dv.d === 1n && R.gcd(nv.n, dv.n) > 1n) f.notLowestTerms = true;
      if (fr.denRecs.length === 1 && fr.denRecs[0].kind === 'num' && fr.denRecs[0].value === 1 &&
          (fr.denRecs[0].exp === null || fr.denRecs[0].exp === 1)) f.denominatorOne = true;
    });

    Object.keys(perLevel).forEach(function (lv) {
      var L = perLevel[lv];
      if (L.nums > 1) f.uncombinedConstants = true;
      var sorted = L.vars.slice().sort();
      if (sorted.join() !== L.vars.join()) f.variableOrder = false;
    });

    var nFrac = topKinds.filter(function (k) { return k === 'frac'; }).length;
    if (nFrac > 1 || (nFrac === 1 && topKinds.length > 1)) f.factorOutsideFraction = true;
    return f;
  }

  PC.Parse = { parse: parse };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
