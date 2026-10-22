// Teacher toolbar: create/edit lessons, list lessons, export. Shown to signed-in teachers only
// (the server enforces the role; see server/api.js). Lessons are edited in the WYSIWYG editor
// (interactive-lesson-editor-v2.js), which saves them to the server.

(function () {
  "use strict";

  window.initAdminInterface = function () {
    const user = window.GaussicaUser;
    if (user && user.role === "teacher") addAdminToolbar();
  };

  function addAdminToolbar() {
    if (document.getElementById("admin-toolbar")) return;
    const toolbar = document.createElement("div");
    toolbar.id = "admin-toolbar";
    toolbar.className = "admin-toolbar";
    toolbar.innerHTML = `
      <div class="admin-toolbar-inner">
        <span class="admin-status">👨‍🏫 Lärare</span>
        <div class="admin-buttons">
          <button id="btn-new-lesson" class="admin-btn" title="Skapa ny lektion">➕ Ny lektion</button>
          <button id="btn-edit-lesson" class="admin-btn" title="Redigera den lektion som visas just nu">✏️ Redigera lektion</button>
          <button id="btn-lesson-list" class="admin-btn" title="Visa alla lektioner">📋 Alla lektioner</button>
          <button id="btn-export-json" class="admin-btn" title="Ladda ner alla lektioner som JSON">💾 Exportera lektioner</button>
        </div>
      </div>
    `;
    document.body.insertBefore(toolbar, document.body.firstChild);
    document.body.classList.add("has-admin-toolbar");

    document.getElementById("btn-new-lesson").addEventListener("click", openNewLessonEditor);
    document.getElementById("btn-edit-lesson").addEventListener("click", openLessonEditor);
    document.getElementById("btn-lesson-list").addEventListener("click", showLessonList);
    document.getElementById("btn-export-json").addEventListener("click", exportLessonsJSON);
  }

  function openNewLessonEditor() {
    if (!window.InteractiveEditor) return alert("Redigeraren är inte laddad. Ladda om sidan.");
    window.InteractiveEditor.newLesson();
  }

  function openLessonEditor() {
    if (!window.activeLessonId) {
      alert("Vänligen välj en lektion först.");
      return;
    }
    if (!window.InteractiveEditor) return alert("Redigeraren är inte laddad. Ladda om sidan.");
    const lesson = window.course.lessons.find(l => l.id === window.activeLessonId);
    if (lesson) window.InteractiveEditor.open(lesson);
  }

  function showLessonList() {
    const modal = createModal("Alla lektioner");
    const content = modal.querySelector(".modal-content");
    const list = document.createElement("div");
    list.className = "lesson-list";

    window.course.lessons.forEach(lesson => {
      const item = document.createElement("div");
      item.className = "lesson-list-item";

      const header = document.createElement("div");
      header.className = "lesson-list-header";
      const title = document.createElement("h4");
      title.textContent = lesson.title;
      const badge = document.createElement("span");
      badge.className = "lesson-badge";
      badge.style.background = getAreaColor(lesson.area);
      badge.textContent = lesson.area;
      header.append(title, badge);

      const meta = document.createElement("p");
      meta.className = "lesson-list-meta";
      meta.textContent = "ID: " + lesson.id + " | " +
        (lesson.prerequisites.length ? lesson.prerequisites.length + " förkunskaper" : "Startkurs") + " | " + (lesson.duration || "");

      const summary = document.createElement("p");
      summary.className = "lesson-list-summary";
      summary.textContent = lesson.summary || "";

      const edit = document.createElement("button");
      edit.className = "btn-small";
      edit.textContent = "Redigera";
      edit.addEventListener("click", () => {
        window.activeLessonId = lesson.id;
        modal.remove();
        openLessonEditor();
      });

      item.append(header, meta, summary, edit);
      list.appendChild(item);
    });

    content.appendChild(list);
    document.body.appendChild(modal);
  }

  function exportLessonsJSON() {
    const data = {
      areas: window.course.areas,
      areaNotes: window.course.areaNotes,
      lessons: window.course.lessons
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gaussica-lessons-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function createModal(title) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.addEventListener("click", () => overlay.remove());

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.width = "800px";
    modal.style.maxHeight = "500px";
    modal.addEventListener("click", e => e.stopPropagation());

    const header = document.createElement("div");
    header.className = "modal-header";
    const h2 = document.createElement("h2");
    h2.textContent = title;
    const close = document.createElement("button");
    close.className = "modal-close";
    close.textContent = "✕";
    close.addEventListener("click", () => overlay.remove());
    header.append(h2, close);

    const content = document.createElement("div");
    content.className = "modal-content";
    modal.append(header, content);
    overlay.appendChild(modal);
    return overlay;
  }

  function getAreaColor(area) {
    const colors = { tal: "#425b9a", algebra: "#8a74c9", geometri: "#ef6f88", matning: "#d99a2b", data: "#2f9d88" };
    return colors[area] || "#627090";
  }
}());
