// The tricks of the pet. Every area of the maths (Tal, Algebra, Form, Tid, Data) teaches the pet three tricks as the student finishes lessons there: a dance,
// a somersault, a juggle with the things of the area (digits, x, shapes, clocks, dice). The student can ask for a trick in the room (the tab "Tricks"), and the
// pet does one now and then on the start page.
//
// A trick is never lost. It is shiny while the student has done something in its area during the last two weeks (a lesson, "Öva mer", "Repetera"). After that it
// is a little rusty: the pet still does it, with a stumble first, and says that it would like to practise. That is all: no coins are taken, nothing locks, and
// the pet is not sad. It is a gentle reason to take the review that the schedule suggests.
//
//   GaussicaPetTricks.TRICKS                       the catalogue: [{ id, area, need, name, move, props, say }]
//   GaussicaPetTricks.status(counts, activity, now) every trick with { unlocked, have, shiny } (counts: finished lessons per area, activity: the last time in each area, in ms)
//   GaussicaPetTricks.fresh(counts, seen)          the ids of the tricks that are unlocked and not in `seen` (the ones the student has not been told about)
//   GaussicaPetTricks.perform(host, trick, options) the pet does the trick in the picture `host` (see below). Returns a promise that is done when it ends.
//
// The movement is made with the Web Animations API on the picture of the pet and on a few small things that float up from it. With reduced motion the pet stands still
// and the things are shown for a moment.

(function (root) {
  "use strict";

  const SHINE_DAYS = 14;
  const NEED = [2, 5, 9];   // finished lessons in the area for the first, second and third trick

  // move: the movement of the pet (see MOVES). props: what floats up (see PROPS).
  const TRICKS = [
    { id: "tal-rakna", area: "tal", need: NEED[0], name: "Räkna högt", move: "vagga", props: "siffror", say: "Ett, två, tre... Titta, jag räknar!" },
    { id: "tal-jonglera", area: "tal", need: NEED[1], name: "Jonglera siffror", move: "hopp", props: "siffror2", say: "Se hur jag jonglerar med siffrorna!" },
    { id: "tal-volt", area: "tal", need: NEED[2], name: "Siffervolten", move: "volt", props: "tecken", say: "Plus, minus, gånger, delat med... och en volt!" },
    { id: "algebra-x", area: "algebra", need: NEED[0], name: "Var är x?", move: "titta", props: "x", say: "Var gömmer sig x? Jag letar!" },
    { id: "algebra-losa", area: "algebra", need: NEED[1], name: "Lös ekvationen", move: "bugning", props: "ekvation", say: "Och svaret är... ta-da!" },
    { id: "algebra-volt", area: "algebra", need: NEED[2], name: "Mysterievolten", move: "volt", props: "x", say: "Mysteriet är löst! Volt!" },
    { id: "geometri-dans", area: "geometri", need: NEED[0], name: "Formdansen", move: "vagga", props: "former", say: "Jag dansar med trianglarna!" },
    { id: "geometri-snurr", area: "geometri", need: NEED[1], name: "Rundsnurren", move: "snurr", props: "rund", say: "Rund som en cirkel! Hoppla!" },
    { id: "geometri-bygge", area: "geometri", need: NEED[2], name: "Pyramidbygget", move: "studsa", props: "pyramid", say: "Vi bygger en pyramid, bit för bit!" },
    { id: "matning-tick", area: "matning", need: NEED[0], name: "Klocktick", move: "vagga", props: "klocka", say: "Tick tack, tick tack!" },
    { id: "matning-volt", area: "matning", need: NEED[1], name: "Tidsvolten", move: "volt", props: "tid", say: "Hela timmen runt, på en sekund!" },
    { id: "matning-mat", area: "matning", need: NEED[2], name: "Mätdansen", move: "hopp", props: "enheter", say: "Centimeter, kilo och liter, dansa med!" },
    { id: "data-kast", area: "data", need: NEED[0], name: "Tärningskast", move: "studsa", props: "tarning", say: "Jag kastar tärningen. Vad blir det?" },
    { id: "data-snurr", area: "data", need: NEED[1], name: "Lyckosnurren", move: "snurr", props: "stjarnor", say: "Snurra, snurra, lyckohjul!" },
    { id: "data-volt", area: "data", need: NEED[2], name: "Slumpvolten", move: "volt", props: "tarning", say: "Slumpen blir bäst med en volt!" }
  ];

  // Movements of the picture: keyframes of a transform, how long it takes (ms), and where it turns. The rusty version starts with a stumble.
  const MOVES = {
    vagga: { ms: 2400, keys: [{ transform: "rotate(0)" }, { transform: "rotate(-9deg) translateY(-4px)" }, { transform: "rotate(9deg) translateY(-4px)" }, { transform: "rotate(-9deg) translateY(-4px)" }, { transform: "rotate(9deg) translateY(-4px)" }, { transform: "rotate(0)" }] },
    hopp: { ms: 2200, keys: [{ transform: "translateY(0)" }, { transform: "translateY(-26px)" }, { transform: "translateY(0)" }, { transform: "translateY(-26px)" }, { transform: "translateY(0)" }, { transform: "translateY(-34px) rotate(6deg)" }, { transform: "translateY(0)" }] },
    volt: { ms: 1700, keys: [{ transform: "translateY(0) rotate(0)" }, { transform: "translateY(-30px) rotate(180deg)" }, { transform: "translateY(0) rotate(360deg)" }] },
    snurr: { ms: 1800, keys: [{ transform: "scaleX(1)" }, { transform: "scaleX(-1)" }, { transform: "scaleX(1)" }, { transform: "scaleX(-1)" }, { transform: "scaleX(1)" }, { transform: "translateY(-18px) scaleX(1)" }, { transform: "translateY(0)" }] },
    studsa: { ms: 2000, keys: [{ transform: "scale(1,1)" }, { transform: "scale(1.08,.88)" }, { transform: "translateY(-26px) scale(.94,1.1)" }, { transform: "scale(1.08,.88)" }, { transform: "translateY(-18px) scale(.96,1.06)" }, { transform: "scale(1.06,.9)" }, { transform: "scale(1,1)" }] },
    titta: { ms: 2400, keys: [{ transform: "rotate(0)" }, { transform: "rotate(-12deg) translateX(-8px)" }, { transform: "rotate(-12deg) translateX(-8px)" }, { transform: "rotate(12deg) translateX(8px)" }, { transform: "rotate(12deg) translateX(8px)" }, { transform: "translateY(-22px)" }, { transform: "rotate(0)" }] },
    bugning: { ms: 2000, keys: [{ transform: "rotate(0)" }, { transform: "translateY(-14px)" }, { transform: "rotate(16deg) translateY(8px)" }, { transform: "rotate(16deg) translateY(8px)" }, { transform: "translateY(-18px)" }, { transform: "rotate(0)" }] }
  };
  const STUMBLE = [{ transform: "rotate(0)" }, { transform: "rotate(-14deg) translateX(-6px)" }, { transform: "rotate(10deg) translateX(5px)" }, { transform: "rotate(-4deg)" }, { transform: "rotate(0)" }];

  // what floats up from the pet: texts of the area
  const PROPS = {
    siffror: ["1", "2", "3", "4", "5"],
    siffror2: ["7", "3", "9", "2", "5", "8"],
    tecken: ["+", "−", "·", ":", "="],
    x: ["x", "?", "x", "?"],
    ekvation: ["x + 2 = 5", "x = 3", "✓"],
    former: ["▲", "■", "●", "◆", "★"],
    rund: ["●", "○", "●", "○"],
    pyramid: ["▲", "▲", "▲"],
    klocka: ["🕒", "🕕", "🕘", "🕛"],
    tid: ["⏱", "🕐", "🕓", "🕖"],
    enheter: ["cm", "kg", "l", "min", "m"],
    tarning: ["🎲", "⚀", "⚃", "⚅"],
    stjarnor: ["⭐", "✨", "⭐", "✨", "⭐"]
  };

  function find(id) { return TRICKS.find(function (t) { return t.id === id; }) || null; }

  // every trick with whether it is unlocked, how far the student has come, and whether it is shiny
  function status(counts, activity, now) {
    const when = now === undefined ? Date.now() : now;
    return TRICKS.map(function (t) {
      const have = (counts && counts[t.area]) || 0;
      const last = (activity && activity[t.area]) || 0;
      return { trick: t, unlocked: have >= t.need, have: have, shiny: last > 0 && when - last <= SHINE_DAYS * 86400000 };
    });
  }

  // the tricks that the student has earned and not been told about
  function fresh(counts, seen) {
    return status(counts, null).filter(function (s) { return s.unlocked && (!seen || seen.indexOf(s.trick.id) < 0); }).map(function (s) { return s.trick; });
  }

  function reduced() { return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

  // One floating thing: a text that rises from the pet, with a delay.
  function floatUp(box, text, i, n, ms) {
    const s = document.createElement("span");
    s.className = "pet-trick-prop";
    s.textContent = text;
    s.setAttribute("aria-hidden", "true");
    const spread = 96;
    s.style.setProperty("--hx", Math.round(n > 1 ? -spread / 2 + spread * i / (n - 1) : 0) + "px");
    box.appendChild(s);
    if (typeof s.animate === "function") {
      s.animate([{ opacity: 0, transform: "translateY(10px) scale(.6)" }, { opacity: 1, transform: "translateY(-30px) scale(1.05)", offset: 0.35 }, { opacity: 0, transform: "translateY(-88px) scale(1)" }],
        { duration: 1500, delay: Math.round((ms - 1500) * i / Math.max(1, n - 1)) * 0.9, easing: "ease-out", fill: "both" });
    }
  }

  // The pet does the trick in the picture `host` (the element that holds the svg of the pet, positioned). options: { rusty, onSay(text) }.
  // Does nothing (and returns a resolved promise) while the pet is busy with something else (host.dataset.cheering).
  function perform(host, trick, options) {
    options = options || {};
    return new Promise(function (resolve) {
      const svg = host && host.querySelector ? host.querySelector(".pet-svg") : null;
      if (!svg || host.dataset.cheering || !trick) { resolve(false); return; }
      host.dataset.cheering = "1";
      const move = MOVES[trick.move] || MOVES.hopp;
      const items = PROPS[trick.props] || [];
      const stumble = Boolean(options.rusty) && !reduced();
      const box = document.createElement("span");
      box.className = "pet-trick-props";
      host.appendChild(box);
      if (options.onSay) options.onSay(options.rusty ? "Hoppsan, lite rostigt! Jag provar igen." : trick.say);
      const finish = function () {
        box.remove();
        svg.style.transformOrigin = "";
        delete host.dataset.cheering;
        if (options.onSay) options.onSay(null);
        resolve(true);
      };
      if (reduced() || typeof svg.animate !== "function") {
        items.slice(0, 3).forEach(function (t, i) { floatUp(box, t, i, 3, 1500); });
        setTimeout(finish, 1500);
        return;
      }
      svg.style.transformOrigin = "50% 88%";
      const run = function () {
        svg.animate(move.keys, { duration: move.ms, easing: "ease-in-out" });
        items.forEach(function (t, i) { floatUp(box, t, i, items.length, move.ms); });
        setTimeout(finish, move.ms + 400);
      };
      if (stumble) { svg.animate(STUMBLE, { duration: 900, easing: "ease-in-out" }); setTimeout(run, 950); } else run();
    });
  }

  const api = { TRICKS: TRICKS, NEED: NEED, SHINE_DAYS: SHINE_DAYS, find: find, status: status, fresh: fresh, perform: perform };
  root.GaussicaPetTricks = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
