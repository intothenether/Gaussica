// "Hjälp för vuxna" in the overview of a lesson, shown to a caregiver: how to explain it, what often goes wrong, what to talk about, and the answers.
// The guide of a lesson is written by hand where there is one (parent-guides.js), and otherwise made from the lesson itself: the problem it starts
// with, its rule and example, and the hints that the lesson gives for the common wrong answers.
//
//   GaussicaParentGuide.build(lesson, guides)   { explain: [text], mistakes: [text], talk: [text], written: boolean }   (no page needed)
//   GaussicaParentGuide.render(lesson)          the box for the page, with the answers to the questions

window.GaussicaParentGuide = (function () {
  "use strict";

  function sentences(text) {
    return String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[.?!])\s+(?=[A-ZÅÄÖ0-9])/);
  }

  // the problem a lesson starts with ("Problemet: ...") and the rest of the explanation
  function splitExplanation(explanation) {
    const all = sentences(String(explanation || "").replace(/^\s*Problemet:\s*/i, ""));
    const hasProblem = /^\s*Problemet:/i.test(String(explanation || ""));
    const q = all.findIndex((s) => /\?$/.test(s));
    const cut = hasProblem ? Math.min(all.length, q >= 0 ? q + 2 : 2) : 0;
    return { problem: all.slice(0, cut).join(" "), rest: all.slice(cut) };
  }

  const clip = (t, n) => (t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t);

  function made(lesson) {
    const parts = splitExplanation(lesson.explanation);
    const explain = [];
    if (parts.problem) explain.push("Börja med frågan barnet möter: " + parts.problem);
    else if (lesson.summary) explain.push("Idén i korthet: " + lesson.summary);
    if (parts.problem && lesson.summary) explain.push("Idén i korthet: " + lesson.summary);
    if (lesson.rule) explain.push("Regeln: " + String(lesson.rule).replace(/[.]*$/, "") + ".");
    if (lesson.example) explain.push(String(lesson.example).replace(/^Exempel:\s*/i, "Exempel: ").replace(/^(?!Exempel:)/, "Exempel: "));
    if (!explain.length) explain.push(clip(parts.rest.join(" "), 400) || "Läs lektionen tillsammans och låt barnet förklara vad den handlar om.");

    // the hints of the lesson are what it says to a student who gives a common wrong answer
    const mistakes = [];
    const seen = new Set();
    const problems = [lesson.exercise].concat(lesson.wordProblems || []).filter(Boolean);
    problems.forEach((p) => (p.feedback || []).forEach((f) => {
      const answer = (f.answers || [])[0], msg = String(f.message || "").trim();
      if (!msg || seen.has(msg) || mistakes.length >= 4) return;
      seen.add(msg);
      mistakes.push(answer !== undefined ? "Svarar barnet ”" + answer + "” får barnet tipset: ”" + clip(msg, 160).trim() + "”" : "Tips till barnet: " + clip(msg, 160));
    }));
    if (!mistakes.length) mistakes.push("Barnet svarar fel i första försöket. Det är normalt: be barnet förklara hur hen tänkte, så märker ni var det fastnar.");

    const title = lesson.explanationTitle || lesson.title;
    const talk = [
      "Fråga: ”" + title.replace(/[?.!]+$/, "") + "”. Hur skulle du förklara det för en kompis?",
      "Be barnet hitta ett exempel hemma, i affären eller ute där det här används.",
      "Låt barnet visa med föremål eller en ritning innan ni räknar."
    ];
    return { explain: explain, mistakes: mistakes, talk: talk, written: false };
  }

  function build(lesson, guides) {
    const own = guides && guides[lesson.id];
    if (!own) return made(lesson);
    const auto = made(lesson);
    return {
      explain: own.explain && own.explain.length ? own.explain : auto.explain,
      mistakes: own.mistakes && own.mistakes.length ? own.mistakes : auto.mistakes,
      talk: own.talk && own.talk.length ? own.talk : auto.talk,
      written: true
    };
  }

  // ----- the page -----
  function render(lesson) {
    const L = window.GaussicaLesson;
    const make = window.GaussicaDom.makeElement;
    const g = build(lesson, window.GaussicaParentGuides);
    const box = document.createElement("details");
    box.className = "parent-guide";
    const sum = document.createElement("summary");
    sum.textContent = "👨‍👩‍👧 Hjälp för vuxna: så förklarar du det";
    box.appendChild(sum);

    const section = function (title, list, ordered) {
      box.appendChild(make("h4", "", title));
      const ul = document.createElement(ordered ? "ol" : "ul");
      list.forEach(function (t) { ul.appendChild(make("li", "", t)); });
      box.appendChild(ul);
    };
    section("Så förklarar du det", g.explain);
    section("Det här går ofta fel", g.mistakes);
    section("Prata om det", g.talk);
    if (!g.written) box.appendChild(make("p", "parent-guide-note", "Den här hjälpen är gjord av lektionens egen text. För några lektioner finns en särskilt skriven."));

    // the answers, for the adult who helps (the child does not see them here)
    const tasks = L && L.tasks ? L.tasks(lesson) : [];
    if (tasks.length) {
      const facit = document.createElement("details");
      facit.className = "parent-guide-facit";
      const s = document.createElement("summary");
      s.textContent = "Facit till frågorna";
      facit.appendChild(s);
      const ul = document.createElement("ul");
      tasks.forEach(function (t, i) {
        if (!t.problem || !t.problem.answer || !t.problem.answer.length) return;
        ul.appendChild(make("li", "", "Fråga " + (i + 1) + ": " + t.problem.answer[0]));
      });
      facit.appendChild(ul);
      box.appendChild(facit);
    }
    return box;
  }

  return { build: build, render: render, sentences: sentences, splitExplanation: splitExplanation };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaParentGuide;
