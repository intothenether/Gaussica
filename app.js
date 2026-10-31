(function () {
  "use strict";

  const filters = document.querySelector("#area-filters");
  const graph = document.querySelector("#lesson-graph");
  const panel = document.querySelector("#lesson-panel");
  const popup = document.querySelector("#lesson-popup");
  const popupCard = document.querySelector("#lesson-popup-card");
  const progressNotice = document.querySelector("#progress-notice");
  const studentProfileBar = document.querySelector("#student-profile-bar");
  const studentModal = document.querySelector("#student-modal");
  const studentModalCard = document.querySelector("#student-modal-card");
  const adminPage = document.querySelector("#admin-page");
  const studentView = document.querySelector("#student-view");
  const areas = new Map();
  let course;
  let activeArea = "alla";
  let activeLessonId = "";
  let lessonDepth = new Map();
  let lessonProgress = {};

  // the tools of dom.js, and what was cut out of this file into modules (they get the page state from init() at the end of this file)
  const makeElement = window.GaussicaDom.makeElement;
  const { renderInteractiveModel, renderSingleVisualContent, renderVisualComponent, renderVisualsFor } = window.GaussicaVisuals;
  const { generateProblemSet, renderProblemPatternUI } = window.GaussicaPatterns;
  const { renderConceptCards, workedExampleFor, isTrue, renderMatching, renderTrueFalse, renderFormat, renderProblem, shuffled } = window.GaussicaQuestions;
  const { openStudentModal, closeStudentModal, renderStudentModal } = window.GaussicaAccount;
  const { refreshTeacherChat, renderAdminPage } = window.GaussicaAdminPage;

  // For a right answer written in the wrong form: what to tell the student (empty = fine).
  function answerFormNote(form, raw) {
    const MS = window.MATTE_SYMBOLIC;
    const text = String(raw);
    if (form === "blandad") {
      if (text.indexOf("/") >= 0 && !(MS && MS.isMixed(text))) return "Det stämmer, men skriv svaret i blandad form, med hela talet först, till exempel 1 3/4.";
    } else if (form === "brak") {
      if (MS && MS.isMixed(text)) return "Det stämmer, men skriv svaret som ett bråk, utan hela tal framför.";
    } else if (form === "utanparentes") {
      if (/[()]/.test(text)) return "Det stämmer, men skriv uttrycket utan parentes. Multiplicera ut parentesen först.";
    } else if (form === "grundpotens") {
      // a number from 1 up to (not including) 10, times a power of ten: 3,5 · 10^4
      const m = /^\s*(\d+(?:[.,]\d+)?)\s*[*·×]\s*10\s*\^\s*\(?[-−]?\d+\)?\s*$/.exec(text);
      const lead = m ? Number(m[1].replace(",", ".")) : NaN;
      if (!m || lead < 1 || lead >= 10) return "Det stämmer, men skriv det i grundpotensform: ett tal från 1 upp till 10 gånger en tiopotens, till exempel 3,5 · 10^4.";
    } else if (form === "forenklat") {
      const m = /^\s*(\d+)\s*[:/]\s*(\d+)\s*$/.exec(text);
      if (m) {
        let a = Number(m[1]), b = Number(m[2]);
        while (b) { const t = b; b = a % b; a = t; }
        if (a > 1) return "Det stämmer, men du kan förenkla mer. Dela båda talen med samma tal.";
      }
    }
    return "";
  }

  function showError(error) {
    console.error("Kunde inte läsa kursinnehållet.", error);
    const detail = error && error.message ? String(error.message) : "";
    graph.replaceChildren(makeElement("p", "course-error",
      "Kursinnehållet kunde inte läsas. Kontrollera att lessons/index.json och alla listade lektionsfiler finns och är giltig JSON." +
      (detail ? " Felet var: " + detail : "") + " Prova att ladda om sidan med Ctrl+F5."));
    panel.replaceChildren(makeElement("p", "course-error", "Lektionerna kunde inte laddas."));
  }

  // --- Inloggad användare. Framsteg och svar sparas på servern. ---
  const API = window.GaussicaAPI;
  let currentUser = null;           // { id, username, name, role, className, color, lessonProgress, attempts }
  const dirtyLessons = new Set();   // lessons whose progress still has to be sent
  const pendingAttempts = [];       // submitted answers the server has not confirmed yet
  let saveTimer = null;
  let retryTimer = null;

  function getActiveStudent() { return currentUser; }

  // Teachers and caregivers (vårdnadshavare) share the view of their classes (a caregiver's class is the family); only teachers edit lessons.
  function isGuide(u) { return Boolean(u && (u.role === "teacher" || u.role === "caregiver")); }

  async function loadUserData(user) {
    const data = await API.get("/api/me/data");
    currentUser = Object.assign({}, user, {
      lessonProgress: data.progress || {}, attempts: data.attempts || [],
      assignments: data.assignments || [], feedback: data.feedback || [], chat: data.chat || []
    });
    lessonProgress = currentUser.lessonProgress;
    window.GaussicaUser = currentUser;
    // "lärare" and "elev" are "vårdnadshavare" and "barn" for a family (words.js)
    if (window.GaussicaWords) window.GaussicaWords.setMode(currentUser.role === "caregiver" ? "caregiver" : currentUser.role === "student" && currentUser.guide === "caregiver" ? "family" : null);
    restoreOutbox();
    // the colour theme the student has chosen follows the account
    if (window.GaussicaTheme) window.GaussicaTheme.sync(lessonProgress.theme);
  }

  // Answers that could not be sent (no connection) are also kept in this browser, per user, so that they survive a
  // reload or a closed tab and are sent the next time the page is open with a connection.
  function outboxKey() { return currentUser ? "gaussica.outbox." + currentUser.id : ""; }

  function saveOutbox() {
    const key = outboxKey();
    if (!key) return;
    try {
      if (!dirtyLessons.size && !pendingAttempts.length) { localStorage.removeItem(key); return; }
      const progress = {};
      dirtyLessons.forEach(function (id) { progress[id] = lessonProgress[id]; });
      localStorage.setItem(key, JSON.stringify({ progress: progress, attempts: pendingAttempts }));
    } catch (e) { /* storage full or blocked: the answers stay in memory, as before */ }
  }

  function restoreOutbox() {
    const key = outboxKey();
    if (!key) return;
    let box = null;
    try { box = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return; }
    if (!box) return;
    Object.keys(box.progress || {}).forEach(function (id) {
      const mine = box.progress[id];
      if (!mine || typeof mine !== "object") return;
      const theirs = lessonProgress[id];
      if (!theirs || (mine.updatedAt || 0) >= (theirs.updatedAt || 0)) lessonProgress[id] = mine;
      dirtyLessons.add(id);
    });
    (box.attempts || []).forEach(function (a) {
      if (!a || typeof a !== "object") return;
      pendingAttempts.push(a);
      currentUser.attempts.push(Object.assign({ id: "att-local-" + Date.now() + "-" + pendingAttempts.length, timestamp: new Date().toISOString() }, a));
    });
    if (dirtyLessons.size || pendingAttempts.length) scheduleSave(500);
  }

  function showSaveNotice(text) {
    if (progressNotice) progressNotice.textContent = text;
  }

  function handleSaveError(error) {
    saveOutbox();
    if (error.status === 401) {
      showSaveNotice("Du har loggats ut och dina senaste svar sparades inte. Ladda om sidan och logga in igen.");
      return;
    }
    showSaveNotice(error.status === 0 && window.GaussicaOffline && window.GaussicaOffline.isOffline()
      ? "Du är offline. Svaren sparas i den här webbläsaren och skickas när du är online igen."
      : "Kunde inte spara just nu, försöker igen om en stund…");
    clearTimeout(retryTimer);
    retryTimer = setTimeout(function () { flushProgress(false); }, 5000);
  }

  function scheduleSave(delay) {
    if (saveTimer) return;
    saveTimer = setTimeout(function () { flushProgress(false); }, delay);
  }

  // Sends changed progress and any unconfirmed attempts. keepalive lets it finish while the page closes.
  // Returns a promise that settles when everything has been sent.
  function flushProgress(keepalive) {
    clearTimeout(saveTimer);
    saveTimer = null;
    const sends = [];
    Array.from(dirtyLessons).forEach(function (id) {
      dirtyLessons.delete(id);
      sends.push(API.put("/api/progress/" + encodeURIComponent(id), { data: lessonProgress[id] }, { keepalive: keepalive })
        .then(function () { if (!dirtyLessons.size && !pendingAttempts.length) showSaveNotice(""); })
        .catch(function (err) { dirtyLessons.add(id); handleSaveError(err); }));
    });
    pendingAttempts.splice(0).forEach(function (a) { sends.push(sendAttempt(a)); });
    return Promise.all(sends).then(saveOutbox);
  }

  function sendAttempt(attempt) {
    return API.post("/api/attempts", attempt)
      .then(function () { if (!dirtyLessons.size && !pendingAttempts.length) showSaveNotice(""); })
      .catch(function (err) {
        if (err.status === 400) return;   // rejected for good; retrying would not help
        pendingAttempts.push(attempt);
        handleSaveError(err);
      });
  }

  // What is still unsent when the page is hidden is written down first: the sending below may not get to finish.
  function flushBeforeHide() {
    saveOutbox();
    flushProgress(true);
  }
  window.addEventListener("pagehide", flushBeforeHide);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushBeforeHide();
  });
  if (window.GaussicaOffline) window.GaussicaOffline.onOnline(function () { if (currentUser) flushProgress(false); });

  function getLessonProgress(id) {
    if (!lessonProgress[id]) {
      lessonProgress[id] = { started: false, answers: {}, interactive: {} };
    }
    return lessonProgress[id];
  }

  // Progress is drawn on the graph nodes, so any change redraws the graph.
  function updateNodeProgress() {
    renderGraph();
    refreshProgressStrip();
  }

  const questionShownAt = {};
  // Latest drawing (JSON string) per "lessonId|taskId" while a problem is open.
  const drawings = {};
  // Generated practice questions ("Öva mer", "Repetera") are not part of a lesson's progress. Their answers are
  // only kept while the round is open; the attempt log still records every submitted answer.
  const practiceEntries = {};
  const practiceProblems = {};

  function isPractice(taskId) { return window.GaussicaPractice.isPracticeId(taskId); }

  function practiceEntry(lessonId, taskId) {
    const key = lessonId + "|" + taskId;
    return practiceEntries[key] || (practiceEntries[key] = { answer: "", scratchpad: "", feedback: "", feedbackType: "", completed: false });
  }

  // The saved state of a question: progress for lesson questions, the open round for generated ones.
  function savedEntry(lessonId, taskId) {
    if (isPractice(taskId)) return practiceEntries[lessonId + "|" + taskId] || {};
    const p = currentUser && currentUser.lessonProgress && currentUser.lessonProgress[lessonId];
    return (p && p.answers && p.answers[taskId]) || {};
  }

  // The drawing is saved on its own, so drawing never changes whether a task counts as solved.
  function storeCanvas(lessonId, taskId, json) {
    drawings[lessonId + "|" + taskId] = json || "";
    if (isPractice(taskId)) {
      const e = practiceEntry(lessonId, taskId);
      if (json) e.canvas = json; else delete e.canvas;
      return;
    }
    const progress = getLessonProgress(lessonId);
    progress.started = true;
    progress.updatedAt = Date.now();
    const entry = progress.answers[taskId] || (progress.answers[taskId] = { answer: "", scratchpad: "", feedback: "", feedbackType: "", completed: false });
    if (json) entry.canvas = json; else delete entry.canvas;
    dirtyLessons.add(lessonId);
    scheduleSave(800);
  }

  function storeAnswerProgress(lessonId, taskId, answer, scratchpad, feedback, feedbackType, completed, misconceptionTitle, promptText, labelText) {
    const practice = isPractice(taskId);
    const drawKey = lessonId + "|" + taskId;
    const lesson = course.lessons.find(function (item) { return item.id === lessonId; });
    const progress = practice ? null : getLessonProgress(lessonId);
    const before = practice ? practiceEntry(lessonId, taskId) : progress.answers[taskId];
    const canvas = (drawKey in drawings ? drawings[drawKey] : (before && before.canvas)) || "";
    const entry = {
      answer: answer,
      scratchpad: scratchpad || (before && before.scratchpad) || "",
      feedback: feedback || "",
      feedbackType: feedbackType || "",
      completed: Boolean(completed)
    };
    if (canvas) entry.canvas = canvas;
    if (practice) {
      entry.completed = entry.completed || Boolean(before && before.completed);   // a solved question stays solved
      practiceEntries[drawKey] = entry;
    } else {
      progress.started = true;
      progress.updatedAt = Date.now();
      progress.answers[taskId] = entry;
      progress.completed = window.GaussicaLesson.tasks(lesson).every(function (task) {
        const taskProgress = progress.answers[task.id];
        return taskProgress && taskProgress.completed;
      });
    }

    // Typing drafts only update progress; the log holds submitted answers ("Kolla svaret").
    if (window.GaussicaLesson.isSubmission({ feedbackType: feedbackType })) {
      const priorSubmissions = currentUser.attempts.filter(function (a) {
        return a.lessonId === lessonId && a.taskId === taskId && window.GaussicaLesson.isSubmission(a);
      }).length;
      const task = practice ? { problem: practiceProblems[drawKey] || { answer: [] } }
        : lesson && window.GaussicaLesson.tasks(lesson).find(function (t) { return t.id === taskId; });
      const shownAt = questionShownAt[lessonId + "|" + taskId];
      const attempt = {
        lessonId: lessonId,
        lessonTitle: (lesson && lesson.title) || lessonId,
        taskId: taskId,
        taskName: practice ? (/^REPETERA/.test(labelText || "") ? "Repetera" : /^MINA KNEPIGA/.test(labelText || "") ? "Mina knepiga" : "Öva mer") : (labelText || taskId),
        prompt: promptText || (lesson && taskId === "exercise" ? lesson.exercise.prompt : ""),
        answer: answer,
        scratchpad: entry.scratchpad,
        completed: Boolean(completed),
        feedback: feedback || "",
        feedbackType: feedbackType || "",
        misconception: misconceptionTitle || null,
        attemptNo: priorSubmissions + 1,
        correctAnswer: task ? task.problem.answer.join(" / ") : "",
        seconds: shownAt ? Math.round((Date.now() - shownAt) / 1000) : null
      };
      // The drawing is only attached when it differs from the one on the previous submission.
      if (canvas) {
        const lastDrawn = currentUser.attempts.filter(function (a) {
          return a.lessonId === lessonId && a.taskId === taskId && a.canvas;
        }).pop();
        if (!lastDrawn || lastDrawn.canvas !== canvas) attempt.canvas = canvas;
      }
      currentUser.attempts.push(Object.assign({ id: "att-local-" + Date.now(), timestamp: new Date().toISOString() }, attempt));
      sendAttempt(attempt);
    }

    if (practice) {
      if (completed) renderCoach();   // practice counts towards "Öva mer" assignments and badges
      return;
    }
    dirtyLessons.add(lessonId);
    scheduleSave(feedbackType ? 100 : 800);
    updateNodeProgress(lessonId);
  }

  // The deployed site has the whole course in one file (lessons/bundle.json, made by npm run build); without it
  // (local server, or a copy of the repository) the index and the lesson files are read one by one.
  async function fetchBundle() {
    try {
      const response = await fetch("./lessons/bundle.json", { cache: "no-cache" });
      if (!response.ok) return null;
      const bundle = await response.json();
      const m = bundle && bundle.manifest;
      if (!m || !Array.isArray(m.lessons) || !Array.isArray(m.areas) || !Array.isArray(bundle.lessons) || bundle.lessons.length !== m.lessons.length) return null;
      return bundle;
    } catch (e) {
      return null;
    }
  }

  async function fetchSingleFiles() {
    // "no-cache" makes the browser check with the server first, so a new index is never mixed with old lesson files
    const response = await fetch("./lessons/index.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Kursindexet svarade med " + response.status);
    const manifest = await response.json();
    if (!manifest || !Array.isArray(manifest.lessons) || !Array.isArray(manifest.areas)) {
      throw new Error("Kursindexet måste innehålla listor för areas och lessons.");
    }

    const lessons = await Promise.all(manifest.lessons.map(async function (path) {
      const lessonResponse = await fetch("./lessons/" + path, { cache: "no-cache" });
      if (!lessonResponse.ok) throw new Error(path + " svarade med " + lessonResponse.status);
      return lessonResponse.json();
    }));
    return { manifest: manifest, lessons: lessons };
  }

  async function loadCourse() {
    const loaded = (await fetchBundle()) || (await fetchSingleFiles());
    const manifest = loaded.manifest;
    course = { areas: manifest.areas, areaNotes: manifest.areaNotes || {}, lessons: loaded.lessons };
    
    // Lessons edited or created by teachers are stored on the server and override the files.
    try {
      const saved = await API.get("/api/lessons");
      (saved.lessons || []).forEach(function (l) {
        const ok = l && l.id && l.title && l.area && Array.isArray(l.prerequisites) && l.exercise &&
          Array.isArray(l.exercise.answer) && Array.isArray(l.exercise.feedback);
        if (!ok) return;
        const idx = course.lessons.findIndex(function (x) { return x.id === l.id; });
        if (idx >= 0) course.lessons[idx] = l; else course.lessons.push(l);
      });
    } catch (e) {
      console.warn("Kunde inte hämta sparade lektioner:", e);
    }

    window.course = course;  // Expose to admin interface
    window.GaussicaPlayer.init({
      workedExample: workedExampleFor,
      renderVisuals: renderVisualsFor,
      container: document.querySelector("#lesson-player"),
      makeElement: makeElement,
      getLesson: function (id) { return course.lessons.find(function (l) { return l.id === id; }); },
      allLessons: function () { return course.lessons; },
      getProgress: getLessonProgress,
      getStudent: getActiveStudent,
      renderBlock: renderBlock,
      renderQuestion: function (parent, lesson, task, label, opts) {
        renderProblem(parent, lesson, task.problem, task.id, label, opts);
      },
      openChat: function (context) { window.GaussicaChat.open(context); },
      openFeedback: function (context) { window.GaussicaFeedback.open(context); },
      canChat: function () { return window.GaussicaChat.canChat(); },
      chatUnread: function () { return window.GaussicaChat.unread(); },
      petRibbon: function () { return window.GaussicaPet.ribbon(); },
      petSay: function (kind, options) { return window.GaussicaPet.say(kind, options); },
      petPeek: function () { return window.GaussicaPet.peek("footer"); },
      goToLesson: function (id) { window.location.hash = "#" + id; },
      goToPlayer: function (id) { window.location.hash = "#play/" + id; },
      hasPractice: function (id) { const l = course.lessons.find(function (x) { return x.id === id; }); return window.GaussicaPractice.has(l); },
      startPractice: function (id) { window.location.hash = "#practice/" + id; }
    });
    window.GaussicaMailbox.init({
      openChat: function (context) { window.GaussicaChat.open(context); },
      chatUnread: function () { return window.GaussicaChat.unread(); },
      getUser: function () { return currentUser; },
      getCourse: function () { return course; },
      getProgress: getLessonProgress,
      openLesson: function (id, step) { window.GaussicaPlayer.open(id, typeof step === "number" ? { step: step } : undefined); },
      markRead: markFeedbackRead,
      startPractice: function (id) { window.location.hash = "#practice/" + id; },
      startProv: function (id) { window.location.hash = "#prov/" + id; }
    });
    window.GaussicaFeedback.init({ getUser: function () { return currentUser; } });
    window.GaussicaChat.init({
      getUser: function () { return currentUser; },
      getMessages: function () { return (currentUser && currentUser.chat) || []; },
      send: sendChatMessage,
      markRead: markChatRead,
      refresh: refreshChat
    });
    window.GaussicaRewards.init({
      getUser: function () { return currentUser; },
      getCourse: function () { return course; },
      getProgress: getLessonProgress,
      isActive: isStudent,
      mailbox: window.GaussicaMailbox
    });
    // some problems are about the pet of the student: its name and what it likes to eat
    window.GaussicaLesson.setPersonal(function () {
      const p = window.GaussicaPet.current();
      return p ? { name: p.name, food: window.GaussicaPetArt.countable(p.kind) } : null;
    });
    window.GaussicaPet.init({
      getUser: function () { return currentUser; },
      getCourse: function () { return course; },
      getProgress: getLessonProgress,
      enabled: function () { return window.GaussicaRewards.enabled(); },
      lessonStars: function (lesson) { return window.GaussicaRewards.lessonStars(lesson); },
      badges: function () { return window.GaussicaRewards.badgeList().badges; },   // the badges, for the things of the shop that are unlocked by them
      doneAssignments: function () { return window.GaussicaMailbox.doneIds(); },
      save: function (record) {
        record.updatedAt = Date.now();
        lessonProgress.pet = record;
        dirtyLessons.add("pet");
        scheduleSave(300);
      },
      refresh: function () { renderCoach(); }
    });
    course.areas.forEach(function (area) { areas.set(area.id, area.name); });
    validateCourse();
    activeLessonId = course.lessons[0] ? course.lessons[0].id : "";
    initPreview();
    initPopup();
    initMapState();
    renderFilters();
    renderGraph();
    renderPanel();
    renderStudentProfileBar();
    showTeacherLinks();
    checkRoute();
    if (window.initAdminInterface) window.initAdminInterface();
    
    // Expose to admin interface
    Object.defineProperty(window, 'activeLessonId', {
      get: function() { return activeLessonId; },
      set: function(value) { activeLessonId = value; }
    });
    window.openLesson = openLesson;
    // Used by the lesson editor: real renderers for its live preview, and a way
    // to redraw the student view after a lesson has been saved.
    window.GaussicaRender = {
      makeElement: makeElement,
      renderVisualsFor: renderVisualsFor,
      renderLessonComponents: renderLessonComponents
    };
    window.refreshCourseView = function (lessonId) {
      validateCourse();
      if (lessonId) activeLessonId = lessonId;
      renderFilters();
      renderGraph();
      renderPanel();
    };
    window.addEventListener("resize", renderGraph);
    window.addEventListener("hashchange", checkRoute);
  }

  function validateCourse() {
    const lessonIds = new Set();
    course.lessons.forEach(function (lesson) {
      if (!lesson.id || !lesson.title || !lesson.area || !Array.isArray(lesson.prerequisites) ||
          !lesson.exercise || !Array.isArray(lesson.exercise.answer) ||
          !Array.isArray(lesson.exercise.feedback) ||
          (lesson.wordProblems && !Array.isArray(lesson.wordProblems))) {
        throw new Error("En lektion saknar obligatoriska fält: " + (lesson.id || "okänt id"));
      }
      (lesson.wordProblems || []).forEach(function (problem, index) {
        if (!problem.prompt || !Array.isArray(problem.answer) || !problem.answer.length ||
            !Array.isArray(problem.feedback)) {
          throw new Error(lesson.id + " har en ogiltig textuppgift på plats " + (index + 1));
        }
      });
      if (lessonIds.has(lesson.id)) throw new Error("Lektions-id används flera gånger: " + lesson.id);
      lessonIds.add(lesson.id);
    });
    if (!areas.has("alla")) {
      const allArea = course.areas.find(function (area) { return area.id === "alla"; });
      if (allArea) areas.set(allArea.id, allArea.name);
    }
    course.lessons.forEach(function (lesson) {
      lesson.prerequisites.forEach(function (id) {
        if (!course.lessons.some(function (item) { return item.id === id; })) {
          throw new Error(lesson.id + " har en okänd förkunskap: " + id);
        }
      });
    });
    lessonDepth = new Map();
    const visiting = new Set();
    function getDepth(lesson) {
      if (lessonDepth.has(lesson.id)) return lessonDepth.get(lesson.id);
      if (visiting.has(lesson.id)) throw new Error("Cykel i förkunskapslänkarna vid " + lesson.id);
      visiting.add(lesson.id);
      const depth = lesson.prerequisites.reduce(function (maxDepth, id) {
        const prerequisite = course.lessons.find(function (item) { return item.id === id; });
        return Math.max(maxDepth, getDepth(prerequisite) + 1);
      }, 0);
      visiting.delete(lesson.id);
      lessonDepth.set(lesson.id, depth);
      return depth;
    }
    course.lessons.forEach(getDepth);
  }

  function renderFilters() {
    filters.replaceChildren();
    course.areas.forEach(function (area) {
      const button = makeElement("button", "area-filter", area.name);
      button.dataset.area = area.id;
      button.type = "button";
      button.setAttribute("aria-pressed", String(activeArea === area.id));
      button.addEventListener("click", function () {
        activeArea = area.id;
        const visible = getVisibleLessons();
        if (!visible.some(function (lesson) { return lesson.id === activeLessonId; })) {
          activeLessonId = visible[0] ? visible[0].id : "";
        }
        renderFilters();
        renderGraph();
        renderPanel();
      });
      filters.appendChild(button);
    });
  }

  function getVisibleLessons() {
    return course.lessons.filter(function (lesson) {
      return activeArea === "alla" || lesson.area === activeArea;
    });
  }

  // ===== "DIN VÄG" AND THE FULL MAP =====
  // Students see a short path by default and open the full graph on request; teachers always see the graph.
  const MAP_KEY = "gaussica.map";
  let mapOpen = true;
  // The overview of a lesson is a pop-up over the page: it opens when a node on the map is chosen, or "Mer om lektionen" in the short path,
  // so that nothing has to be scrolled to. popupOpener is what had the focus, to give it back when the pop-up closes.
  let popupOpen = false;
  let popupOpener = null;

  function readMapPref() {
    try { return window.localStorage.getItem(MAP_KEY) === "open"; } catch (e) { return false; }
  }

  function initMapState() {
    const student = isStudent();
    mapOpen = student ? readMapPref() : true;
    popupOpen = false;
    const toggle = document.getElementById("map-toggle");
    const row = document.getElementById("map-toggle-row");
    if (row) row.hidden = !student;
    if (toggle && !toggle.dataset.bound) {
      toggle.dataset.bound = "1";
      toggle.addEventListener("click", function () {
        mapOpen = !mapOpen;
        try { window.localStorage.setItem(MAP_KEY, mapOpen ? "open" : "closed"); } catch (e) { /* storage blocked */ }
        applyMapState();
        if (mapOpen) { renderGraph(); renderPanel(); }
      });
    }
    const desc = document.querySelector("#larstig .section-description");
    if (desc && student) desc.textContent = "Här är det som passar dig just nu. Vill du välja själv öppnar du hela kartan.";
    applyMapState();
  }

  function applyMapState() {
    const fullMap = document.getElementById("full-map");
    const toggle = document.getElementById("map-toggle");
    if (fullMap) fullMap.hidden = !mapOpen;
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(mapOpen));
      toggle.textContent = mapOpen ? "🗺️ Dölj kartan" : "🗺️ Visa hela kartan";
    }
    updatePanelVisibility();
  }

  function updatePanelVisibility() {
    if (popup) popup.hidden = !popupOpen;
    document.body.classList.toggle("lesson-popup-open", popupOpen);
  }

  // Shows the pop-up (it is drawn already, see renderPanel) and moves the focus into it.
  function openPopup() {
    if (!popupOpen) {
      popupOpener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
      popupOpen = true;
    }
    updatePanelVisibility();
    popupCard.scrollTop = 0;
    panel.scrollTop = 0;
    popupCard.focus({ preventScroll: true });
  }

  // silent: closed by a new route (a lesson is opened in the player, say), so the address and the focus are left as they are.
  function closePopup(silent) {
    if (!popupOpen) return;
    popupOpen = false;
    updatePanelVisibility();
    const id = activeLessonId;
    let back = popupOpener;
    popupOpener = null;
    if (silent) return;
    // the address of a lesson (#id) is left, or the pop-up would open again when the page is loaded
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && course && course.lessons.some(function (l) { return l.id === hash; }) && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search + "#larstig");
    }
    if (!back || !back.isConnected) back = graph.querySelector('[data-lesson-id="' + id + '"]');   // the map has been drawn again since
    if (back && typeof back.focus === "function") back.focus({ preventScroll: true });
  }

  function initPopup() {
    if (!popup || popup.dataset.bound) return;
    popup.dataset.bound = "1";
    document.body.appendChild(popup);   // out of the section, so that nothing around it can move or clip it
    popup.addEventListener("click", function (e) { if (e.target === popup) closePopup(); });
    document.getElementById("lesson-popup-close").addEventListener("click", function () { closePopup(); });
    popup.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); closePopup(); return; }
      if (e.key !== "Tab") return;
      // the focus stays inside the pop-up
      const items = Array.prototype.filter.call(popupCard.querySelectorAll("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])"), function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === popupCard)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function showLessonPanel(id) {
    openLesson(id);
  }

  function renderGraph() {
    if (!mapOpen) { renderCoach(); return; }
    const petMark = petOnMap();
    window.GaussicaGraph.render({
      container: graph,
      pet: petMark,
      paws: Boolean(petMark),
      lessons: getVisibleLessons(),
      allLessons: course.lessons,
      areas: areas,
      depthOf: function (id) { return lessonDepth.get(id); },
      placed: isStudent() ? window.GaussicaPlacement.knownSet(currentUser) : null,
      activeId: activeLessonId,
      getProgress: getLessonProgress,
      emptyText: course.areaNotes[activeArea],
      onSelect: function (id) {
        const opener = document.activeElement;
        activeLessonId = id;
        renderGraph();
        renderPanel();
        if (!popupOpen) popupOpener = opener && opener !== document.body ? opener : null;
        openPopup();
      }
    });
    renderCoach();
  }

  // The pet sits on the lesson the student is at (the one to continue or start), and walks there when that changes.
  // Where it was is kept in the browser, so that the walk starts from the node it left.
  function petOnMap() {
    if (!isStudent() || !window.GaussicaPet || !window.GaussicaPet.current()) return null;
    const pet = window.GaussicaPet.current();
    const step = window.GaussicaCoach.nextStep(coachContext());
    const at = step && step.lesson ? step.lesson.id : null;
    const key = "gaussica.pet.at." + currentUser.id;
    let from = null;
    try { from = window.localStorage.getItem(key); } catch (e) { from = null; }
    if (at) { try { window.localStorage.setItem(key, at); } catch (e) { /* storage blocked */ } }
    return { at: at, from: from, name: pet.name, face: window.GaussicaPetArt.face(pet, "", { wide: true }) };
  }

  // ============ "NÄSTA STEG", ÖVA MER OCH REPETERA ============
  function coachContext() {
    return { lessons: course.lessons, student: currentUser, getProgress: getLessonProgress };
  }

  // Teachers can switch to the student's view to see what students see ("Visa som elev").
  const PREVIEW_KEY = "gaussica.preview";
  let previewAsStudent = false;

  function isStudent() {
    return Boolean(currentUser && (currentUser.role === "student" || (isGuide(currentUser) && previewAsStudent)));
  }

  function setPreview(on) {
    previewAsStudent = Boolean(on) && isGuide(currentUser);
    try { window.sessionStorage.setItem(PREVIEW_KEY, previewAsStudent ? "1" : "0"); } catch (e) { /* storage blocked */ }
    applyPreviewUi();
    initMapState();
    renderGraph();
    renderPanel();
    renderCoach();
  }

  function applyPreviewUi() {
    const teacher = isGuide(currentUser);
    const sw = document.getElementById("view-switch");
    const banner = document.getElementById("preview-banner");
    const adminLink = document.getElementById("admin-top-link");
    document.body.classList.toggle("is-previewing", previewAsStudent);
    if (sw) {
      sw.hidden = !teacher;
      sw.textContent = previewAsStudent ? (currentUser.role === "caregiver" ? "👨‍👩‍👧 Tillbaka till mina barn" : "🧑‍🏫 Tillbaka till lärarvyn") : "👀 Visa som elev";
    }
    if (banner) banner.hidden = !previewAsStudent;
    if (adminLink && teacher) adminLink.hidden = previewAsStudent;
  }

  function initPreview() {
    const sw = document.getElementById("view-switch");
    const back = document.getElementById("preview-back");
    if (sw && !sw.dataset.bound) {
      sw.dataset.bound = "1";
      sw.addEventListener("click", function () {
        if (!previewAsStudent && window.location.hash.indexOf("#admin") === 0) window.location.hash = "#larstig";
        setPreview(!previewAsStudent);
      });
    }
    if (back && !back.dataset.bound) {
      back.dataset.bound = "1";
      back.addEventListener("click", function () { setPreview(false); });
    }
    try { previewAsStudent = isGuide(currentUser) && window.sessionStorage.getItem(PREVIEW_KEY) === "1"; } catch (e) { previewAsStudent = false; }
    applyPreviewUi();
  }

  // The badge in the top bar, the big box under it and the pins on assigned lessons in the graph.
  function renderInbox() {
    updateChatLink();
    const box = document.getElementById("mailbox");
    const link = document.getElementById("mail-link");
    Array.prototype.forEach.call(graph.querySelectorAll(".gn-pin"), function (p) { p.remove(); });
    Array.prototype.forEach.call(graph.querySelectorAll(".has-assignment"), function (n) { n.classList.remove("has-assignment"); });
    if (!course || !isStudent()) {
      if (box) box.hidden = true;
      if (link) link.hidden = true;
      window.GaussicaRewards.check();
      window.GaussicaPet.check();
      return;
    }
    const M = window.GaussicaMailbox;
    M.render(box);
    const c = M.counts();
    const total = c.assignments + c.unread;
    if (link) {
      link.hidden = false;
      link.classList.toggle("has-news", total > 0);
      const badge = link.querySelector(".mail-badge");
      badge.hidden = total === 0;
      badge.textContent = String(total);
      link.setAttribute("aria-label", total ? "Uppdrag och meddelanden från din lärare: " + total + " nya" : "Uppdrag och meddelanden från din lärare");
    }
    window.GaussicaRewards.check();
    window.GaussicaPet.check();
    const tones = M.assignedLessonIds();
    Object.keys(tones).forEach(function (id) {
      const node = graph.querySelector('[data-lesson-id="' + id + '"]');
      if (!node) return;
      node.classList.add("has-assignment");
      const pin = makeElement("span", "gn-pin is-" + tones[id], "UPPDRAG");
      pin.setAttribute("aria-hidden", "true");
      node.appendChild(pin);
    });
    document.title = (total ? "(" + total + ") " : "") + document.title.replace(/^\(\d+\)\s/, "");
  }

  function markFeedbackRead(ids) {
    const set = new Set(ids);
    let changed = false;
    (currentUser.feedback || []).forEach(function (f) { if (set.has(f.id) && !f.read) { f.read = true; changed = true; } });
    if (!changed) return;
    API.post("/api/me/feedback/read", { ids: ids }).catch(function () { /* shown as unread again next time */ });
    renderCoach();
  }

  // ----- chat with the teacher -----
  function sendChatMessage(payload) {
    return API.post("/api/me/chat", payload).then(function (r) {
      (currentUser.chat = currentUser.chat || []).push({
        id: r.id, studentId: String(currentUser.id), fromTeacher: false, text: payload.text, classId: payload.classId || currentUser.classId || null, lessonId: payload.lessonId || null, taskId: payload.taskId || null,
        context: payload.context || null, createdAt: new Date().toISOString(), read: true
      });
      return r;
    });
  }

  function markChatRead() {
    let changed = false;
    (currentUser.chat || []).forEach(function (m) { if (m.fromTeacher && !m.read) { m.read = true; changed = true; } });
    if (!changed) return;
    API.post("/api/me/chat/read", {}).catch(function () { /* shown as unread again next time */ });
    updateChatLink();
    if (course) renderInbox();
  }

  function refreshChat() {
    return API.get("/api/me/data").then(function (data) {
      currentUser.chat = data.chat || [];
      updateChatLink();
      if (course) renderInbox();
    });
  }

  function updateChatLink() {
    const link = document.getElementById("chat-link");
    if (!link) return;
    const show = Boolean(currentUser) && window.GaussicaChat.canChat() && !previewAsStudent;
    link.hidden = !show;
    const n = show ? window.GaussicaChat.unread() : 0;
    const badge = link.querySelector(".mail-badge");
    badge.hidden = n === 0;
    badge.textContent = String(n);
    link.classList.toggle("has-news", n > 0);
    link.setAttribute("aria-label", n ? "Fråga läraren: " + n + (n === 1 ? " nytt svar" : " nya svar") : "Fråga läraren");
  }

  const chatLink = document.getElementById("chat-link");
  if (chatLink) chatLink.addEventListener("click", function () { window.GaussicaChat.open(null); });

  // Picks up new assignments and comments without a page reload.
  async function refreshInbox() {
    if (!isStudent() || document.visibilityState === "hidden") return;
    try {
      const data = await API.get("/api/me/data");
      currentUser.assignments = data.assignments || [];
      currentUser.feedback = data.feedback || [];
      currentUser.chat = data.chat || [];
      renderCoach();
    } catch (e) { /* offline: try again next time */ }
  }
  setInterval(refreshInbox, 120000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") refreshInbox(); });

  // The suggestion card above the graph, the hero button and the highlighted node.
  function renderCoach() {
    const card = document.getElementById("next-card");
    const hero = document.getElementById("hero-cta");
    if (course && window.GaussicaPet) {
      const heroPet = document.getElementById("hero-pet");
      window.GaussicaPet.render(heroPet, { layout: "hero" });
      const hero = document.getElementById("hero");
      if (hero && heroPet) hero.classList.toggle("has-panel", !heroPet.hidden);   // without a pet panel the text has the whole width
    }
    const toolsCard = document.getElementById("workshop-card");
    if (toolsCard) {
      toolsCard.replaceChildren();
      toolsCard.hidden = !(course && isStudent());
      if (!toolsCard.hidden) {
        const icon = makeElement("span", "train-icon", "🧰");
        const copy = makeElement("div", "train-copy");
        copy.append(makeElement("h3", "", "Verkstad"), makeElement("p", "", "Bygg och prova med platsvärdesblock, bråkstavar, tallinje, balansvåg och rutnät. Inget räknas, du bara leker och förstår."));
        const go = makeElement("button", "primary-button train-go", "Öppna verkstaden");
        go.type = "button";
        go.addEventListener("click", function () { window.GaussicaWorkshop.open(); });
        toolsCard.append(icon, copy, go);
      }
    }
    renderJourneyAndNotebook();
    const trainCard = document.getElementById("train-card");
    if (trainCard) {
      if (course && isStudent()) window.GaussicaFluency.renderCard(trainCard, fluencyRecord(), { open: function () { window.location.hash = "#traning"; } });
      else trainCard.hidden = true;
    }
    const prev = graph.querySelector(".is-next");
    if (prev) prev.classList.remove("is-next");
    if (course) renderInbox();
    if (!card || !course || !isStudent()) {
      if (card) card.hidden = true;
      renderHeroMain(null, null);
      updateStartPage();
      return;
    }
    ensureReviewSchedule();
    const next = window.GaussicaCoach.nextStep(coachContext());
    const review = window.GaussicaCoach.reviewPlan(coachContext());
    const assigned = window.GaussicaMailbox.openLessonAssignments()[0];
    const data = window.GaussicaCoach.path(coachContext(), assigned && assigned.a.lessonId);
    card.hidden = false;
    renderHeroMain(data, assigned);
    window.GaussicaPathView.render(card, data, {
      hideNow: true,
      assignment: assigned || null,
      reviewLessons: review.lessons,
      dueLessons: review.due,
      placementTest: isStudent() ? function () { window.location.hash = "#nivatest"; } : null,
      start: function (id) { window.location.hash = "#play/" + id; },
      more: showLessonPanel,
      review: function () { window.location.hash = "#review"; }
    });

    // the node of the current step glows in the full map, and the hero button leads to it
    if (data.now) {
      const node = graph.querySelector('[data-lesson-id="' + data.now.lesson.id + '"]');
      if (node) node.classList.add("is-next");
    }
    updateStartPage();
    if (hero) {
      if (assigned) {
        hero.textContent = "Gör uppdraget →";
        hero.setAttribute("href", "#play/" + assigned.lesson.id);
      } else if (next.kind === "done") {
        hero.textContent = "Hitta nästa steg ↓";
        hero.setAttribute("href", "#larstig");
      } else {
        hero.textContent = (next.kind === "continue" ? "Fortsätt här" : "Börja här") + " →";
        hero.setAttribute("href", "#play/" + next.lesson.id);
      }
    }
  }

  // The hero: for a student a greeting and the step of the day (with its button) next to the pet panel; for everyone else (a teacher, or
  // before the course has loaded) the headline and a button to the learning path.
  let heroGeneric = null;

  function firstName(name) { return String(name || "").trim().split(/\s+/)[0] || ""; }

  function renderHeroMain(data, assigned) {
    const title = document.getElementById("hero-title");
    const desc = document.getElementById("hero-description");
    const step = document.getElementById("hero-step");
    const actions = document.getElementById("hero-actions");
    if (!title || !step) return;
    if (!heroGeneric) heroGeneric = title.innerHTML;
    if (!data || !currentUser) {
      title.innerHTML = heroGeneric;
      step.hidden = true;
      step.replaceChildren();
      if (desc) desc.hidden = false;
      if (actions) actions.hidden = false;
      return;
    }
    const name = firstName(currentUser.name);
    const ask = data.now ? (data.now.kind === "assignment" ? "Din lärare har ett uppdrag åt dig."
      : data.now.kind === "continue" ? "Redo att fortsätta där du slutade?" : "Redo för ett första steg?") : "Vad vill du göra härnäst?";
    title.textContent = "";
    title.append(document.createTextNode("Hej" + (name ? " " + name : "") + "!"), document.createElement("br"), makeElement("span", "", ask));
    if (desc) desc.hidden = true;
    if (actions) actions.hidden = true;
    step.hidden = false;
    window.GaussicaPathView.heroStep(step, data, { assignment: assigned || null, peek: function (kind) { return window.GaussicaPet.peek(kind); }, start: function (id) { window.location.hash = "#play/" + id; } });
  }

  // The start page is kept calm: "Idag" has the rest of the path (the step of the day is in the hero above it), and the rest (the notebook, the road, the training and
  // the workshop) is gathered under "Mer att utforska", which is closed unless the student has opened it before.
  const MORE_KEY = "gaussica.more-open";
  const MORE_NAMES = { "knep-card": "Mina knepiga", "journey-card": "Resan", "train-card": "Snabbträning", "workshop-card": "Verkstad" };

  function updateStartPage() {
    const today = document.getElementById("today");
    const more = document.getElementById("more-cards");
    if (today) today.hidden = ["next-card"].every(function (id) { const e = document.getElementById(id); return !e || e.hidden; });
    if (!more) return;
    const shown = Array.prototype.filter.call(more.querySelectorAll(".more-body > *"), function (c) { return !c.hidden; });
    more.hidden = !shown.length;
    const peek = document.getElementById("more-peek");
    if (peek) peek.textContent = shown.map(function (c) { return MORE_NAMES[c.id]; }).filter(Boolean).join(" · ");
    // a number on the closed list when there are tricky questions to look at
    const badge = document.getElementById("more-badge");
    const knep = document.getElementById("knep-card");
    if (badge) {
      let n = 0;
      if (knep && !knep.hidden && course && isStudent()) n = window.GaussicaNotebook.entries(notebookContext()).open.length;
      badge.hidden = !n;
      badge.textContent = n ? String(n) : "";
      badge.title = n ? n + (n === 1 ? " knepig fråga" : " knepiga frågor") : "";
    }
    if (!more.dataset.bound) {
      more.dataset.bound = "1";
      try { more.open = window.localStorage.getItem(MORE_KEY) === "1"; } catch (e) { /* closed */ }
      more.addEventListener("toggle", function () { try { window.localStorage.setItem(MORE_KEY, more.open ? "1" : "0"); } catch (e) { /* storage blocked */ } });
    }
  }

  // "Mina knepiga" (notebook.js) and "Resan" (journey.js): the notebook of tricky questions and the road through an area
  function notebookContext() { return { lessons: course.lessons, student: currentUser }; }

  function renderJourneyAndNotebook() {
    const knep = document.getElementById("knep-card");
    const journey = document.getElementById("journey-card");
    const student = Boolean(course && isStudent());
    if (knep) {
      if (student) window.GaussicaNotebook.renderCard(knep, notebookContext(), { open: function () { window.location.hash = "#knepiga"; } });
      else { knep.replaceChildren(); knep.hidden = true; }
    }
    if (journey) {
      if (!student) { journey.replaceChildren(); journey.hidden = true; return; }
      const assigned = window.GaussicaMailbox.openLessonAssignments()[0];
      const data = window.GaussicaCoach.path(coachContext(), assigned && assigned.a.lessonId);
      window.GaussicaJourney.render(journey, coachContext(), {
        nowLessonId: data.now && data.now.lesson.id,
        pet: window.GaussicaPet ? window.GaussicaPet.current() : null,
        petSvg: function (pet, size) { return window.GaussicaPetArt.svg(pet, { bare: true, size: size }); },
        start: function (id) { window.location.hash = "#play/" + id; }
      });
    }
  }

  function saveNotebook(record) {
    record.updatedAt = Date.now();
    lessonProgress[window.GaussicaNotebook.KEY] = record;
    dirtyLessons.add(window.GaussicaNotebook.KEY);
    scheduleSave(300);
  }

  function openNotebook() {
    if (!isStudent()) { window.location.hash = "#larstig"; return; }
    window.GaussicaNotebook.open({
      getContext: notebookContext,
      save: function (record) { saveNotebook(record); renderCoach(); },
      workedExample: workedExampleFor,
      openLesson: function (id) { window.location.hash = "#play/" + id; },
      startRetry: function () { window.location.hash = "#knepiga-trana"; },
      onExit: function () { window.location.hash = "#larstig"; renderCoach(); }
    });
  }

  function openNotebookRound() {
    const options = {
      title: "Mina knepiga",
      backLabel: "Till Mina knepiga",
      backHash: "#knepiga",
      again: function () { openRound("knep", window.GaussicaNotebook.retryRound(notebookContext(), 5), options); }
    };
    openRound("knep", window.GaussicaNotebook.retryRound(notebookContext(), 5), options);
  }

  // Spaced repetition (coach.js): finished lessons get a place in the schedule, and a round of Repetera or Öva mer moves
  // the lessons it asked about up or down in it.
  function saveReview(record) {
    record.updatedAt = Date.now();
    lessonProgress[window.GaussicaCoach.REVIEW_KEY] = record;
    dirtyLessons.add(window.GaussicaCoach.REVIEW_KEY);
    scheduleSave(500);
  }

  function ensureReviewSchedule() {
    if (!course || !isStudent()) return;
    const seeded = window.GaussicaCoach.seedReview(coachContext());
    if (seeded) saveReview(seeded);
  }

  function recordReviewRound(items, results) {
    const outcomes = {};
    items.forEach(function (it) {
      const o = outcomes[it.lessonId] || (outcomes[it.lessonId] = { n: 0, firstTry: 0 });
      o.n += 1;
      if ((results[it.taskId] || {}).firstTry) o.firstTry += 1;
    });
    // only lessons that are in the schedule (finished lessons) move
    const record = window.GaussicaCoach.reviewRecord(currentUser);
    Object.keys(outcomes).forEach(function (id) { if (!record.lessons[id]) delete outcomes[id]; });
    if (Object.keys(outcomes).length) saveReview(window.GaussicaCoach.afterReview(record, outcomes, Date.now()));
  }

  function openRound(kind, items, options) {
    if (!items.length) {
      window.location.hash = options.backHash;
      return;
    }
    items.forEach(function (it) { practiceProblems[it.lessonId + "|" + it.taskId] = it.problem; });
    window.GaussicaPlayer.openSession({
      kind: kind,
      title: options.title,
      items: items,
      backLabel: options.backLabel,
      onExit: function () { window.location.hash = options.backHash; },
      onDone: recordReviewRound,
      again: options.again
    });
  }

  function openPracticeSession(lessonId) {
    const lesson = course.lessons.find(function (l) { return l.id === lessonId; });
    if (!lesson || !window.GaussicaPractice.has(lesson)) {
      window.location.hash = lesson ? "#" + lessonId : "#larstig";
      return;
    }
    const options = {
      title: "Öva mer: " + lesson.title,
      backLabel: "Tillbaka till lektionen",
      backHash: "#" + lessonId,
      again: function () { openRound("practice", window.GaussicaCoach.practiceRound(coachContext(), lesson, 5), options); }
    };
    openRound("practice", window.GaussicaCoach.practiceRound(coachContext(), lesson, 5), options);
  }

  // "Hitta din nivå": a short adaptive test that marks what the student already knows (placement.js)
  function openPlacementTest() {
    if (!isStudent()) { window.location.hash = "#larstig"; return; }
    window.GaussicaPlacement.open({
      container: document.querySelector("#lesson-player"),
      lessons: function () { return course.lessons; },
      getLesson: function (id) { return course.lessons.find(function (l) { return l.id === id; }); },
      renderVisuals: renderVisualsFor,
      student: currentUser,
      save: function (result) {
        result.updatedAt = Date.now();
        lessonProgress.placement = result;
        dirtyLessons.add("placement");
        scheduleSave(100);
        renderGraph();
      },
      openLesson: function (id) { window.location.hash = "#play/" + id; },
      onExit: function () { window.location.hash = "#larstig"; }
    });
  }

  // Snabbträning (fluency.js): short rounds of tables and number facts, route #traning
  function fluencyRecord() {
    const p = currentUser && currentUser.lessonProgress && currentUser.lessonProgress.fluency;
    return p && p.facts ? p : { v: 1, facts: {}, sessions: [] };
  }

  function openFluency() {
    if (!isStudent()) { window.location.hash = "#larstig"; return; }
    window.GaussicaFluency.open({
      container: document.querySelector("#lesson-player"),
      getRecord: fluencyRecord,
      save: function (record) {
        record.updatedAt = Date.now();
        lessonProgress.fluency = record;
        dirtyLessons.add("fluency");
        scheduleSave(300);
      },
      petSay: function (kind) { return window.GaussicaPet.say(kind); },
      onExit: function () { window.location.hash = "#larstig"; renderCoach(); }
    });
  }

  // A prov (generated test) from the teacher: route #prov/<assignment id>
  function openProv(id) {
    const assignment = ((currentUser && currentUser.assignments) || []).find(function (a) { return String(a.id) === String(id) && a.kind === "prov"; });
    if (!isStudent() || !assignment || !assignment.config) { window.location.hash = "#larstig"; return; }
    window.GaussicaProv.open({
      container: document.querySelector("#lesson-player"),
      lessons: function () { return course.lessons; },
      getLesson: function (lid) { return course.lessons.find(function (l) { return l.id === lid; }); },
      renderVisuals: renderVisualsFor,
      student: currentUser,
      allowsExpression: function (lesson, problem) { return window.GaussicaLesson.allowsExpression(lesson, problem, course.lessons); },
      formNote: answerFormNote,
      save: function (key, record) {
        lessonProgress[key] = record;
        dirtyLessons.add(key);
        scheduleSave(300);
        window.GaussicaMailbox.render(document.getElementById("mailbox"));
      },
      onExit: function () { window.location.hash = "#larstig"; renderCoach(); }
    }, assignment);
  }

  function openReviewSession() {
    const options = {
      title: "Repetera",
      backLabel: "Till lärstigen",
      backHash: "#larstig",
      again: function () { openRound("review", window.GaussicaCoach.reviewRound(coachContext(), 6), options); }
    };
    openRound("review", window.GaussicaCoach.reviewRound(coachContext(), 6), options);
  }

  function addSection(parent, eyebrow, heading, text) {
    const section = makeElement("section", "explanation-section");
    section.append(
      makeElement("p", "eyebrow", eyebrow),
      makeElement("h3", "", heading),
      makeElement("p", "body-copy", text)
    );
    parent.appendChild(section);
    return section;
  }

  // What an interactive tool needs from the app: a way to draw figures, and (inside a lesson
  // that is being taken, not in the editor preview) to remember which challenges are done.
  function toolContext(lesson, compIndex) {
    const taskId = function (goalId) { return "goal-" + compIndex + "-" + goalId; };
    return {
      renderVisual: renderSingleVisualContent,
      isGoalDone: lesson ? function (goalId) {
        const entry = getLessonProgress(lesson.id).answers[taskId(goalId)];
        return Boolean(entry && entry.completed);
      } : null,
      onGoal: lesson ? function (goalId) { storeGoalProgress(lesson.id, taskId(goalId)); } : null
    };
  }

  // A challenge reached in an interactive tool counts as a completed task (no attempt log: nothing is "submitted").
  function storeGoalProgress(lessonId, taskId) {
    const progress = getLessonProgress(lessonId);
    const lesson = course.lessons.find(function (item) { return item.id === lessonId; });
    progress.started = true;
    progress.updatedAt = Date.now();
    progress.answers[taskId] = { answer: "klart", scratchpad: "", feedback: "", feedbackType: "correct", completed: true };
    progress.completed = window.GaussicaLesson.tasks(lesson).every(function (task) {
      const entry = progress.answers[task.id];
      return entry && entry.completed;
    });
    dirtyLessons.add(lessonId);
    scheduleSave(100);
    updateNodeProgress(lessonId);
  }

  // `lesson` is optional: when given, "problem" components become real, answerable
  // tasks that store progress. Without it (editor preview) they render statically.
  function renderLessonComponents(parent, components, lesson, firstIndex) {
    if (!Array.isArray(components) || components.length === 0) return;

    components.forEach(function (comp, offset) {
      if (!comp) return;
      const compIndex = offset + (firstIndex || 0);
      if (comp.type === "problem" && lesson && window.GaussicaLesson.isTaskComponent(comp)) {
        renderProblem(parent, lesson, comp, "component-" + compIndex, "UPPGIFT");
        return;
      }
      if (window.GaussicaPyssel && window.GaussicaPyssel.supports(comp.type)) {
        parent.appendChild(window.GaussicaPyssel.render(comp, toolContext(lesson, compIndex)));
        return;
      }
      if (comp.type === "begreppskort") {
        parent.appendChild(renderConceptCards(comp));
        return;
      }
      if (window.GaussicaFigures && window.GaussicaFigures.supports(comp.type)) {   // a figure used as a block between the text
        parent.appendChild(renderVisualComponent(comp));
        return;
      }
      const div = makeElement("div", "custom-component component-" + comp.type);
      
      switch (comp.type) {
        case "text":
          div.appendChild(makeElement("p", "", comp.text || ""));
          break;
          
        case "heading":
          const level = comp.level || 1;
          const headingTag = "h" + (level + 2);
          div.appendChild(makeElement(headingTag, "", comp.text || ""));
          break;
          
        case "rule":
          div.className = "custom-component rule-card";
          div.append(
            makeElement("span", "rule-label", comp.label || "REGEL"),
            makeElement("span", "rule-equation", comp.formula || ""),
            makeElement("span", "rule-example", comp.example || "")
          );
          break;
          
        case "diagram":
          div.className = "custom-component diagram-component";
          if (comp.title) {
            div.appendChild(makeElement("h4", "", comp.title));
          }
          if (comp.subtitle) {
            div.appendChild(makeElement("p", "diagram-subtitle", comp.subtitle));
          }
          // Render chart based on diagramType
          if (comp.data && Array.isArray(comp.data)) {
            const cfg = {
              type: comp.diagramType || "stapeldiagram",
              data: comp.data,
              unit: comp.unit || "",
              title: comp.title,
              subtitle: comp.subtitle
            };
            const chartEl = renderVisualComponent(cfg);
            if (chartEl) div.appendChild(chartEl);
          }
          break;
          
        case "slider":
          div.className = "custom-component slider-component";
          (function () {
            const min = Number(comp.min !== undefined ? comp.min : 0);
            const max = Number(comp.max !== undefined ? comp.max : 100);
            const unit = comp.unit ? " " + comp.unit : "";
            const readout = makeElement("strong", "slider-value", "");
            const input = document.createElement("input");
            input.type = "range";
            input.min = String(min);
            input.max = String(max);
            input.step = String(Number(comp.step) || 1);
            input.value = String(comp.start !== undefined ? Number(comp.start) : min);
            const label = makeElement("label", "slider-label", (comp.label || "Prova själv") + ": ");
            const update = function () { readout.textContent = input.value + unit; };
            input.addEventListener("input", update);
            update();
            label.appendChild(readout);
            div.append(label, input);
          }());
          break;

        case "problem":
          div.className = "custom-component problem-component";
          div.appendChild(makeElement("p", "", comp.prompt || ""));
          break;
          
        case "santfalskt":   // static view for the editor preview; students get the interactive true/false task
          div.className = "custom-component problem-component";
          div.appendChild(makeElement("p", "", comp.prompt || "Sant eller falskt?"));
          (comp.statements || []).forEach(function (s) { div.appendChild(makeElement("p", "muted", (isTrue(s.answer) ? "✓ Sant: " : "✗ Falskt: ") + s.text)); });
          break;

        case "sortera":   // static views for the editor preview; students get the interactive tasks
        case "ordna":
        case "hittafelet":
        case "lucktext":
          div.className = "custom-component problem-component";
          div.appendChild(makeElement("p", "", (window.GaussicaLesson.FORMATS[comp.type] ? window.GaussicaLesson.FORMATS[comp.type].name + ": " : "") + (comp.prompt || "")));
          if (window.GaussicaFormats) div.appendChild(makeElement("p", "muted", window.GaussicaFormats.summary(window.GaussicaLesson.formatProblem(comp))));
          break;

        case "koppla":   // static view for the editor preview; students get the interactive matching task
          div.className = "custom-component problem-component";
          div.appendChild(makeElement("p", "", comp.prompt || ""));
          (comp.pairs || []).forEach(function (p) { div.appendChild(makeElement("p", "muted", p.term + " ↔ " + p.definition)); });
          break;

        default:
          div.appendChild(makeElement("p", "muted", "[" + comp.type + "]"));
      }
      
      parent.appendChild(div);
    });
  }

  // A button that does its work without taking the focus from the field the student is typing in. On a phone, the focus leaving the
  // field closes the keyboard; the click still comes, and the field keeps its cursor.
  function keepFocus(button) {
    const hold = function (e) { e.preventDefault(); };
    button.addEventListener("pointerdown", hold);
    button.addEventListener("mousedown", hold);
  }

  function openLesson(id) {
    const lesson = course.lessons.find(function (item) { return item.id === id; });
    if (!lesson) return;
    activeLessonId = id;
    if (activeArea !== "alla" && activeArea !== lesson.area) {
      activeArea = "alla";
      renderFilters();
    }
    renderGraph();
    renderPanel();
    openPopup();
  }

  // The explanation as a section: the title, a "Problemet" tag when the text begins with the problem, and short paragraphs.
  // A page of a long explanation (step.part of step.parts) shows only its part of the text.
  function renderExplanation(parent, lesson, step) {
    const L = window.GaussicaLesson;
    const parts = L.explanationParts ? L.explanationParts(lesson.explanation) : [[String(lesson.explanation || "")]];
    const paragraphs = step && step.parts ? (parts[step.part] || []) : parts.reduce(function (all, p) { return all.concat(p); }, []);
    const paged = step && step.parts > 1;
    const section = makeElement("section", "explanation-section");
    section.appendChild(makeElement("p", "eyebrow", "FÖRSTÅ IDÉN" + (paged ? " · DEL " + (step.part + 1) + " AV " + step.parts : "")));
    section.appendChild(makeElement("h3", "", lesson.explanationTitle || "Förklaring"));
    const listen = window.GaussicaSpeech && window.GaussicaSpeech.button(function () {
      return (lesson.explanationTitle || "") + ". " + paragraphs.join(" ").replace(/^\s*Problemet:\s*/i, "Problemet: ");
    });
    if (listen) section.appendChild(listen);
    paragraphs.forEach(function (text, i) {
      let body = text;
      if (i === 0 && (!paged || step.part === 0)) {
        const m = /^\s*Problemet:\s*/i.exec(body);
        if (m) {
          body = body.slice(m[0].length);
          section.appendChild(makeElement("span", "pl-tag pl-tag-problem", "🧩 Problemet"));
        }
      }
      section.appendChild(makeElement("p", "body-copy", body));
    });
    parent.appendChild(section);
  }

  function renderBlock(parent, lesson, key, step) {
    if (key === "explanation") {
      renderExplanation(parent, lesson, step);
    } else if (key === "visual") {
      renderVisualsFor(parent, lesson);
    } else if (key === "rule") {
      const rule = makeElement("div", "rule-card");
      rule.style.setProperty("--rule-color", "var(--area-" + lesson.area + ", var(--brand))");   // the card takes the colour of the lesson's area
      rule.append(
        makeElement("span", "rule-label", lesson.ruleLabel),
        makeElement("span", "rule-equation", lesson.rule),
        makeElement("span", "rule-example", lesson.example)
      );
      parent.appendChild(rule);
    } else if (key === "interactive") {
      renderInteractiveModel(parent, lesson.interactive);
    } else if (key === "exercise") {
      renderProblem(parent, lesson, lesson.exercise, "exercise", "DIN TUR");
    } else if (key === "patterns") {
      lesson.problemPatterns.forEach(function (pattern) {
        const problems = generateProblemSet(lesson, pattern.id, 8);
        if (problems.length > 0) {
          const patternUI = renderProblemPatternUI(lesson, pattern.id, problems);
          if (patternUI) parent.appendChild(patternUI);
        }
      });
    } else if (key.indexOf("comp:") === 0) {
      const index = Number(key.slice(5));
      renderLessonComponents(parent, [lesson.components[index]], lesson, index);
    } else if (key.indexOf("word:") === 0) {
      const index = Number(key.slice(5));
      renderProblem(parent, lesson, lesson.wordProblems[index], "word-" + index, "TEXTUPPGIFT " + (index + 1));
    }
  }

  // The lesson itself is taken in the player (one question at a time); the panel shows
  // what is in it, how it is going, and a start/continue button.
  function renderLessonOverview(parent, lesson) {
    const L = window.GaussicaLesson;
    renderProgressStrip(parent, lesson);
    if (isStudent()) {
      const banner = window.GaussicaMailbox.banner(lesson.id);
      if (banner) parent.appendChild(banner);
      const comments = window.GaussicaMailbox.inline(lesson.id, null);
      if (comments) parent.appendChild(comments);
    } else if (isGuide(currentUser)) {
      const give = makeElement("button", "secondary-button give-assignment", "📌 Ge som uppdrag");
      give.type = "button";
      give.addEventListener("click", function () {
        window.GaussicaTeacher.prefillAssignment(lesson.id);
        window.location.hash = "#admin";
      });
      parent.appendChild(give);
    }
    const steps = L.steps(lesson);
    const progress = getLessonProgress(lesson.id);
    const questions = steps.filter(function (st) { return st.type === "question"; });
    const state = summarizeLesson(lesson).state;

    const card = makeElement("section", "start-card");
    const copy = makeElement("div", "start-card-copy");
    const isPlay = lesson.kind === "pyssel";
    const tools = (lesson.components || []).filter(L.isTool).length;
    const goalCount = L.tasks(lesson).filter(function (t) { return t.goal; }).length;
    const countText = isPlay
      ? tools + (tools === 1 ? " pyssel" : " pyssel") + " · " + goalCount + (goalCount === 1 ? " utmaning" : " utmaningar") + " · " + questions.length + (questions.length === 1 ? " fråga" : " frågor")
      : questions.length + (questions.length === 1 ? " fråga" : " frågor") + " · " + (lesson.duration || "");
    copy.append(
      makeElement("p", "eyebrow", (isPlay ? "PYSSLA · " : "") + (state === "complete"
        ? "KLAR" + (window.GaussicaRewards.enabled() ? " · " + window.GaussicaRewards.starsText(window.GaussicaRewards.lessonStars(lesson).stars) : "")
        : state === "new" ? "REDO ATT STARTA" : "DU HAR PÅBÖRJAT")),
      makeElement("h3", "", countText)
    );
    const startBtn = makeElement("button", "primary-button start-button",
      isPlay ? (state === "complete" ? "Pyssla igen" : state === "new" ? "Börja pyssla" : "Fortsätt pyssla")
        : (state === "complete" ? "Gå igenom igen" : state === "new" ? "Starta lektionen" : "Fortsätt lektionen"));
    startBtn.type = "button";
    startBtn.addEventListener("click", function () {
      window.GaussicaPlayer.open(lesson.id, state === "complete" ? { step: 0 } : undefined);
    });
    const actions = makeElement("div", "start-actions");
    actions.appendChild(startBtn);
    if (window.GaussicaPractice.has(lesson)) {
      const practiceBtn = makeElement("button", "secondary-button start-practice", "Öva mer");
      practiceBtn.type = "button";
      practiceBtn.title = "Nya uppgifter i samma stil, med nya tal";
      practiceBtn.addEventListener("click", function () { window.location.hash = "#practice/" + lesson.id; });
      actions.appendChild(practiceBtn);
    }
    card.append(copy, actions);
    parent.appendChild(card);

    const list = makeElement("ol", "step-list");
    steps.forEach(function (st, index) {
      const item = makeElement("li", "step-list-item");
      const btn = makeElement("button", "step-list-btn");
      btn.type = "button";
      let status = "";
      let title;
      if (st.type === "learn") {
        title = "Läs: " + st.titles.join(" · ");
        status = "read";
      } else {
        const entry = progress.answers && progress.answers[st.task.id];
        status = entry && entry.completed ? "done" : (entry && (entry.answer || entry.feedbackType)) ? "fix" : "todo";
        title = "Fråga " + st.number + ": " + (st.task.problem.prompt || "").slice(0, 80);
      }
      btn.append(
        makeElement("span", "step-dot is-" + status, status === "done" ? "✓" : status === "fix" ? "!" : status === "read" ? "¶" : String(st.number)),
        makeElement("span", "step-title", title)
      );
      btn.addEventListener("click", function () { window.GaussicaPlayer.open(lesson.id, { step: index }); });
      item.appendChild(btn);
      list.appendChild(item);
    });
    parent.appendChild(list);
    // a caregiver gets help to explain the lesson (not while the site is shown as a student sees it)
    if (currentUser && currentUser.role === "caregiver" && !previewAsStudent && window.GaussicaParentGuide) parent.appendChild(window.GaussicaParentGuide.render(lesson));
  }

  function summarizeLesson(lesson) {
    return window.GaussicaLesson.summarize(lesson, getLessonProgress, course.lessons);
  }

  // Compact "x av y klara · n att rätta" bar at the top of a lesson.
  function buildProgressStrip(lesson) {
    const summary = summarizeLesson(lesson);
    if (!summary.total) return null;
    const strip = makeElement("div", "progress-strip");
    strip.setAttribute("role", "img");
    strip.setAttribute("aria-label", window.GaussicaLesson.describe(summary));
    const bar = makeElement("div", "progress-strip-bar");
    summary.statuses.forEach(function (status) {
      bar.appendChild(makeElement("span", "progress-strip-seg is-" + status));
    });
    strip.append(bar, makeElement("span", "progress-strip-text", window.GaussicaLesson.describe(summary)));
    return strip;
  }

  function renderProgressStrip(parent, lesson) {
    const strip = buildProgressStrip(lesson);
    if (strip) parent.appendChild(strip);
  }

  // Updates the strip in place after an answer (re-rendering the panel would clear the answer fields).
  function refreshProgressStrip() {
    const old = panel.querySelector(".progress-strip");
    const lesson = course.lessons.find(function (item) { return item.id === activeLessonId; });
    const fresh = old && lesson ? buildProgressStrip(lesson) : null;
    if (fresh) old.replaceWith(fresh);
  }

  function renderPanel() {
    renderPanelContent();
    updatePanelVisibility();
  }

  function renderPanelContent() {
    panel.replaceChildren();
    const lesson = course.lessons.find(function (item) { return item.id === activeLessonId; });
    if (!lesson) {
      const area = course.areas.find(function (item) { return item.id === activeArea; });
      panel.append(
        makeElement("span", "panel-kicker", "LÄRSTIG PÅ VÄG"),
        makeElement("h3", "panel-title", area ? area.name : "Välj en lektion"),
        makeElement("p", "body-copy", course.areaNotes[activeArea] || "Välj ett område eller en annan lektion i lärandegrafen.")
      );
      return;
    }

    // Check if this is a parent lesson with sub-lessons
    const isParent = lesson.isParentLesson && lesson.subLessons && lesson.subLessons.length > 0;
    
    popupCard.setAttribute("aria-label", lesson.title);
    const header = makeElement("div", "panel-header");
    const metadata = makeElement("div", "panel-metadata");
    metadata.append(
      makeElement("span", "panel-kicker", (areas.get(lesson.area) || lesson.area).toUpperCase()),
      makeElement("span", "panel-duration", lesson.duration)
    );
    header.append(metadata, makeElement("span", "lesson-level panel-grade", lesson.level));
    panel.append(
      header,
      makeElement("h3", "panel-title", lesson.title),
      makeElement("p", "panel-summary", lesson.summary)
    );

    const prerequisites = makeElement("div", "prerequisite-box");
    prerequisites.appendChild(makeElement("span", "prerequisite-label", "BYGGER VIDARE PÅ"));
    if (lesson.prerequisites.length) {
      lesson.prerequisites.forEach(function (id) {
        const prerequisite = course.lessons.find(function (item) { return item.id === id; });
        if (!prerequisite) return;
        const button = makeElement("button", "prerequisite-tag prerequisite-link", prerequisite.title + " ↖");
        button.type = "button";
        button.addEventListener("click", function () { openLesson(id); });
        prerequisites.appendChild(button);
      });
    } else {
      prerequisites.appendChild(makeElement("span", "prerequisite-tag", "Börja här, inga förkunskaper behövs"));
    }
    panel.appendChild(prerequisites);

    // If this is a parent lesson with sub-lessons, show sub-lesson navigation instead of content
    if (isParent) {
      addSection(panel, "UTFORSKA", "Delpunkter i detta område", lesson.explanation || "Denna lektion innehåller flera fokuserade delpunkter. Välj en nedan för att börja.");
      
      const subLessonContainer = makeElement("div", "sub-lessons-container");
      subLessonContainer.appendChild(makeElement("span", "sub-lessons-label", "VÄLJ ETT FOKUSOMRÅDE"));
      
      const subLessonGrid = makeElement("div", "sub-lessons-grid");
      lesson.subLessons.forEach(function (subLessonRef) {
        const subLesson = course.lessons.find(function (l) { return l.id === subLessonRef.id; });
        if (!subLesson) return;
        
        const card = makeElement("button", "sub-lesson-card");
        card.type = "button";
        card.addEventListener("click", function () { openLesson(subLesson.id); });
        
        card.append(
          makeElement("span", "sub-lesson-sequence", subLessonRef.sequence ? "Steg " + subLessonRef.sequence : ""),
          makeElement("h4", "sub-lesson-title", subLesson.title),
          makeElement("p", "sub-lesson-duration", subLesson.duration || ""),
          makeElement("p", "sub-lesson-progress state-" + summarizeLesson(subLesson).state, window.GaussicaLesson.describe(summarizeLesson(subLesson))),
          makeElement("span", "sub-lesson-arrow", "→")
        );
        subLessonGrid.appendChild(card);
      });
      subLessonContainer.appendChild(subLessonGrid);
      panel.appendChild(subLessonContainer);
      
      return;
    }

    // For sub-lessons, show breadcrumb navigation back to parent
    if (lesson.parentId) {
      const breadcrumb = makeElement("div", "breadcrumb-nav");
      const parentLesson = course.lessons.find(function (l) { return l.id === lesson.parentId; });
      if (parentLesson) {
        const parentBtn = makeElement("button", "breadcrumb-link", parentLesson.title);
        parentBtn.type = "button";
        parentBtn.addEventListener("click", function () { openLesson(parentLesson.id); });
        breadcrumb.append(
          parentBtn,
          makeElement("span", "breadcrumb-sep", " › "),
          makeElement("span", "breadcrumb-current", lesson.title)
        );
        panel.appendChild(breadcrumb);
      }
    }

    renderLessonOverview(panel, lesson);

    const nextLessons = course.lessons.filter(function (item) {
      return item.prerequisites.includes(lesson.id);
    });
    if (nextLessons.length) {
      const next = makeElement("div", "next-step");
      next.appendChild(makeElement("span", "next-label", "NÄSTA IDÉ ATT UTFORSKA"));
      nextLessons.forEach(function (item) {
        const button = makeElement("button", "next-link", item.title + " ↗");
        button.type = "button";
        button.addEventListener("click", function () { openLesson(item.id); });
        next.appendChild(button);
      });
      panel.appendChild(next);
    }
  }

  function formatTimestamp(isoString) {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("sv-SE") + " kl. " + d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return isoString;
    }
  }

  function showTeacherLinks() {
    if (!isGuide(currentUser)) return;
    document.querySelectorAll(".admin-top-link, .footer-admin-link").forEach(function (a) { a.hidden = false; });
    applyPreviewUi();
    refreshTeacherChat();
  }

  function renderStudentProfileBar() {
    if (!studentProfileBar) return;
    studentProfileBar.innerHTML = "";
    const current = getActiveStudent();
    if (!current) return;

    const btn = makeElement("button", "student-profile-btn");
    btn.type = "button";
    btn.title = "Mitt konto";

    const avatar = makeElement("span", "student-avatar", current.name.charAt(0).toUpperCase());
    avatar.setAttribute("aria-hidden", "true");
    if (current.color) avatar.style.background = current.color;

    const info = makeElement("div", "student-info");
    info.append(
      makeElement("span", "student-name", current.name),
      makeElement("span", "student-class", (current.role === "teacher" ? "Lärare" : current.role === "caregiver" ? "Vårdnadshavare" : (current.className || "Elev")) + " • Konto ▾")
    );

    btn.append(avatar, info);
    btn.addEventListener("click", openStudentModal);
    studentProfileBar.appendChild(btn);
  }

  function checkRoute() {
    const hash = window.location.hash || "";
    // the pop-up of a lesson stays only for the address of a lesson; any other route (the player, a test, the start) closes it
    if (popupOpen && !(course && course.lessons.some(function (l) { return "#" + l.id === hash; }))) closePopup(true);
    const playId = hash.indexOf("#play/") === 0 ? hash.slice(6) : "";
    const practiceId = hash.indexOf("#practice/") === 0 ? decodeURIComponent(hash.slice(10)) : "";
    if (hash !== "#nivatest" && hash.indexOf("#prov/") !== 0) window.GaussicaTest.closeActive();
    if (hash !== "#traning") window.GaussicaFluency.closeActive();
    if (hash !== "#knepiga") window.GaussicaNotebook.closeActive();
    if (hash === "#knepiga" || hash === "#knepiga-trana") {
      if (adminPage) adminPage.hidden = true;
      if (studentView) studentView.hidden = false;
      if (hash === "#knepiga") { window.GaussicaPlayer.close(true); openNotebook(); } else openNotebookRound();
      return;
    }
    if (hash === "#traning") {
      if (adminPage) adminPage.hidden = true;
      if (studentView) studentView.hidden = false;
      window.GaussicaPlayer.close(true);
      openFluency();
      return;
    }
    const provMatch = /^#prov\/(\d+)$/.exec(hash);
    if (provMatch) {
      if (adminPage) adminPage.hidden = true;
      if (studentView) studentView.hidden = false;
      window.GaussicaPlayer.close(true);
      openProv(provMatch[1]);
      return;
    }
    if (hash === "#nivatest") {
      if (adminPage) adminPage.hidden = true;
      if (studentView) studentView.hidden = false;
      window.GaussicaPlayer.close(true);
      openPlacementTest();
      return;
    }
    if (practiceId || hash === "#review") {
      if (adminPage) adminPage.hidden = true;
      if (studentView) studentView.hidden = false;
      if (practiceId) openPracticeSession(practiceId); else openReviewSession();
      return;
    }
    if (playId) {
      if (adminPage) adminPage.hidden = true;
      if (studentView) studentView.hidden = false;
      window.GaussicaPlayer.open(decodeURIComponent(playId), undefined, true);
      return;
    }
    window.GaussicaPlayer.close(true);
    if (hash === "#admin" || hash.startsWith("#admin/")) {
      if (!isGuide(currentUser)) {
        window.location.hash = "#larstig";
        return;
      }
      if (previewAsStudent) setPreview(false);
      if (studentView) studentView.hidden = true;
      if (adminPage) {
        adminPage.hidden = false;
        renderAdminPage(true);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      if (adminPage) adminPage.hidden = true;
      if (studentView) studentView.hidden = false;
      if (hash === "#uppdrag") {
        const box = document.getElementById("mailbox");
        if (box && !box.hidden) box.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (hash && hash !== "#start" && hash !== "#larstig") {
        const lessonId = hash.replace(/^#/, "");
        if (course && course.lessons.some(function (l) { return l.id === lessonId; })) {
          openLesson(lessonId);
        }
      }
    }
  }

  // What the modules need from this file: the page state (as functions where it changes) and the functions that keep the progress.
  window.GaussicaVisuals.init({
    dirtyLessons: dirtyLessons, scheduleSave: scheduleSave, getLessonProgress: getLessonProgress, updateNodeProgress: updateNodeProgress,
    getActiveLessonId: function () { return activeLessonId; }
  });
  window.GaussicaQuestions.init({
    questionShownAt: questionShownAt, drawings: drawings, practiceProblems: practiceProblems, isPractice: isPractice, savedEntry: savedEntry,
    storeCanvas: storeCanvas, storeAnswerProgress: storeAnswerProgress, isStudent: isStudent, renderVisualsFor: renderVisualsFor, keepFocus: keepFocus,
    answerFormNote: answerFormNote, getCourse: function () { return course; }
  });
  window.GaussicaAccount.init({
    studentModal: studentModal, studentModalCard: studentModalCard, API: API, dirtyLessons: dirtyLessons, pendingAttempts: pendingAttempts,
    getActiveStudent: getActiveStudent, isGuide: isGuide, outboxKey: outboxKey, scheduleSave: scheduleSave, flushProgress: flushProgress,
    getAllProgress: function () { return lessonProgress; }
  });
  window.GaussicaAdminPage.init({
    adminPage: adminPage, API: API, isGuide: isGuide, markChatRead: markChatRead, renderVisualsFor: renderVisualsFor, formatTimestamp: formatTimestamp,
    getCourse: function () { return course; }, getUser: function () { return currentUser; }
  });

  (async function start() {
    try {
      const user = await window.GaussicaAuth.ensureLoggedIn();
      await loadUserData(user);
      await loadCourse();
    } catch (error) {
      showError(error);
    }
  }());
}());
