// Study guidance for a student: what to do next, what to repeat, and which questions to practise.
// Everything is computed from the data the app already has (progress per lesson and the log of
// submitted answers), so nothing extra is stored.
//
//   nextStep(ctx)    -> { kind: "continue" | "start" | "done", lesson, done, total, after }
//   reviewPlan(ctx)  -> { lessons: [{ lesson, score }], weights: { lessonId: { templateId: weight } } }
//   practiceRound(ctx, lesson, count)  -> [{ lessonId, taskId, templateId, problem }]
//   reviewRound(ctx, count)            -> same, mixed from the lessons that need repeating
//
// ctx = { lessons, student, getProgress }

window.GaussicaCoach = (function () {
  "use strict";

  const DAY = 86400000;
  const REVIEW_WINDOW = 30 * DAY;      // only answers from the last 30 days count towards "needs repeating"
  const REVIEW_THRESHOLD = 2;          // net wrong answers before a lesson is suggested for repeating

  function L() { return window.GaussicaLesson; }
  function PR() { return window.GaussicaPractice; }

  function time(a) { const t = Date.parse(a && a.timestamp); return isFinite(t) ? t : 0; }

  function submissions(student) {
    return ((student && student.attempts) || []).filter(L().isSubmission).slice().sort(function (a, b) { return time(a) - time(b); });
  }

  // Which templates a fixed question mirrors (template.for lists task ids such as "exercise" or "word-0").
  function mirroredBy(lesson, taskId) {
    return PR().templates(lesson).filter(function (t) { return (t.for || []).indexOf(taskId) >= 0; }).map(function (t) { return t.id; });
  }

  // Per lesson: a score that goes up with every wrong answer and down with every answer that is right on the
  // first try, plus the same bookkeeping per practice template.
  function weaknesses(ctx) {
    const byLesson = {};
    const lessonById = {};
    ctx.lessons.forEach(function (l) { lessonById[l.id] = l; });
    const since = Date.now() - REVIEW_WINDOW;
    submissions(ctx.student).forEach(function (a) {
      const lesson = lessonById[a.lessonId];
      if (!lesson || time(a) < since) return;
      const w = byLesson[a.lessonId] || (byLesson[a.lessonId] = { score: 0, last: 0, templates: {}, prompts: [] });
      const firstTry = a.completed && Number(a.attemptNo) === 1;
      if (!a.completed) { w.score += 1; w.last = Math.max(w.last, time(a)); }
      else if (firstTry) w.score = Math.max(0, w.score - 1);
      if (a.prompt) w.prompts.push(a.prompt);
      const parsed = PR().parseId(a.taskId);
      const tplIds = parsed ? [parsed.template] : mirroredBy(lesson, a.taskId);
      tplIds.forEach(function (id) {
        const cur = w.templates[id] || 0;
        if (!a.completed) w.templates[id] = cur + 1;
        else if (firstTry) w.templates[id] = Math.max(0, cur - 1);
      });
    });
    return byLesson;
  }

  function templateWeights(w) {
    const out = {};
    // capped, so a round keeps some variety even when one kind of question went badly
    Object.keys((w && w.templates) || {}).forEach(function (id) { out[id] = Math.min(4, 1 + 2 * w.templates[id]); });
    return out;
  }

  function lastActivity(ctx, lesson) {
    const p = ctx.getProgress(lesson.id) || {};
    let t = Number(p.updatedAt) || 0;
    submissions(ctx.student).forEach(function (a) { if (a.lessonId === lesson.id) t = Math.max(t, time(a)); });
    return t;
  }

  // ----- what next -----
  function candidates(ctx) {
    return ctx.lessons.filter(function (l) { return !l.isParentLesson; });
  }

  function summaryOf(ctx, lesson) {
    return L().summarize(lesson, ctx.getProgress, ctx.lessons);
  }

  function nextStep(ctx) {
    const lessons = candidates(ctx);
    if (!lessons.length) return { kind: "done" };
    const index = new Map();
    ctx.lessons.forEach(function (l, i) { index.set(l.id, i); });
    const grades = new Map();
    const gradeOf = function (l) {
      if (!grades.has(l.id)) grades.set(l.id, L().effectiveGrade(l, ctx.lessons));
      return grades.get(l.id);
    };
    const byPath = function (a, b) { return gradeOf(a) - gradeOf(b) || index.get(a.id) - index.get(b.id); };

    const states = new Map();
    lessons.forEach(function (l) { states.set(l.id, summaryOf(ctx, l)); });

    const going = lessons.filter(function (l) { const s = states.get(l.id); return s.state === "started" || s.state === "fix"; })
      .sort(function (a, b) { return lastActivity(ctx, b) - lastActivity(ctx, a) || byPath(a, b); });
    if (going.length) {
      const s = states.get(going[0].id);
      return { kind: "continue", lesson: going[0], done: s.done, total: s.total, fix: s.fix };
    }

    const isDone = function (id) {
      const p = ctx.lessons.find(function (x) { return x.id === id; });
      return !p || summaryOf(ctx, p).state === "complete";
    };
    const fresh = lessons.filter(function (l) { return states.get(l.id).state === "new"; }).sort(byPath);
    const ready = fresh.filter(function (l) { return (l.prerequisites || []).every(isDone); });
    const pick = ready[0] || fresh[0];
    if (!pick) return { kind: "done" };
    const after = (pick.prerequisites || []).map(function (id) { return ctx.lessons.find(function (x) { return x.id === id; }); })
      .filter(Boolean).filter(function (p) { return summaryOf(ctx, p).state === "complete"; });
    return { kind: "start", lesson: pick, after: after, ready: Boolean(ready[0]), total: states.get(pick.id).total };
  }

  // ----- what to repeat -----
  function reviewPlan(ctx) {
    const weak = weaknesses(ctx);
    const lessons = [];
    const weights = {};
    ctx.lessons.forEach(function (l) {
      const w = weak[l.id];
      if (!w || w.score < REVIEW_THRESHOLD || !PR().has(l)) return;
      lessons.push({ lesson: l, score: w.score, last: w.last });
      weights[l.id] = templateWeights(w);
    });
    lessons.sort(function (a, b) { return b.score - a.score || b.last - a.last; });
    return { lessons: lessons, weights: weights, recent: weak };
  }

  // ----- rounds of generated questions -----
  function recentPrompts(weak, lessonId) {
    const w = weak[lessonId];
    return new Set(w ? w.prompts.slice(-40) : []);
  }

  function practiceRound(ctx, lesson, count) {
    const weak = weaknesses(ctx);
    const weights = templateWeights(weak[lesson.id]);
    const avoid = recentPrompts(weak, lesson.id);
    const out = [];
    for (let i = 0; i < (count || 5); i++) {
      const q = PR().fresh(lesson, weights, avoid);
      if (!q) break;
      avoid.add(q.problem.prompt);
      out.push({ lessonId: lesson.id, taskId: q.taskId, templateId: q.templateId, problem: q.problem });
    }
    return out;
  }

  function reviewRound(ctx, count) {
    const plan = reviewPlan(ctx);
    const picked = plan.lessons.slice(0, 3);
    if (!picked.length) return [];
    count = count || 6;
    const used = {};
    picked.forEach(function (p) { used[p.lesson.id] = recentPrompts(plan.recent, p.lesson.id); });
    const out = [];
    for (let i = 0; i < count * 3 && out.length < count; i++) {
      const p = picked[i % picked.length];
      const q = PR().fresh(p.lesson, plan.weights[p.lesson.id], used[p.lesson.id]);
      if (!q) continue;
      used[p.lesson.id].add(q.problem.prompt);
      out.push({ lessonId: p.lesson.id, taskId: q.taskId, templateId: q.templateId, problem: q.problem });
    }
    return out;
  }

  return { nextStep: nextStep, reviewPlan: reviewPlan, practiceRound: practiceRound, reviewRound: reviewRound, weaknesses: weaknesses };
}());
