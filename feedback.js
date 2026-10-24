// "Skicka feedback": anyone can tell whoever runs the site about a mistake, an idea or anything else.
// The message is sent to the server (POST /api/feedback), which e-mails it to the owner. See README, "Feedback".
// Opened from the footer and from the lesson player (then it can carry the question the student was looking at).
//
//   GaussicaFeedback.init({ getUser })
//   GaussicaFeedback.open(context)   context (optional): { lessonId, taskId, lessonTitle, taskName, prompt, answer, status }
//
// In demo mode (no server) nothing can be sent, so the button opens the visitor's own e-mail program instead,
// addressed to the contact in config.js (if there is one).

window.GaussicaFeedback = (function () {
  "use strict";

  const KINDS = [
    { id: "fel", label: "🐞 Något är fel" },
    { id: "forslag", label: "💡 Ett förslag" },
    { id: "annat", label: "💬 Något annat" }
  ];
  const MAX = 2000;

  let deps = { getUser: function () { return null; } };
  let overlay = null;
  let opener = null;

  function init(d) { deps = Object.assign(deps, d || {}); }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function mode() { return window.GaussicaAPI && window.GaussicaAPI.mode ? window.GaussicaAPI.mode() : ""; }
  function contact() { return (window.GAUSSICA_CONFIG && window.GAUSSICA_CONFIG.contact) || ""; }

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    if (opener && opener.isConnected) opener.focus();
    opener = null;
  }

  function mailtoLink(kind, text, email, ctx) {
    const lines = [text, ""];
    if (email) lines.push("Svara till: " + email);
    lines.push("Sida: " + (window.location.hash || "start"));
    if (ctx && ctx.prompt) lines.push("Fråga: " + ctx.prompt);
    return "mailto:" + encodeURIComponent(contact()).replace(/%40/g, "@") + "?subject=" + encodeURIComponent("Gaussica feedback: " + kind.label.replace(/^\S+\s/, "")) +
      "&body=" + encodeURIComponent(lines.join("\n"));
  }

  function thanks(panel, message) {
    panel.replaceChildren();
    const done = el("div", "fb-done");
    done.append(el("p", "fb-done-emoji", "💌"), el("h2", "fb-done-title", "Tack!"), el("p", "fb-done-text", message));
    const ok = el("button", "chat-send", "Stäng");
    ok.type = "button";
    ok.addEventListener("click", close);
    done.appendChild(ok);
    panel.appendChild(done);
    ok.focus();
  }

  function open(context) {
    close();
    opener = document.activeElement;
    const ctx = context && (context.prompt || context.taskName || context.lessonTitle) ? context : null;
    const demo = mode() === "local";

    overlay = el("div", "chat-overlay fb-overlay");
    const panel = el("div", "chat-panel fb-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Skicka feedback");

    const head = el("header", "chat-head");
    head.appendChild(el("h2", "chat-title", "📣 Skicka feedback"));
    const closeBtn = el("button", "chat-close", "✕");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Stäng");
    closeBtn.addEventListener("click", close);
    head.appendChild(closeBtn);
    panel.appendChild(head);

    const form = el("form", "fb-form");
    form.appendChild(el("p", "fb-intro", "Hittade du ett fel, eller har du en idé? Berätta, så läser den som driver sidan det."));

    // what kind of message
    let kind = KINDS[0];
    const kinds = el("div", "fb-kinds");
    kinds.setAttribute("role", "radiogroup");
    kinds.setAttribute("aria-label", "Vad gäller det?");
    KINDS.forEach(function (k) {
      const b = el("button", "fb-kind" + (k === kind ? " is-on" : ""), k.label);
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(k === kind));
      b.addEventListener("click", function () {
        kind = k;
        Array.prototype.forEach.call(kinds.children, function (c) { c.classList.toggle("is-on", c === b); c.setAttribute("aria-checked", String(c === b)); });
      });
      kinds.appendChild(b);
    });
    form.appendChild(kinds);

    const area = el("textarea", "chat-input");
    area.maxLength = MAX;
    area.rows = 5;
    area.placeholder = "Skriv här…";
    area.setAttribute("aria-label", "Ditt meddelande");
    form.appendChild(area);

    let attach = null;
    if (ctx) {
      const box = el("label", "fb-attach");
      attach = document.createElement("input");
      attach.type = "checkbox";
      attach.checked = true;
      const what = [ctx.taskName, ctx.lessonTitle].filter(Boolean).join(" i ");
      box.append(attach, el("span", "", "Skicka med vilken uppgift jag tittar på" + (what ? " (" + what + ")" : "")));
      form.appendChild(box);
    }

    const emailLabel = el("label", "fb-email-label", "Din e-post, om du vill ha svar (valfritt)");
    const email = document.createElement("input");
    email.type = "email";
    email.className = "chat-input fb-email";
    email.maxLength = 120;
    email.autocomplete = "email";
    emailLabel.appendChild(email);
    form.appendChild(emailLabel);

    // hidden field: a person never sees it, a form-filling robot does
    const trap = document.createElement("input");
    trap.type = "text";
    trap.name = "website";
    trap.tabIndex = -1;
    trap.autocomplete = "off";
    trap.setAttribute("aria-hidden", "true");
    trap.className = "fb-trap";
    form.appendChild(trap);

    const user = deps.getUser();
    const who = user && user.name ? "Ditt namn" + (user.className ? " och din klass" : "") + " följer med, eftersom du är inloggad." : "Du är inte inloggad, så ingen vet vem du är om du inte skriver det.";
    form.appendChild(el("p", "fb-note", demo ? "Sidan körs i demoläge. Det här öppnar ditt e-postprogram." : who));

    const error = el("p", "chat-error");
    error.hidden = true;
    form.appendChild(error);
    const send = el("button", "chat-send", demo ? "Öppna e-post ✉️" : "Skicka 📨");
    send.type = "submit";
    const foot = el("div", "chat-foot");
    foot.append(el("span", "chat-hint", ""), send);
    form.appendChild(foot);
    panel.appendChild(form);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const text = area.value.trim();
      if (text.length < 3) { error.textContent = "Skriv en rad eller två först."; error.hidden = false; area.focus(); return; }
      error.hidden = true;
      const withContext = ctx && attach && attach.checked;

      if (demo) {
        if (!contact()) { error.textContent = "Det går inte att skicka feedback från demoläget, eftersom sidan inte vet vart den ska skickas."; error.hidden = false; return; }
        window.location.href = mailtoLink(kind, text, email.value.trim(), withContext ? ctx : null);
        thanks(panel, "Ditt e-postprogram har öppnats med meddelandet. Tryck på skicka där.");
        return;
      }

      send.disabled = true;
      const payload = { kind: kind.id, text: text, email: email.value.trim(), page: window.location.hash || "start", website: trap.value };
      if (withContext) {
        payload.context = { prompt: ctx.prompt, answer: ctx.answer, lessonTitle: ctx.lessonTitle, taskName: ctx.taskName, status: ctx.status };
        payload.page = (window.location.hash || "start") + (ctx.lessonId ? " (" + ctx.lessonId + (ctx.taskId ? ", " + ctx.taskId : "") + ")" : "");
      }
      window.GaussicaAPI.post("/api/feedback", payload).then(function () {
        thanks(panel, "Ditt meddelande är skickat. Det är till stor hjälp.");
      }).catch(function (err) {
        error.textContent = err && err.message ? err.message : "Kunde inte skicka just nu. Försök igen om en stund.";
        error.hidden = false;
        send.disabled = false;
      });
    });

    overlay.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
    });
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    setTimeout(function () { area.focus(); }, 30);
  }

  const footerButton = document.getElementById("footer-feedback");
  if (footerButton) footerButton.addEventListener("click", function () { open(null); });

  return { init: init, open: open };
}());
