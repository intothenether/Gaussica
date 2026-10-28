// Study guidance for a student: what to do next, what to repeat, and which questions to practise.
// Everything is computed from the data the app already has (progress per lesson and the log of
// submitted answers), so nothing extra is stored.
//
//   nextStep(ctx)    -> { kind: "continue" | "start" | "done", lesson, done, total, after }
//   reviewPlan(ctx)  -> { lessons: [{ lesson, score }], due: [{ lesson, due, box }], weights: { lessonId: { templateId: weight } } }
//   practiceRound(ctx, lesson, count)  -> [{ lessonId, taskId, templateId, problem }]
//   reviewRound(ctx, count)            -> same, mixed from the lessons that need repeating (wrong answers lately, or due)
//   dueReviews(ctx, now), seedReview(ctx, now), afterReview(record, outcomes, now)   spaced repetition, see below
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

  // Where the student is in the course: lessons in path order, how far each one is, and what is ready.
  function analyse(ctx) {
    const lessons = candidates(ctx);
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
    // what the placement test ("Hitta din nivå") found: lessons the student seems to know already count as done
    // when deciding what is ready, and lessons near the edge of what is known come before the ones far below it
    const placement = (window.GaussicaPlacement && ctx.student && window.GaussicaPlacement.saved(ctx.student)) || null;
    const known = new Set(placement ? placement.known : []);
    const isDone = function (id) {
      if (known.has(id)) return true;
      const p = ctx.lessons.find(function (x) { return x.id === id; });
      return !p || summaryOf(ctx, p).state === "complete";
    };
    const going = lessons.filter(function (l) { const s = states.get(l.id); return s.state === "started" || s.state === "fix"; })
      .sort(function (a, b) { return lastActivity(ctx, b) - lastActivity(ctx, a) || byPath(a, b); });
    const fresh = lessons.filter(function (l) { return states.get(l.id).state === "new" && !known.has(l.id); }).sort(byPath);
    if (placement) {
      const edge = Number(placement.level) || 0;
      const starts = placement.start || [];
      const rank = function (l) { return starts.indexOf(l.id) >= 0 ? 0 : gradeOf(l) >= edge - 1 ? 1 : 2; };
      fresh.sort(function (a, b) { return rank(a) - rank(b) || byPath(a, b); });
    }
    const ready = fresh.filter(function (l) { return (l.prerequisites || []).every(isDone); });
    const done = lessons.filter(function (l) { return states.get(l.id).state === "complete"; });
    return { lessons: lessons, states: states, going: going, fresh: fresh, ready: ready, done: done, isDone: isDone, placement: placement, known: known };
  }

  // The year the student is working at: three quarters up among the years of the lessons that are finished (or known from the
  // placement test), so a few easy ones do not pull it down and one hard one does not lift it. null when there is too little to go on.
  function levelOf(ctx, A) {
    A = A || analyse(ctx);
    const grades = [];
    A.lessons.forEach(function (l) {
      if (l.kind === "pyssel") return;
      if (A.known.has(l.id) || A.states.get(l.id).state === "complete") grades.push(L().effectiveGrade(l, ctx.lessons));
    });
    const edge = A.placement ? Math.round(Number(A.placement.level) || 0) : 0;
    if (grades.length < 3) return edge || null;
    grades.sort(function (a, b) { return a - b; });
    const q = grades[Math.min(grades.length - 1, Math.floor(grades.length * 0.75))];
    return Math.max(q, edge);
  }

  function nextStep(ctx) {
    const A = analyse(ctx);
    if (!A.lessons.length) return { kind: "done" };
    if (A.going.length) {
      const s = A.states.get(A.going[0].id);
      return { kind: "continue", lesson: A.going[0], done: s.done, total: s.total, fix: s.fix };
    }
    const pick = A.ready[0] || A.fresh[0];
    if (!pick) return { kind: "done" };
    const after = (pick.prerequisites || []).map(function (id) { return ctx.lessons.find(function (x) { return x.id === id; }); })
      .filter(Boolean).filter(function (p) { return summaryOf(ctx, p).state === "complete"; });
    return { kind: "start", lesson: pick, after: after, ready: Boolean(A.ready[0]), total: A.states.get(pick.id).total };
  }

  // "Din väg": what to do now, what comes after, and one play lesson. `assigned` is the lesson of an open
  // assignment from the teacher (it always comes first).
  function path(ctx, assignedLessonId) {
    const A = analyse(ctx);
    const level = levelOf(ctx, A);
    const step = function (role, kind, lesson, extra) {
      const s = A.states.get(lesson.id) || summaryOf(ctx, lesson);
      const grade = L().effectiveGrade(lesson, ctx.lessons);
      // gap: how many years above (+) or below (-) the student's own year the lesson is; null when that is not known
      return Object.assign({ role: role, kind: kind, lesson: lesson, sum: s, grade: grade, level: level, gap: level ? grade - level : null }, extra || {});
    };
    const taken = new Set();
    let now = null;
    const assigned = assignedLessonId && A.lessons.find(function (l) { return l.id === assignedLessonId; });
    if (assigned) now = step("now", "assignment", assigned);
    else if (A.going.length) now = step("now", "continue", A.going[0]);
    else if (A.ready[0] || A.fresh[0]) now = step("now", "start", A.ready[0] || A.fresh[0], { ready: Boolean(A.ready[0]) });
    if (now) taken.add(now.lesson.id);

    // after that: other lessons already begun, then lessons that are ready (never play lessons here)
    const later = [];
    const candidatesLater = A.going.concat(A.ready).filter(function (l) { return l.kind !== "pyssel"; });
    candidatesLater.forEach(function (l) {
      if (later.length >= 2 || taken.has(l.id)) return;
      taken.add(l.id);
      const begun = A.states.get(l.id).state !== "new";
      later.push(step("later", begun ? "going" : "start", l));
    });

    // one play lesson: one that is begun, otherwise the first that is ready
    const playPool = A.going.concat(A.ready).filter(function (l) { return l.kind === "pyssel" && !taken.has(l.id); });
    const play = playPool[0] ? step("play", A.states.get(playPool[0].id).state === "new" ? "start" : "going", playPool[0]) : null;

    return { now: now, later: later, play: play, doneCount: A.done.length, total: A.lessons.length, allDone: !now && A.lessons.every(function (l) { return A.known.has(l.id) || A.states.get(l.id).state === "complete"; }),
      placement: A.placement ? { at: A.placement.at, known: A.known.size, level: A.placement.level || 0 } : null };
  }

  // ----- spaced repetition -----
  // A lesson that is finished comes back for a short refresh after 3 days, then 1, 3, 8 and 20 weeks later if it keeps
  // going well. What is remembered is kept in the student's progress under the key "review":
  //   { v: 1, lessons: { lessonId: { box, due, last, n } } }
  // Nothing is lost by waiting: a lesson that is due just stays due. It only shows as a calm suggestion, never as a streak.
  const REVIEW_KEY = "review";
  const REVIEW_STEPS = [3 * DAY, 7 * DAY, 21 * DAY, 60 * DAY, 150 * DAY];

  function reviewRecord(student) {
    const r = student && student.lessonProgress && student.lessonProgress[REVIEW_KEY];
    return r && r.lessons ? r : { v: 1, lessons: {} };
  }

  // Finished lessons without a place in the schedule get one. To avoid a pile of lessons being due on the same day when a
  // student with a long history starts, they are spread out: at most two a day from today on. Returns a new record, or
  // null when nothing changed.
  function seedReview(ctx, now) {
    now = now || Date.now();
    const record = reviewRecord(ctx.student);
    const fresh = ctx.lessons.filter(function (l) {
      return !l.isParentLesson && PR().has(l) && !record.lessons[l.id] && summaryOf(ctx, l).state === "complete";
    }).map(function (l) { return { lesson: l, last: lastActivity(ctx, l) || now }; }).sort(function (a, b) { return a.last - b.last; });
    if (!fresh.length) return null;
    const next = { v: 1, lessons: Object.assign({}, record.lessons) };
    fresh.forEach(function (x, i) {
      next.lessons[x.lesson.id] = { box: 0, due: Math.max(x.last + REVIEW_STEPS[0], now + Math.floor(i / 2) * DAY), last: x.last, n: 0 };
    });
    return next;
  }

  // The lessons that are due now, the one waiting longest first.
  function dueReviews(ctx, now) {
    now = now || Date.now();
    const record = reviewRecord(ctx.student);
    const out = [];
    ctx.lessons.forEach(function (l) {
      const r = record.lessons[l.id];
      if (!r || l.isParentLesson || !PR().has(l) || r.due > now) return;
      if (summaryOf(ctx, l).state !== "complete") return;
      out.push({ lesson: l, due: r.due, box: r.box });
    });
    return out.sort(function (a, b) { return a.due - b.due; });
  }

  // outcomes: { lessonId: { n, firstTry } } for the lessons that were asked in a round. Right at once on three out of
  // four or more: up one step. About half: the same step, but sooner. Less: back to the start, in two days.
  function afterReview(record, outcomes, now) {
    now = now || Date.now();
    const next = { v: 1, lessons: Object.assign({}, (record && record.lessons) || {}) };
    Object.keys(outcomes).forEach(function (id) {
      const o = outcomes[id];
      if (!o || !o.n) return;
      const r = Object.assign({ box: 0, due: now, last: now, n: 0 }, next.lessons[id] || {});
      const ratio = o.firstTry / o.n;
      if (ratio >= 0.75) { r.box = Math.min(REVIEW_STEPS.length - 1, r.box + 1); r.due = now + REVIEW_STEPS[r.box]; }
      else if (ratio >= 0.5) r.due = now + Math.round(REVIEW_STEPS[r.box] / 2);
      else { r.box = 0; r.due = now + 2 * DAY; }
      r.last = now;
      r.n += 1;
      next.lessons[id] = r;
    });
    return next;
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
    return { lessons: lessons, due: dueReviews(ctx), weights: weights, recent: weak };
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
    // lessons with many wrong answers lately first, then the ones that are due for a refresh
    const picked = plan.lessons.slice(0, 3);
    plan.due.forEach(function (d) {
      if (picked.length < 3 && !picked.some(function (p) { return p.lesson.id === d.lesson.id; })) picked.push({ lesson: d.lesson, score: 0, last: d.due });
    });
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

  return { nextStep: nextStep, path: path, levelOf: levelOf, reviewPlan: reviewPlan, practiceRound: practiceRound, reviewRound: reviewRound, weaknesses: weaknesses,
    REVIEW_KEY: REVIEW_KEY, REVIEW_STEPS: REVIEW_STEPS, reviewRecord: reviewRecord, seedReview: seedReview, dueReviews: dueReviews, afterReview: afterReview };
}());
