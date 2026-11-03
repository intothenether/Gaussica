// Where the feedback has a gap: the wrong answers that students gave and that only got the general hint ("Generellt beräkningsfel"), so that someone
// who writes the lessons can see which rule to write next, instead of guessing what students get wrong. The attempts of the students are the only input:
// each one has the question, the answer given, the right answer and the title of the hint that was shown.
//
//   GaussicaGaps.collect(students)    [{ lessonId, lessonTitle, task, name, fixed, prompt, correct, count, students, answers: [{ answer, count }], examples }] most common first
//   GaussicaGaps.suggest(gap)         the rules to write, as text for the "feedback" list of the question in the lesson file
//   GaussicaGaps.report(gaps)         the whole as text (used by scripts/feedback-gaps.js)
//
// A question of a lesson is one entry. The questions of Öva mer are made again with new numbers each time, so they are one entry per template, with
// a few of the questions as examples (the answer to this one question says nothing about the next).

(function (root) {
  "use strict";

  const GENERIC = "Generellt beräkningsfel";
  const PRACTICE = /^practice-(.+)-([0-9a-z]+)$/;

  const norm = (a) => String(a === undefined || a === null ? "" : a).trim().toLowerCase().replace(/\s+/g, " ");
  const submission = (a) => a && (a.feedbackType === "correct" || a.feedbackType === "hint");

  // an answer that only got the general hint: the right answer was not found, and no pattern, lesson rule or slip was said
  function isGap(att) {
    return submission(att) && att.feedbackType === "hint" && !att.completed && att.misconception === GENERIC && norm(att.answer) !== "";
  }

  function collect(students) {
    const groups = new Map();
    (students || []).forEach((student) => {
      (student.attempts || []).filter(isGap).forEach((att) => {
        const m = PRACTICE.exec(String(att.taskId || ""));
        const fixed = !m;
        const task = fixed ? att.taskId : "practice-" + m[1];
        const key = att.lessonId + "|" + task;
        if (!groups.has(key)) {
          groups.set(key, { lessonId: att.lessonId, lessonTitle: att.lessonTitle || att.lessonId, task: task, name: fixed ? att.taskName : "Öva mer (" + m[1] + ")", fixed: fixed,
            prompt: String(att.prompt || ""), correct: String(att.correctAnswer || ""), count: 0, who: new Set(), byAnswer: new Map(), examples: [] });
        }
        const g = groups.get(key);
        g.count++;
        g.who.add(String(student.id !== undefined ? student.id : student.username));
        if (fixed) {
          const k = norm(att.answer);
          g.byAnswer.set(k, (g.byAnswer.get(k) || 0) + 1);
        } else if (g.examples.length < 3 && !g.examples.some((e) => e.prompt === String(att.prompt || ""))) {
          g.examples.push({ prompt: String(att.prompt || ""), answer: String(att.answer), correct: String(att.correctAnswer || "") });
        }
      });
    });
    return Array.from(groups.values()).map((g) => ({
      lessonId: g.lessonId, lessonTitle: g.lessonTitle, task: g.task, name: g.name, fixed: g.fixed, prompt: g.prompt, correct: g.correct, count: g.count, students: g.who.size,
      answers: Array.from(g.byAnswer.entries()).map((e) => ({ answer: e[0], count: e[1] })).sort((a, b) => b.count - a.count).slice(0, 6), examples: g.examples
    })).sort((a, b) => b.count - a.count || b.students - a.students);
  }

  // text for the lesson file: the answers that were given, ready for a message
  function suggest(gap) {
    if (!gap.fixed) return "I mallen " + gap.task.replace(/^practice-/, "") + " i \"practice\": tänk på vilket fel som ger svaren i exemplen, och skriv en regel med \"answers\": [\"=uttryck\"] för det.";
    const list = gap.answers.filter((a) => a.count >= 1).map((a) => JSON.stringify(a.answer));
    return "{ \"answers\": [" + list.join(", ") + "], \"message\": \"...\" }";
  }

  function report(gaps) {
    if (!gaps.length) return "Inga felsvar saknar återkoppling. Alla felsvar fick ett eget tips.\n";
    const out = ["# Felsvar som bara fick det allmänna tipset", "", "Skriv en regel i lektionens fil (listan \"feedback\" på uppgiften) för de vanligaste, så får nästa elev ett riktigt tips.", ""];
    gaps.forEach((g, i) => {
      out.push((i + 1) + ". " + g.lessonTitle + " (" + g.lessonId + ", " + g.name + "): " + g.count + " svar av " + g.students + " elev" + (g.students === 1 ? "" : "er"));
      out.push("   Fråga: " + g.prompt);
      if (g.correct) out.push("   Rätt svar: " + g.correct);
      if (g.fixed) out.push("   Vanliga felsvar: " + g.answers.map((a) => a.answer + " (" + a.count + ")").join(", "));
      else g.examples.forEach((e) => out.push("   Exempel: " + e.prompt + " -> " + e.answer + " (rätt: " + e.correct + ")"));
      out.push("   Skriv: " + suggest(g));
      out.push("");
    });
    return out.join("\n");
  }

  const api = { collect: collect, suggest: suggest, report: report, isGap: isGap, GENERIC: GENERIC };
  root.GaussicaGaps = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
