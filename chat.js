// "Fråga läraren": a small chat between a student and the teacher of their class.
// When the student writes from a question, the message carries what they were looking at (the lesson, the
// question text and the answer typed so far), so the teacher sees the problem without having to ask.
//
//   GaussicaChat.init(deps)
//   GaussicaChat.open(context)   context (all optional): { lessonId, taskId, lessonTitle, taskName, prompt, answer, tries, status }
//   GaussicaChat.canChat()       true for a student who is in a class
//   GaussicaChat.unread()        how many answers from the teacher have not been read yet
//   GaussicaChat.describe(context)   one line such as "Textuppgift 1 i Bråk" (also used by the teacher view)
//
// deps: { getUser, getMessages() -> [message], send(payload) -> Promise, markRead(), refresh() -> Promise }
// message: { id, fromTeacher, text, lessonId, taskId, context, createdAt, read }

window.GaussicaChat = (function () {
  "use strict";

  const MAX = 600;
  const POLL_MS = 12000;

  let deps = null;
  let overlay = null;
  let pollTimer = null;
  let opener = null;

  function init(d) { deps = d; }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function user() { return (deps && deps.getUser && deps.getUser()) || {}; }
  function messages() { return (deps && deps.getMessages && deps.getMessages()) || []; }

  function canChat() {
    const u = user();
    return Boolean(deps && u && u.role === "student" && u.classId);
  }

  function unread() {
    return messages().filter(function (m) { return m.fromTeacher && !m.read; }).length;
  }

  function describe(ctx) {
    if (!ctx) return "";
    const bits = [];
    if (ctx.taskName) bits.push(ctx.taskName);
    if (ctx.lessonTitle) bits.push((bits.length ? "i " : "") + ctx.lessonTitle);
    return bits.join(" ");
  }

  function when(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const today = new Date();
    const time = d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === today.toDateString()) return time;
    return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }) + " " + time;
  }

  function clip(text, n) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
  }

  // ----- the dialog -----
  function close() {
    if (!overlay) return;
    clearInterval(pollTimer);
    pollTimer = null;
    overlay.remove();
    overlay = null;
    if (opener && opener.isConnected) opener.focus();
    opener = null;
  }

  function bubble(m) {
    const row = el("div", "chat-row " + (m.fromTeacher ? "is-teacher" : "is-me"));
    const b = el("div", "chat-bubble");
    if (m.fromTeacher) b.appendChild(el("strong", "chat-who", "Din lärare"));
    if (!m.fromTeacher && m.context) {
      const about = describe(m.context);
      if (about) b.appendChild(el("span", "chat-about", "Om: " + about));
    }
    b.appendChild(el("span", "chat-text", m.text));
    b.appendChild(el("time", "chat-time", when(m.createdAt)));
    row.appendChild(b);
    return row;
  }

  function open(context) {
    if (!deps || !canChat()) return;
    close();
    opener = document.activeElement;
    const ctx = context && (context.prompt || context.taskName || context.lessonTitle) ? context : null;

    overlay = el("div", "chat-overlay");
    const panel = el("div", "chat-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Fråga din lärare");

    const head = el("header", "chat-head");
    head.appendChild(el("h2", "chat-title", "💬 Fråga din lärare"));
    const closeBtn = el("button", "chat-close", "✕");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Stäng");
    closeBtn.addEventListener("click", close);
    head.appendChild(closeBtn);
    panel.appendChild(head);

    const thread = el("div", "chat-thread");
    thread.setAttribute("aria-live", "polite");
    panel.appendChild(thread);

    // what the teacher will see together with the message
    let attach = null;
    if (ctx) {
      const card = el("div", "chat-context");
      const label = el("label", "chat-context-check");
      attach = document.createElement("input");
      attach.type = "checkbox";
      attach.checked = true;
      label.append(attach, el("span", "", "Visa läraren vilken uppgift jag tittar på"));
      card.appendChild(label);
      const what = el("div", "chat-context-what");
      const about = describe(ctx);
      if (about) what.appendChild(el("strong", "", about));
      if (ctx.prompt) what.appendChild(el("span", "chat-context-prompt", "”" + clip(ctx.prompt, 200) + "”"));
      if (ctx.answer) what.appendChild(el("span", "chat-context-answer", "Ditt svar hittills: " + clip(ctx.answer, 80)));
      card.appendChild(what);
      attach.addEventListener("change", function () { card.classList.toggle("is-off", !attach.checked); });
      panel.appendChild(card);
    }

    const form = el("form", "chat-form");
    const area = el("textarea", "chat-input");
    area.maxLength = MAX;
    area.rows = 3;
    area.placeholder = ctx ? "Vad är det du undrar över?" : "Skriv vad du undrar över…";
    area.setAttribute("aria-label", "Ditt meddelande till läraren");
    const error = el("p", "chat-error");
    error.hidden = true;
    const send = el("button", "chat-send", "Skicka 📨");
    send.type = "submit";
    const foot = el("div", "chat-foot");
    foot.append(el("span", "chat-hint", "Din lärare svarar när meddelandet har lästs. Svaret hittar du här."), send);
    form.append(area, error, foot);
    panel.appendChild(form);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    let shown = -1;
    function draw(force) {
      const list = messages();
      const key = list.length + ":" + list.map(function (m) { return m.id; }).join(",");
      if (!force && key === shown) return;
      const atEnd = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 60 || shown === -1;
      shown = key;
      thread.replaceChildren();
      if (!list.length) {
        thread.appendChild(el("p", "chat-empty", "Här kan du skriva till din lärare. Fråga om något du inte förstår, eller berätta var du fastnade."));
      }
      list.forEach(function (m) { thread.appendChild(bubble(m)); });
      if (atEnd) thread.scrollTop = thread.scrollHeight;
      if (unread() && deps.markRead) deps.markRead();
    }
    draw(true);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const text = area.value.trim();
      if (!text) { error.textContent = "Skriv något först."; error.hidden = false; return; }
      error.hidden = true;
      send.disabled = true;
      const payload = { text: text };
      if (ctx && attach && attach.checked) {
        payload.lessonId = ctx.lessonId || null;
        payload.taskId = ctx.taskId || null;
        payload.context = {
          prompt: ctx.prompt, answer: ctx.answer, lessonTitle: ctx.lessonTitle, taskName: ctx.taskName,
          tries: ctx.tries, status: ctx.status
        };
      }
      deps.send(payload).then(function () {
        area.value = "";
        draw(true);
        thread.scrollTop = thread.scrollHeight;
      }).catch(function (err) {
        error.textContent = err && err.message ? err.message : "Kunde inte skicka just nu. Försök igen.";
        error.hidden = false;
      }).then(function () { send.disabled = false; area.focus(); });
    });

    area.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    });
    overlay.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
    });
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });

    pollTimer = setInterval(function () {
      if (document.visibilityState === "hidden" || !deps.refresh) return;
      deps.refresh().then(function () { if (overlay) draw(false); }).catch(function () { /* offline: try again */ });
    }, POLL_MS);
    if (deps.refresh) deps.refresh().then(function () { if (overlay) draw(false); }).catch(function () { /* offline */ });
    setTimeout(function () { area.focus(); }, 30);
  }

  return { init: init, open: open, canChat: canChat, unread: unread, describe: describe };
}());
