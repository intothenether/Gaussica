"use strict";
// Planera efter mål against the real server: every request the planner makes is accepted, and the student sees the result.
// usage: node tests/api-planner.js <base> cookie <teacherCode>
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
const BASE = process.argv[2];
const TEACHER_CODE = process.argv[4] || "LARARE1";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "lesson-model.js");
require(ROOT + "pyssel.js");
window.MATTE_SYMBOLIC = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
require(ROOT + "lgr22.js");
const P = require(ROOT + "planner.js");

let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

function who() {
  const jar = { cookie: null };
  return {
    async call(method, p, body) {
      const headers = { "Content-Type": "application/json", Origin: BASE };
      if (jar.cookie) headers.Cookie = jar.cookie;
      const res = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const sc = res.headers.get("set-cookie");
      if (sc && /^gs=/.test(sc)) jar.cookie = sc.split(";")[0];
      let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
      return { status: res.status, json };
    }
  };
}

(async () => {
  const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
  const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
  const T = who(), S = who();
  await T.call("POST", "/api/register", { role: "teacher", username: "lararP", displayName: "Fröken Plan", password: "hemligt-123", teacherCode: TEACHER_CODE });
  const cls = (await T.call("POST", "/api/teacher/classes", { name: "5P" })).json["class"];
  await S.call("POST", "/api/register", { role: "student", username: "elevP", displayName: "Pia", password: "hemligt-123", classCode: cls.code });

  const goals = P.goals([], lessons, {});
  let created = 0, rejected = 0, provs = 0;
  for (const c of goals.slice(0, 12)) {
    const plan = P.proposal(c.item.id, [], lessons, [], cls.id);
    const reqs = P.requests(plan, { classId: cls.id, ids: plan.lessons.map((x) => x.lesson.id), prov: { perLesson: 3, minutes: 20 }, note: "Vi övar: " + c.item.text, dueDate: "2026-12-01" });
    for (const r of reqs) {
      const res = await T.call("POST", "/api/teacher/assignments", r);
      if (res.status === 201) { created += 1; if (r.kind === "prov") provs += 1; } else { rejected += 1; console.log("     " + res.status + " " + JSON.stringify(res.json) + " " + JSON.stringify(r).slice(0, 160)); }
    }
  }
  ok(created > 20 && rejected === 0, "every assignment the planner makes is accepted by the server (" + created + " created, " + rejected + " refused)");
  ok(provs >= 5, "and the prov too (" + provs + ")");
  const mine = (await S.call("GET", "/api/me/data")).json.assignments;
  ok(mine.length === created, "the student sees all of them (" + mine.length + ")");
  ok(mine.some((a) => a.kind === "prov" && a.config && a.config.lessons.length >= 1 && /^Prov: /.test(a.config.title)) && mine.every((a) => a.dueDate === "2026-12-01"), "with the prov settings and the date");
  const list = (await T.call("GET", "/api/teacher/assignments")).json.assignments;
  const again = P.proposal(goals[0].item.id, [], lessons, list, cls.id);
  ok(again.lessons.every((x) => x.already && !x.pick), "afterwards the planner knows those lessons already are assignments for the class");

  console.log(failures ? failures + " FAILED" : "ALL PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
