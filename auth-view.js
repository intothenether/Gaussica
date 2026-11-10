// API client + login / registration screen.
//
// GaussicaAPI   – fetch wrapper for /api (JSON, session cookie)
// GaussicaAuth  – ensureLoggedIn() shows the sign-in screen until the user has an account
//                 and resolves with the user; logout() ends the session.

window.GaussicaAPI = (function () {
  "use strict";

  // "server" when the Node server answers /api, "local" when the site is static (GitHub Pages):
  // then GaussicaLocal keeps accounts and progress in this browser instead.
  // "remote" when config.js points at the shared Cloudflare API: logged-in users are then identified by a
  // token kept in this browser instead of a cookie.
  const TOKEN_KEY = "gaussica.token";
  let backend = null;
  let apiBase = "";

  function getToken() { try { return window.localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function setToken(t) {
    try { if (t) window.localStorage.setItem(TOKEN_KEY, t); else window.localStorage.removeItem(TOKEN_KEY); } catch (e) { /* storage blocked */ }
  }

  async function detect() {
    if (backend) return backend;
    const cfg = window.GAUSSICA_CONFIG || {};
    // the trial for a parent (demo.js) is always on this browser, whatever config.js says
    if (window.GaussicaLocal && window.GaussicaLocal.demo && window.GaussicaLocal.demo.active) { backend = "local"; return backend; }
    if (cfg.apiBase) {
      apiBase = String(cfg.apiBase).replace(/\/+$/, "");
      backend = "remote";
      return backend;
    }
    if (!window.GaussicaLocal) { backend = "server"; return backend; }
    try {
      const res = await fetch("/api/me", { credentials: "same-origin" });
      backend = res.ok && /json/i.test(res.headers.get("content-type") || "") ? "server" : "local";
    } catch (e) {
      // A stopped dev server should still show the connection error; anywhere else there is no server to wait for.
      backend = /^(localhost|127\.|\[::1\])/.test(window.location.hostname) ? null : "local";
      if (!backend) return "server";
    }
    return backend;
  }

  // The last answer to the three reads that the page needs to start is kept in this browser, so that a visit
  // without any connection can still show the account, the progress and the teacher's own lessons. Only used when
  // the server cannot be reached at all, and removed again when the user logs out.
  const CACHE_PREFIX = "gaussica.cache.";
  const CACHED_PATHS = ["/api/me", "/api/me/data", "/api/lessons"];

  function readCache(path) {
    if (CACHED_PATHS.indexOf(path) < 0) return null;
    try { return JSON.parse(window.localStorage.getItem(CACHE_PREFIX + path) || "null"); } catch (e) { return null; }
  }

  function writeCache(path, json) {
    if (CACHED_PATHS.indexOf(path) < 0 || !json) return;
    try {
      const text = JSON.stringify(json);
      if (text.length < 1500000) window.localStorage.setItem(CACHE_PREFIX + path, text);
    } catch (e) { /* storage full or blocked */ }
  }

  function clearCache() {
    try {
      Object.keys(window.localStorage).filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0; }).forEach(function (k) { window.localStorage.removeItem(k); });
    } catch (e) { /* storage blocked */ }
  }

  async function request(method, path, body, options) {
    if ((await detect()) === "local") {
      try {
        return await window.GaussicaLocal.handle(method, path, body);
      } catch (e) {
        if (!e.status) e.status = 500;
        throw e;
      }
    }
    const remote = backend === "remote";
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const headers = { "Content-Type": "application/json" };
    if (remote && getToken()) headers.Authorization = "Bearer " + getToken();
    let res;
    try {
      res = await fetch((remote ? apiBase : "") + path, {
        method: method,
        credentials: remote ? "omit" : "same-origin",
        headers: headers,
        body: payload,
        // keepalive requests are capped at 64 KB, drawings can be larger
        keepalive: Boolean(options && options.keepalive) && (!payload || payload.length < 60000)
      });
    } catch (e) {
      const cached = method === "GET" ? readCache(path) : null;
      if (cached) return cached;
      const err = new Error(remote ? "Kan inte nå databasen. Kontrollera internetanslutningen." : "Kan inte nå servern. Kontrollera anslutningen.");
      err.status = 0;
      throw err;
    }
    let json = null;
    try { json = await res.json(); } catch (e) { /* empty or not JSON */ }
    if (!res.ok) {
      const err = new Error((json && json.error) || "Något gick fel (" + res.status + ").");
      err.status = res.status;
      if (json && json.code) err.code = json.code;
      // the family has no access (a trial that ended, a subscription that lapsed): the page says so, once
      if (res.status === 402 && json && json.code === "subscription" && window.GaussicaSubscription) window.GaussicaSubscription.expired();
      throw err;
    }
    if (remote && json && json.token) setToken(json.token);
    if (path === "/api/logout") { if (remote) setToken(null); clearCache(); }
    if (method === "GET") writeCache(path, json);
    return json;
  }

  return {
    mode: function () { return backend; },
    clearCache: clearCache,
    request: request,
    get: function (path) { return request("GET", path); },
    post: function (path, body) { return request("POST", path, body === undefined ? {} : body); },
    put: function (path, body, options) { return request("PUT", path, body, options); },
    del: function (path) { return request("DELETE", path); }
  };
}());

window.GaussicaAuth = (function () {
  "use strict";

  const API = window.GaussicaAPI;

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function screen() {
    let s = document.getElementById("auth-screen");
    if (!s) {
      s = el("div", "auth-screen");
      s.id = "auth-screen";
      document.body.appendChild(s);
    }
    s.hidden = false;
    document.body.classList.add("auth-open");
    return s;
  }

  function hideScreen() {
    const s = document.getElementById("auth-screen");
    if (s) s.remove();
    document.body.classList.remove("auth-open");
  }

  function wordmark() {
    const w = el("div", "wordmark auth-wordmark");
    const mark = el("img", "wordmark-mark");
    mark.src = "./logo.svg";
    mark.alt = "";
    mark.width = 44;
    mark.height = 44;
    const text = el("span");
    text.append("Gauss", el("span", "wordmark-light", "ica"));
    w.append(mark, text);
    return w;
  }

  function field(id, label, input, hint) {
    const wrap = el("div", "auth-field");
    const l = el("label", "", label);
    l.setAttribute("for", id);
    input.id = id;
    wrap.append(l, input);
    if (hint) wrap.appendChild(el("small", "", hint));
    return wrap;
  }

  function input(type, name, autocomplete, extra) {
    const i = el("input");
    i.type = type;
    i.name = name;
    i.autocomplete = autocomplete;
    i.required = true;
    i.setAttribute("autocapitalize", "none");
    i.spellcheck = false;
    Object.keys(extra || {}).forEach(function (k) { i.setAttribute(k, extra[k]); });
    return i;
  }

  // Connection problem (e.g. the server is not running).
  function showServerError(message) {
    return new Promise(function (resolve) {
      const s = screen();
      s.replaceChildren();
      const card = el("div", "auth-card");
      card.append(wordmark(), el("h1", "", "Ingen kontakt med servern"),
        el("p", "auth-lead", message + (API.mode() === "remote" ? " Försök igen om en stund." : " Starta servern med “npm start” (eller “node server.js”) och försök igen.")));
      const retry = el("button", "primary-button auth-submit", "Försök igen");
      retry.type = "button";
      retry.addEventListener("click", resolve);
      card.appendChild(retry);
      s.appendChild(card);
    });
  }

  function showAuthScreen() {
    return new Promise(function (resolve) {
      const s = screen();
      s.replaceChildren();
      const card = el("div", "auth-card");
      card.appendChild(wordmark());
      const title = el("h1", "", "Välkommen");
      const lead = el("p", "auth-lead", "Logga in för att fortsätta där du slutade – dina svar och framsteg sparas på ditt konto.");
      card.append(title, lead);
      if (API.mode() === "local") {
        card.appendChild(el("p", "auth-note", "Demoläge: det finns ingen server här, så konton och framsteg sparas bara i den här webbläsaren."));
      }

      const tabs = el("div", "auth-tabs");
      tabs.setAttribute("role", "tablist");
      const tabLogin = el("button", "", "Logga in");
      const tabRegister = el("button", "", "Skapa konto");
      [tabLogin, tabRegister].forEach(function (t) { t.type = "button"; t.setAttribute("role", "tab"); });
      tabs.append(tabLogin, tabRegister);
      card.appendChild(tabs);

      const body = el("div", "auth-body");
      card.appendChild(body);
      if (window.GaussicaPrivacy) card.appendChild(window.GaussicaPrivacy.link("Så hanteras dina uppgifter", "pv-link auth-privacy"));
      const fb = el("button", "pv-link auth-privacy", "Skicka feedback");
      fb.type = "button";
      fb.addEventListener("click", function () { if (window.GaussicaFeedback) window.GaussicaFeedback.open(null); });
      card.appendChild(fb);
      const parents = el("a", "pv-link auth-privacy auth-parents", "Läs mer för föräldrar");
      parents.href = "./foraldrar.html";
      card.appendChild(parents);
      const tryIt = el("a", "pv-link auth-privacy auth-parents", "Prova utan konto");
      tryIt.href = "./index.html#prova";
      card.appendChild(tryIt);
      s.appendChild(card);

      let mode = "login";
      let role = "student";

      function render() {
        tabLogin.setAttribute("aria-selected", String(mode === "login"));
        tabRegister.setAttribute("aria-selected", String(mode === "register"));
        body.replaceChildren();
        const form = el("form", "auth-form");
        form.noValidate = false;
        const error = el("p", "auth-error");
        error.setAttribute("role", "alert");
        error.hidden = true;

        let name, user, pass, code;
        if (mode === "register") {
          const roles = el("div", "auth-roles");
          [["student", "Jag är elev"], ["caregiver", "Jag är vårdnadshavare"], ["teacher", "Jag är lärare"]].forEach(function (r) {
            const b = el("button", "", r[1]);
            b.type = "button";
            b.setAttribute("aria-pressed", String(role === r[0]));
            b.addEventListener("click", function () { role = r[0]; render(); });
            roles.appendChild(b);
          });
          form.appendChild(roles);
          name = input("text", "displayName", "name", { maxlength: "80" });
          form.appendChild(field("auth-name", "Ditt namn", name, role === "student" ? "Förnamn eller smeknamn räcker. Skriv inget privat som adress eller telefonnummer." : ""));
          if (role === "caregiver") {
            const about = el("p", "auth-about", "Med ett konto som vårdnadshavare ser du hur det går för barnen, kan ge dem uppdrag och heja på, och svara när de undrar något. Du får en familjekod som barnen skapar konto med, eller så lägger du till deras konton själv.");
            form.appendChild(about);
          }
        }
        user = input("text", "username", "username", { maxlength: "40" });
        form.appendChild(field("auth-user", "Användarnamn", user,
          mode === "register" ? "3–30 tecken: bokstäver, siffror, punkt, understreck eller bindestreck." : ""));
        pass = input("password", "password", mode === "login" ? "current-password" : "new-password", { maxlength: "200" });
        const passField = field("auth-pass", "Lösenord", pass, mode === "register" ? "Minst 8 tecken." : "");
        const toggle = el("button", "auth-toggle", "Visa");
        toggle.type = "button";
        toggle.setAttribute("aria-label", "Visa lösenordet");
        toggle.addEventListener("click", function () {
          const show = pass.type === "password";
          pass.type = show ? "text" : "password";
          toggle.textContent = show ? "Dölj" : "Visa";
        });
        passField.classList.add("has-toggle");
        passField.appendChild(toggle);
        form.appendChild(passField);
        let guideCode = null, email = null, terms = null;
        if (mode === "register" && role === "caregiver") {
          email = input("email", "email", "email", { maxlength: "120" });
          form.appendChild(field("auth-email", "E-post", email, "Du får ett mejl för att bekräfta adressen. Den behövs om du glömmer lösenordet. Barnen behöver ingen."));
          terms = el("label", "auth-terms");
          const box = document.createElement("input");
          box.type = "checkbox";
          box.required = true;
          terms.appendChild(box);
          const text = el("span");
          const link = function (label, href) { const a = el("a", "", label); a.href = href; a.target = "_blank"; a.rel = "noopener"; return a; };
          text.append("Jag är vårdnadshavare och har läst ", link("villkoren", "./villkor.html"), " och ", link("integritetstexten", "./integritet.html"), ".");
          terms.appendChild(text);
          terms.input = box;
        }
        if (mode === "register" && role === "caregiver") {
          guideCode = input("text", "guideCode", "off", { maxlength: "40" });
          guideCode.required = false;
          form.appendChild(field("auth-guide", "Kod för vuxna (valfritt)", guideCode, "Har den andra vårdnadshavaren redan skapat familjen? Skriv koden för vuxna, så får du samma familj i stället för en egen."));
        }
        if (terms) form.appendChild(terms);
        if (mode === "register" && role !== "caregiver") {
          code = input("text", "code", "off", { maxlength: "40" });
          form.appendChild(role === "student"
            ? field("auth-code", "Kod", code, "Du får koden av din lärare eller vårdnadshavare.")
            : field("auth-code", "Lärarkod", code, API.mode() === "local"
              ? "I demoläget är lärarkoden " + window.GaussicaLocal.teacherCode + "."
              : API.mode() === "remote"
                ? "Lärarkoden har ställts in av den som driver sidan."
                : "Koden visas när servern startas första gången (eller med “node server.js --teacher-code”)."));
        }

        const submit = el("button", "primary-button auth-submit", mode === "login" ? "Logga in" : "Skapa konto");
        submit.type = "submit";
        form.append(error, submit);
        if (mode === "login") {
          const forgotLink = el("button", "pv-link auth-forgot", "Glömt lösenord?");
          forgotLink.type = "button";
          forgotLink.addEventListener("click", function () { renderForgot(); });
          form.appendChild(forgotLink);
        }

        form.addEventListener("submit", async function (e) {
          e.preventDefault();
          error.hidden = true;
          submit.disabled = true;
          submit.textContent = "Vänta…";
          try {
            let result;
            if (mode === "login") {
              result = await API.post("/api/login", { username: user.value.trim(), password: pass.value });
            } else {
              const payload = { role: role, displayName: name.value.trim(), username: user.value.trim(), password: pass.value };
              if (role === "student") payload.classCode = code.value; else if (role === "teacher") payload.teacherCode = code.value; else if (guideCode && guideCode.value.trim()) payload.guideCode = guideCode.value.trim();
              if (email) { payload.email = email.value.trim(); payload.acceptTerms = Boolean(terms && terms.input.checked); }
              result = await API.post("/api/register", payload);
            }
            hideScreen();
            resolve(result.user);
          } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
            submit.disabled = false;
            submit.textContent = mode === "login" ? "Logga in" : "Skapa konto";
          }
        });

        body.appendChild(form);
        (mode === "register" ? name : user).focus();
      }

      // a new password by e-mail: only an adult with a verified address; a child asks the adult
      function renderForgot() {
        body.replaceChildren();
        const form = el("form", "auth-form");
        const mail = input("email", "email", "email", { maxlength: "120" });
        form.appendChild(field("auth-forgot-mail", "Din e-postadress", mail, "Vi skickar en länk om adressen hör till ett konto. Kolla i skräpposten också. Barn ber sin vårdnadshavare eller lärare om ett nytt lösenord."));
        const note = el("p", "auth-note");
        note.setAttribute("role", "status");
        note.hidden = true;
        const error = el("p", "auth-error");
        error.setAttribute("role", "alert");
        error.hidden = true;
        const send = el("button", "primary-button auth-submit", "Skicka länk");
        send.type = "submit";
        const back = el("button", "pv-link auth-forgot", "Tillbaka till inloggningen");
        back.type = "button";
        back.addEventListener("click", function () { mode = "login"; render(); });
        form.append(error, note, send, back);
        form.addEventListener("submit", async function (e) {
          e.preventDefault();
          error.hidden = true;
          send.disabled = true;
          try {
            await API.post("/api/auth/forgot", { email: mail.value.trim() });
            note.textContent = "Om adressen hör till ett konto har vi skickat en länk. Den fungerar i en timme.";
            note.hidden = false;
          } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
          }
          send.disabled = false;
        });
        body.appendChild(form);
        mail.focus();
      }

      tabLogin.addEventListener("click", function () { mode = "login"; render(); });
      tabRegister.addEventListener("click", function () { mode = "register"; render(); });
      render();
    });
  }

  // A card with a title, a text and one button, in the place of the sign-in screen; resolves when the button is pressed.
  function showCard(title, text, buttonLabel, failed) {
    return new Promise(function (resolve) {
      const s = screen();
      s.replaceChildren();
      const card = el("div", "auth-card");
      const p = el("p", failed ? "auth-error" : "auth-lead", text);
      p.setAttribute("role", failed ? "alert" : "status");
      const b = el("button", "primary-button auth-submit", buttonLabel);
      b.type = "button";
      b.addEventListener("click", function () { hideScreen(); resolve(); });
      card.append(wordmark(), el("h1", "", title), p, b);
      s.appendChild(card);
      b.focus();
    });
  }

  async function showVerified(token) {
    try {
      const r = await API.post("/api/auth/verify-email", { token: token });
      await showCard("Adressen är bekräftad", "Tack! " + (r.email || "Din e-postadress") + " är bekräftad. Nu kan du få ett nytt lösenord av oss om du glömmer det.", "Fortsätt");
    } catch (err) {
      await showCard("Länken fungerar inte", err.message, "Fortsätt", true);
    }
  }

  function showReset(token) {
    return new Promise(function (resolve) {
      const s = screen();
      s.replaceChildren();
      const card = el("div", "auth-card");
      const form = el("form", "auth-form");
      const pass = input("password", "password", "new-password", { maxlength: "200" });
      form.appendChild(field("auth-reset-pass", "Nytt lösenord", pass, "Minst 8 tecken."));
      const error = el("p", "auth-error");
      error.setAttribute("role", "alert");
      error.hidden = true;
      const save = el("button", "primary-button auth-submit", "Spara nytt lösenord");
      save.type = "submit";
      form.append(error, save);
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        error.hidden = true;
        save.disabled = true;
        try {
          await API.post("/api/auth/reset", { token: token, password: pass.value });
          hideScreen();
          await showCard("Lösenordet är bytt", "Logga in med det nya lösenordet.", "Logga in");
          resolve();
        } catch (err) {
          error.textContent = err.message;
          error.hidden = false;
          save.disabled = false;
        }
      });
      card.append(wordmark(), el("h1", "", "Välj nytt lösenord"), form);
      s.appendChild(card);
      pass.focus();
    });
  }

  // #verifiera/<token> (the link to verify an address) and #aterstall/<token> (the link to choose a new password)
  async function handleEmailLinks() {
    const m = /^#(verifiera|aterstall)\/([A-Za-z0-9_-]{10,200})$/.exec(window.location.hash || "");
    if (!m) return;
    try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e) { /* the token stays in the address, nothing worse */ }
    if (m[1] === "verifiera") await showVerified(m[2]); else await showReset(m[2]);
  }

  async function ensureLoggedIn() {
    if (window.GaussicaLocal && window.GaussicaLocal.demo && window.GaussicaLocal.demo.active) await window.GaussicaLocal.demo.start();
    await handleEmailLinks();
    for (;;) {
      try {
        const me = await API.get("/api/me");
        if (me.user) return me.user;
        return await showAuthScreen();
      } catch (err) {
        await showServerError(err.message);
      }
    }
  }

  async function logout() {
    try { await API.post("/api/logout"); } catch (e) { /* session is gone either way */ }
    API.clearCache();
    window.location.reload();
  }

  return { ensureLoggedIn: ensureLoggedIn, logout: logout };
}());
