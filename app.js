(function () {
  "use strict";

  const filters = document.querySelector("#area-filters");
  const graph = document.querySelector("#lesson-graph");
  const panel = document.querySelector("#lesson-panel");
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

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) {
      if (window.GaussicaText) window.GaussicaText.set(element, text); else element.textContent = text;
    }
    return element;
  }

  // For a right answer written in the wrong form: what to tell the student (empty = fine).
  function answerFormNote(form, raw) {
    const MS = window.MATTE_SYMBOLIC;
    const text = String(raw);
    if (form === "blandad") {
      if (text.indexOf("/") >= 0 && !(MS && MS.isMixed(text))) return "Det stämmer, men skriv svaret i blandad form, med hela talet först, till exempel 1 3/4.";
    } else if (form === "brak") {
      if (MS && MS.isMixed(text)) return "Det stämmer, men skriv svaret som ett bråk, utan hela tal framför.";
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

  async function loadUserData(user) {
    const data = await API.get("/api/me/data");
    currentUser = Object.assign({}, user, {
      lessonProgress: data.progress || {}, attempts: data.attempts || [],
      assignments: data.assignments || [], feedback: data.feedback || []
    });
    lessonProgress = currentUser.lessonProgress;
    window.GaussicaUser = currentUser;
  }

  function showSaveNotice(text) {
    if (progressNotice) progressNotice.textContent = text;
  }

  function handleSaveError(error) {
    if (error.status === 401) {
      showSaveNotice("Du har loggats ut och dina senaste svar sparades inte. Ladda om sidan och logga in igen.");
      return;
    }
    showSaveNotice("Kunde inte spara just nu, försöker igen om en stund…");
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
    return Promise.all(sends);
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

  window.addEventListener("pagehide", function () { flushProgress(true); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushProgress(true);
  });

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
        taskName: practice ? (/^REPETERA/.test(labelText || "") ? "Repetera" : "Öva mer") : (labelText || taskId),
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

  async function loadCourse() {
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
    course = { areas: manifest.areas, areaNotes: manifest.areaNotes || {}, lessons: lessons };
    
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
      goToLesson: function (id) { window.location.hash = "#" + id; },
      goToPlayer: function (id) { window.location.hash = "#play/" + id; },
      hasPractice: function (id) { const l = course.lessons.find(function (x) { return x.id === id; }); return window.GaussicaPractice.has(l); },
      startPractice: function (id) { window.location.hash = "#practice/" + id; }
    });
    window.GaussicaMailbox.init({
      getUser: function () { return currentUser; },
      getCourse: function () { return course; },
      getProgress: getLessonProgress,
      openLesson: function (id, step) { window.GaussicaPlayer.open(id, typeof step === "number" ? { step: step } : undefined); },
      markRead: markFeedbackRead,
      startPractice: function (id) { window.location.hash = "#practice/" + id; }
    });
    window.GaussicaRewards.init({
      getUser: function () { return currentUser; },
      getCourse: function () { return course; },
      getProgress: getLessonProgress,
      isActive: isStudent,
      mailbox: window.GaussicaMailbox
    });
    course.areas.forEach(function (area) { areas.set(area.id, area.name); });
    validateCourse();
    activeLessonId = course.lessons[0] ? course.lessons[0].id : "";
    initPreview();
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
  let panelShown = true;   // the lesson panel is hidden for students until they ask for "Mer om lektionen"

  function readMapPref() {
    try { return window.localStorage.getItem(MAP_KEY) === "open"; } catch (e) { return false; }
  }

  function initMapState() {
    const student = isStudent();
    mapOpen = student ? readMapPref() : true;
    panelShown = !student;
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
    if (panel) panel.hidden = !(mapOpen || panelShown);
  }

  function showLessonPanel(id) {
    panelShown = true;
    openLesson(id);
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderGraph() {
    if (!mapOpen) { renderCoach(); return; }
    window.GaussicaGraph.render({
      container: graph,
      lessons: getVisibleLessons(),
      allLessons: course.lessons,
      areas: areas,
      depthOf: function (id) { return lessonDepth.get(id); },
      activeId: activeLessonId,
      getProgress: getLessonProgress,
      emptyText: course.areaNotes[activeArea],
      onSelect: function (id) {
        activeLessonId = id;
        panelShown = true;
        renderGraph();
        renderPanel();
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
    renderCoach();
  }

  // ============ "NÄSTA STEG", ÖVA MER OCH REPETERA ============
  function coachContext() {
    return { lessons: course.lessons, student: currentUser, getProgress: getLessonProgress };
  }

  // Teachers can switch to the student's view to see what students see ("Visa som elev").
  const PREVIEW_KEY = "gaussica.preview";
  let previewAsStudent = false;

  function isStudent() {
    return Boolean(currentUser && (currentUser.role === "student" || (currentUser.role === "teacher" && previewAsStudent)));
  }

  function setPreview(on) {
    previewAsStudent = Boolean(on) && Boolean(currentUser && currentUser.role === "teacher");
    try { window.sessionStorage.setItem(PREVIEW_KEY, previewAsStudent ? "1" : "0"); } catch (e) { /* storage blocked */ }
    applyPreviewUi();
    initMapState();
    renderGraph();
    renderPanel();
    renderCoach();
  }

  function applyPreviewUi() {
    const teacher = Boolean(currentUser && currentUser.role === "teacher");
    const sw = document.getElementById("view-switch");
    const banner = document.getElementById("preview-banner");
    const adminLink = document.getElementById("admin-top-link");
    document.body.classList.toggle("is-previewing", previewAsStudent);
    if (sw) {
      sw.hidden = !teacher;
      sw.textContent = previewAsStudent ? "🧑‍🏫 Tillbaka till lärarvyn" : "👀 Visa som elev";
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
    try { previewAsStudent = currentUser && currentUser.role === "teacher" && window.sessionStorage.getItem(PREVIEW_KEY) === "1"; } catch (e) { previewAsStudent = false; }
    applyPreviewUi();
  }

  // The badge in the top bar, the big box under it and the pins on assigned lessons in the graph.
  function renderInbox() {
    const box = document.getElementById("mailbox");
    const link = document.getElementById("mail-link");
    Array.prototype.forEach.call(graph.querySelectorAll(".gn-pin"), function (p) { p.remove(); });
    Array.prototype.forEach.call(graph.querySelectorAll(".has-assignment"), function (n) { n.classList.remove("has-assignment"); });
    if (!course || !isStudent()) {
      if (box) box.hidden = true;
      if (link) link.hidden = true;
      window.GaussicaRewards.check();
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

  // Picks up new assignments and comments without a page reload.
  async function refreshInbox() {
    if (!isStudent() || document.visibilityState === "hidden") return;
    try {
      const data = await API.get("/api/me/data");
      currentUser.assignments = data.assignments || [];
      currentUser.feedback = data.feedback || [];
      renderCoach();
    } catch (e) { /* offline: try again next time */ }
  }
  setInterval(refreshInbox, 120000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") refreshInbox(); });

  // The suggestion card above the graph, the hero button and the highlighted node.
  function renderCoach() {
    const card = document.getElementById("next-card");
    const hero = document.getElementById("hero-cta");
    const prev = graph.querySelector(".is-next");
    if (prev) prev.classList.remove("is-next");
    if (course) renderInbox();
    if (!card || !course || !isStudent()) {
      if (card) card.hidden = true;
      return;
    }
    const next = window.GaussicaCoach.nextStep(coachContext());
    const review = window.GaussicaCoach.reviewPlan(coachContext());
    const assigned = window.GaussicaMailbox.openAssignments()[0];
    const data = window.GaussicaCoach.path(coachContext(), assigned && assigned.a.lessonId);
    card.hidden = false;
    window.GaussicaPathView.render(card, data, {
      assignment: assigned || null,
      reviewLessons: review.lessons,
      start: function (id) { window.location.hash = "#play/" + id; },
      more: showLessonPanel,
      review: function () { window.location.hash = "#review"; }
    });

    // the node of the current step glows in the full map, and the hero button leads to it
    if (data.now) {
      const node = graph.querySelector('[data-lesson-id="' + data.now.lesson.id + '"]');
      if (node) node.classList.add("is-next");
    }
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

  function renderInteractiveModel(parent, config) {
    if (config.type !== "fraction-model") return;
    const model = makeElement("section", "experiment");
    model.setAttribute("aria-labelledby", "experiment-title");
    const heading = makeElement("div", "experiment-heading");
    const headingCopy = makeElement("div");
    headingCopy.append(
      makeElement("h3", "", "Prova själv"),
      makeElement("p", "body-copy", "Ändra täljaren och se hur stor del av helheten du har.")
    );
    heading.append(makeElement("span", "experiment-icon", "↔"), headingCopy);
    headingCopy.id = "experiment-title";

    const controls = makeElement("div", "fraction-controls");
    const numeratorLabel = makeElement("label", "", "Antal delar");
    const numerator = document.createElement("input");
    numerator.type = "range";
    numerator.min = "0";
    numerator.max = "8";
    numerator.value = String(config.numerator || 0);
    numerator.setAttribute("aria-label", "Antal delar, täljare");
    const denominatorLabel = makeElement("label", "", "Delar i helheten");
    const denominator = document.createElement("input");
    denominator.type = "range";
    denominator.min = "2";
    denominator.max = "8";
    denominator.value = String(config.denominator || 4);
    denominator.setAttribute("aria-label", "Delar i helheten, nämnare");
    const fractionValue = makeElement("output", "fraction-value");
    fractionValue.setAttribute("aria-live", "polite");
    const tiles = makeElement("div", "fraction-tiles");
    tiles.setAttribute("role", "img");
    const tileDescription = makeElement("p", "tile-caption");
    tileDescription.setAttribute("aria-live", "polite");
    const saved = getLessonProgress(activeLessonId).interactive;
    let hasInteracted = false;
    numerator.value = String(saved.numerator === undefined ? config.numerator || 0 : saved.numerator);
    denominator.value = String(saved.denominator === undefined ? config.denominator || 4 : saved.denominator);

    function updateModel() {
      let parts = Number(numerator.value);
      const whole = Number(denominator.value);
      if (parts > whole) {
        parts = whole;
        numerator.value = String(whole);
      }
      fractionValue.textContent = parts + "/" + whole;
      tiles.replaceChildren();
      tiles.style.setProperty("--parts", String(whole));
      for (let index = 0; index < whole; index += 1) {
        tiles.appendChild(makeElement("span", index < parts ? "fraction-tile filled" : "fraction-tile"));
      }
      tiles.setAttribute("aria-label", parts + " av " + whole + " lika stora delar markerade");
      tileDescription.textContent = parts + " av " + whole + " lika stora delar är markerade.";
      if (hasInteracted && model.isConnected) {
        const progress = getLessonProgress(activeLessonId);
        progress.started = true;
        progress.interactive = { numerator: parts, denominator: whole };
        dirtyLessons.add(activeLessonId);
        scheduleSave(800);
        updateNodeProgress(activeLessonId);
      }
    }

    numeratorLabel.appendChild(numerator);
    denominatorLabel.appendChild(denominator);
    controls.append(numeratorLabel, denominatorLabel, fractionValue);
    numerator.addEventListener("input", function () {
      hasInteracted = true;
      updateModel();
    });
    denominator.addEventListener("input", function () {
      hasInteracted = true;
      updateModel();
    });
    model.append(heading, controls, tiles, tileDescription);
    parent.appendChild(model);
    updateModel();
  }

  const CHART_PALETTE = [
    "#425b9a", // Djupblå
    "#ff8ca0", // Korall
    "#4fa8dc", // Himmelsblå
    "#f0b04a", // Solgul
    "#8a74c9", // Violett
    "#47b79a", // Mynta
    "#f29a6b", // Persika
    "#7a8db8"  // Dimblå
  ];

  function makeSvg(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) {
      for (const key in attrs) {
        if (attrs[key] !== undefined && attrs[key] !== null) {
          el.setAttribute(key, String(attrs[key]));
        }
      }
    }
    return el;
  }

  function normalizeChartData(config) {
    if (Array.isArray(config.data)) {
      return config.data.map(function (item, index) {
        return {
          label: String(item.label || item.name || item.category || ""),
          value: Number(item.value !== undefined ? item.value : (item.y !== undefined ? item.y : 0)),
          color: item.color || CHART_PALETTE[index % CHART_PALETTE.length]
        };
      });
    }
    if (Array.isArray(config.labels) && Array.isArray(config.values)) {
      return config.labels.map(function (label, index) {
        return {
          label: String(label),
          value: Number(config.values[index] || 0),
          color: (config.colors && config.colors[index]) || CHART_PALETTE[index % CHART_PALETTE.length]
        };
      });
    }
    return [];
  }

  function calculateNiceScale(maxVal) {
    if (maxVal <= 0) return { max: 5, step: 1 };
    if (maxVal <= 5) return { max: 5, step: 1 };
    if (maxVal <= 10) return { max: 10, step: 2 };
    if (maxVal <= 16) return { max: 16, step: 4 };
    if (maxVal <= 20) return { max: 20, step: 5 };
    if (maxVal <= 30) return { max: 30, step: 5 };
    if (maxVal <= 50) return { max: 50, step: 10 };
    if (maxVal <= 100) return { max: 100, step: 20 };
    const rough = maxVal / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    let step = mag;
    if (norm > 5) step = 10 * mag;
    else if (norm > 2) step = 5 * mag;
    else if (norm > 1) step = 2 * mag;
    const max = Math.ceil(maxVal / step) * step;
    return { max: max, step: step };
  }

  function renderBarChart(config) {
    const data = normalizeChartData(config);
    const container = makeElement("div", "chart-wrapper bar-chart-wrapper");
    if (!data.length) return container;

    const unit = config.unit || "";
    const width = 500;
    const height = 230;
    const left = config.yAxis && config.yAxis.label ? 50 : 42;
    const right = 20;
    const top = 28;
    const bottom = config.xAxis && config.xAxis.label ? 46 : 38;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const values = data.map(function (d) { return d.value; });
    const maxVal = Math.max.apply(null, values.concat([1]));
    const scale = calculateNiceScale(config.yAxis && config.yAxis.max ? config.yAxis.max : maxVal);
    const maxY = config.yAxis && config.yAxis.max ? config.yAxis.max : scale.max;
    const step = config.yAxis && config.yAxis.step ? config.yAxis.step : scale.step;

    const svg = makeSvg("svg", {
      viewBox: "0 0 " + width + " " + height,
      class: "chart-svg",
      role: "img",
      "aria-label": config.ariaLabel || (config.title || "Stapeldiagram") + ": " +
        data.map(function (d) { return d.label + " " + d.value + (unit ? " " + unit : ""); }).join(", ")
    });

    if (config.yAxis && config.yAxis.label) {
      const yAxisTitle = makeSvg("text", {
        x: left,
        y: top - 12,
        class: "chart-axis-title",
        "text-anchor": "start"
      });
      yAxisTitle.textContent = config.yAxis.label.toUpperCase();
      svg.appendChild(yAxisTitle);
    }

    const numTicks = Math.round(maxY / step);
    for (let i = 0; i <= numTicks; i += 1) {
      const val = i * step;
      if (val > maxY + 0.0001) break;
      const y = top + plotHeight - (val / maxY) * plotHeight;
      const line = makeSvg("line", {
        x1: left,
        y1: y,
        x2: left + plotWidth,
        y2: y,
        class: i === 0 ? "chart-axis-line" : "chart-grid-line"
      });
      svg.appendChild(line);

      const tick = makeSvg("text", {
        x: left - 8,
        y: y + 4,
        class: "chart-tick-label",
        "text-anchor": "end"
      });
      tick.textContent = String(Math.round(val * 100) / 100);
      svg.appendChild(tick);
    }

    const slotWidth = plotWidth / data.length;
    const barWidth = Math.min(50, Math.max(16, slotWidth * 0.65));

    data.forEach(function (d, i) {
      const barHeight = Math.max(0, (d.value / maxY) * plotHeight);
      const x = left + i * slotWidth + (slotWidth - barWidth) / 2;
      const y = top + plotHeight - barHeight;

      const g = makeSvg("g", { class: "chart-bar-group" });
      const rect = makeSvg("rect", {
        x: x,
        y: y,
        width: barWidth,
        height: barHeight,
        rx: 4,
        ry: 4,
        fill: d.color,
        class: "chart-bar"
      });
      const titleEl = makeSvg("title");
      titleEl.textContent = d.label + ": " + d.value + (unit ? " " + unit : "");
      rect.appendChild(titleEl);

      const valText = makeSvg("text", {
        x: x + barWidth / 2,
        y: y - 6,
        class: "chart-value-label",
        "text-anchor": "middle"
      });
      valText.textContent = String(d.value);

      const catText = makeSvg("text", {
        x: x + barWidth / 2,
        y: top + plotHeight + 17,
        class: "chart-category-label",
        "text-anchor": "middle"
      });
      catText.textContent = d.label;

      g.append(rect, valText, catText);
      svg.appendChild(g);
    });

    if (config.xAxis && config.xAxis.label) {
      const xAxisTitle = makeSvg("text", {
        x: left + plotWidth / 2,
        y: height - 6,
        class: "chart-axis-title",
        "text-anchor": "middle"
      });
      xAxisTitle.textContent = config.xAxis.label.toUpperCase();
      svg.appendChild(xAxisTitle);
    }

    container.appendChild(svg);
    return container;
  }

  function renderPieChart(config) {
    const data = normalizeChartData(config);
    const container = makeElement("div", "chart-wrapper pie-chart-wrapper");
    if (!data.length) return container;

    const unit = config.unit || "";
    const isDonut = config.donut !== false;
    const total = data.reduce(function (sum, d) { return sum + d.value; }, 0);

    const layout = makeElement("div", "pie-layout-row");
    const svgBox = makeElement("div", "pie-svg-box");
    const legend = makeElement("div", "pie-legend");

    const size = 220;
    const cx = size / 2;
    const cy = size / 2;
    const r = 90;
    const rInner = isDonut ? 48 : 0;

    const svg = makeSvg("svg", {
      viewBox: "0 0 " + size + " " + size,
      class: "pie-svg",
      role: "img",
      "aria-label": config.ariaLabel || (config.title || "Cirkeldiagram") + ": " +
        data.map(function (d) {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return d.label + " " + d.value + (unit ? " " + unit : "") + " (" + pct + " %)";
        }).join(", ")
    });

    let currentAngle = -Math.PI / 2;

    data.forEach(function (d, i) {
      const pct = total > 0 ? (d.value / total) : 0;
      const angleSpan = pct * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSpan;
      currentAngle = endAngle;

      const group = makeSvg("g", { class: "pie-slice-group", "data-index": String(i) });

      if (data.length === 1 || pct >= 0.9999) {
        const circle = makeSvg("circle", {
          cx: cx,
          cy: cy,
          r: r,
          fill: d.color,
          class: "pie-slice",
          stroke: "#fffdf7",
          "stroke-width": "2"
        });
        const titleEl = makeSvg("title");
        titleEl.textContent = d.label + ": " + d.value + (unit ? " " + unit : "") + " (100 %)";
        circle.appendChild(titleEl);
        group.appendChild(circle);
      } else if (pct > 0) {
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = angleSpan > Math.PI ? 1 : 0;

        let pathData = "";
        if (isDonut) {
          const xi1 = cx + rInner * Math.cos(endAngle);
          const yi1 = cy + rInner * Math.sin(endAngle);
          const xi2 = cx + rInner * Math.cos(startAngle);
          const yi2 = cy + rInner * Math.sin(startAngle);
          pathData = [
            "M", x1, y1,
            "A", r, r, 0, largeArc, 1, x2, y2,
            "L", xi1, yi1,
            "A", rInner, rInner, 0, largeArc, 0, xi2, yi2,
            "Z"
          ].join(" ");
        } else {
          pathData = [
            "M", cx, cy,
            "L", x1, y1,
            "A", r, r, 0, largeArc, 1, x2, y2,
            "Z"
          ].join(" ");
        }

        const path = makeSvg("path", {
          d: pathData,
          fill: d.color,
          stroke: "#fffdf7",
          "stroke-width": "2",
          class: "pie-slice"
        });
        const titleEl = makeSvg("title");
        titleEl.textContent = d.label + ": " + d.value + (unit ? " " + unit : "") + " (" + Math.round(pct * 100) + " %)";
        path.appendChild(titleEl);
        group.appendChild(path);

        if (pct >= 0.12) {
          const midAngle = startAngle + angleSpan / 2;
          const rText = isDonut ? (r + rInner) / 2 : r * 0.66;
          const tx = cx + rText * Math.cos(midAngle);
          const ty = cy + rText * Math.sin(midAngle) + 4;
          const sliceText = makeSvg("text", {
            x: tx,
            y: ty,
            class: "pie-slice-label",
            "text-anchor": "middle"
          });
          sliceText.textContent = Math.round(pct * 100) + "%";
          group.appendChild(sliceText);
        }
      }

      svg.appendChild(group);

      const legendItem = makeElement("div", "pie-legend-item");
      legendItem.dataset.index = String(i);
      const swatch = makeElement("span", "pie-legend-swatch");
      swatch.style.backgroundColor = d.color;
      const label = makeElement("span", "pie-legend-label", d.label);
      const valSpan = makeElement("span", "pie-legend-value", String(d.value) + (unit ? " " + unit : ""));
      const pctSpan = makeElement("span", "pie-legend-pct", "(" + Math.round(pct * 100) + " %)");

      legendItem.append(swatch, label, valSpan, pctSpan);

      legendItem.addEventListener("mouseenter", function () {
        group.classList.add("is-hovered");
        legendItem.classList.add("is-hovered");
      });
      legendItem.addEventListener("mouseleave", function () {
        group.classList.remove("is-hovered");
        legendItem.classList.remove("is-hovered");
      });
      group.addEventListener("mouseenter", function () {
        legendItem.classList.add("is-hovered");
        group.classList.add("is-hovered");
      });
      group.addEventListener("mouseleave", function () {
        legendItem.classList.remove("is-hovered");
        group.classList.remove("is-hovered");
      });

      legend.appendChild(legendItem);
    });

    if (isDonut) {
      const centerTotal = makeSvg("text", {
        x: cx,
        y: cy - 2,
        class: "pie-center-total",
        "text-anchor": "middle"
      });
      centerTotal.textContent = String(total);
      const centerLabel = makeSvg("text", {
        x: cx,
        y: cy + 13,
        class: "pie-center-label",
        "text-anchor": "middle"
      });
      centerLabel.textContent = (config.unit || "TOTALT").toUpperCase();
      svg.append(centerTotal, centerLabel);
    }

    svgBox.appendChild(svg);
    layout.append(svgBox, legend);
    container.appendChild(layout);
    return container;
  }

  function renderLineChart(config) {
    const data = normalizeChartData(config);
    const container = makeElement("div", "chart-wrapper line-chart-wrapper");
    if (!data.length) return container;

    const unit = config.unit || "";
    const width = 500;
    const height = 230;
    const left = config.yAxis && config.yAxis.label ? 50 : 42;
    const right = 24;
    const top = 28;
    const bottom = config.xAxis && config.xAxis.label ? 46 : 38;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const values = data.map(function (d) { return d.value; });
    const maxVal = Math.max.apply(null, values.concat([1]));
    const scale = calculateNiceScale(config.yAxis && config.yAxis.max ? config.yAxis.max : maxVal);
    const maxY = config.yAxis && config.yAxis.max ? config.yAxis.max : scale.max;
    const step = config.yAxis && config.yAxis.step ? config.yAxis.step : scale.step;

    const chartId = "line-" + Math.random().toString(36).slice(2, 8);

    const svg = makeSvg("svg", {
      viewBox: "0 0 " + width + " " + height,
      class: "chart-svg",
      role: "img",
      "aria-label": config.ariaLabel || (config.title || "Linjediagram") + ": " +
        data.map(function (d) { return d.label + " " + d.value + (unit ? " " + unit : ""); }).join(", ")
    });

    const defs = makeSvg("defs");
    const grad = makeSvg("linearGradient", {
      id: chartId + "-grad",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    });
    const stop1 = makeSvg("stop", { offset: "0%", "stop-color": "#425b9a", "stop-opacity": "0.22" });
    const stop2 = makeSvg("stop", { offset: "100%", "stop-color": "#425b9a", "stop-opacity": "0.01" });
    grad.append(stop1, stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);

    if (config.yAxis && config.yAxis.label) {
      const yAxisTitle = makeSvg("text", {
        x: left,
        y: top - 12,
        class: "chart-axis-title",
        "text-anchor": "start"
      });
      yAxisTitle.textContent = config.yAxis.label.toUpperCase();
      svg.appendChild(yAxisTitle);
    }

    const numTicks = Math.round(maxY / step);
    for (let i = 0; i <= numTicks; i += 1) {
      const val = i * step;
      if (val > maxY + 0.0001) break;
      const y = top + plotHeight - (val / maxY) * plotHeight;
      const line = makeSvg("line", {
        x1: left,
        y1: y,
        x2: left + plotWidth,
        y2: y,
        class: i === 0 ? "chart-axis-line" : "chart-grid-line"
      });
      svg.appendChild(line);

      const tick = makeSvg("text", {
        x: left - 8,
        y: y + 4,
        class: "chart-tick-label",
        "text-anchor": "end"
      });
      tick.textContent = String(Math.round(val * 100) / 100);
      svg.appendChild(tick);
    }

    const points = data.map(function (d, i) {
      const x = left + (data.length > 1 ? i * (plotWidth / (data.length - 1)) : plotWidth / 2);
      const y = top + plotHeight - (d.value / maxY) * plotHeight;
      return { x: x, y: y, data: d };
    });

    if (points.length > 1) {
      let areaD = "M " + points[0].x + " " + (top + plotHeight) + " L " + points[0].x + " " + points[0].y;
      for (let i = 1; i < points.length; i += 1) {
        areaD += " L " + points[i].x + " " + points[i].y;
      }
      areaD += " L " + points[points.length - 1].x + " " + (top + plotHeight) + " Z";

      const areaPath = makeSvg("path", {
        d: areaD,
        fill: "url(#" + chartId + "-grad)",
        class: "line-chart-area"
      });
      svg.appendChild(areaPath);

      let lineD = "M " + points[0].x + " " + points[0].y;
      for (let j = 1; j < points.length; j += 1) {
        lineD += " L " + points[j].x + " " + points[j].y;
      }
      const linePath = makeSvg("path", {
        d: lineD,
        fill: "none",
        stroke: "#425b9a",
        "stroke-width": "3",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        class: "line-chart-stroke"
      });
      svg.appendChild(linePath);
    }

    points.forEach(function (pt) {
      const g = makeSvg("g", { class: "line-point-group" });
      const circle = makeSvg("circle", {
        cx: pt.x,
        cy: pt.y,
        r: 5,
        fill: "#fffdf7",
        stroke: "#425b9a",
        "stroke-width": "2.5",
        class: "line-point-dot"
      });
      const titleEl = makeSvg("title");
      titleEl.textContent = pt.data.label + ": " + pt.data.value + (unit ? " " + unit : "");
      circle.appendChild(titleEl);

      const valText = makeSvg("text", {
        x: pt.x,
        y: pt.y - 10,
        class: "chart-value-label",
        "text-anchor": "middle"
      });
      valText.textContent = String(pt.data.value);

      const catText = makeSvg("text", {
        x: pt.x,
        y: top + plotHeight + 17,
        class: "chart-category-label",
        "text-anchor": "middle"
      });
      catText.textContent = pt.data.label;

      g.append(circle, valText, catText);
      svg.appendChild(g);
    });

    if (config.xAxis && config.xAxis.label) {
      const xAxisTitle = makeSvg("text", {
        x: left + plotWidth / 2,
        y: height - 6,
        class: "chart-axis-title",
        "text-anchor": "middle"
      });
      xAxisTitle.textContent = config.xAxis.label.toUpperCase();
      svg.appendChild(xAxisTitle);
    }

    container.appendChild(svg);
    return container;
  }

  function renderTable(config) {
    const container = makeElement("div", "table-wrapper");
    const table = makeElement("table", "lesson-table");

    if (config.caption) {
      table.appendChild(makeElement("caption", "visually-hidden", config.caption));
    }

    let headers = config.headers || [];
    let rows = config.rows || [];

    if (!headers.length && config.data && Array.isArray(config.data)) {
      headers = [config.categoryHeader || "Kategori", config.valueHeader || (config.unit ? "Antal (" + config.unit + ")" : "Antal")];
      rows = config.data.map(function (d) {
        return [d.label, String(d.value)];
      });
    }

    if (headers.length) {
      const thead = document.createElement("thead");
      const tr = document.createElement("tr");
      headers.forEach(function (header, i) {
        const th = makeElement("th", "", String(header));
        th.setAttribute("scope", "col");
        if (config.align && config.align[i]) {
          th.classList.add("text-" + config.align[i]);
        } else if (i > 0) {
          th.classList.add("text-right");
        }
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    const tbody = document.createElement("tbody");
    rows.forEach(function (row) {
      const tr = document.createElement("tr");
      const rowArr = Array.isArray(row) ? row : Object.values(row);
      rowArr.forEach(function (cell, i) {
        const td = makeElement("td", "", String(cell));
        const strCell = String(cell).trim();
        const isNumeric = typeof cell === "number" || (!isNaN(Number(strCell)) && !isNaN(parseFloat(strCell))) || strCell.endsWith("%");
        if (config.align && config.align[i]) {
          td.classList.add("text-" + config.align[i]);
        } else if (isNumeric || i > 0) {
          td.classList.add("text-right");
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    if (config.summaryRow || config.footer) {
      const footerRow = config.summaryRow || config.footer;
      const tfoot = document.createElement("tfoot");
      const tr = document.createElement("tr");
      footerRow.forEach(function (cell, i) {
        const td = makeElement("td", "", String(cell));
        if (config.align && config.align[i]) {
          td.classList.add("text-" + config.align[i]);
        } else if (i > 0) {
          td.classList.add("text-right");
        }
        tr.appendChild(td);
      });
      tfoot.appendChild(tr);
      table.appendChild(tfoot);
    }

    container.appendChild(table);
    return container;
  }

  function renderSingleVisualContent(config) {
    if (!config) return null;
    const type = (config.type || "").toLowerCase();
    // Figures first: "tallinje" would otherwise be mistaken for a line chart.
    if (window.GaussicaFigures && window.GaussicaFigures.supports(type)) {
      return window.GaussicaFigures.render(config);
    }
    if (type.includes("stapel") || type.includes("bar")) {
      return renderBarChart(config);
    }
    if (type.includes("cirkel") || type.includes("pie")) {
      return renderPieChart(config);
    }
    if (type.includes("linje") || type.includes("line")) {
      return renderLineChart(config);
    }
    if (type.includes("tabel") || type.includes("table")) {
      return renderTable(config);
    }
    return null;
  }

  function renderVisualComponent(config) {
    if (!config) return null;

    const isTabs = config.type === "tabs" || (Array.isArray(config.views) && config.views.length > 0);
    const card = makeElement("figure", "visual-card");

    const header = makeElement("figcaption", "visual-header");
    const headerCopy = makeElement("div", "visual-header-copy");

    let badgeText = "";
    if (isTabs) {
      badgeText = "DIAGRAM & TABELL";
    } else {
      const type = (config.type || "").toLowerCase();
      if (window.GaussicaFigures && window.GaussicaFigures.supports(type)) badgeText = window.GaussicaFigures.badge(type);
      else if (type.includes("stapel") || type.includes("bar")) badgeText = "STAPELDIAGRAM";
      else if (type.includes("cirkel") || type.includes("pie")) badgeText = "CIRKELDIAGRAM";
      else if (type.includes("linje") || type.includes("line")) badgeText = "LINJEDIAGRAM";
      else if (type.includes("tabel") || type.includes("table")) badgeText = "TABELL";
      else badgeText = "DATA";
    }

    headerCopy.appendChild(makeElement("span", "visual-badge", badgeText));
    if (config.title) {
      headerCopy.appendChild(makeElement("h4", "visual-title", config.title));
    }
    if (config.subtitle) {
      headerCopy.appendChild(makeElement("p", "visual-subtitle", config.subtitle));
    }
    header.appendChild(headerCopy);

    const body = makeElement("div", "visual-body");

    if (isTabs) {
      const views = config.views || [];
      const tabNav = makeElement("div", "visual-tabs-nav");
      tabNav.setAttribute("role", "tablist");
      tabNav.setAttribute("aria-label", config.title || "Välj diagramtyp eller tabell");

      const viewContainers = [];

      views.forEach(function (view, index) {
        const tabTitle = view.tabTitle || view.title || (
          view.type === "stapeldiagram" ? "Stapel" :
          view.type === "cirkeldiagram" ? "Cirkel" :
          view.type === "linjediagram" ? "Linje" :
          view.type === "tabell" ? "Tabell" : ("Vy " + (index + 1))
        );
        const tabBtn = makeElement("button", "visual-tab-btn", tabTitle);
        tabBtn.type = "button";
        tabBtn.setAttribute("role", "tab");
        tabBtn.setAttribute("aria-selected", String(index === 0));

        const viewWrapper = makeElement("div", "visual-tab-panel");
        viewWrapper.setAttribute("role", "tabpanel");
        viewWrapper.hidden = index !== 0;

        const content = renderSingleVisualContent(view);
        if (content) viewWrapper.appendChild(content);
        viewContainers.push(viewWrapper);

        tabBtn.addEventListener("click", function () {
          tabNav.querySelectorAll(".visual-tab-btn").forEach(function (btn) {
            btn.setAttribute("aria-selected", "false");
          });
          tabBtn.setAttribute("aria-selected", "true");
          viewContainers.forEach(function (panel, pIndex) {
            panel.hidden = pIndex !== index;
          });
        });

        tabNav.appendChild(tabBtn);
      });

      header.appendChild(tabNav);
      viewContainers.forEach(function (vc) { body.appendChild(vc); });
    } else {
      const content = renderSingleVisualContent(config);
      if (content) body.appendChild(content);
    }

    card.append(header, body);

    if (config.caption) {
      card.appendChild(makeElement("p", "visual-caption", config.caption));
    }

    return card;
  }

  function renderVisualsFor(parent, target) {
    if (!target) return;
    const configs = [];
    if (target.visual) configs.push(target.visual);
    if (Array.isArray(target.visuals)) {
      configs.push.apply(configs, target.visuals);
    }
    if (target.chart) configs.push(target.chart);
    if (Array.isArray(target.charts)) configs.push.apply(configs, target.charts);
    if (target.diagram) configs.push(target.diagram);
    if (Array.isArray(target.diagrams)) configs.push.apply(configs, target.diagrams);
    if (target.table) configs.push(target.table);
    if (Array.isArray(target.tables)) configs.push.apply(configs, target.tables);

    configs.forEach(function (cfg) {
      const el = renderVisualComponent(cfg);
      if (el) parent.appendChild(el);
    });
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

  // ===== BEGREPP: term cards and the matching test =====
  // { type: "begreppskort", title, intro, cards: [{ term, definition, example }] }
  function renderConceptCards(comp) {
    const box = makeElement("section", "concepts");
    box.appendChild(makeElement("p", "eyebrow", "BEGREPP"));
    box.appendChild(makeElement("h3", "concepts-title", comp.title || "Begreppen i den här lektionen"));
    if (comp.intro) box.appendChild(makeElement("p", "body-copy", comp.intro));
    const grid = makeElement("div", "concept-grid");
    (comp.cards || []).forEach(function (card, i) {
      const c = makeElement("article", "concept-card c" + (i % 6));
      c.appendChild(makeElement("h4", "concept-term", card.term));
      c.appendChild(makeElement("p", "concept-def", card.definition));
      if (card.example) {
        const ex = makeElement("p", "concept-example");
        window.GaussicaText.set(ex, "Exempel: " + card.example);
        c.appendChild(ex);
      }
      grid.appendChild(c);
    });
    box.appendChild(grid);
    return box;
  }

  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Connect each term with its explanation: pick one on each side. A right pair locks in with a colour and number;
  // a wrong pair is logged (so the teacher sees which terms get mixed up) and the student tries again.
  function renderMatching(parent, lesson, exercise, taskId, labelText, opts) {
    const finish = function (isCorrect) { if (opts && opts.onResult) opts.onResult(isCorrect); };
    questionShownAt[lesson.id + "|" + taskId] = Date.now();
    if (isPractice(taskId)) practiceProblems[lesson.id + "|" + taskId] = exercise;
    const saved = savedEntry(lesson.id, taskId);
    const pairs = exercise.pairs;

    const section = makeElement("section", "exercise word-problem match-exercise");
    const headingId = "problem-title-" + lesson.id + "-" + taskId;
    section.setAttribute("aria-labelledby", headingId);
    const heading = makeElement("h3", "", exercise.prompt);
    heading.id = headingId;
    section.append(makeElement("p", "eyebrow", labelText), heading);
    section.appendChild(makeElement("p", "match-help", "Välj ett begrepp och sedan förklaringen som passar. Rätt par får samma färg."));

    const status = makeElement("p", "match-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const board = makeElement("div", "match-board");
    const left = makeElement("div", "match-col");
    const right = makeElement("div", "match-col");
    board.append(left, right);
    const feedback = makeElement("p", "feedback-message", "");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");

    const termBtns = [], defBtns = [];
    const matched = new Set();
    let pickedTerm = -1, pickedDef = -1, order = 0;

    function markPair(t, d) {
      order += 1;
      matched.add(t);
      [termBtns[t], defBtns[d]].forEach(function (b) {
        b.disabled = true;
        b.classList.remove("is-picked");
        b.classList.add("is-done", "pair" + ((order - 1) % 6));
        b.appendChild(makeElement("span", "match-no", String(order)));
      });
    }

    function updateStatus() {
      status.textContent = matched.size + " av " + pairs.length + " rätt";
    }

    function clearPicks() {
      pickedTerm = pickedDef = -1;
      termBtns.concat(defBtns).forEach(function (b) { b.classList.remove("is-picked"); b.setAttribute("aria-pressed", "false"); });
    }

    function tryPair() {
      if (pickedTerm < 0 || pickedDef < 0) return;
      const t = pickedTerm, d = pickedDef;
      if (t === d) {
        clearPicks();
        markPair(t, d);
        updateStatus();
        if (matched.size === pairs.length) {
          window.GaussicaText.set(feedback, exercise.correct);
          feedback.className = "feedback-message feedback-correct";
          storeAnswerProgress(lesson.id, taskId, "Alla " + pairs.length + " par rätt", "", exercise.correct, "correct", true, null, exercise.prompt, labelText);
          finish(true);
        } else {
          feedback.className = "feedback-message";
          feedback.textContent = "";
        }
        return;
      }
      // wrong: remember which term the chosen explanation belongs to
      const wrongBtns = [termBtns[t], defBtns[d]];
      wrongBtns.forEach(function (b) { b.classList.add("is-wrong"); });
      setTimeout(function () { wrongBtns.forEach(function (b) { b.classList.remove("is-wrong"); }); }, 650);
      clearPicks();
      const note = "Inte riktigt. De passar inte ihop. Läs begreppskorten igen och försök på nytt.";
      feedback.className = "feedback-message feedback-hint";
      feedback.textContent = note;
      const shown = pairs[d].definition.length > 80 ? pairs[d].definition.slice(0, 77) + "…" : pairs[d].definition;
      storeAnswerProgress(lesson.id, taskId, pairs[t].term + " = " + shown, "", note, "hint", false,
        "Blandade ihop ”" + pairs[t].term + "” med ”" + pairs[d].term + "”", exercise.prompt, labelText);
      finish(false);
    }

    pairs.forEach(function (p, i) {
      const tb = makeElement("button", "match-item match-term", p.term);
      tb.type = "button";
      tb.setAttribute("aria-pressed", "false");
      tb.addEventListener("click", function () {
        if (matched.has(i)) return;
        const was = pickedTerm === i;
        termBtns.forEach(function (b) { b.classList.remove("is-picked"); b.setAttribute("aria-pressed", "false"); });
        pickedTerm = was ? -1 : i;
        if (!was) { tb.classList.add("is-picked"); tb.setAttribute("aria-pressed", "true"); }
        tryPair();
      });
      termBtns[i] = tb;
      left.appendChild(tb);
    });

    shuffled(pairs.map(function (p, i) { return i; })).forEach(function (i) {
      const db = makeElement("button", "match-item match-def", pairs[i].definition);
      db.type = "button";
      db.setAttribute("aria-pressed", "false");
      db.addEventListener("click", function () {
        if (matched.has(i)) return;
        const was = pickedDef === i;
        defBtns.forEach(function (b) { b.classList.remove("is-picked"); b.setAttribute("aria-pressed", "false"); });
        pickedDef = was ? -1 : i;
        if (!was) { db.classList.add("is-picked"); db.setAttribute("aria-pressed", "true"); }
        tryPair();
      });
      defBtns[i] = db;
      right.appendChild(db);
    });

    section.append(board, status, feedback);
    parent.appendChild(section);
    updateStatus();

    // an already solved test is shown as solved
    if (saved.completed) {
      pairs.forEach(function (p, i) { markPair(i, i); });
      updateStatus();
      window.GaussicaText.set(feedback, exercise.correct);
      feedback.className = "feedback-message feedback-correct";
    }
  }

  // opts.onResult(isCorrect) is called after each submitted answer (used by the lesson player).
  function renderProblem(parent, lesson, exercise, taskId, labelText, opts) {
    if (Array.isArray(exercise.pairs)) return renderMatching(parent, lesson, exercise, taskId, labelText, opts);
    const finish = function (isCorrect) { if (opts && opts.onResult) opts.onResult(isCorrect); };
    questionShownAt[lesson.id + "|" + taskId] = Date.now();
    const saved = savedEntry(lesson.id, taskId);
    if (isPractice(taskId)) practiceProblems[lesson.id + "|" + taskId] = exercise;
    const section = makeElement("section", taskId === "exercise" ? "exercise" : "exercise word-problem");
    const headingId = "problem-title-" + lesson.id + "-" + taskId;
    section.setAttribute("aria-labelledby", headingId);
    const heading = makeElement("h3", "", exercise.prompt);
    heading.id = headingId;
    section.append(
      makeElement("p", "eyebrow", labelText),
      heading
    );
    const teacherNotes = isStudent() && !isPractice(taskId) ? window.GaussicaMailbox.inline(lesson.id, taskId) : null;
    if (teacherNotes) section.appendChild(teacherNotes);
    renderVisualsFor(section, exercise);

    // --- RITYTA: pen, text and bits to place; saved with the answer so the teacher can see it ---
    const drawKey = lesson.id + "|" + taskId;
    drawings[drawKey] = saved.canvas || "";
    const scratchBox = makeElement("div", "scratchpad-box canvas-box");
    const scratchHeader = makeElement("div", "scratchpad-header");
    const scratchTitle = makeElement("div", "scratchpad-title");
    scratchTitle.append(
      makeElement("span", "scratchpad-icon", "✏️"),
      makeElement("span", "scratchpad-heading", "Rityta")
    );
    const scratchSubtitle = makeElement("span", "scratchpad-hint", "Rita, skriv och lägg ut saker. Din lärare kan se hur du tänkte.");
    scratchHeader.append(scratchTitle, scratchSubtitle);
    const pad = window.GaussicaCanvas.create({
      value: saved.canvas || "",
      onChange: function (json) { storeCanvas(lesson.id, taskId, json); }
    });
    scratchBox.append(scratchHeader, pad);
    section.appendChild(scratchBox);

    // --- SLUTGILTIGT SVARSFÄLT ---
    const form = document.createElement("form");
    form.className = "answer-form";
    const answerField = makeElement("div", "final-answer-field");
    const label = makeElement("label", "final-answer-label", "Svar:");
    label.setAttribute("for", "answer-" + lesson.id + "-" + taskId);

    const answer = document.createElement("input");
    answer.type = "text";
    answer.id = "answer-" + lesson.id + "-" + taskId;
    answer.name = "answer";
    answer.autocomplete = "off";
    answer.placeholder = "Skriv ditt svar här";
    answer.required = true;
    answer.value = saved.answer || "";
    answer.setAttribute("aria-describedby", "feedback-" + lesson.id + "-" + taskId);
    answerField.append(label, answer);

    const submit = makeElement("button", "primary-button answer-button", "Kolla svaret");
    submit.type = "submit";
    form.append(answerField, submit);

    const feedback = makeElement("p", "feedback-message", saved.feedback || "");
    feedback.id = "feedback-" + lesson.id + "-" + taskId;
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    feedback.classList.toggle("feedback-correct", saved.feedbackType === "correct");
    feedback.classList.toggle("feedback-hint", saved.feedbackType === "hint");

    answer.addEventListener("input", function () {
      feedback.className = "feedback-message";
      feedback.textContent = "";
      storeAnswerProgress(lesson.id, taskId, answer.value, "", "", "", false, null, exercise.prompt, labelText);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const rawValue = answer.value.trim();
      const value = rawValue.toLowerCase().replace(/\s+/g, "");

      // 1. Symbolisk CAS-kontroll
      let isCorrect = false;
      if (window.MATTE_SYMBOLIC) {
        isCorrect = exercise.answer.some(function (accepted) {
          return window.MATTE_SYMBOLIC.areEquivalent(rawValue, accepted);
        });
      } else {
        isCorrect = exercise.answer.some(function (accepted) {
          return value === accepted.toLowerCase().replace(/\s+/g, "");
        });
      }

      // The right value written as a calculation ("36/6" for 6): where the point is to calculate, ask for the number.
      const MS = window.MATTE_SYMBOLIC;
      if (isCorrect && MS && MS.isCalculation(rawValue) && MS.expectsPlainNumber(exercise.answer) &&
          !window.GaussicaLesson.allowsExpression(lesson, exercise, course.lessons)) {
        const note = "Det stämmer, men du ska räkna ut svaret och skriva det som ett tal. Skriv talet i stället för uträkningen.";
        feedback.className = "feedback-message feedback-hint";
        window.GaussicaText.set(feedback, note);
        storeAnswerProgress(lesson.id, taskId, answer.value, "", note, "hint", false, "Skrev en uträkning i stället för ett svar", exercise.prompt, labelText);
        finish(false);
        return;
      }

      // Some questions ask for a particular way of writing the right value (form: "blandad", "brak" or "forenklat").
      const formNote = isCorrect && exercise.form ? answerFormNote(exercise.form, rawValue) : "";
      if (formNote) {
        feedback.className = "feedback-message feedback-hint";
        window.GaussicaText.set(feedback, formNote);
        storeAnswerProgress(lesson.id, taskId, answer.value, "", formNote, "hint", false, "Skrev rätt värde på fel sätt", exercise.prompt, labelText);
        finish(false);
        return;
      }

      if (isCorrect) {
        feedback.className = "feedback-message feedback-correct";
        window.GaussicaText.set(feedback, exercise.correct);
        storeAnswerProgress(lesson.id, taskId, answer.value, "", exercise.correct, "correct", true, null, exercise.prompt, labelText);
        finish(true);
        return;
      }

      // 2. Fördefinierad återkoppling i lektionens JSON
      const misconception = exercise.feedback.find(function (item) {
        return item.answers.some(function (incorrect) {
          if (window.MATTE_SYMBOLIC && window.MATTE_SYMBOLIC.areEquivalent(rawValue, incorrect)) return true;
          return value === incorrect.toLowerCase().replace(/\s+/g, "");
        });
      });

      if (misconception) {
        feedback.className = "feedback-message feedback-hint";
        window.GaussicaText.set(feedback, misconception.message);
        storeAnswerProgress(lesson.id, taskId, answer.value, "", misconception.message, "hint", false, misconception.message, exercise.prompt, labelText);
        finish(false);
        return;
      }

      // 3. Automatisk generering och diagnos av missuppfattningar (kedjeregel, associativa, distributiva, räkneordning osv.)
      let autoDiagnosis = null;
      if (window.MATTE_SYMBOLIC) {
        autoDiagnosis = window.MATTE_SYMBOLIC.diagnoseMisconception(
          rawValue,
          exercise.answer[0],
          { prompt: exercise.prompt, explanation: lesson.explanation }
        );
      }

      if (autoDiagnosis) {
        feedback.className = "feedback-message feedback-hint feedback-diagnosed";
        feedback.replaceChildren();
        const badge = makeElement("span", "feedback-diagnosed-badge", "💡 Upptäckt mönster: " + autoDiagnosis.title);
        const explanationP = makeElement("p", "", autoDiagnosis.explanation);
        feedback.append(badge, explanationP);
        storeAnswerProgress(lesson.id, taskId, answer.value, "", autoDiagnosis.title + ": " + autoDiagnosis.explanation, "hint", false, autoDiagnosis.title, exercise.prompt, labelText);
        finish(false);
        return;
      }

      // 4. Standardledtråd
      feedback.className = "feedback-message feedback-hint";
      feedback.textContent = "Det svaret stämmer inte riktigt ännu. Titta på förklaringen ovan och prova att ta ett steg i taget.";
      storeAnswerProgress(lesson.id, taskId, answer.value, "", feedback.textContent, "hint", false, "Generellt beräkningsfel", exercise.prompt, labelText);
      finish(false);
    });

    // Keys for signs that are hard to find on a keyboard (< > ≠, brackets): "keys": ["<", "=", ">"] on a question
    let keysRow = null;
    if (Array.isArray(exercise.keys) && exercise.keys.length) {
      keysRow = makeElement("div", "answer-keys");
      keysRow.setAttribute("role", "group");
      keysRow.setAttribute("aria-label", "Tecken att skriva in");
      exercise.keys.forEach(function (key) {
        const b = makeElement("button", "answer-key", key);
        b.type = "button";
        b.addEventListener("click", function () {
          const start = answer.selectionStart === null ? answer.value.length : answer.selectionStart;
          const end = answer.selectionEnd === null ? start : answer.selectionEnd;
          answer.value = answer.value.slice(0, start) + key + answer.value.slice(end);
          answer.focus();
          answer.setSelectionRange(start + key.length, start + key.length);
          answer.dispatchEvent(new Event("input", { bubbles: true }));
        });
        keysRow.appendChild(b);
      });
    }

    if (opts && opts.answerHost) {   // the player keeps these in its bottom bar
      if (keysRow) opts.answerHost.appendChild(keysRow);
      opts.answerHost.appendChild(form);
      (opts.feedbackHost || section).appendChild(feedback);
    } else {
      section.append(form);
      if (keysRow) section.appendChild(keysRow);
      section.append(feedback);
    }
    parent.appendChild(section);
  }

  function openLesson(id) {
    const lesson = course.lessons.find(function (item) { return item.id === id; });
    if (!lesson) return;
    activeLessonId = id;
    panelShown = true;
    if (activeArea !== "alla" && activeArea !== lesson.area) {
      activeArea = "alla";
      renderFilters();
    }
    renderGraph();
    renderPanel();
  }

  // ============ PROBLEM PATTERN GENERATION SYSTEM ============
  // Generates similar problems in bulk with varying parameters
  
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateProblemSet(lesson, patternId, count) {
    if (!lesson.problemPatterns) return [];
    
    const pattern = lesson.problemPatterns.find(function (p) { return p.id === patternId; });
    if (!pattern) return [];
    
    const problems = [];
    for (let i = 0; i < count; i++) {
      const problem = generateFromPattern(pattern);
      if (problem) problems.push(problem);
    }
    return problems;
  }

  function generateFromPattern(pattern) {
    if (pattern.type === 'arithmetic') {
      return generateArithmetic(pattern);
    } else if (pattern.type === 'multiStep') {
      return generateMultiStep(pattern);
    } else if (pattern.type === 'wordProblem') {
      return generateWordProblem(pattern);
    }
    return null;
  }

  function generateArithmetic(pattern) {
    const params = pattern.parameters;
    const a = randomInt(params.minA, params.maxA);
    const b = randomInt(params.minB, params.maxB);
    
    const templates = pattern.templates || [pattern.template];
    const template = templates[Math.floor(Math.random() * templates.length)];
    const prompt = template.replace('{a}', a).replace('{b}', b);
    
    let answer;
    if (pattern.operation === 'addition') {
      answer = a + b;
    } else if (pattern.operation === 'subtraction') {
      answer = a - b;
    } else if (pattern.operation === 'multiplication') {
      answer = a * b;
    } else if (pattern.operation === 'division' && b !== 0) {
      answer = Math.floor(a / b);
    } else {
      return null;
    }
    
    return { prompt: prompt, answer: String(answer), patternId: pattern.id };
  }

  function generateMultiStep(pattern) {
    const params = pattern.parameters;
    
    if (pattern.pattern === 'operator_precedence') {
      // Pattern: a op1 b op2 c (where op2 has higher precedence)
      const a = randomInt(params.minA, params.maxA);
      const b = randomInt(params.minB, params.maxB);
      const c = randomInt(params.minC, params.maxC);
      
      const templates = pattern.templates || [];
      const template = templates[Math.floor(Math.random() * templates.length)] || "{a} + {b} · {c} = ?";
      
      let prompt = template.replace('{a}', a).replace('{b}', b).replace('{c}', c);
      let answer;
      
      // Determine operation order
      if (pattern.parameters.operatorSequence[0] === 'multiplication') {
        // Multiplication first: a + b*c or a - b*c or b*c + a, etc.
        if (prompt.includes('·') && prompt.includes('+')) {
          answer = a + (b * c); // or other combo
          if (template.includes('{c} + {a}')) answer = c + (a * b);
          if (template.includes('{b} · {c} + {a}')) answer = (b * c) + a;
        } else if (prompt.includes('·') && prompt.includes('-')) {
          answer = a - (b * c);
        }
      } else if (pattern.parameters.operatorSequence[0] === 'division') {
        // Division first: a + b/2 or similar
        if (prompt.includes('/')) {
          const divisor = 2;
          const divResult = Math.floor(b / divisor);
          if (template.includes('{a} + {b}/')) {
            answer = a + divResult;
          } else if (template.includes('{b}/') && template.includes('+ {a}')) {
            answer = divResult + a;
          } else {
            answer = c + divResult;
          }
        }
      }
      
      return { prompt: prompt, answer: String(answer), patternId: pattern.id };
      
    } else if (pattern.pattern === 'parentheses') {
      const a = randomInt(params.minA, params.maxA);
      const b = randomInt(params.minB, params.maxB);
      const c = randomInt(params.minC, params.maxC);
      
      const templates = pattern.templates || [];
      const template = templates[Math.floor(Math.random() * templates.length)] || "({a} + {b}) · {c} = ?";
      
      const prompt = template.replace('{a}', a).replace('{b}', b).replace('{c}', c);
      let answer;
      
      // Handle parentheses: (a + b) * c, (a - b) * c, etc.
      if (template.includes('({a} + {b})') && template.includes('· {c}')) {
        answer = (a + b) * c;
      } else if (template.includes('{c} · ({a} + {b})')) {
        answer = c * (a + b);
      } else if (template.includes('({b} + {a})') && template.includes('· {c}')) {
        answer = (b + a) * c;
      } else if (template.includes('({a} - {b})') && template.includes('· {c}')) {
        answer = (a - b) * c;
      } else if (template.includes('{c} · ({a} - {b})')) {
        answer = c * (a - b);
      } else if (template.includes('({a} + {b}) - {c}')) {
        answer = (a + b) - c;
      } else if (template.includes('{a} + ({b} - {c})')) {
        answer = a + (b - c);
      } else if (template.includes('({a} - {b}) + {c}')) {
        answer = (a - b) + c;
      } else {
        answer = (a + b) * c; // default
      }
      
      return { prompt: prompt, answer: String(answer), patternId: pattern.id };
    }
    
    return null;
  }

  function generateWordProblem(pattern) {
    // Placeholder for word problem generation
    // Can be expanded with rich templates
    return null;
  }

  function renderProblemPatternUI(lesson, patternId, problems) {
    if (!problems || problems.length === 0) return null;
    
    const container = makeElement("div", "problem-pattern-container");
    const header = makeElement("h4", "pattern-header", "Träna fler liknande uppgifter");
    container.appendChild(header);
    
    const grid = makeElement("div", "problem-pattern-grid");
    problems.forEach(function (problem, index) {
      const problemBtn = makeElement("button", "problem-pattern-item");
      problemBtn.type = "button";
      problemBtn.textContent = (index + 1);
      problemBtn.title = problem.prompt;
      problemBtn.addEventListener("click", function () {
        alert("Uppgift: " + problem.prompt + "\n\nSvar: " + problem.answer);
      });
      grid.appendChild(problemBtn);
    });
    
    container.appendChild(grid);
    return container;
  }

  // ============ END PATTERN GENERATION ============

  function renderBlock(parent, lesson, key) {
    if (key === "explanation") {
      addSection(parent, "FÖRSTÅ IDÉN", lesson.explanationTitle, lesson.explanation);
    } else if (key === "visual") {
      renderVisualsFor(parent, lesson);
    } else if (key === "rule") {
      const rule = makeElement("div", "rule-card");
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
    } else if (currentUser && currentUser.role === "teacher") {
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
    if (!currentUser || currentUser.role !== "teacher") return;
    document.querySelectorAll(".admin-top-link, .footer-admin-link").forEach(function (a) { a.hidden = false; });
    applyPreviewUi();
  }

  function renderStudentProfileBar() {
    if (!studentProfileBar) return;
    studentProfileBar.innerHTML = "";
    const current = getActiveStudent();
    if (!current) return;

    const btn = makeElement("button", "student-profile-btn");
    btn.type = "button";
    btn.title = "Mitt konto";
    btn.setAttribute("aria-label", "Inloggad som " + current.name + ". Öppna kontomenyn.");

    const avatar = makeElement("span", "student-avatar", current.name.charAt(0).toUpperCase());
    if (current.color) avatar.style.background = current.color;

    const info = makeElement("div", "student-info");
    info.append(
      makeElement("span", "student-name", current.name),
      makeElement("span", "student-class", (current.role === "teacher" ? "Lärare" : (current.className || "Elev")) + " • Konto ▾")
    );

    btn.append(avatar, info);
    btn.addEventListener("click", openStudentModal);
    studentProfileBar.appendChild(btn);
  }

  function openStudentModal() {
    if (!studentModal) return;
    renderStudentModal();
    if (typeof studentModal.showModal === "function") {
      studentModal.showModal();
    } else {
      studentModal.setAttribute("open", "");
    }
  }

  function closeStudentModal() {
    if (!studentModal) return;
    if (typeof studentModal.close === "function") {
      studentModal.close();
    } else {
      studentModal.removeAttribute("open");
    }
  }

  // "Mitt konto": who is signed in, change password, sign out.
  function renderStudentModal() {
    if (!studentModalCard) return;
    studentModalCard.innerHTML = "";
    const u = getActiveStudent();
    if (!u) return;

    const header = makeElement("div", "modal-header");
    const headerLeft = makeElement("div");
    headerLeft.append(
      makeElement("h3", "", "Mitt konto"),
      makeElement("p", "", u.name + " · " + u.username + " · " + (u.role === "teacher" ? "lärare" : (u.className || "elev")))
    );
    const closeBtn = makeElement("button", "modal-close-btn", "✕");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Stäng");
    closeBtn.addEventListener("click", closeStudentModal);
    header.append(headerLeft, closeBtn);

    const form = makeElement("form", "account-form");
    form.appendChild(makeElement("h4", "", "Byt lösenord"));
    const mkField = function (label, name, autocomplete) {
      const wrap = makeElement("label", "account-field");
      const input = document.createElement("input");
      input.type = "password";
      input.name = name;
      input.required = true;
      input.autocomplete = autocomplete;
      wrap.append(makeElement("span", "", label), input);
      return { wrap: wrap, input: input };
    };
    const current = mkField("Nuvarande lösenord", "current", "current-password");
    const next = mkField("Nytt lösenord (minst 8 tecken)", "next", "new-password");
    const msg = makeElement("p", "account-msg");
    msg.setAttribute("role", "status");
    const save = makeElement("button", "primary-button", "Spara nytt lösenord");
    save.type = "submit";
    form.append(current.wrap, next.wrap, msg, save);
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      msg.className = "account-msg";
      msg.textContent = "";
      try {
        await API.post("/api/me/password", { current: current.input.value, next: next.input.value });
        form.reset();
        msg.className = "account-msg is-ok";
        msg.textContent = "Lösenordet är bytt.";
      } catch (err) {
        msg.className = "account-msg is-error";
        msg.textContent = err.message;
      }
    });

    const logout = makeElement("button", "account-logout", "Logga ut");
    logout.type = "button";
    logout.addEventListener("click", function () {
      logout.disabled = true;
      // Finish saving before the session ends, otherwise the last answers would be rejected.
      flushProgress(false).then(function () { window.GaussicaAuth.logout(); });
    });

    studentModalCard.append(header, form, logout);

    if (studentModal && !studentModal.dataset.listenerAdded) {
      studentModal.dataset.listenerAdded = "true";
      studentModal.addEventListener("click", function (e) {
        if (e.target === studentModal) closeStudentModal();
      });
    }
  }

  // Teacher data as last fetched from the server (used by the exports below).
  let teacherCache = { students: [], classes: [], assignments: [], inboxUnavailable: false };

  function exportAttemptsCSV() {
    const students = teacherCache.students;
    const rows = [
      ["Elev", "Klass", "Lektion", "Uppgift", "Fråga", "Försök nr", "Inlämnat svar", "Rätt svar", "Resultat", "Kladdpapper (uträkning)", "Diagnostiserad missuppfattning", "Sekunder", "Tidpunkt"]
    ];

    students.forEach(function (student) {
      const counters = {};
      (student.attempts || []).filter(window.GaussicaLesson.isSubmission).sort(function (a, b) {
        return String(a.timestamp || "").localeCompare(String(b.timestamp || ""));
      }).forEach(function (att) {
        const key = att.lessonId + "|" + att.taskId;
        counters[key] = (counters[key] || 0) + 1;
        rows.push([
          student.name,
          student.class,
          att.lessonTitle || att.lessonId,
          att.taskName || att.taskId,
          att.prompt || "",
          att.attemptNo || counters[key],
          att.answer || "",
          att.correctAnswer || "",
          att.completed ? "Rätt" : "Fel",
          att.scratchpad || "",
          att.misconception || "",
          att.seconds == null ? "" : att.seconds,
          att.timestamp || ""
        ]);
      });
    });

    const csvContent = "\uFEFF" + rows.map(function (row) {
      return row.map(function (field) {
        const str = String(field == null ? "" : field).replace(/"/g, '""');
        return '"' + str + '"';
      }).join(";");
    }).join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gaussica-elevsvar-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportDataJSON() {
    const jsonStr = JSON.stringify({
      exportedAt: new Date().toISOString(),
      classes: teacherCache.classes,
      students: teacherCache.students
    }, null, 2);

    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gaussica-elever-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // refetch: true loads fresh data from the server; false redraws from what is already loaded.
  async function renderAdminPage(refetch) {
    if (!adminPage) return;
    if (!currentUser || currentUser.role !== "teacher") {
      adminPage.replaceChildren(makeElement("p", "course-error", "Den här sidan är bara för lärare."));
      return;
    }
    if (refetch !== false) {
      if (!teacherCache.students.length) adminPage.replaceChildren(makeElement("p", "tv-empty", "Hämtar elevdata…"));
      try {
        // An API that has not been updated yet (no assignments endpoint) must not block the rest of the teacher view.
        const results = await Promise.all([
          API.get("/api/teacher/students"), API.get("/api/teacher/classes"),
          API.get("/api/teacher/assignments").catch(function (err) {
            if (err.status === 404) return { assignments: [], unavailable: true };
            throw err;
          })
        ]);
        teacherCache = { students: results[0].students, classes: results[1].classes, assignments: results[2].assignments, inboxUnavailable: Boolean(results[2].unavailable) };
      } catch (err) {
        adminPage.replaceChildren(makeElement("p", "course-error", "Kunde inte hämta elevdata: " + err.message));
        return;
      }
    }
    window.GaussicaTeacher.render(adminPage, {
      students: teacherCache.students,
      classes: teacherCache.classes,
      assignments: teacherCache.assignments,
      inboxUnavailable: teacherCache.inboxUnavailable,
      course: course,
      formatTimestamp: formatTimestamp,
      rerender: function () { renderAdminPage(false); },
      refresh: function () { renderAdminPage(true); },
      actions: {
        back: function () { window.location.hash = "#larstig"; },
        exportCSV: exportAttemptsCSV,
        exportJSON: exportDataJSON,
        createClass: function (name) { return API.post("/api/teacher/classes", { name: name }).then(function (r) { return r["class"]; }); },
        resetPassword: function (studentId) {
          return API.post("/api/teacher/students/" + encodeURIComponent(studentId) + "/password").then(function (r) { return r.password; });
        },
        deleteStudent: function (studentId) { return API.del("/api/teacher/students/" + encodeURIComponent(studentId)); },
        setClassRewards: function (id, on) {
          return API.put("/api/teacher/classes/" + encodeURIComponent(id), { rewards: Boolean(on) }).then(function () {
            const c = teacherCache.classes.find(function (x) { return x.id === id; });
            if (c) c.rewards = Boolean(on);
          });
        },
        createAssignment: function (payload) { return API.post("/api/teacher/assignments", payload); },
        archiveAssignment: function (id) { return API.del("/api/teacher/assignments/" + encodeURIComponent(id)); },
        sendFeedback: function (payload) {
          return API.post("/api/teacher/feedback", payload).then(function (r) {
            const student = teacherCache.students.find(function (s) { return s.id === String(payload.studentId); });
            if (student) {
              (student.feedback = student.feedback || []).push({ id: r.id, studentId: payload.studentId, lessonId: payload.lessonId || null, taskId: payload.taskId || null,
                text: payload.text || "", sticker: payload.sticker || null, createdAt: new Date().toISOString(), read: false, teacher: currentUser.name });
            }
            return r;
          });
        },
        deleteFeedback: function (id) {
          return API.del("/api/teacher/feedback/" + encodeURIComponent(id)).then(function () {
            teacherCache.students.forEach(function (s) { s.feedback = (s.feedback || []).filter(function (f) { return f.id !== id; }); });
          });
        }
      }
    });
  }

  function checkRoute() {
    const hash = window.location.hash || "";
    const playId = hash.indexOf("#play/") === 0 ? hash.slice(6) : "";
    const practiceId = hash.indexOf("#practice/") === 0 ? decodeURIComponent(hash.slice(10)) : "";
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
      if (!currentUser || currentUser.role !== "teacher") {
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
