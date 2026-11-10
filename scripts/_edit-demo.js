const fs = require("fs");
function edit(file, pairs) {
  let t = fs.readFileSync(file, "utf8");
  const crlf = /\r\n/.test(t);
  if (crlf) t = t.replace(/\r\n/g, "\n");
  pairs.forEach(([a, b]) => { if (!t.includes(a)) throw new Error("missing in " + file + ": " + a.slice(0, 70)); t = t.replace(a, () => b); });
  fs.writeFileSync(file, crlf ? t.replace(/\n/g, "\r\n") : t);
}

edit("local-backend.js", [
  [`  const KEY = "gaussica.local.v1";`,
   `  // The page for parents sends a visitor to index.html#prova: the site is then tried without an account, on this browser only, with a family and a child that
  // are made here (not the server, whatever config.js says), kept apart from the demo accounts of the developer (see demo.js and startDemo below).
  const DEMO = (function () {
    try {
      if (/^#prova\\b/.test(window.location.hash)) {
        window.sessionStorage.setItem("gaussica.demo", "1");
        window.sessionStorage.setItem("gaussica.preview", "1");   // starts as the child: the parent sees what the child sees first
        window.history.replaceState(null, "", window.location.pathname + window.location.search + "#start");
      }
      return window.sessionStorage.getItem("gaussica.demo") === "1";
    } catch (e) { return false; }
  }());
  const KEY = DEMO ? "gaussica.demo.v1" : "gaussica.local.v1";`],
  [`  let db = load();
  let memoryOnly = false;`, `  let db = load();
  let memoryOnly = false;

  // ----- the trial for a parent (DEMO): a caregiver with a family, and a child who has done a few things this week -----
  const DEMO_USER = "prova.forald";
  async function startDemo() {
    const have = db.users.find(function (u) { return u.username === DEMO_USER; });
    if (have) { if (!db.session) { db.session = have.id; save(); } return; }
    const guardian = (await register({ role: "caregiver", username: DEMO_USER, displayName: "Förälder (prov)", password: "prova-prova-123" })).user;
    const family = db.classes[0];
    const kid = (await register({ role: "student", username: "maja.prova", displayName: "Maja", password: "prova-prova-123", classCode: family.code })).user;
    db.session = guardian.id;
    const at = function (daysAgo, minute) { return new Date(Date.now() - daysAgo * 86400000 - minute * 60000).toISOString(); };
    const attempt = function (lessonId, title, prompt, answer, ok, misconception, correct, daysAgo, minute) {
      const data = { lessonId: lessonId, lessonTitle: title, taskId: "exercise", taskName: "Din tur", prompt: prompt, answer: answer, scratchpad: "", completed: ok,
        feedback: ok ? "Rätt!" : "", feedbackType: ok ? "correct" : "hint", misconception: misconception, attemptNo: 1, correctAnswer: correct, seconds: ok ? 55 : 80 };
      db.attempts.push({ id: db.next.attempt++, userId: kid.id, lessonId: lessonId, taskId: "exercise", completed: ok, data: data, createdAt: at(daysAgo, minute) });
    };
    attempt("addition", "Addition: lägg ihop tal", "Räkna ut 358 + 176.", "424", false, "Glömde att växla", "534", 3, 6);
    attempt("addition", "Addition: lägg ihop tal", "Räkna ut 358 + 176.", "534", true, null, "534", 3, 4);
    attempt("addition-uppstallning", "Addition med uppställning", "Räkna ut 38 + 47 med uppställning.", "58", false, "Siffrorna i fel ordning", "85", 1, 9);
    attempt("addition-uppstallning", "Addition med uppställning", "Räkna ut 38 + 47 med uppställning.", "1000", false, "Generellt beräkningsfel", "85", 1, 7);
    db.progress[kid.id] = {
      addition: { started: true, answers: { exercise: { answer: "534", scratchpad: "", feedback: "Rätt!", feedbackType: "correct", completed: true } }, interactive: {} },
      "addition-uppstallning": { started: true, answers: { exercise: { answer: "1000", scratchpad: "", feedback: "", feedbackType: "hint", completed: false } }, interactive: {} }
    };
    save();
  }

  function resetDemo() {
    try { window.localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ }
    db = empty();
  }`]
]);
// export the demo hooks next to handle
let t = fs.readFileSync("local-backend.js", "utf8");
const crlf = /\r\n/.test(t); if (crlf) t = t.replace(/\r\n/g, "\n");
const m = /return \{([^}]*\bhandle\b[^}]*)\};\s*\n\}\(\)\);\s*$/.exec(t);
if (!m) throw new Error("no return of GaussicaLocal");
t = t.slice(0, m.index) + "return {" + m[1].replace(/\s+$/, "") + ", demo: { active: DEMO, start: startDemo, reset: resetDemo } };\n}());\n";
fs.writeFileSync("local-backend.js", crlf ? t.replace(/\n/g, "\r\n") : t);

edit("auth-view.js", [
  [`    if (!window.GaussicaLocal) { backend = "server"; return backend; }`, `    if (window.GaussicaLocal && window.GaussicaLocal.demo && window.GaussicaLocal.demo.active) { backend = "local"; return backend; }   // the trial for a parent (demo.js)
    if (!window.GaussicaLocal) { backend = "server"; return backend; }`],
  [`    if (cfg.apiBase) {
      apiBase = String(cfg.apiBase).replace(/\\/+$/, "");`, `    if (window.GaussicaLocal && window.GaussicaLocal.demo && window.GaussicaLocal.demo.active) { backend = "local"; return backend; }
    if (cfg.apiBase) {
      apiBase = String(cfg.apiBase).replace(/\\/+$/, "");`],
  [`  async function ensureLoggedIn() {
    await handleEmailLinks();`, `  async function ensureLoggedIn() {
    if (window.GaussicaLocal && window.GaussicaLocal.demo && window.GaussicaLocal.demo.active) await window.GaussicaLocal.demo.start();
    await handleEmailLinks();`]
]);

edit("subscription.js", [[`  function start(user, API) {
    me = user;
    api = API;
    if (!user) return;`, `  function start(user, API) {
    me = user;
    api = API;
    if (!user) return;
    if (window.GaussicaLocal && window.GaussicaLocal.demo && window.GaussicaLocal.demo.active) return;   // the trial for a parent: nothing about an account`]]);

edit("app.js", [[`GaussicaSubscription.start(currentUser, API)`, `GaussicaSubscription.start(currentUser, API);
      if (window.GaussicaDemo) window.GaussicaDemo.start()`]]);
edit("index.html", [[`<script src="./subscription.js"`, `<script src="./demo.js" defer></script>
    <script src="./subscription.js"`]]);
console.log("ok");
