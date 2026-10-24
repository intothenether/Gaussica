// Shared lesson model: block order, answerable tasks and progress summaries.
// Used by the student view (app.js), the lesson graph (graph-view.js) and the editor.
//
// A lesson's content is a list of "blocks". Each block has a key:
//   explanation | visual | rule | interactive | exercise | patterns
//   comp:<i>   -> lesson.components[i]
//   word:<i>   -> lesson.wordProblems[i]
// `lesson.layout` (array of keys) sets the order and which blocks are shown.
// Lessons without a layout use the original fixed order (see defaultKeys).

window.GaussicaLesson = (function () {
  "use strict";

  const SINGLE = ["explanation", "visual", "rule", "interactive", "exercise", "patterns"];

  function hasVisual(l) {
    return Boolean(l.visual || (Array.isArray(l.visuals) && l.visuals.length) ||
      l.chart || (Array.isArray(l.charts) && l.charts.length) ||
      l.diagram || (Array.isArray(l.diagrams) && l.diagrams.length) ||
      l.table || (Array.isArray(l.tables) && l.tables.length));
  }

  function defaultKeys(l) {
    const keys = ["explanation"];
    if (hasVisual(l)) keys.push("visual");
    (l.components || []).forEach(function (c, i) { keys.push("comp:" + i); });
    keys.push("rule");
    if (l.interactive) keys.push("interactive");
    keys.push("exercise");
    (l.wordProblems || []).forEach(function (p, i) { keys.push("word:" + i); });
    if (Array.isArray(l.problemPatterns) && l.problemPatterns.length) keys.push("patterns");
    return keys;
  }

  function isValidKey(l, key) {
    if (typeof key !== "string") return false;
    if (SINGLE.indexOf(key) >= 0) {
      if (key === "visual") return hasVisual(l);
      if (key === "interactive") return Boolean(l.interactive);
      if (key === "exercise") return Boolean(l.exercise);
      if (key === "patterns") return Array.isArray(l.problemPatterns) && l.problemPatterns.length > 0;
      return true;
    }
    const m = /^(comp|word):(\d+)$/.exec(key);
    if (!m) return false;
    const list = m[1] === "comp" ? l.components : l.wordProblems;
    return Array.isArray(list) && Number(m[2]) < list.length;
  }

  function blockKeys(l) {
    if (!Array.isArray(l.layout)) return defaultKeys(l);
    const seen = new Set();
    return l.layout.filter(function (key) {
      if (!isValidKey(l, key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Interactive "pyssla" tools (see pyssel.js). They can declare challenges (goals) that count as tasks.
  const TOOL_TYPES = { pyssel: true, ritrutnat: true, primtalssil: true, tarning: true, robot: true };

  function isTool(c) {
    return Boolean(c && TOOL_TYPES[c.type]);
  }

  function toolGoals(c) {
    if (!isTool(c)) return [];
    if (Array.isArray(c.goals)) return c.goals;
    return c.goal ? [c.goal] : [];
  }

  function isTaskComponent(c) {
    return Boolean(c && c.type === "problem" && Array.isArray(c.answer) && Array.isArray(c.feedback));
  }

  // A matching test: connect each term ("begrepp") with its explanation. { type: "koppla", prompt, pairs: [{ term, definition }] }
  function isMatchComponent(c) {
    return Boolean(c && c.type === "koppla" && Array.isArray(c.pairs) && c.pairs.length >= 2);
  }

  function matchProblem(c) {
    return {
      prompt: c.prompt || "Para ihop varje begrepp med rätt förklaring.",
      pairs: c.pairs,
      answer: ["alla par rätt"],
      correct: c.correct || "Alla begrepp är rätt ihopparade!",
      feedback: []
    };
  }

  // Answerable tasks shown in the lesson, in display order. `id` matches the ids
  // used when storing answers (see renderProblem in app.js).
  function tasks(l) {
    const out = [];
    blockKeys(l).forEach(function (key) {
      if (key === "exercise") {
        out.push({ id: "exercise", key: key, problem: l.exercise, name: "Din tur" });
      } else if (key.indexOf("word:") === 0) {
        const i = Number(key.slice(5));
        out.push({ id: "word-" + i, key: key, problem: l.wordProblems[i], name: "Textuppgift " + (i + 1) });
      } else if (key.indexOf("comp:") === 0 && isTaskComponent(l.components[Number(key.slice(5))])) {
        const i = Number(key.slice(5));
        out.push({ id: "component-" + i, key: key, problem: l.components[i], name: "Uppgift" });
      } else if (key.indexOf("comp:") === 0 && isMatchComponent(l.components[Number(key.slice(5))])) {
        const i = Number(key.slice(5));
        out.push({ id: "match-" + i, key: key, problem: matchProblem(l.components[i]), name: "Para ihop begrepp" });
      } else if (key.indexOf("comp:") === 0) {
        // challenges inside an interactive tool: done when the student reaches the goal
        const i = Number(key.slice(5));
        toolGoals(l.components[i]).forEach(function (g) {
          out.push({ id: "goal-" + i + "-" + g.id, key: key, goal: true, name: "Utmaning",
            problem: { prompt: g.text, answer: ["klart"], feedback: [], correct: "Uppnådd" } });
        });
      }
    });
    return out;
  }

  function blockTitle(l, key) {
    if (key === "explanation") return l.explanationTitle || "Förklaring";
    if (key === "visual") return (l.visual && l.visual.title) || "Diagram";
    if (key === "rule") return l.ruleLabel || "Regel";
    if (key === "interactive") return "Utforska";
    if (key === "patterns") return "Öva mer";
    if (key.indexOf("comp:") === 0) {
      const c = l.components[Number(key.slice(5))] || {};
      if (isTool(c)) return "Pyssla: " + (c.title || "");
      if (c.type === "begreppskort") return c.title || "Begreppskort";
      return c.title || c.label || (c.type === "text" || c.type === "heading" ? String(c.text || "").slice(0, 40) : "") || "Innehåll";
    }
    return "Innehåll";
  }

  // The lesson as a sequence of screens for the player: consecutive reading blocks are
  // grouped into one "learn" step; every answerable task is its own "question" step.
  function steps(l) {
    const out = [];
    const taskList = tasks(l);
    let group = null;
    const questions = taskList.filter(function (t) { return !t.goal; });
    blockKeys(l).forEach(function (key) {
      const task = questions.find(function (t) { return t.key === key; });
      if (task) {
        group = null;
        out.push({ type: "question", key: key, task: task });
      } else {
        // every interactive tool gets a page of its own
        const tool = key.indexOf("comp:") === 0 && isTool((l.components || [])[Number(key.slice(5))]);
        if (!group || tool) { group = { type: "learn", keys: [], titles: [] }; out.push(group); }
        group.keys.push(key);
        group.titles.push(blockTitle(l, key));
      }
    });
    let n = 0;
    out.forEach(function (st) { if (st.type === "question") { n += 1; st.number = n; st.total = questions.length; } });
    return out;
  }

  function isTaskKey(l, key) {
    return tasks(l).some(function (t) { return t.key === key; });
  }

  function children(l, all) {
    if (!l.isParentLesson || !Array.isArray(l.subLessons)) return [];
    const list = [];
    l.subLessons.slice().sort(function (a, b) { return (a.sequence || 0) - (b.sequence || 0); })
      .forEach(function (ref) {
        const found = all.find(function (x) { return x.id === ref.id; });
        if (found) list.push(found);
      });
    return list;
  }

  function statusOf(progress, taskId) {
    const a = progress && progress.answers && progress.answers[taskId];
    if (!a) return "todo";
    if (a.completed) return "done";
    return (a.answer || a.feedbackType) ? "fix" : "todo";
  }

  // statuses: one entry per task ("done" | "fix" | "todo"); a chapter sums its sub-lessons.
  function summarize(l, getProgress, all) {
    const kids = children(l, all);
    let statuses = [];
    let started = false;
    if (kids.length) {
      kids.forEach(function (k) {
        const s = summarize(k, getProgress, all);
        statuses = statuses.concat(s.statuses);
        started = started || s.started;
      });
    } else {
      const p = getProgress(l.id);
      tasks(l).forEach(function (t) { statuses.push(statusOf(p, t.id)); });
      started = Boolean(p && p.started);
    }
    const total = statuses.length;
    const done = statuses.filter(function (s) { return s === "done"; }).length;
    const fix = statuses.filter(function (s) { return s === "fix"; }).length;
    let state = "new";
    if (total > 0 && done === total) state = "complete";
    else if (fix > 0) state = "fix";
    else if (done > 0 || started) state = "started";
    return { statuses: statuses, total: total, done: done, fix: fix, todo: total - done - fix, state: state, started: started };
  }

  function describe(s) {
    if (!s.total) return s.started ? "Påbörjad" : "Ej påbörjad";
    let text = s.done + " av " + s.total + " klara";
    if (s.fix) text += " · " + s.fix + " att rätta";
    return text;
  }

  // ===== Attempt log =====
  // student.attempts holds one entry per submitted answer ("Kolla svaret").
  // Entries without a result were typing drafts in older versions and are ignored.
  function isSubmission(att) {
    return att && (att.feedbackType === "correct" || att.feedbackType === "hint");
  }

  function byTime(a, b) {
    return String(a.timestamp || "").localeCompare(String(b.timestamp || ""));
  }

  // Submissions for one task, oldest first.
  function history(student, lessonId, taskId) {
    return ((student && student.attempts) || []).filter(function (a) {
      return a.lessonId === lessonId && a.taskId === taskId && isSubmission(a);
    }).sort(byTime);
  }

  // How a task went for a student. `entry` is progress.answers[taskId] (current state).
  function taskStats(subs, entry) {
    const firstCorrect = subs.findIndex(function (a) { return a.completed; });
    const solvedNow = Boolean(entry && entry.completed);
    return {
      submissions: subs.length,
      solved: firstCorrect >= 0 || solvedNow,
      solvedNow: solvedNow,
      triesToSolve: firstCorrect >= 0 ? firstCorrect + 1 : null,   // null: not solved, or solved before logging
      wrongBeforeSolved: firstCorrect >= 0 ? firstCorrect : subs.filter(function (a) { return !a.completed; }).length,
      wrongAnswers: subs.filter(function (a) { return !a.completed; }),
      lastAt: subs.length ? subs[subs.length - 1].timestamp : null
    };
  }

  // ===== School year =====
  // `grade` is the year a topic is usually introduced in Swedish schools (3–9, 10+ = gymnasiet).
  // A lesson is never placed earlier than its prerequisites, so the graph can't contradict itself.
  function effectiveGrade(l, all, memo) {
    memo = memo || new Map();
    if (memo.has(l.id)) return memo.get(l.id);
    memo.set(l.id, Number(l.grade) || 3);          // guards against cycles
    let g = Number(l.grade) || 0;
    (l.prerequisites || []).forEach(function (pid) {
      const p = all.find(function (x) { return x.id === pid; });
      if (p) g = Math.max(g, effectiveGrade(p, all, memo));
    });
    g = g || 3;
    memo.set(l.id, g);
    return g;
  }

  // May the student answer with a calculation ("36/6", "3*6") where a number is expected?
  // Lower grades practise doing the calculation, so it is not accepted there. From åk 7 the
  // calculation step is treated as trivial (slopes, equations, formulas), so it is accepted.
  // A question or a lesson can decide for itself with "allowExpression": true | false.
  function allowsExpression(lesson, problem, all) {
    if (problem && typeof problem.allowExpression === "boolean") return problem.allowExpression;
    if (lesson && typeof lesson.allowExpression === "boolean") return lesson.allowExpression;
    return lesson && all ? effectiveGrade(lesson, all) >= 7 : false;
  }

  function gradeLabel(g) {
    return g >= 10 ? "GYMNASIET" : "ÅK " + g;
  }

  return { isTool: isTool, toolGoals: toolGoals, effectiveGrade: effectiveGrade, allowsExpression: allowsExpression, gradeLabel: gradeLabel, steps: steps, isTaskKey: isTaskKey, isSubmission: isSubmission, history: history, taskStats: taskStats, blockKeys: blockKeys, defaultKeys: defaultKeys, tasks: tasks, children: children,
    summarize: summarize, describe: describe, hasVisual: hasVisual, isTaskComponent: isTaskComponent, isMatchComponent: isMatchComponent };
}());
