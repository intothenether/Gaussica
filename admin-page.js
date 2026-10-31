// The page of the teacher or caregiver (#admin): fetches the students, the classes and the assignments, hands them to teacher-view.js with the actions
// it needs, exports them as files, and counts the unanswered questions. Cut out of app.js.

window.GaussicaAdminPage = (function () {
  "use strict";

  const makeElement = window.GaussicaDom.makeElement;
  const downloadJSON = window.GaussicaDom.downloadJSON;
  // what app.js gives to init: the page state and the functions that keep the progress
  let adminPage, API, isGuide, markChatRead, renderVisualsFor, formatTimestamp, getCourse, getUser;

  function init(d) {
    adminPage = d.adminPage;
    API = d.API;
    isGuide = d.isGuide;
    markChatRead = d.markChatRead;
    renderVisualsFor = d.renderVisualsFor;
    formatTimestamp = d.formatTimestamp;
    getCourse = d.getCourse;
    getUser = d.getUser;
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
    downloadJSON("gaussica-elever-" + new Date().toISOString().slice(0, 10) + ".json", {
      exportedAt: new Date().toISOString(),
      classes: teacherCache.classes,
      students: teacherCache.students
    });
  }

  // Everything the site holds about one student, as a file the teacher can hand over when the student or a guardian asks.
  function exportStudentJSON(student) {
    downloadJSON("gaussica-" + String(student.username || "elev").replace(/[^\w.-]+/g, "_") + "-" + new Date().toISOString().slice(0, 10) + ".json", {
      exportedAt: new Date().toISOString(),
      account: { name: student.name, username: student.username, class: student.class, createdAt: student.createdAt },
      progress: student.lessonProgress,
      attempts: student.attempts,
      feedbackFromTeacher: student.feedback,
      messages: student.chat
    });
  }

  // Unanswered questions show as a badge on the teacher link, also while the teacher is somewhere else on the site.
  function countTeacherChat() {
    return teacherCache.students.reduce(function (n, s) {
      return n + (s.chat || []).filter(function (m) { return !m.fromTeacher && !m.read; }).length;
    }, 0);
  }

  let shownTeacherChat = 0;
  function showTeacherChatCount(n) {
    shownTeacherChat = n;
    const link = document.getElementById("admin-top-link");
    const badge = link && link.querySelector(".mail-badge");
    if (!badge) return;
    badge.hidden = n === 0;
    badge.textContent = String(n);
    link.setAttribute("aria-label", n ? "Lärarvy: " + n + (n === 1 ? " ny fråga från en elev" : " nya frågor från elever") : "Lärarvy");
  }

  async function refreshTeacherChat() {
    if (!isGuide(getUser()) || document.visibilityState === "hidden") return;
    try {
      const r = await API.get("/api/teacher/chat/unread");
      const grew = r.unread > shownTeacherChat;
      showTeacherChatCount(r.unread);
      // on the teacher page, new questions appear by themselves unless the teacher is in the middle of writing an answer
      const onAdmin = (window.location.hash || "").indexOf("#admin") === 0 && adminPage && !adminPage.hidden;
      const typing = adminPage && Array.prototype.some.call(adminPage.querySelectorAll("textarea"), function (t) { return t.value.trim(); });
      if (grew && onAdmin && !typing) renderAdminPage(true);
    } catch (e) { /* offline or an older server: no badge */ }
  }
  setInterval(refreshTeacherChat, 60000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") refreshTeacherChat(); });

  // refetch: true loads fresh data from the server; false redraws from what is already loaded.
  async function renderAdminPage(refetch) {
    if (!adminPage) return;
    if (!isGuide(getUser())) {
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
        showTeacherChatCount(countTeacherChat());
      } catch (err) {
        adminPage.replaceChildren(makeElement("p", "course-error", "Kunde inte hämta elevdata: " + err.message));
        return;
      }
    }
    window.GaussicaTeacher.render(adminPage, {
      caregiver: getUser().role === "caregiver",
      students: teacherCache.students,
      classes: teacherCache.classes,
      assignments: teacherCache.assignments,
      inboxUnavailable: teacherCache.inboxUnavailable,
      course: getCourse(),
      renderVisuals: renderVisualsFor,
      formatTimestamp: formatTimestamp,
      rerender: function () { renderAdminPage(false); },
      refresh: function () { renderAdminPage(true); },
      actions: {
        back: function () { window.location.hash = "#larstig"; },
        exportCSV: exportAttemptsCSV,
        exportJSON: exportDataJSON,
        joinAsGuide: function (code) { return API.post("/api/teacher/join", { guideCode: code }); },
        removeGuide: function (classId, userId) { return API.del("/api/teacher/classes/" + encodeURIComponent(classId) + "/guides/" + encodeURIComponent(userId)); },
        addChild: function (payload) { return API.post("/api/teacher/students", payload).then(function (r) { return r.student; }); },
        createClass: function (name) { return API.post("/api/teacher/classes", { name: name }).then(function (r) { return r["class"]; }); },
        resetPassword: function (studentId) {
          return API.post("/api/teacher/students/" + encodeURIComponent(studentId) + "/password").then(function (r) { return r.password; });
        },
        deleteStudent: function (studentId) { return API.del("/api/teacher/students/" + encodeURIComponent(studentId)); },
        deleteClass: function (id) { return API.del("/api/teacher/classes/" + encodeURIComponent(id)); },
        exportStudent: exportStudentJSON,
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
                text: payload.text || "", sticker: payload.sticker || null, createdAt: new Date().toISOString(), read: false, teacher: getUser().name });
            }
            return r;
          });
        },
        deleteFeedback: function (id) {
          return API.del("/api/teacher/feedback/" + encodeURIComponent(id)).then(function () {
            teacherCache.students.forEach(function (s) { s.feedback = (s.feedback || []).filter(function (f) { return f.id !== id; }); });
          });
        },
        sendChat: function (payload) {
          return API.post("/api/teacher/chat", payload).then(function (r) {
            const student = teacherCache.students.find(function (s) { return s.id === String(payload.studentId); });
            if (student) {
              (student.chat = student.chat || []).forEach(function (m) { if (!m.fromTeacher) m.read = true; });
              student.chat.push({ id: r.id, studentId: student.id, fromTeacher: true, text: payload.text, lessonId: null, taskId: null, context: null, createdAt: new Date().toISOString(), read: false });
            }
            showTeacherChatCount(countTeacherChat());
            return r;
          });
        },
        markChatRead: function (studentId) {
          return API.post("/api/teacher/chat/read", { studentId: studentId }).then(function () {
            const student = teacherCache.students.find(function (s) { return s.id === String(studentId); });
            if (student) (student.chat || []).forEach(function (m) { if (!m.fromTeacher) m.read = true; });
            showTeacherChatCount(countTeacherChat());
          });
        }
      }
    });
  }

  return { init: init, refreshTeacherChat: refreshTeacherChat, renderAdminPage: renderAdminPage };
}());
