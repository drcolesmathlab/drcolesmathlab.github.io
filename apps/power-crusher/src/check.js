/*
 * check.js — grades a typed answer against an expected expression.
 *
 * Two steps, kept apart on purpose (handoff §4 assumption): first, is the answer
 * equivalent at all (compare normal forms)? Then, which formatting rules of the
 * current policy does it break? Every broken rule is reported by code, so
 * feedback wording can be written later without touching the checker.
 *
 * A policy is data: which structural facts block a correct mark (`issues`) and
 * which are reported but still correct (`notes`). Each mode picks or extends one.
 */
(function (PC) {
  'use strict';
  var E = PC.Expr;

  // fact name (parse.js) → issue code, in the order feedback should mention them.
  var RULES = [
    ['groupLeft',             'GROUP_LEFT'],
    ['constantPower',         'CONSTANT_POWER'],
    ['negativeExponent',      'NEGATIVE_EXPONENT'],
    ['zeroExponent',          'ZERO_EXPONENT'],
    ['repeatedBase',          'REPEATED_BASE'],
    ['uncombinedConstants',   'UNCOMBINED_CONSTANTS'],
    ['factorOutsideFraction', 'FACTOR_OUTSIDE_FRACTION'],
    ['notLowestTerms',        'NOT_LOWEST_TERMS'],
    ['denominatorOne',        'DENOMINATOR_ONE'],
    ['oneFactor',             'ONE_FACTOR'],
    ['exponentOne',           'EXPONENT_ONE'],
  ];

  var POLICIES = {
    /* Mixed Practice (Mode 7 design §6): the answer must be equal and fully
       simplified. An `issues` code is red (wrong): a negative or zero exponent
       left, a constant left as a power (2³ for 8), a base written twice, constants
       not combined (3 · 4x). A `notes` code is yellow: the answer is right but not
       fully simplified, so it counts as correct and the box stays open (a fraction
       not in lowest terms, a denominator of 1, multiplication by 1, an exponent of
       1). A coefficient fraction outside the variables, (1/8)x, is fine
       (FACTOR_OUTSIDE_FRACTION is in neither list), and so is any order of the
       bases. This overrides handoff §4, where 1x³ and x¹ were plain correct.
       Parentheses left in the answer, (x²)³ for x⁶, are red (Dr. Cole, 2026-09-30,
       phase 2): the problem typed back is not an answer. */
    mixed: {
      id: 'mixed',
      issues: ['GROUP_LEFT', 'CONSTANT_POWER', 'NEGATIVE_EXPONENT', 'ZERO_EXPONENT', 'REPEATED_BASE',
               'UNCOMBINED_CONSTANTS'],
      notes: ['NOT_LOWEST_TERMS', 'DENOMINATOR_ONE', 'ONE_FACTOR', 'EXPONENT_ONE'],
    },
    /* Property modes 1–4: the student applies the property; anything equivalent
       and simplified further is fine (x³/x⁵ → x⁻² or 1/x²), x¹ is fine. The one
       thing that means the property was NOT applied is a base still written
       twice (x⁴x³ typed back for x⁴·x³). Per-mode pass criteria are [TBD] and
       will extend this in each mode's phase. */
    property: {
      id: 'property',
      issues: ['REPEATED_BASE'],
      notes: [],
    },
    /* [ASSUMPTION — provisional until Dr. Cole designs these modes] The zero and
       negative exponent properties exist to remove that exponent, so typing it
       back (7⁰ for 7⁰) must not pass. The default above can't see that.
       Mode 5's levels don't use `zero`: they grade in zero.js, by the design's
       own rules (Mode 5 design §6, §7). It stays for the sandbox. */
    zero: {
      id: 'zero',
      issues: ['REPEATED_BASE', 'ZERO_EXPONENT'],
      notes: [],
    },
    negative: {
      id: 'negative',
      issues: ['REPEATED_BASE', 'NEGATIVE_EXPONENT'],
      notes: [],
    },
  };

  /* PLACEHOLDER wording — Dr. Cole writes the real feedback once the explorations
     exist (handoff §3). These only say which rule applied. */
  var MESSAGES = {
    EMPTY: 'Type an answer first.',
    EMPTY_BOX: 'There is an empty box in your answer.',
    EXPONENT_NOT_INTEGER: 'An exponent here must be a whole number, like 3 or −2.',
    EXPONENT_WITHOUT_BASE: 'An exponent needs a number or letter in front of it.',
    MISPLACED_MINUS: 'That minus sign is in a place it can’t go.',
    NESTED_FRACTION: 'A fraction can’t go inside a fraction here.',
    NESTED_GROUP: 'Only one level of parentheses is used here.',
    NUMBER_TOO_LONG: 'That number is too long.',
    UNKNOWN_SYMBOL: 'Your answer has a symbol that can’t be used here.',
    NOT_EQUIVALENT: 'Not quite — that isn’t equal to the expression.',
    GROUP_LEFT: 'The parentheses are still there: apply the exponent to everything inside them.',   // placeholder
    CONSTANT_POWER: 'Evaluate powers of numbers, like 2³ = 8.',
    NEGATIVE_EXPONENT: 'The final answer should have no negative exponents.',
    ZERO_EXPONENT: 'The final answer should have no zero exponents.',
    REPEATED_BASE: 'A base appears more than once — combine it.',
    UNCOMBINED_CONSTANTS: 'Multiply the numbers together into one.',
    FACTOR_OUTSIDE_FRACTION: 'Write the whole answer as one fraction.',
    NOT_LOWEST_TERMS: 'The fraction can be reduced.',
    DENOMINATOR_ONE: 'A denominator of 1 can be left out.',
    ONE_FACTOR: 'Multiplying by 1 can be left out: write x³, not 1x³.',   // placeholder (Mode 7 design §6)
    EXPONENT_ONE: 'Exponents of 1 are left out of final answers: write x, not x¹.',
    VARIABLE_ORDER: 'Correct. Letters are usually written in alphabetical order.',
    CORRECT: 'Correct.',
  };

  function check(model, expected, policy) {
    policy = typeof policy === 'string' ? POLICIES[policy] : policy;
    var p = PC.Parse.parse(model);
    var result = {
      status: 'invalid', correct: false, equivalent: false,
      errors: p.errors, issues: [], notes: [], facts: p.facts, tree: p.tree,
    };
    if (p.errors.length) return result;

    result.equivalent = E.equivalent(p.tree, expected);
    if (!result.equivalent) result.issues.push('NOT_EQUIVALENT');

    RULES.forEach(function (rule) {
      if (!p.facts[rule[0]]) return;
      if (policy.issues.indexOf(rule[1]) >= 0) result.issues.push(rule[1]);
      else if (policy.notes.indexOf(rule[1]) >= 0) result.notes.push(rule[1]);
    });
    if (!p.facts.variableOrder && policy.notes.indexOf('VARIABLE_ORDER') >= 0) {
      result.notes.push('VARIABLE_ORDER');
    }

    result.correct = result.issues.length === 0;
    result.status = result.correct ? 'correct' : 'incorrect';
    return result;
  }

  /* One sentence for the live region. Variable order is held back from the text
     until the handoff's [TBD] on it is settled; it stays in result.notes. A correct
     answer with a note says what to improve (a Mixed Practice yellow). */
  function message(result) {
    if (result.status === 'invalid') return MESSAGES[result.errors[0]] || MESSAGES.UNKNOWN_SYMBOL;
    if (!result.correct) return MESSAGES[result.issues[0]];
    var hints = improvements(result);
    if (hints.length) return 'Correct. ' + hints.join(' ');
    return MESSAGES.CORRECT;
  }

  /* The sentences for the notes that mean "correct, but not fully simplified",
     in the order of RULES. VARIABLE_ORDER is not one of them. */
  function improvements(result) {
    return RULES.map(function (r) { return r[1]; })
      .filter(function (code) { return result.notes.indexOf(code) >= 0; })
      .map(function (code) { return MESSAGES[code]; });
  }

  PC.Check = { check: check, message: message, improvements: improvements, POLICIES: POLICIES, MESSAGES: MESSAGES };
})(typeof module === 'object' && module.exports
  ? (module.exports = globalThis.PowerCrusher = globalThis.PowerCrusher || {})
  : (window.PowerCrusher = window.PowerCrusher || {}));
