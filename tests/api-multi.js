"use strict";
// Several adults per child and a child in more than one class: a school class and a family, two parents in one family.
// usage: node tests/api-multi.js <base> cookie <teacherCode>
const BASE = process.argv[2];
const TEACHER_CODE = process.argv[4] || "LARARE1";
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

function who() {
  const jar = { cookie: null };
  return {
    async call(method, path, body) {
      const headers = { "Content-Type": "application/json", Origin: BASE };
      if (jar.cookie) headers.Cookie = jar.cookie;
      const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const sc = res.headers.get("set-cookie");
      if (sc && /^gs=[^;]+/.test(sc)) jar.cookie = sc.split(";")[0];
      let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
      return { status: res.status, json };
    }
  };
}

(async () => {
  await require("./multi-scenario.js")(who, TEACHER_CODE, ok);
  console.log(failures ? "\n" + failures + " FAILED" : "\nAll multi-membership checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
