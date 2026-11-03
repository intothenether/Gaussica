// Spelling in answers that are words ("summa", "täljare"): a young student can know the word and not yet be able to spell it. An answer that is almost right
// in the spelling counts as the right word, and the student is shown how it is spelled (a setting in "Läsning" can turn this off).
//
//   GaussicaSpelling.match(raw, accepted, others)   { word, wrote } when raw is a slip in the spelling of exactly one of the accepted words, otherwise null
//   GaussicaSpelling.contextFor(lesson, exercise)   the other words of the question and the lesson (wrong answers with hints, the terms of the lesson), so that
//                                                   a word that is another term is never taken for a slip of this one
//   GaussicaSpelling.isWord(text)                   only letters (and a space or hyphen): numbers, fractions and calculations are never touched
//
// What counts as a slip: the same word when å ä ö are written a o, double letters are single (suma), ck is k, and w is v, or one letter more, less, other
// or two letters swapped (sumna). Eight letters or more may have two. Never for words under four letters, except for the writing of å ä ö and doubled
// letters. The ambiguity check is the safety: if the answer is as near to another word of the lesson (or nearer), it is not a slip of this one.

(function (root) {
  "use strict";

  const WORD = /^[a-zåäöéü][a-zåäöéü \-]*$/i;

  function isWord(text) { return typeof text === "string" && WORD.test(text.trim()) && text.replace(/[^a-zåäöéü]/gi, "").length >= 2; }

  // the word as it sounds, roughly: without what a young speller mixes up
  function key(text) {
    return String(text).toLowerCase().replace(/[\s\-]+/g, "")
      .replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/é/g, "e").replace(/ü/g, "y")
      .replace(/ck/g, "k").replace(/ph/g, "f").replace(/w/g, "v")
      .replace(/(.)\1+/g, "$1");
  }

  // Levenshtein with a swap of two neighbouring letters as one step
  function distance(a, b) {
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  // how many letters may differ in a word of this length (in the key)
  function allowed(length) { return length < 4 ? 0 : length < 8 ? 1 : 2; }

  function match(raw, accepted, others) {
    if (!isWord(raw)) return null;
    const words = (accepted || []).map(String);
    if (!words.length || !words.every(isWord)) return null;
    const k = key(raw);
    // the nearest of the accepted ones
    let best = null;
    words.forEach(function (w) {
      const kw = key(w), d = distance(k, kw);
      if (d <= allowed(kw.length) && (!best || d < best.d)) best = { word: w, key: kw, d: d };
    });
    if (!best) return null;
    // another word of the lesson that the answer is as near to, or nearer: it may be that word, so nothing is assumed
    const acceptedKeys = new Set(words.map(key));
    const rivals = (others || []).map(String).filter(isWord).map(key).filter(function (o) { return !acceptedKeys.has(o); });
    if (rivals.some(function (o) { return distance(k, o) <= best.d; })) return null;
    return { word: best.word, wrote: String(raw).trim() };
  }

  // the other words that the question or the lesson has: the wrong answers that have a hint, the terms of the concept cards and of the practice
  function contextFor(lesson, exercise) {
    const out = [];
    const add = function (w) { if (isWord(w) && out.indexOf(w) < 0) out.push(w); };
    ((exercise && exercise.feedback) || []).forEach(function (rule) { (rule.answers || []).forEach(add); });
    ((exercise && exercise.bank) || []).forEach(add);
    ((lesson && lesson.components) || []).forEach(function (c) { if (c && c.type === "begreppskort") (c.cards || []).forEach(function (card) { add(card.term); }); });
    ((lesson && lesson.practice) || []).forEach(function (t) {
      (t.pool || []).forEach(function (p) { if (p && p.term) { add(p.term); (p.alt || []).forEach(add); } });
      (t.feedback || []).forEach(function (rule) { (rule.answers || []).forEach(add); });
    });
    return out;
  }

  const api = { match: match, contextFor: contextFor, isWord: isWord, key: key, distance: distance };
  root.GaussicaSpelling = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
