// The course mapped to the syllabus for mathematics in the compulsory school (Lgr22): which central content each lesson
// gives practice in, and what a student or a class has covered of it.
//
// The list of central content below is a short summary in our own words, grouped like the syllabus (stage and area).
// It is NOT the wording of the syllabus. Check it against Skolverket (skolverket.se, Lgr22, matematik) before it is
// used as documentation, and change the lines here if your school reads the content differently.
//
//   GaussicaLgr22.STAGES, AREAS, CONTENT, MAP
//   GaussicaLgr22.coverage(student, lessons)   per item of central content: how far the student has come
//   GaussicaLgr22.abilities(student, lessons)  indications for the abilities of the syllabus that the answer log can show
//   GaussicaLgr22.summary(student, lessons)    totals for the student
//   GaussicaLgr22.classCoverage(students, lessons)
//   GaussicaLgr22.csv(rows)                    rows -> text for Excel (semicolons, quoted)
//
// A student is { lessonProgress, attempts } as in the teacher view.

window.GaussicaLgr22 = (function () {
  "use strict";

  const STAGES = [
    { id: "1-3", name: "Årskurs 1–3" },
    { id: "4-6", name: "Årskurs 4–6" },
    { id: "7-9", name: "Årskurs 7–9" }
  ];

  const AREAS = [
    { id: "tal", name: "Taluppfattning och tals användning" },
    { id: "algebra", name: "Algebra" },
    { id: "geometri", name: "Geometri" },
    { id: "statistik", name: "Sannolikhet och statistik" },
    { id: "samband", name: "Samband och förändring" },
    { id: "problem", name: "Problemlösning" }
  ];

  // [id, stage, area, text]
  const ROWS = [
    ["t13-tal", "1-3", "tal", "Naturliga tal: antal, ordning, jämföra och dela upp tal"],
    ["t13-pos", "1-3", "tal", "Positionssystemet: hur tal skrivs med siffror"],
    ["t13-brak", "1-3", "tal", "Del av helhet och del av antal, enkla tal i bråkform"],
    ["t13-rakna", "1-3", "tal", "Addition och subtraktion med naturliga tal, i huvudet och skriftligt"],
    ["t13-mult", "1-3", "tal", "Multiplikation och division och hur de hänger ihop"],
    ["t13-uppskatt", "1-3", "tal", "Uppskatta och avrunda, och kontrollera om ett svar är rimligt"],
    ["t13-vardag", "1-3", "tal", "Räkna med pengar och andra tal i vardagen"],
    ["t46-hel", "4-6", "tal", "Naturliga tal, negativa tal och talens egenskaper (till exempel delare)"],
    ["t46-pos", "4-6", "tal", "Positionssystemet för hela tal och decimaltal"],
    ["t46-brak", "4-6", "tal", "Tal i bråk- och decimalform: jämföra, räkna med och använda"],
    ["t46-procent", "4-6", "tal", "Procent och sambandet mellan bråk, decimaltal och procent"],
    ["t46-rakna", "4-6", "tal", "De fyra räknesätten och reglerna för dem (räkneordning, parenteser)"],
    ["t46-metoder", "4-6", "tal", "Huvudräkning, överslag och skriftliga metoder för räknesätten"],
    ["t79-reella", "7-9", "tal", "Reella tal och deras egenskaper, till exempel kvadratrötter"],
    ["t79-prim", "7-9", "tal", "Primtal och hur tal kan delas upp i faktorer"],
    ["t79-pot", "7-9", "tal", "Potenser, tiopotenser och grundpotensform"],
    ["t79-procent", "7-9", "tal", "Procentuell förändring"],
    ["t79-rakna", "7-9", "tal", "Räkna med bråk och tal i olika former"],
    ["a13-lika", "1-3", "algebra", "Likheter och vad likhetstecknet betyder"],
    ["a13-monster", "1-3", "algebra", "Mönster i tal och figurer: fortsätta och beskriva dem"],
    ["a13-algo", "1-3", "algebra", "Stegvisa instruktioner som grund för programmering"],
    ["a46-obek", "4-6", "algebra", "Obekanta tal, symboler för dem och enkla ekvationer"],
    ["a46-monster", "4-6", "algebra", "Talföljder och mönster: regler för hur de växer"],
    ["a46-algo", "4-6", "algebra", "Algoritmer och enkel programmering"],
    ["a79-uttr", "7-9", "algebra", "Algebraiska uttryck och formler, förenkling och parenteser"],
    ["a79-ekv", "7-9", "algebra", "Ekvationer och ekvationssystem"],
    ["g13-former", "1-3", "geometri", "Former och kroppar och deras egenskaper (sidor, hörn)"],
    ["g13-sym", "1-3", "geometri", "Symmetri och spegling"],
    ["g13-lage", "1-3", "geometri", "Läge och riktning: beskriva var något finns, kartor och rutnät"],
    ["g13-mat", "1-3", "geometri", "Mäta och jämföra längd, massa och volym med vanliga enheter"],
    ["g13-tid", "1-3", "geometri", "Tid och klockan"],
    ["g46-figur", "4-6", "geometri", "Egenskaper hos månghörningar, trianglar, cirklar och kroppar"],
    ["g46-sym", "4-6", "geometri", "Symmetri, förstoring och förminskning"],
    ["g46-mat", "4-6", "geometri", "Mätning och växling mellan enheter (längd, volym, massa, tid)"],
    ["g46-omk", "4-6", "geometri", "Omkrets, area och volym för enkla figurer och kroppar"],
    ["g46-vinkel", "4-6", "geometri", "Vinklar och hur de mäts"],
    ["g79-cirkel", "7-9", "geometri", "Cirkelns omkrets och area"],
    ["g79-area", "7-9", "geometri", "Area och volym för sammansatta figurer"],
    ["g79-pyth", "7-9", "geometri", "Pythagoras sats och trigonometri i rätvinkliga trianglar"],
    ["g79-likform", "7-9", "geometri", "Likformighet och skala: hur längder, areor och volymer förändras vid förstoring"],
    ["s13-tabell", "1-3", "statistik", "Tabeller och enkla diagram: läsa och göra egna"],
    ["s13-slump", "1-3", "statistik", "Slumpmässiga händelser i vardagen: säkert, möjligt, omöjligt"],
    ["s46-diagram", "4-6", "statistik", "Tabeller och diagram: läsa, jämföra och skapa"],
    ["s46-lage", "4-6", "statistik", "Medelvärde, median, typvärde och variationsbredd"],
    ["s46-sannolik", "4-6", "statistik", "Sannolikhet: slumpmässiga händelser och hur chans kan uttryckas"],
    ["s79-komb", "7-9", "statistik", "Kombinatorik"],
    ["s79-sannolik", "7-9", "statistik", "Sannolikhet i flera steg, träddiagram"],
    ["s79-stat", "7-9", "statistik", "Spridningsmått och lådagram, och att granska statistik och diagram kritiskt"],
    ["sf46-prop", "4-6", "samband", "Proportionalitet och förhållande i enkla situationer"],
    ["sf46-skala", "4-6", "samband", "Skala: förminska och förstora"],
    ["sf46-koord", "4-6", "samband", "Koordinatsystem: läsa av och sätta ut punkter"],
    ["sf79-funk", "7-9", "samband", "Funktioner och räta linjer (k och m), grafer"],
    ["p13", "1-3", "problem", "Lösa matematiska problem med olika strategier"],
    ["p46", "4-6", "problem", "Strategier för problemlösning och att ställa egna frågor"],
    ["p79", "7-9", "problem", "Problemlösning och matematisk modellering"]
  ];

  const CONTENT = ROWS.map(function (r) { return { id: r[0], stage: r[1], area: r[2], text: r[3] }; });

  // lesson id -> the central content it gives practice in
  const MAP = {
    "platsvarde": ["t13-pos", "t13-tal"], "stora-tal": ["t46-pos"], "begrepp-tal": ["t13-tal", "t13-pos"], "storre-mindre": ["t13-tal"],
    "inte-lika-med": ["a13-lika"], "addition": ["t13-rakna"], "subtraktion": ["t13-rakna"], "addition-uppstallning": ["t13-rakna"],
    "avrundning-overslag": ["t13-uppskatt", "t46-metoder"], "subtraktion-uppstallning": ["t13-rakna"], "pengar-vaxel": ["t13-vardag", "t13-rakna"],
    "multiplikation": ["t13-mult"], "multiplikationstabellen": ["t13-mult"], "huvudrakning": ["t46-metoder"], "multiplikation-uppstallning": ["t46-metoder"],
    "multiplikation-10-100-1000": ["t46-pos", "t46-metoder"], "multiplikation-tvasiffrigt": ["t46-metoder"], "division": ["t13-mult"],
    "division-med-rest": ["t46-metoder", "t46-rakna"], "kortdivision": ["t46-metoder"], "langdivision": ["t46-metoder"],
    "division-med-10-100-1000": ["t46-pos", "t46-metoder"], "begrepp-rakna": ["t46-rakna"], "uttryck-med-x": ["a46-obek"],
    "likhet-balansvag": ["a46-obek", "a13-lika"], "operatorsordning": ["t46-rakna"], "parenteser": ["t46-rakna"],
    "potenser": ["t79-pot"], "tiopotenser": ["t79-pot"], "tid-klocka": ["g13-tid"], "digital-klocka": ["g13-tid"],
    "enheter": ["g46-mat"], "matning-liter-gram": ["g46-mat"], "omkrets": ["g79-cirkel"], "cirkelns-area": ["g79-cirkel"],
    "area": ["g46-omk"], "vinklar": ["g46-vinkel"], "fyrhorningar-linjer": ["g46-figur"], "begrepp-geometri": ["g46-figur", "g46-mat"],
    "diagram": ["s46-diagram"], "strecktabell-stapeldiagram": ["s46-diagram", "s13-tabell"],
    "brak-del": ["t46-brak", "t13-brak"], "brak-tallinje": ["t46-brak"], "brak-likavarda": ["t46-brak"], "brak-jämfora": ["t46-brak"],
    "brak-rakna": ["t46-brak"], "brak-blandad": ["t46-brak"], "brak-multiplikation": ["t79-rakna"], "begrepp-brak": ["t46-brak"],
    "procent": ["t46-procent"], "procent-vardagen": ["t46-procent"], "procentuell-forandring": ["t79-procent"],
    "ekvation": ["a79-ekv"], "ekvationer-bada-sidor": ["a79-ekv"], "parenteser-uttryck": ["a79-uttr"], "kvadreringsreglerna": ["a79-uttr"],
    "andragradsekvationer": ["a79-ekv"], "ekvationssystem": ["a79-ekv"], "begrepp-algebra": ["a79-uttr", "sf79-funk"],
    "funktioner": ["sf79-funk"], "linjara-funktioner-km": ["sf79-funk"], "tallinjen": ["t13-tal"], "negativa-tal": ["t46-hel"],
    "negativa-tal-rakna": ["t46-hel", "t46-rakna"], "koordinatsystem": ["sf46-koord"], "begrepp-koordinat": ["sf46-koord"],
    "talfoljder": ["a46-monster"], "algoritmer": ["a46-algo"], "pyssla-robot": ["a46-algo", "a13-algo"],
    "delare": ["t46-hel"], "gemensamma-delare": ["t46-hel"], "begrepp-delbarhet": ["t46-hel", "t79-prim"], "storsta-gemensamma-delare": ["t79-prim"],
    "primtal": ["t79-prim"], "decimaltal": ["t46-pos", "t46-brak"], "decimaltal-rakna": ["t46-brak", "t46-metoder"],
    "division-decimaltal": ["t46-brak"], "multiplikation-decimaltal": ["t46-brak"], "skala": ["sf46-skala", "g46-sym"],
    "forhallande": ["sf46-prop"], "proportionalitet": ["sf46-prop"], "medelvarde": ["s46-lage"], "median-typvarde": ["s46-lage"],
    "begrepp-statistik": ["s46-lage", "s46-sannolik"], "begrepp-sannolikhet": ["s13-slump"], "slump": ["s46-sannolik"],
    "kombinatorik": ["s79-komb"], "traddiagram": ["s79-sannolik"], "geometriska-figurer": ["g13-former"], "kroppar": ["g13-former", "g46-figur"],
    "symmetri": ["g13-sym"], "geometriska-monster": ["a46-monster"], "kvadratens-omkrets": ["g46-omk"], "kvadratens-area": ["g46-omk"],
    "rektangelns-omkrets": ["g46-omk"], "rektangelns-area": ["g46-omk"], "volym": ["g46-omk", "g46-mat"],
    "triangelns-vinkelsumma": ["g46-vinkel", "g46-figur"], "triangelns-omkrets": ["g46-omk"], "triangelns-area": ["g46-omk"],
    "parallellogrammens-area": ["g46-omk"], "trapetsens-area": ["g79-area"], "pythagoras": ["g79-pyth"], "rotuttryck": ["t79-reella"],
    "trigonometri": ["g79-pyth"], "pyssla-tallinjen": ["t13-tal"], "pyssla-klockan": ["g13-tid"], "pyssla-symmetri": ["g13-sym"],
    "pyssla-omkrets-area": ["g46-omk"], "pyssla-vinklar": ["g46-vinkel"], "pyssla-monster": ["a46-monster"], "pyssla-decimaltal": ["t46-pos"],
    "pyssla-delare": ["t46-hel"], "pyssla-slump": ["s46-sannolik"], "pyssla-primtal": ["t79-prim"], "pyssla-triangel": ["g46-figur"],
    "pyssla-skala": ["sf46-skala"], "pyssla-medelvarde": ["s46-lage"], "pyssla-procent": ["t46-procent"], "pyssla-ekvation": ["a79-ekv"],
    "pyssla-funktioner": ["sf79-funk"],
    // the lessons for years 3 to 5 that were added to fill the gaps
    "monster-fortsatt": ["a13-monster"], "mata-langd": ["g13-mat"], "var-ar-det": ["g13-lage"], "tabell-lasa": ["s13-tabell"],
    "halvor-fjardedelar": ["t13-brak"], "udda-jamna": ["t13-tal"], "sakert-mojligt": ["s13-slump"], "problemlosning-rita": ["p13", "p46"],
    // the lessons that were added to fill the remaining gaps
    "stegvisa-instruktioner": ["a13-algo"], "kalendern": ["g13-tid"], "tidsintervall": ["g46-mat"], "okant-tal": ["a46-obek"],
    "formler": ["a46-obek", "a79-uttr"], "monster-regel": ["a46-monster"], "hastighet": ["sf46-prop", "g46-mat"],
    "avrunda-decimaltal": ["t46-pos", "t46-metoder"], "relativ-frekvens": ["s46-sannolik"], "vilseledande-diagram": ["s79-stat", "s46-diagram"],
    "ladagram": ["s79-stat", "s46-lage"], "sammansatta-figurer": ["g79-area", "g46-omk"], "vinkelsumma-manghorningar": ["g46-vinkel", "g46-figur"],
    "volym-prisma-cylinder": ["g79-area", "g46-omk"], "likformighet": ["g79-likform", "sf46-skala"], "division-av-brak": ["t79-rakna"],
    "upprepad-procent": ["t79-procent"], "ekvation-fran-text": ["a79-ekv"],
    "trianglar-typer": ["g46-figur"], "linjediagram": ["s46-diagram"], "samma-tal-tre-satt": ["t46-brak", "t46-procent"], "pris-per-enhet": ["sf46-prop"]
  };

  function L() { return window.GaussicaLesson; }

  function stageOfGrade(g) { return g <= 3 ? "1-3" : g <= 6 ? "4-6" : "7-9"; }

  function item(id) { return CONTENT.find(function (c) { return c.id === id; }) || null; }

  // the lessons (not chapter headings) that give practice in an item
  function lessonsOf(itemId, lessons) {
    return lessons.filter(function (l) { return !l.isParentLesson && (MAP[l.id] || []).indexOf(itemId) >= 0; });
  }

  // ===== evidence from one student =====
  function getter(student) {
    const p = (student && student.lessonProgress) || {};
    return function (id) { return p[id]; };
  }

  // How one lesson went for the student: state, tasks solved, and how many were right on the first try.
  function lessonEvidence(lesson, student, lessons, get) {
    const sum = L().summarize(lesson, get, lessons);
    const answers = (get(lesson.id) || {}).answers || {};
    let tasks = 0, solved = 0, first = 0;
    L().tasks(lesson).filter(function (t) { return !t.goal; }).forEach(function (t) {
      tasks += 1;
      const st = L().taskStats(L().history(student, lesson.id, t.id), answers[t.id]);
      if (st.solved) solved += 1;
      if (st.triesToSolve === 1 || (st.triesToSolve === null && st.solved && st.submissions === 0)) first += 1;
    });
    return { lesson: lesson, state: sum.state, done: sum.done, total: sum.total, tasks: tasks, solved: solved, first: first };
  }

  // Textual problems solved (ids word-N), by the stage of the lesson they sit in.
  function wordProblems(student, lessons, get) {
    const out = { "1-3": { solved: 0, total: 0 }, "4-6": { solved: 0, total: 0 }, "7-9": { solved: 0, total: 0 } };
    const memo = new Map();
    lessons.forEach(function (lesson) {
      if (lesson.isParentLesson) return;
      const stage = stageOfGrade(L().effectiveGrade(lesson, lessons, memo));
      const answers = (get(lesson.id) || {}).answers || {};
      L().tasks(lesson).forEach(function (t) {
        if (String(t.id).indexOf("word-") !== 0) return;
        out[stage].total += 1;
        const st = L().taskStats(L().history(student, lesson.id, t.id), answers[t.id]);
        if (st.solved) out[stage].solved += 1;
      });
    });
    return out;
  }

  // ===== coverage =====
  // One entry per item of central content: { item, lessons: [evidence], status, solved, first }
  //   status: "klar" (all its lessons finished), "delvis" (some begun or finished), "nivatest" (the placement test found
  //   it known, nothing opened yet) or "ingen"
  function coverage(student, lessons) {
    const get = getter(student);
    const known = new Set(((student && student.lessonProgress && student.lessonProgress.placement) || {}).known || []);
    const evidence = new Map();
    const ev = function (lesson) {
      if (!evidence.has(lesson.id)) evidence.set(lesson.id, lessonEvidence(lesson, student, lessons, get));
      return evidence.get(lesson.id);
    };
    const wp = wordProblems(student, lessons, get);
    return CONTENT.map(function (it) {
      if (it.area === "problem") {
        const w = wp[it.stage];
        const status = w.solved >= 6 ? "klar" : w.solved >= 1 ? "delvis" : "ingen";
        return { item: it, lessons: [], status: status, solved: w.solved, first: null, words: w };
      }
      const list = lessonsOf(it.id, lessons).map(ev);
      let status = "ingen";
      if (list.length && list.every(function (e) { return e.state === "complete"; })) status = "klar";
      else if (list.some(function (e) { return e.state !== "new" || e.solved > 0; })) status = "delvis";
      else if (list.length && list.every(function (e) { return known.has(e.lesson.id); })) status = "nivatest";
      const solved = list.reduce(function (n, e) { return n + e.solved; }, 0);
      const first = list.reduce(function (n, e) { return n + e.first; }, 0);
      return { item: it, lessons: list, status: status, solved: solved, first: first };
    });
  }

  function classCoverage(students, lessons) {
    const per = students.map(function (s) { return coverage(s, lessons); });
    return CONTENT.map(function (it, i) {
      const counts = { klar: 0, delvis: 0, nivatest: 0, ingen: 0 };
      per.forEach(function (p) { counts[p[i].status] += 1; });
      return { item: it, counts: counts, n: students.length, lessons: lessonsOf(it.id, lessons).length };
    });
  }

  // ===== the abilities (förmågorna): only what the answer log can show =====
  function abilities(student, lessons) {
    const get = getter(student);
    const rate = function (a, b) { return b ? Math.round((a / b) * 100) : null; };
    const out = {
      begrepp: { solved: 0, total: 0, first: 0 },
      metod: { solved: 0, total: 0, first: 0 },
      problemlosning: { solved: 0, total: 0, first: 0 },
      kommunikation: { drawn: 0, tasks: 0 }
    };
    lessons.forEach(function (lesson) {
      if (lesson.isParentLesson) return;
      const answers = (get(lesson.id) || {}).answers || {};
      L().tasks(lesson).filter(function (t) { return !t.goal; }).forEach(function (t) {
        const entry = answers[t.id];
        const st = L().taskStats(L().history(student, lesson.id, t.id), entry);
        const first = st.triesToSolve === 1 || (st.triesToSolve === null && st.solved && st.submissions === 0);
        let bucket = String(t.id).indexOf("word-") === 0 ? "problemlosning" : lesson.kind === "begrepp" ? "begrepp" : "metod";
        const b = out[bucket];
        b.total += 1;
        if (st.solved) b.solved += 1;
        if (first) b.first += 1;
        if (entry && (entry.canvas || (entry.scratchpad && String(entry.scratchpad).trim()))) out.kommunikation.drawn += 1;
        if (entry && (entry.answer || entry.completed)) out.kommunikation.tasks += 1;
      });
    });
    ["begrepp", "metod", "problemlosning"].forEach(function (k) { out[k].firstRate = rate(out[k].first, out[k].solved); });
    return out;
  }

  // ===== totals =====
  function summary(student, lessons) {
    const get = getter(student);
    const subs = ((student && student.attempts) || []).filter(L().isSubmission);
    const days = new Set();
    let first = "", last = "";
    subs.forEach(function (a) {
      const t = String(a.timestamp || "");
      if (!t) return;
      days.add(t.slice(0, 10));
      if (!first || t < first) first = t;
      if (!last || t > last) last = t;
    });
    let finished = 0, begun = 0, solved = 0, firstTry = 0;
    lessons.forEach(function (lesson) {
      if (lesson.isParentLesson) return;
      const e = lessonEvidence(lesson, student, lessons, get);
      if (e.state === "complete") finished += 1;
      else if (e.state !== "new") begun += 1;
      solved += e.solved;
      firstTry += e.first;
    });
    const wrong = subs.filter(function (a) { return !a.completed; }).length;
    return {
      lessonsFinished: finished, lessonsBegun: begun, tasksSolved: solved, firstTryRate: solved ? Math.round((firstTry / solved) * 100) : null,
      submissions: subs.length, wrong: wrong, activeDays: days.size, firstAt: first, lastAt: last
    };
  }

  // ===== text for Excel: semicolons (Swedish Excel), quoted when needed =====
  function csv(rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        const s = c === null || c === undefined ? "" : String(c);
        return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(";");
    }).join("\r\n");
  }

  const STATUS_TEXT = { klar: "Klar", delvis: "Delvis", nivatest: "Verkar kunna (nivåtest)", ingen: "Inte påbörjad" };

  return {
    STAGES: STAGES, AREAS: AREAS, CONTENT: CONTENT, MAP: MAP, STATUS_TEXT: STATUS_TEXT,
    stageOfGrade: stageOfGrade, item: item, lessonsOf: lessonsOf, coverage: coverage, classCoverage: classCoverage,
    abilities: abilities, summary: summary, csv: csv
  };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaLgr22;
