// A word bank under the answer field for questions where the answer is a word: the right word and a few that it is easily mixed up with, to tap instead of
// typing. For a young student it takes spelling out of the question while the point is to know the concept. It fades as the student gets on:
//
//   at first                          always shown
//   after eight points                only after a wrong answer
//   after sixteen points              only when asked for ("Visa ordbank")
//
// A right answer gives one point when a word was tapped and two when it was typed. A student who only taps stays where they are for longer, and the
// bank is never hidden for good: it is one tap away. The setting "Ordbank" in Läsning can keep it always on ("always") or off ("off").
//
//   GaussicaWordBank.options(exercise, lesson)    the words to show (the right one among them, in a random place), or [] if the question is not one for it
//   GaussicaWordBank.when()                       "show" | "afterMiss" | "onRequest" | "none"
//   GaussicaWordBank.add(points)                  a right answer was given
//
// The wrong words are the answers of the question's own hints (the words that students mix it up with), a list in `bank` on the question if it has one,
// and otherwise the terms of the lesson. A question needs at least two of them: with fewer there is nothing to choose between.

(function (root) {
  "use strict";

  const KEY = "gaussica-wordbank";
  const SHOW_UNTIL = 8, AFTER_MISS_UNTIL = 16, MAX = 5;
  const PLAIN = /^(ja|nej|sant|falskt|rätt|fel)$/i;

  function spelling() { return root.GaussicaSpelling || (typeof require !== "undefined" ? require("./spelling.js") : null); }

  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function options(exercise, lesson) {
    const S = spelling();
    if (!S || !exercise || !Array.isArray(exercise.answer) || !exercise.answer.length) return [];
    const accepted = exercise.answer.map(String);
    if (!accepted.every(S.isWord) || PLAIN.test(accepted[0].trim())) return [];
    const taken = new Set(accepted.map(S.key));
    const listed = [], near = [], far = [];
    const add = function (list, w) { if (S.isWord(w) && !taken.has(S.key(w))) { taken.add(S.key(w)); list.push(w); } };
    (exercise.bank || []).forEach(function (w) { add(listed, w); });   // chosen by the question: the words most like the right one first
    (exercise.feedback || []).forEach(function (rule) { if (rule && rule.answers && rule.answers.length) add(near, String(rule.answers[0])); });
    // the terms of the lesson only for a question that has no words of its own to choose between (the words of its hints are the ones it is mixed up with)
    if (!listed.length && !near.length) S.contextFor(lesson, {}).forEach(function (w) { add(far, w); });
    const wrong = listed.slice(0, MAX - 1);
    if (wrong.length < MAX - 1) shuffled(near).slice(0, MAX - 1 - wrong.length).forEach(function (w) { wrong.push(w); });
    if (wrong.length < MAX - 1) shuffled(far).slice(0, MAX - 1 - wrong.length).forEach(function (w) { wrong.push(w); });
    if (wrong.length < 2) return [];
    return shuffled([accepted[0]].concat(wrong));
  }

  function read() {
    try { const s = JSON.parse(root.localStorage.getItem(KEY) || "{}"); return { points: Number(s.points) > 0 ? Number(s.points) : 0 }; } catch (e) { return { points: 0 }; }
  }
  function points() { return read().points; }
  function add(n) {
    try { root.localStorage.setItem(KEY, JSON.stringify({ points: points() + n })); } catch (e) { /* not kept: it starts again */ }
  }

  function mode() {
    const s = root.GaussicaReading && root.GaussicaReading.settings ? root.GaussicaReading.settings() : {};
    return s.bank === "always" || s.bank === "off" ? s.bank : "fade";
  }

  function when() {
    const m = mode();
    if (m === "off") return "none";
    if (m === "always") return "show";
    const p = points();
    return p < SHOW_UNTIL ? "show" : p < AFTER_MISS_UNTIL ? "afterMiss" : "onRequest";
  }

  const api = { options: options, when: when, add: add, points: points, SHOW_UNTIL: SHOW_UNTIL, AFTER_MISS_UNTIL: AFTER_MISS_UNTIL };
  root.GaussicaWordBank = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
