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
// The new formats (see formats.js) have templates too, so that Öva mer can give a fresh round of each:
//   { "id": "udda", "for": ["so-0"], "mode": "sortera", "size": 6, "prompt": "Sortera talen.", "categories": ["Jämna", "Udda"],
//     "pool": [{ "text": "14", "category": 0, "explain": "..." }, ...] }       items are drawn from the pool, always from every group
//   { "id": "ordning", "for": ["or-1"], "mode": "ordna", "size": 4, "prompt": "Sätt talen i ordning, minst först.", "top": "Minst", "bottom": "Störst",
//     "pool": [{ "text": "0,5", "value": 0.5 }, ...] }                        items with different values, put in the order of the values
//   { "id": "fel", "for": ["hf-2"], "mode": "hittafelet", "prompt": "Vilket steg är fel?",
//     "pool": [{ "steps": ["..."], "wrong": 1, "explain": "...", "fix": "...", "hint": "..." }, ...] }   one solution from the pool
//   { "id": "luckor", "for": ["lt-3"], "mode": "lucktext", "vars": { "a": [2, 9] }, "prompt": "Fyll i luckorna.",
//     "text": "{a} veckor är [[1]] dagar.", "blanks": [{ "answer": ["=a*7"], "options": [...], "hint": "..." }] }   gaps are [[1]], [[2]] ... here
//
// A generated question has the same shape as a normal lesson question, so it is answered and
// checked by the same code. Its id is "practice-<template>-<seed>", which makes it reproducible.

window.GaussicaPractice = (function () {
  "use strict";

  const PREFIX = "practice-";

  function P() { return window.GaussicaPyssel; }

  function templates(lesson) {
    return (lesson && Array.isArray(lesson.practice) ? lesson.practice : []).filter(function (t) {
      return t && t.id && ((t.prompt && Array.isArray(t.answer) && t.answer.length) || (Array.isArray(t.pool) && t.pool.length >= 2) ||
        (Array.isArray(t.statements) && t.statements.length >= 1) || (t.mode === "lucktext" && typeof t.text === "string" && Array.isArray(t.blanks) && t.blanks.length >= 1));
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

  // A string that starts with "=" is a formula, so the equals sign itself as an answer ("=") needs protecting.
  const GUARD = "\u0001";
  function guard(value) {
    if (typeof value === "string") return value === "=" ? GUARD + "=" : value;
    if (Array.isArray(value)) return value.map(guard);
    if (value && typeof value === "object") {
      const o = {};
      Object.keys(value).forEach(function (k) { o[k] = guard(value[k]); });
      return o;
    }
    return value;
  }
  function unguard(value) {
    if (typeof value === "string") return value === GUARD + "=" ? "=" : value;
    if (Array.isArray(value)) return value.map(unguard);
    if (value && typeof value === "object") {
      const o = {};
      Object.keys(value).forEach(function (k) { o[k] = unguard(value[k]); });
      return o;
    }
    return value;
  }

  // true = the statement is true. Accepts true/false, "sant"/"falskt", "=expr" (not zero is true) and a condition { expr, min, max }.
  function truthOf(a, scope, py) {
    if (typeof a === "boolean") return a;
    if (a && typeof a === "object") return Boolean(py && py.holds(a, scope));
    const s = String(a === undefined || a === null ? "" : a).trim();
    if (s.charAt(0) === "=") return py ? py.evalExpr(s.slice(1), scope) !== 0 : false;
    return /^(sant|true|ja)$/i.test(s);
  }

  // ----- the new formats -----
  // A round of sortera: size items from the pool, with at least one from each group when the pool has them.
  function buildSort(template, pool, rand) {
    const cats = template.categories || [];
    const kind = function (p) { return typeof p.category === "number" ? p.category : cats.map(String).indexOf(String(p.category)); };
    const size = Math.max(2, Math.min(template.size || 6, pool.length));
    const picked = pool.slice(0, size);
    cats.forEach(function (c, k) {
      if (picked.some(function (p) { return kind(p) === k; })) return;
      const other = pool.slice(size).find(function (p) { return kind(p) === k; });
      const swap = picked.findIndex(function (p) { return picked.filter(function (q) { return kind(q) === kind(p); }).length > 1; });
      if (other && swap >= 0) picked[swap] = other;
    });
    return {
      format: "sortera", prompt: template.prompt || "Sortera.", categories: cats.slice(),
      items: picked.map(function (p) { const it = { text: p.text, category: kind(p) }; if (p.explain) it.explain = p.explain; return it; }),
      answer: ["alla rätt"], correct: template.correct || "Rätt! Allt ligger i rätt grupp.", feedback: []
    };
  }

  // A round of ordna: size items with different values, in the order of the values (the smallest first, or the largest first with descending).
  function buildOrder(template, pool) {
    const size = Math.max(3, Math.min(template.size || 4, pool.length));
    const seen = new Set();
    const picked = [];
    pool.forEach(function (p) {
      const v = typeof p === "object" ? Number(p.value) : NaN;
      if (picked.length < size && isFinite(v) && !seen.has(v)) { seen.add(v); picked.push({ text: String(p.text), value: v }); }
    });
    picked.sort(function (a, b) { return template.descending ? b.value - a.value : a.value - b.value; });
    return {
      format: "ordna", prompt: template.prompt || "Sätt dem i rätt ordning.", items: picked.map(function (p) { return p.text; }),
      top: template.top, bottom: template.bottom, answer: ["alla rätt"], correct: template.correct || "Rätt! Allt står i rätt ordning.", feedback: []
    };
  }

  // One worked solution with a mistake, from the pool.
  function buildFind(template, pool) {
    const p = pool[0];
    if (!p) return null;
    const out = {
      format: "hittafelet", prompt: p.prompt || template.prompt || "Här finns ett fel. Vilket steg är fel?", steps: p.steps.slice(), wrong: p.wrong, explain: p.explain,
      answer: ["alla rätt"], correct: template.correct || p.correct || "Rätt! Det är det steget som är fel.", feedback: []
    };
    if (p.fix) out.fix = p.fix;
    if (p.hint) out.hint = p.hint;
    return out;
  }

  // Terms and explanations ("begrepp"): template.pool = [{ term, definition, alt: [other accepted spellings] }].
  //   mode "koppla" (default): a matching round with template.size pairs
  //   mode "fraga": one explanation, the student writes the term
  //   mode "santfalskt": template.pool = [{ text, answer: true | false, explain }], a true/false round with template.size statements
  function buildFromPool(template, seed) {
    const rand = rng(seed);
    const pool = template.pool.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    if (template.mode === "sortera") return buildSort(template, pool, rand);
    if (template.mode === "ordna") return buildOrder(template, pool);
    if (template.mode === "hittafelet") return buildFind(template, pool.filter(function (p) { return p && Array.isArray(p.steps) && Number.isInteger(p.wrong); }));
    if (template.mode === "santfalskt") {
      const size = Math.max(1, Math.min(template.size || 4, pool.length));
      const picked = pool.slice(0, size);
      // a round with only true (or only false) statements is too easy to guess: swap in one of the other kind when there is one
      const kind = function (p) { return truthOf(p.answer, {}, null); };
      if (picked.length > 1 && picked.every(function (p) { return kind(p) === kind(picked[0]); })) {
        const other = pool.slice(size).find(function (p) { return kind(p) !== kind(picked[0]); });
        if (other) picked[picked.length - 1] = other;
      }
      return {
        prompt: template.prompt || "Sant eller falskt?",
        statements: picked.map(function (p) { return { text: p.text, answer: kind(p), explain: p.explain }; }),
        answer: ["alla rätt"],
        correct: template.correct || "Rätt! Alla påståenden är bedömda rätt.",
        feedback: []
      };
    }
    if (template.mode === "fraga") {
      const p = pool[0];
      return {
        prompt: (template.prompt || "Vilket begrepp passar förklaringen? Skriv begreppet.") + " ”" + p.definition + "”",
        answer: [p.term].concat(p.alt || []),
        correct: "Rätt! " + p.term.charAt(0).toUpperCase() + p.term.slice(1) + ": " + p.definition,
        feedback: []
      };
    }
    const size = Math.max(2, Math.min(template.size || 4, pool.length));
    return {
      prompt: template.prompt || "Para ihop varje begrepp med rätt förklaring.",
      pairs: pool.slice(0, size).map(function (p) { return { term: p.term, definition: p.definition }; }),
      answer: ["alla par rätt"],
      correct: template.correct || "Alla begrepp är rätt ihopparade!",
      feedback: []
    };
  }

  // Builds one question from a template and a seed. Returns null if the numbers can't be made to fit.
  function build(template, seed) {
    if (Array.isArray(template.pool)) return buildFromPool(template, seed);
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

      if (template.mode === "lucktext") {
        // a text with gaps: the numbers of the template are put in the text, and the answers are worked out. The gaps are [[1]], [[2]] ... in a
        // template (the {} is for the numbers) and {1}, {2} ... in the question.
        const raw = fillPicks({ prompt: template.prompt, text: template.text, blanks: template.blanks, correct: template.correct || "Rätt! Allt stämmer." }, picks);
        const rr = unguard(py.resolve(guard(raw), scope));
        const lt = {
          format: "lucktext", prompt: rr.prompt || "Fyll i luckorna.", text: String(rr.text).replace(/\[\[(\d+)\]\]/g, "{$1}"),
          blanks: rr.blanks.map(function (b) {
            const out = { answer: stringsOf(b.answer) };
            if (Array.isArray(b.options)) out.options = stringsOf(b.options);
            if (b.hint) out.hint = b.hint;
            return out;
          }),
          answer: ["alla rätt"], correct: rr.correct, feedback: []
        };
        const gaps = (lt.text.match(/\{\d+\}/g) || []).length;
        if (/NaN|undefined|Infinity/.test(JSON.stringify(lt)) || /\[\[|\]\]|[$]/.test(lt.text) || gaps !== lt.blanks.length || lt.blanks.some(function (b) { return !b.answer.length || b.answer.indexOf("?") >= 0; })) continue;
        return window.GaussicaLesson && window.GaussicaLesson.personalize ? window.GaussicaLesson.personalize(lt) : lt;
      }
      const filled = fillPicks({
        prompt: template.prompt, answer: template.answer, correct: template.correct || "Rätt!",
        feedback: template.feedback || [], visual: template.visual, visuals: template.visuals,
        statements: Array.isArray(template.statements) ? template.statements.map(function (s) { return { text: s.text, explain: s.explain }; }) : undefined,
        steps: Array.isArray(template.steps) ? template.steps : undefined
      }, picks);
      const r = unguard(py.resolve(guard(filled), scope));

      // a true/false round whose statements use the random numbers
      if (Array.isArray(template.statements)) {
        const statements = template.statements.map(function (s, i) {
          return { text: r.statements[i].text, answer: truthOf(s.answer, scope, py), explain: r.statements[i].explain };
        });
        const tf = { prompt: r.prompt || "Sant eller falskt?", statements: statements, answer: ["alla rätt"],
          correct: template.correct || "Rätt! Alla påståenden är bedömda rätt.", feedback: [] };
        if (r.visual) tf.visual = r.visual;
        if (r.visuals) tf.visuals = r.visuals;
        if (/NaN|undefined/.test(JSON.stringify(tf)) || statements.some(function (s) { return /\{|\}/.test(s.text) || !String(s.text).trim(); })) continue;
        return tf;
      }
      const answer = stringsOf(r.answer);
      if (!answer.length || answer.indexOf("?") >= 0) continue;
      const feedback = [];
      (r.feedback || []).forEach(function (f) {
        const answers = stringsOf(f.answers || []).filter(function (a) { return answer.indexOf(a) < 0 && a !== "?"; });
        if (answers.length && f.message) feedback.push({ answers: answers, message: f.message });
      });
      const problem = { prompt: r.prompt, answer: answer, correct: r.correct, feedback: feedback };
      if (typeof template.allowExpression === "boolean") problem.allowExpression = template.allowExpression;
      if (typeof template.form === "string") problem.form = template.form;
      if (Array.isArray(template.keys)) problem.keys = template.keys;
      if (r.visual) problem.visual = r.visual;
      if (r.visuals) problem.visuals = r.visuals;
      // the solution, step by step: shown as a worked example when a student is stuck (see lesson-player.js)
      if (Array.isArray(r.steps)) problem.solution = r.steps.map(String).filter(function (s) { return s.trim(); });
      if (problem.solution && problem.solution.some(function (s) { return /\{|\}/.test(s); })) continue;
      if (/NaN|undefined/.test(JSON.stringify(problem)) || /\{|\}/.test(problem.prompt)) continue;
      return window.GaussicaLesson && window.GaussicaLesson.personalize ? window.GaussicaLesson.personalize(problem) : problem;
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
