// Searching for a lesson by what the student or the teacher remembers of it: part of the name ("tomma hinken"), a word from the summary ("klocka"), the area, or the
// kind ("pyssla", "kapitel"). It is used in two places that both had a long list to scroll through: the map of the lessons and the lesson pickers of the assignments.
//
//   GaussicaSearch.normalize(text)                       lower case, without the accents (å, ä and ö count as a, a and o, so that "brak" finds "Bråk"), single spaces
//   GaussicaSearch.find(lessons, query, options)         the lessons that match every word of the query, the best first: [{ lesson, score }]
//        options.extra(lesson)    more text to search in, as a string (the name of the area, the kind of lesson, the titles of the parts of a chapter)
//        options.limit            at most this many
//   GaussicaSearch.matches(lesson, query, options)       does it match? (the same as find, for one lesson)
//
// Every word of the query has to be found (in any order), the start of a word counts more than the middle of one, and a word of the title counts more than a word of the
// summary. An empty query finds nothing (the caller then shows everything).

(function (root) {
  "use strict";

  function normalize(text) {
    return String(text === undefined || text === null ? "" : text).toLowerCase()
      .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function words(query) { return normalize(query).split(" ").filter(Boolean); }

  // how well one word of the query is found in a text: 0 (not at all), 1 (somewhere in it) or 2 (at the start of a word)
  function find1(hay, word) {
    const at = hay.indexOf(word);
    if (at < 0) return 0;
    return at === 0 || hay.charAt(at - 1) === " " || hay.indexOf(" " + word) >= 0 ? 2 : 1;
  }

  // the parts of a lesson to search in, with how much each counts
  function fieldsOf(lesson, options) {
    const extra = options && options.extra ? options.extra(lesson) : "";
    return [
      [normalize(lesson.title), 10], [normalize(lesson.explanationTitle), 4], [normalize(lesson.id.replace(/-/g, " ")), 3],
      [normalize(lesson.summary), 3], [normalize(lesson.level), 3], [normalize(extra), 3]
    ];
  }

  function score(lesson, ws, options) {
    if (!ws.length) return 0;
    const fields = fieldsOf(lesson, options);
    let total = 0;
    for (let i = 0; i < ws.length; i++) {
      let best = 0;
      fields.forEach(function (f) {
        const hit = find1(f[0], ws[i]);
        if (hit) best = Math.max(best, f[1] * hit);
      });
      if (!best) return 0;   // a word that is nowhere: not a match
      total += best;
    }
    return total;
  }

  function find(lessons, query, options) {
    const ws = words(query);
    if (!ws.length) return [];
    const out = [];
    (lessons || []).forEach(function (lesson, i) {
      const s = score(lesson, ws, options);
      if (s > 0) out.push({ lesson: lesson, score: s, i: i });
    });
    out.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
    const limit = options && options.limit ? options.limit : out.length;
    return out.slice(0, limit).map(function (x) { return { lesson: x.lesson, score: x.score }; });
  }

  function matches(lesson, query, options) { return score(lesson, words(query), options) > 0; }

  const api = { normalize: normalize, find: find, matches: matches };
  root.GaussicaSearch = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
