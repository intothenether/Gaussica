// "Mitt konto": who is signed in, the colour theme, the data of the student, the classes of a student, deleting the account, and signing out.
// Cut out of app.js; it gets the page state and the functions that keep the progress from app.js through init().

window.GaussicaAccount = (function () {
  "use strict";

  const makeElement = window.GaussicaDom.makeElement;
  const downloadJSON = window.GaussicaDom.downloadJSON;
  // what app.js gives to init: the page state and the functions that keep the progress
  let studentModal, studentModalCard, API, dirtyLessons, pendingAttempts, getActiveStudent, isGuide, outboxKey, scheduleSave, flushProgress, getAllProgress;

  function init(d) {
    studentModal = d.studentModal;
    studentModalCard = d.studentModalCard;
    API = d.API;
    dirtyLessons = d.dirtyLessons;
    pendingAttempts = d.pendingAttempts;
    getActiveStudent = d.getActiveStudent;
    isGuide = d.isGuide;
    outboxKey = d.outboxKey;
    scheduleSave = d.scheduleSave;
    flushProgress = d.flushProgress;
    getAllProgress = d.getAllProgress;
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

  // "Utseende": the colour theme (theme.js). The choice is put on the page at once and saved in the account.
  function saveTheme(id) {
    getAllProgress().theme = { id: id, updatedAt: Date.now() };
    dirtyLessons.add("theme");
    scheduleSave(300);
  }

  function themeSection() {
    const box = makeElement("div", "account-form account-theme");
    box.appendChild(makeElement("h4", "", "Utseende"));
    box.appendChild(makeElement("p", "account-note", "Välj färger till sidan. Valet följer med ditt konto till andra enheter."));
    box.appendChild(window.GaussicaTheme.picker(saveTheme));
    return box;
  }

  // "Mina uppgifter": download everything the site holds about you, or delete the account (GDPR: access and erasure).
  async function downloadMyData(u) {
    const data = await API.get("/api/me/data");
    downloadJSON("gaussica-mina-uppgifter-" + new Date().toISOString().slice(0, 10) + ".json", {
      exportedAt: new Date().toISOString(),
      account: { name: u.name, username: u.username, role: u.role, class: u.className || null },
      progress: data.progress,
      attempts: data.attempts,
      assignments: data.assignments,
      feedbackFromTeacher: data.feedback,
      messages: data.chat
    });
  }

  function myDataSection(u) {
    const isTeacher = isGuide(u);
    const family = u.role === "caregiver";
    const box = makeElement("div", "account-form account-data");
    box.appendChild(makeElement("h4", "", "Mina uppgifter"));
    const info = makeElement("p", "account-note", family
      ? "Du kan ladda ner dina egna uppgifter. Barnens uppgifter laddar du ner under Mina barn, för ett barn i taget eller för alla."
      : isTeacher
      ? "Du kan ladda ner dina egna uppgifter. Elevernas uppgifter laddar du ner i lärarvyn."
      : "Du kan ladda ner allt som sparats om dig, eller radera ditt konto.");
    const msg = makeElement("p", "account-msg");
    msg.setAttribute("role", "status");
    const download = makeElement("button", "tv-btn", "Ladda ner mina uppgifter");
    download.type = "button";
    download.addEventListener("click", function () {
      download.disabled = true;
      msg.className = "account-msg";
      msg.textContent = "";
      downloadMyData(u).catch(function (err) {
        msg.className = "account-msg is-error";
        msg.textContent = err.message;
      }).then(function () { download.disabled = false; });
    });

    const del = document.createElement("details");
    del.className = "account-danger";
    del.appendChild(makeElement("summary", "", "Radera mitt konto"));
    del.appendChild(makeElement("p", "account-note", family
      ? "Det här raderar ditt konto, familjen, barnens konton och allt barnen har gjort. Det går inte att ångra. Ladda ner barnens uppgifter först om du vill spara dem."
      : isTeacher
      ? "Det här raderar ditt konto, alla dina klasser, alla elever i dem och allt de gjort. Det går inte att ångra. Ladda ner uppgifterna i lärarvyn först om du vill spara dem."
      : "Det här raderar ditt konto och allt du gjort: dina svar, ditt djur och dina meddelanden. Det går inte att ångra. Din lärare får veta att du inte längre finns i klassen."));
    const wrap = makeElement("label", "account-field");
    const pass = document.createElement("input");
    pass.type = "password";
    pass.autocomplete = "current-password";
    wrap.append(makeElement("span", "", "Skriv ditt lösenord för att bekräfta"), pass);
    const dmsg = makeElement("p", "account-msg");
    dmsg.setAttribute("role", "status");
    const go = makeElement("button", "account-logout", "Radera allt för alltid");
    go.type = "button";
    go.addEventListener("click", async function () {
      dmsg.className = "account-msg";
      dmsg.textContent = "";
      if (!pass.value) { dmsg.className = "account-msg is-error"; dmsg.textContent = "Skriv ditt lösenord först."; pass.focus(); return; }
      if (!window.confirm(family ? "Radera ditt konto, familjen och barnens konton? Det går inte att ångra." : isTeacher ? "Radera ditt konto, dina klasser och alla elever i dem? Det går inte att ångra." : "Radera ditt konto och allt du gjort? Det går inte att ångra.")) return;
      go.disabled = true;
      try {
        await API.post("/api/me/delete", { password: pass.value });
      } catch (err) {
        dmsg.className = "account-msg is-error";
        dmsg.textContent = err.message;
        go.disabled = false;
        return;
      }
      // nothing of the old account may be sent again from this browser
      dirtyLessons.clear();
      pendingAttempts.length = 0;
      try { localStorage.removeItem(outboxKey()); } catch (e) { /* nothing to remove */ }
      window.GaussicaAuth.logout();
    });
    del.append(wrap, dmsg, go);
    box.append(info, download, msg, del);
    return box;
  }

  // A student can be in several classes: a school class and a family. Here they are listed, one can be left, and another joined with its code.
  function myClassesSection(u) {
    const box = makeElement("div", "account-form account-classes");
    if (u.role !== "student") return box;
    box.appendChild(makeElement("h4", "", "Mina klasser och familjer"));
    const classes = u.classes || [];
    const msg = makeElement("p", "account-msg");
    msg.setAttribute("role", "status");
    const done = function () { flushProgress(false).then(function () { window.location.reload(); }); };   // everything is read again for the classes
    if (classes.length) {
      const list = makeElement("ul", "account-class-list");
      classes.forEach(function (c) {
        const li = makeElement("li");
        li.appendChild(makeElement("span", "", c.name + (c.family ? " (familj)" : "")));
        const leave = makeElement("button", "tv-btn is-danger tv-small", "Lämna");
        leave.type = "button";
        leave.addEventListener("click", function () {
          if (!window.confirm("Lämna " + c.name + "? Du ser inte uppdrag och meddelanden därifrån längre. Det du har gjort finns kvar på ditt konto.")) return;
          leave.disabled = true;
          API.del("/api/me/classes/" + encodeURIComponent(c.id)).then(done).catch(function (err) { leave.disabled = false; msg.className = "account-msg is-error"; msg.textContent = err.message; });
        });
        li.appendChild(leave);
        list.appendChild(li);
      });
      box.appendChild(list);
    } else {
      box.appendChild(makeElement("p", "account-note", "Du är inte med i någon klass eller familj just nu."));
    }
    const form = makeElement("form", "account-join");
    const wrap = makeElement("label", "account-field");
    const code = document.createElement("input");
    code.type = "text";
    code.autocomplete = "off";
    code.required = true;
    code.maxLength = 40;
    code.setAttribute("autocapitalize", "characters");
    wrap.append(makeElement("span", "", "Gå med i en klass eller familj till med en kod"), code);
    const join = makeElement("button", "tv-btn", "Gå med");
    join.type = "submit";
    form.append(wrap, join);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.className = "account-msg";
      msg.textContent = "";
      join.disabled = true;
      API.post("/api/me/classes", { classCode: code.value }).then(done).catch(function (err) {
        join.disabled = false;
        msg.className = "account-msg is-error";
        msg.textContent = err.message;
      });
    });
    box.append(form, msg);
    return box;
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
      makeElement("p", "", u.name + " · " + u.username + " · " + (u.role === "teacher" ? "lärare" : u.role === "caregiver" ? "vårdnadshavare" : (u.className || "elev")))
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

    const S = window.GaussicaSubscription;
    const adult = S ? [S.emailSection(u, API), S.subscriptionSection(u, API)].filter(Boolean) : [];
    studentModalCard.append.apply(studentModalCard, [header, form].concat(adult, [themeSection(), myClassesSection(u), myDataSection(u), logout]));

    if (studentModal && !studentModal.dataset.listenerAdded) {
      studentModal.dataset.listenerAdded = "true";
      studentModal.addEventListener("click", function (e) {
        if (e.target === studentModal) closeStudentModal();
      });
    }
  }

  return { init: init, openStudentModal: openStudentModal, closeStudentModal: closeStudentModal, renderStudentModal: renderStudentModal };
}());
