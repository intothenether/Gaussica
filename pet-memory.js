// What the pet remembers, and says on special days. The speech bubble on the start page used to pick one of six lines that were the same for everybody. Now it
// can refer to what the student really has done: "Yesterday you finished ..." or "You did not give up on ...". It is only ever kind: nothing is said about
// what was not done, nothing is counted against the student, and a long time away is met with "how nice that you are back".
//
//   GaussicaPetMemory.lines(ctx)        what the pet could say now, most special first: [{ id, text, weight }]
//   GaussicaPetMemory.say(ctx)          one of them (the same during a visit, another the next time: ctx.seed), or null
//   GaussicaPetMemory.greeting(date)    the line for a special day (Lucia, Midsommar, ...), or null
//   GaussicaPetMemory.easter(year)      the date of Easter Sunday (a Date)
//
//   ctx = { now (ms), seed (a number), done: [{ title, area, at }], fixed: [{ title, at }], areas: { tal: "Tal & räkning", ... }, counts: { tal: 3, ... },
//           gapDays (days since the student was last here, or null), friendship (the index of the level, 0 to 3), shopReady (there are coins for something new), seasonal: [{ name, thing, ends }], trick: { name } | null, dusty: { trick, area } | null }
// A line never names a number the student did not earn, and a title is cut short so that the bubble stays small.

(function (root) {
  "use strict";

  const DAY = 86400000;
  const MILESTONES = [5, 10, 25, 50, 75, 100, 150, 200];

  // Easter Sunday (the computus of Meeus, Jones and Butcher)
  function easter(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  const FIXED = {
    "1/1": "Gott nytt år! Vilket år det blir för oss två!",
    "1/13": "Idag dansar vi ut julen! Hoppa med mig.",
    "2/14": "Glad alla hjärtans dag! ♥",
    "4/30": "Glad Valborg! Jag ser fram emot våren.",
    "5/1": "Första maj! Vilken fin dag.",
    "6/6": "Grattis på nationaldagen!",
    "10/4": "Idag är det kanelbullens dag! Mums.",
    "10/31": "Bu! Det är Halloween. Blev du rädd?",
    "12/13": "God Lucia! Jag tänder ett ljus för dig.",
    "12/24": "God jul! Tack för att du är min kompis.",
    "12/31": "Gott slut på året! Snart är det nytt år."
  };

  // the line of a special day, or null. Fettisdagen, Easter Sunday and Midsommarafton move, so they are worked out.
  function greeting(date) {
    const d = date instanceof Date ? date : new Date(date === undefined ? Date.now() : date);
    const key = (d.getMonth() + 1) + "/" + d.getDate();
    if (FIXED[key]) return FIXED[key];
    const e = easter(d.getFullYear());
    const same = function (x) { return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate(); };
    if (same(e)) return "Glad påsk! Har du hittat några ägg?";
    if (same(new Date(e.getFullYear(), e.getMonth(), e.getDate() - 47))) return "Idag är det fettisdag. Dags för semla!";
    if (d.getMonth() === 5 && d.getDay() === 5 && d.getDate() >= 19 && d.getDate() <= 25) return "Glad midsommar! Dags att dansa kring stången.";
    return null;
  }

  function short(title) {
    const t = String(title || "").trim();
    return t.length > 44 ? t.slice(0, 42).replace(/[ ,.:;]+$/, "") + "…" : t;
  }
  const quote = function (title) { return "”" + short(title) + "”"; };

  function lines(ctx) {
    ctx = ctx || {};
    const now = ctx.now === undefined ? Date.now() : ctx.now;
    const today = new Date(now);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const out = [];
    const add = function (id, text, weight) { out.push({ id: id, text: text, weight: weight }); };

    const special = greeting(today);
    if (special) add("greeting", special, 100);

    const done = (ctx.done || []).filter(function (d) { return d && d.title; });
    const recent = done.filter(function (d) { return d.at > 0; }).sort(function (a, b) { return b.at - a.at; });
    const yesterday = recent.filter(function (d) { return d.at >= startOfToday - DAY && d.at < startOfToday; })[0];
    const earlier = recent.filter(function (d) { return d.at >= startOfToday; })[0];
    if (yesterday) add("done-yesterday", "I går klarade du " + quote(yesterday.title) + ". Det var starkt!", 6);
    if (earlier) add("done-today", "Idag har du redan klarat " + quote(earlier.title) + "!", 6);

    const fixed = (ctx.fixed || []).filter(function (f) { return f && f.title && f.at >= startOfToday - 3 * DAY; }).sort(function (a, b) { return b.at - a.at; })[0];
    if (fixed) add("fixed", "Jag minns att du inte gav upp på " + quote(fixed.title) + ". Det var modigt!", 8);

    const total = done.length;
    if (total >= 3) {
      const reached = MILESTONES.filter(function (m) { return total >= m; }).pop();
      if (reached && total - reached <= 2) add("milestone", "Du har klarat " + total + " lektioner! Tänk att vi gjort allt det tillsammans.", 7);
      else add("total", "Vi har klarat " + total + " lektioner ihop. Det är jag stolt över.", 2);
    }

    const counts = ctx.counts || {}, areas = ctx.areas || {};
    const ranked = Object.keys(areas).map(function (a) { return { a: a, n: counts[a] || 0 }; }).sort(function (x, y) { return y.n - x.n; });
    if (ranked.length && ranked[0].n >= 3 && (ranked.length < 2 || ranked[0].n > ranked[1].n)) add("favourite", "Jag har märkt att du gillar " + areas[ranked[0].a] + ". Det gör jag också!", 3);
    const untouched = ranked.filter(function (r) { return r.n === 0; })[0];
    if (untouched && total >= 6) add("curious", "Har du provat " + areas[untouched.a] + "? Jag är nyfiken på det!", 2);

    if (ctx.gapDays !== null && ctx.gapDays !== undefined && ctx.gapDays >= 4) add("back", "Vad roligt att du är tillbaka! Jag har saknat dig.", 9);

    if (ctx.friendship >= 2) add("friends", ctx.friendship >= 3 ? "Vi är superbästisar, du och jag. 💛" : "Vi är bästisar nu, du och jag.", 2);

    if (ctx.shopReady) add("shop", "Du har nog med mynt för något nytt i butiken!", 3);

    (ctx.seasonal || []).slice(0, 2).forEach(function (s, i) { add("season-" + i, "Nu finns " + s.thing + " i butiken! Bara till " + s.ends + ".", 4); });

    if (ctx.trick) add("trick", "Jag har lärt mig ett nytt trick: " + ctx.trick.name + "! Vill du se det?", 8);
    if (ctx.dusty) add("dusty", "Mitt trick " + ctx.dusty.trick + " är lite rostigt. Ska vi repetera " + ctx.dusty.area + " tillsammans?", 3);

    return out.sort(function (a, b) { return b.weight - a.weight; });
  }

  // One line: a special day always wins. Otherwise one of the others, the more special ones more often, and a different one in the next visit (seed).
  // Returns { id, text } or null when there is nothing special to say (the caller then falls back on its general lines).
  function say(ctx) {
    const list = lines(ctx);
    if (!list.length) return null;
    if (list[0].id === "greeting") return { id: list[0].id, text: list[0].text };
    const total = list.reduce(function (s, l) { return s + l.weight; }, 0);
    const seed = Math.abs(Math.floor(Number(ctx && ctx.seed) || 0));
    let r = ((seed * 9301 + 49297) % 233280) / 233280 * total;
    for (let i = 0; i < list.length; i++) { r -= list[i].weight; if (r <= 0) return { id: list[i].id, text: list[i].text }; }
    return { id: list[0].id, text: list[0].text };
  }

  const api = { lines: lines, say: say, greeting: greeting, easter: easter, short: short };
  root.GaussicaPetMemory = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
