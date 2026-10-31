"use strict";
// The checks of tests/multi-scenario.js (several adults per child, a child in several classes) against the demo backend that runs in the browser
// (local-backend.js), with a localStorage that lives in this process. The demo has one signed-in user at a time, so each person signs in again
// before what they do (their password is kept by the test).
const crypto = require("crypto");

const store = {};
global.window = {
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  crypto: crypto.webcrypto
};
require("../local-backend.js");
const API = window.GaussicaLocal;

let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

const CREATES = ["/api/register", "/api/teacher/classes", "/api/teacher/students", "/api/teacher/assignments", "/api/teacher/feedback", "/api/me/chat", "/api/teacher/chat"];

function who() {
  const me = { username: null, password: null };
  me.call = async (method, path, body) => {
    // the person signs in again first, unless this is the call that signs up or in
    if (me.username && path !== "/api/register" && path !== "/api/login") await API.handle("POST", "/api/login", { username: me.username, password: me.password });
    try {
      const json = await API.handle(method, path, body);
      if ((path === "/api/register" || path === "/api/login") && body) { me.username = body.username; me.password = body.password; }
      return { status: method === "POST" && CREATES.indexOf(path) >= 0 ? 201 : 200, json: json };   // the server says 201 when something was made
    } catch (e) {
      return { status: e.status || 500, json: { error: e.message } };
    }
  };
  return me;
}

(async () => {
  await require("./multi-scenario.js")(who, "GAUSSICA", ok);
  console.log(failures ? "\n" + failures + " FAILED" : "\nAll demo multi-membership checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
