"use strict";
// Offline: the lesson bundle equals the single files, a visit without any connection falls back on the last answers
// to the start-up reads, and logging out removes them.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..") + "/";

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

(async function () {
  // ----- the bundle -----
  const { bundle } = require(ROOT + "scripts/build-bundle.js");
  const b = bundle(ROOT);
  const index = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
  ok(JSON.stringify(b.manifest) === JSON.stringify(index), "the bundle holds the index as it is");
  ok(b.lessons.length === index.lessons.length, "one lesson per entry of the index");
  index.lessons.forEach((file, i) => {
    const single = JSON.parse(fs.readFileSync(ROOT + "lessons/" + file, "utf8"));
    ok(JSON.stringify(single) === JSON.stringify(b.lessons[i]), file + ": the bundle has the same lesson as the file");
  });
  ok(Buffer.byteLength(JSON.stringify(b)) < 4 * 1024 * 1024, "the bundle stays small enough to load in one go");

  // ----- the manifest and the service worker -----
  const manifest = JSON.parse(fs.readFileSync(ROOT + "manifest.webmanifest", "utf8"));
  ok(manifest.name && manifest.start_url && manifest.display === "standalone", "the web app manifest can be installed");
  manifest.icons.forEach((icon) => ok(fs.existsSync(path.join(ROOT, icon.src)), "the icon " + icon.src + " exists"));
  const sw = fs.readFileSync(ROOT + "sw.js", "utf8");
  ok(/\/api\//.test(sw) && /origin/.test(sw), "the service worker leaves the API and other servers alone");
  const html = fs.readFileSync(ROOT + "index.html", "utf8");
  ok(html.includes('rel="manifest"') && html.includes("./offline.js"), "the page links the manifest and loads offline.js");

  // ----- the service worker (run here with a made-up browser around it) -----
  {
    const vm = require("vm");
    const listeners = {}, store = {};
    const cache = (name) => ({
      match: async (req) => store[name + ":" + (typeof req === "string" ? new URL(req, "https://site.test/").href : req.url)],
      put: async (req, res) => { store[name + ":" + req.url] = res; }
    });
    let online = true;
    const sandbox = {
      URL, setTimeout, Promise,
      self: { location: { origin: "https://site.test" }, addEventListener: (t, fn) => { listeners[t] = fn; }, skipWaiting() {}, clients: { claim: async () => {} } },
      caches: { open: async (n) => cache(n), keys: async () => [], delete: async () => true },
      fetch: async (req) => { if (!online) throw new TypeError("offline"); return { ok: true, url: req.url, clone() { return this; }, body: "fresh " + req.url }; }
    };
    vm.runInNewContext(fs.readFileSync(ROOT + "sw.js", "utf8"), sandbox);
    const ask = async (url, method, mode) => {
      let answer = null;
      const event = { request: { url, method: method || "GET", mode: mode || "no-cors" }, respondWith: (p) => { answer = p; }, waitUntil() {} };
      listeners.fetch(event);
      return answer ? Promise.resolve(answer).then((r) => ({ handled: true, res: r }), (e) => ({ handled: true, error: e })) : { handled: false };
    };
    ok(!(await ask("https://site.test/api/me")).handled, "service worker: the API is never handled");
    ok(!(await ask("https://site.test/app.js", "POST")).handled, "service worker: only GET is handled");
    ok(!(await ask("https://db.example.invalid/api/me")).handled, "service worker: other servers (the database) are left alone");
    ok((await ask("https://fonts.gstatic.com/s/nunito.woff2")).handled, "service worker: fonts are handled");
    const first = await ask("https://site.test/app.js");
    ok(first.handled && first.res.body === "fresh https://site.test/app.js", "service worker: online, the fresh file is used");
    online = false;
    const again = await ask("https://site.test/app.js");
    ok(again.res && again.res.body === "fresh https://site.test/app.js", "service worker: offline, the last copy is used");
    const never = await ask("https://site.test/never-seen.js");
    ok(never.error, "service worker: offline and never seen, it fails as usual");
    await ask("https://site.test/index.html", "GET", "navigate").then(() => {});
    online = true;
    await ask("https://site.test/index.html", "GET", "navigate");
    online = false;
    const nav = await ask("https://site.test/?x=1", "GET", "navigate");
    ok(nav.res && /index.html/.test(nav.res.body), "service worker: offline, a page address falls back on the stored page");
  }

  // ----- the last answers of the start-up reads -----
  const store = {};
  global.window = {
    GAUSSICA_CONFIG: { apiBase: "https://example.invalid" },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; },
      get length() { return Object.keys(store).length; }
    }
  };
  // Object.keys(localStorage) lists the stored keys in a browser
  const realKeys = Object.keys;
  Object.keys = function (o) { return o === window.localStorage ? realKeys(store) : realKeys(o); };
  let online = true;
  global.fetch = async (url) => {
    if (!online) throw new TypeError("Failed to fetch");
    const p = String(url).replace("https://example.invalid", "");
    const body = p === "/api/me" ? { user: { id: "u1", name: "Elev" } } : p === "/api/me/data" ? { progress: { a: { started: true } }, attempts: [] } : p === "/api/lessons" ? { lessons: [] } : { ok: true };
    return { ok: true, status: 200, json: async () => body, headers: { get: () => "application/json" } };
  };
  global.document = { createElement: () => ({}) };
  require(ROOT + "auth-view.js");
  const API = window.GaussicaAPI;

  const me = await API.get("/api/me");
  ok(me.user.id === "u1", "online: the answer comes from the server");
  await API.get("/api/me/data");
  await API.get("/api/lessons");
  online = false;
  const offlineMe = await API.get("/api/me");
  ok(offlineMe.user && offlineMe.user.id === "u1", "offline: the account comes from the last visit");
  const offlineData = await API.get("/api/me/data");
  ok(offlineData.progress && offlineData.progress.a.started, "offline: the progress comes from the last visit");
  let failed = null;
  try { await API.get("/api/teacher/students"); } catch (e) { failed = e; }
  ok(failed && failed.status === 0, "offline: other reads fail as before");
  failed = null;
  try { await API.put("/api/progress/a", { data: {} }); } catch (e) { failed = e; }
  ok(failed && failed.status === 0, "offline: a save fails (the page keeps it and sends it later)");

  online = true;
  await API.post("/api/logout");
  online = false;
  failed = null;
  try { await API.get("/api/me"); } catch (e) { failed = e; }
  ok(failed && failed.status === 0, "after logging out nothing is left to fall back on");

  console.log(failures ? failures + " FAILED" : "All offline checks passed");
  process.exit(failures ? 1 : 0);
}()).catch((e) => { console.log(e); process.exit(1); });
