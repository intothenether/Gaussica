// Provträning: practice for the national tests, for a student or a parent who wants it, without a teacher. The student starts a test of questions in the areas
// of the tests of åk 3, 6 or 9, with a time limit and no hints, and every round has new numbers. It is made like a prov that the teacher builds (prov.js): the same
// test, the same marking and the same record under the key "prov-<id>", where the id is "tr-<set>-<round>". It is practice in the same areas, NOT the real
// national tests (those are not public), and the page says so.
//
//   GaussicaProvTraining.SETS              the three sets: { id, name, grade, minutes, perLesson, lessons }
//   GaussicaProvTraining.assignment(setId, round)   the test of a round, as an assignment for GaussicaProv.open
//   GaussicaProvTraining.state(student, setId)      { round, rec, status: "new" | "started" | "done" } for the round to show: the one in progress, or the next new one
//   GaussicaProvTraining.finished(student, now)     the rounds finished in the last seven days (for the adult's week)
//   GaussicaProvTraining.renderCard(container, student, lessons, { open(setId, round) })

window.GaussicaProvTraining = (function () {
  "use strict";

  const SETS = [
    { id: "ak3", name: "Åk 3", grade: 3, minutes: 40, perLesson: 1, lessons: [
      "platsvarde", "storre-mindre", "addition", "subtraktion", "addition-uppstallning", "subtraktion-uppstallning", "multiplikation", "multiplikationstabellen",
      "division", "tid-klocka", "mata-langd", "pengar-vaxel", "uppskatta-rimligt", "udda-jamna", "halvor-fjardedelar", "symmetri"] },
    { id: "ak6", name: "Åk 6", grade: 6, minutes: 60, perLesson: 1, lessons: [
      "stora-tal", "avrundning-overslag", "huvudrakning", "multiplikation-tvasiffrigt", "kortdivision", "langdivision", "decimaltal-rakna", "multiplikation-decimaltal",
      "brak-likavarda", "brak-rakna", "samma-tal-tre-satt", "procent", "procent-vardagen", "okant-tal", "uttryck-med-x", "enheter", "matning-liter-gram", "area",
      "rektangelns-area", "volym", "medelvarde", "median-typvarde", "slump", "skala", "hastighet", "forhallande", "diagram", "negativa-tal"] },
    { id: "ak9", name: "Åk 9", grade: 9, minutes: 60, perLesson: 1, lessons: [
      "procentuell-forandring", "potenser", "tiopotenser", "brak-multiplikation", "division-av-brak", "ekvation", "ekvationer-bada-sidor", "olikheter", "parenteser-uttryck",
      "bryta-ut", "kvadreringsreglerna", "andragradsekvationer", "ekvationssystem", "funktioner", "linjara-funktioner-km", "pythagoras", "trigonometri", "likformighet",
      "volym-prisma-cylinder", "cirkelns-area", "rotuttryck", "traddiagram", "utan-aterlaggning", "kombinatorik", "upprepad-procent", "ladagram"] }
  ];

  const set = (id) => SETS.find(function (s) { return s.id === id; }) || null;
  const idOf = (setId, round) => "tr-" + setId + "-" + round;
  const keyOf = (setId, round) => "prov-" + idOf(setId, round);

  function assignment(setId, round) {
    const s = set(setId);
    if (!s) return null;
    return { id: idOf(setId, round), kind: "prov", config: { title: "Provträning " + s.name.toLowerCase(), lessons: s.lessons, perLesson: s.perLesson, minutes: s.minutes, showResult: true } };
  }

  function rounds(student, setId) {
    const progress = (student && student.lessonProgress) || {};
    const out = [];
    Object.keys(progress).forEach(function (k) {
      const m = new RegExp("^prov-tr-" + setId + "-(\\d+)$").exec(k);
      if (m && progress[k] && Array.isArray(progress[k].answers)) out.push({ round: Number(m[1]), rec: progress[k] });
    });
    return out.sort(function (a, b) { return a.round - b.round; });
  }

  function state(student, setId) {
    const all = rounds(student, setId);
    const last = all[all.length - 1];
    if (!last) return { round: 1, rec: null, status: "new", done: [] };
    const done = all.filter(function (r) { return r.rec.finishedAt; });
    if (!last.rec.finishedAt) return { round: last.round, rec: last.rec, status: "started", done: done };
    return { round: last.round + 1, rec: null, status: "new", done: done };
  }

  function finished(student, now) {
    const since = now - 7 * 86400000;
    const out = [];
    SETS.forEach(function (s) {
      rounds(student, s.id).forEach(function (r) {
        if (r.rec.finishedAt && Date.parse(r.rec.finishedAt) >= since) out.push({ name: s.name, score: Number(r.rec.score) || r.rec.answers.filter(function (a) { return a.correct; }).length, total: r.rec.total || r.rec.answers.length, at: r.rec.finishedAt });
      });
    });
    return out.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function renderCard(container, student, lessons, actions) {
    container.replaceChildren();
    container.hidden = false;
    const copy = el("div", "train-copy");
    copy.append(el("h3", "", "Provträning"),
      el("p", "", "Öva som inför de nationella proven: frågor i samma områden, med tid och utan tips, och nya tal varje gång. Det här är övning och inte de riktiga proven."));
    const row = el("div", "provtr-row");
    SETS.forEach(function (s) {
      const st = state(student, s.id);
      const have = s.lessons.filter(function (id) { return lessons.some(function (l) { return l.id === id; }); }).length;
      const b = el("button", "provtr-btn");
      b.type = "button";
      const last = st.done.length ? st.done[st.done.length - 1].rec : null;
      b.append(el("strong", "", s.name),
        el("span", "", st.status === "started" ? "Fortsätt provet" : (st.done.length ? "Ny omgång" : "Starta") + " · " + have + " frågor · " + s.minutes + " min"),
        el("small", "", last ? "Senast: " + (Number(last.score) || 0) + " av " + (last.total || have) : ""));
      b.addEventListener("click", function () { actions.open(s.id, st.round); });
      row.appendChild(b);
    });
    copy.appendChild(row);
    container.append(el("span", "train-icon", "📝"), copy);
  }

  const api = { SETS: SETS, assignment: assignment, state: state, finished: finished, renderCard: renderCard };
  if (typeof window !== "undefined") window.GaussicaProvTraining = api;
  if (typeof module !== "undefined") module.exports = api;
  return api;
}());
