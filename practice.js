// Generated practice questions ("Öva mer").
//
// A lesson can carry `practice`: a list of templates that produce fresh questions with new numbers.
// Each template is plain JSON and uses the small safe expression evaluator from pyssel.js:
//
//   { "id": "sum", "for": ["exercise"],                 // optional: fixed tasks this template mirrors (used for review)
//     "pick": { "namn": ["Mira", "Omar"] },             // random text choices, written {$namn}
//     "vars": { "a": [100, 899], "b": [100, 899] },     // random numbers [min, max] or [min, max, step]
//     "derive": [ { "name": "s", "expr": "a+b" } ],     // computed values, in order
//     "where": [ { "expr": "a-b", "min": 1 } ],         // conditions the numbers must meet
//     "prompt": "Räkna ut {a} + {b}.",                  // {expr} is filled in (comma for decimals)
//     "answer": ["=s"],                                 // "=expr" becomes a number, text may use {expr}
//     "correct": "Rätt! {a} + {b} = {s}.",
//     "feedback": [ { "answers": ["=a-b"], "message": "Du har tagit bort i stället för att lägga till." } ],
//     "visual": { "type": "klocka", "h": "=h", "m": "=m" } }   // optional figure, same bindings
//
// A generated question has the same shape as a normal lesson question, so it is answered and
// checked by the same code. Its id is "practice-<template>-<seed>", which makes it reproducible.

window.GaussicaPractice = (function () {
  "use strict";

  const PREFIX = "practice-";

  function P() { return window.GaussicaPyssel; }

  function templates(lesson) {
    return (lesson && Array.isArray(lesson.practice) ? lesson.practice : []).filter(function (t) {
      return t && t.id && t.prompt && Array.isArray(t.answer) && t.answer.length;
    });
  }

  function has(lesson) { return templates(lesson).length > 0; }

  function isPracticeId(taskId) { return String(taskId || "").indexOf(PREFIX) === 0; }

  // "practice-<template>-<seed>" -> { template, seed }
  function parseId(taskId) {
    const m = /^practice-(.+)-([0-9a-z]+)$/.exec(String(taskId || ""));
    return m ? { template: m[1], seed: parseInt(m[2], 36) } : null;
  }

  function makeId(templateId, seed) { return PREFIX + templateId + "-" + seed.toString(36); }

  // Small seeded random generator, so a question can be recreated from its id.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeed() { return Math.floor(Math.random() * 1e9) + 1; }

  function round6(v) { return Math.round(v * 1e6) / 1e6; }

  // Accepted spellings of a number: 31.4 and 31,4
  function numberStrings(n) {
    const s = String(round6(n));
    return s.indexOf(".") >= 0 ? [s, s.replace(".", ",")] : [s];
  }

  function stringsOf(list) {
    const out = [];
    list.forEach(function (v) {
      (typeof v === "number" ? (isFinite(v) ? numberStrings(v) : ["?"]) : [String(v)]).forEach(function (s) {
        if (out.indexOf(s) < 0) out.push(s);
      });
    });
    return out;
  }

  function fillPicks(value, picks) {
    if (typeof value === "string") return value.replace(/\{\$([A-Za-z_åäöÅÄÖ0-9]+)\}/g, function (m, k) { return picks[k] !== undefined ? picks[k] : m; });
    if (Array.isArray(value)) return value.map(function (v) { return fillPicks(v, picks); });
    if (value && typeof value === "object") {
      const o = {};
      Object.keys(value).forEach(function (k) { o[k] = fillPicks(value[k], picks); });
      return o;
    }
    return value;
  }

  // Builds one question from a template and a seed. Returns null if the numbers can't be made to fit.
  function build(template, seed) {
    const py = P();
    if (!py) return null;
    const rand = rng(seed);
    for (let attempt = 0; attempt < 80; attempt++) {
      const scope = {};
      const picks = {};
      Object.keys(template.pick || {}).forEach(function (k) {
        const list = template.pick[k];
        picks[k] = list[Math.floor(rand() * list.length)];
      });
      Object.keys(template.vars || {}).forEach(function (k) {
        const r = template.vars[k];
        const step = r[2] || 1;
        const n = Math.floor((r[1] - r[0]) / step + 1e-9);
        scope[k] = round6(r[0] + step * Math.floor(rand() * (n + 1)));
      });
      (template.derive || []).forEach(function (d) { scope[d.name] = py.evalExpr(d.expr, scope); });
      const ok = (template.where || []).every(function (c) { return py.holds(c, scope); });
      if (!ok) continue;

      const filled = fillPicks({
        prompt: template.prompt, answer: template.answer, correct: template.correct || "Rätt!",
        feedback: template.feedback || [], visual: template.visual, visuals: template.visuals
      }, picks);
      const r = py.resolve(filled, scope);
      const answer = stringsOf(r.answer);
      if (!answer.length || answer.indexOf("?") >= 0) continue;
      const feedback = [];
      (r.feedback || []).forEach(function (f) {
        const answers = stringsOf(f.answers || []).filter(function (a) { return answer.indexOf(a) < 0 && a !== "?"; });
        if (answers.length && f.message) feedback.push({ answers: answers, message: f.message });
      });
      const problem = { prompt: r.prompt, answer: answer, correct: r.correct, feedback: feedback };
      if (r.visual) problem.visual = r.visual;
      if (r.visuals) problem.visuals = r.visuals;
      if (/NaN|undefined/.test(JSON.stringify(problem)) || /\{|\}/.test(problem.prompt)) continue;
      return problem;
    }
    return null;
  }

  // Question for a lesson: { taskId, templateId, problem } or null.
  function generate(lesson, templateId, seed) {
    const list = templates(lesson);
    const template = list.find(function (t) { return t.id === templateId; }) || list[0];
    if (!template) return null;
    seed = seed || randomSeed();
    const problem = build(template, seed);
    return problem ? { taskId: makeId(template.id, seed), templateId: template.id, problem: problem } : null;
  }

  // A weighted choice among a lesson's templates. weights: { templateId: number } (default 1).
  function chooseTemplate(lesson, weights) {
    const list = templates(lesson);
    if (!list.length) return null;
    let total = 0;
    const w = list.map(function (t) { const x = Math.max(0.1, (weights && weights[t.id]) || 1); total += x; return x; });
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }

  // Fresh question for a lesson that differs from the prompts in `avoid` (a Set of strings).
  function fresh(lesson, weights, avoid) {
    for (let i = 0; i < 25; i++) {
      const t = chooseTemplate(lesson, weights);
      if (!t) return null;
      const q = generate(lesson, t.id, randomSeed());
      if (q && !(avoid && avoid.has(q.problem.prompt))) return q;
    }
    return null;
  }

  return {
    has: has, templates: templates, generate: generate, fresh: fresh, chooseTemplate: chooseTemplate,
    isPracticeId: isPracticeId, parseId: parseId, makeId: makeId, build: build
  };
}());
