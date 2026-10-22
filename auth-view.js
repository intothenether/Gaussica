// API client + login / registration screen.
//
// GaussicaAPI   – fetch wrapper for /api (JSON, session cookie)
// GaussicaAuth  – ensureLoggedIn() shows the sign-in screen until the user has an account
//                 and resolves with the user; logout() ends the session.

window.GaussicaAPI = (function () {
  "use strict";

  async function request(method, path, body, options) {
    let res;
    try {
      res = await fetch(path, {
        method: method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        keepalive: Boolean(options && options.keepalive)
      });
    } catch (e) {
      const err = new Error("Kan inte nå servern. Kontrollera anslutningen.");
      err.status = 0;
      throw err;
    }
    let json = null;
    try { json = await res.json(); } catch (e) { /* empty or not JSON */ }
    if (!res.ok) {
      const err = new Error((json && json.error) || "Något gick fel (" + res.status + ").");
      err.status = res.status;
      throw err;
    }
    return json;
  }

  return {
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
        el("p", "auth-lead", message + " Starta servern med “npm start” (eller “node server.js”) och försök igen."));
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

      const tabs = el("div", "auth-tabs");
      tabs.setAttribute("role", "tablist");
      const tabLogin = el("button", "", "Logga in");
      const tabRegister = el("button", "", "Skapa konto");
      [tabLogin, tabRegister].forEach(function (t) { t.type = "button"; t.setAttribute("role", "tab"); });
      tabs.append(tabLogin, tabRegister);
      card.appendChild(tabs);

      const body = el("div", "auth-body");
      card.appendChild(body);
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
          [["student", "Jag är elev"], ["teacher", "Jag är lärare"]].forEach(function (r) {
            const b = el("button", "", r[1]);
            b.type = "button";
            b.setAttribute("aria-pressed", String(role === r[0]));
            b.addEventListener("click", function () { role = r[0]; render(); });
            roles.appendChild(b);
          });
          form.appendChild(roles);
          name = input("text", "displayName", "name", { maxlength: "80" });
          form.appendChild(field("auth-name", "Ditt namn", name));
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
        if (mode === "register") {
          code = input("text", "code", "off", { maxlength: "40" });
          form.appendChild(role === "student"
            ? field("auth-code", "Klasskod", code, "Du får koden av din lärare.")
            : field("auth-code", "Lärarkod", code, "Koden visas när servern startas första gången (eller med “node server.js --teacher-code”)."));
        }

        const submit = el("button", "primary-button auth-submit", mode === "login" ? "Logga in" : "Skapa konto");
        submit.type = "submit";
        form.append(error, submit);

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
              if (role === "student") payload.classCode = code.value; else payload.teacherCode = code.value;
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

      tabLogin.addEventListener("click", function () { mode = "login"; render(); });
      tabRegister.addEventListener("click", function () { mode = "register"; render(); });
      render();
    });
  }

  async function ensureLoggedIn() {
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
    window.location.reload();
  }

  return { ensureLoggedIn: ensureLoggedIn, logout: logout };
}());
