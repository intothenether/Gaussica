// A number line to play on: the student's own pet stands on it and hops where the buttons say (or where the line is tapped), the hop is drawn as an arrow
// and written as a sum, a thermometer beside it shows the same number as a temperature, and a few missions ask for a place to land on.
//
//   { "type": "hoppa-pa-linjen", "title": "Hoppa på tallinjen", "intro": "...", "min": -10, "max": 10, "start": 0, "hops": [1, 3, 5], "thermometer": true,
//     "missions": [ { "text": "Hoppa till −3.", "target": -3, "start": 0, "done": "..." }, { "text": "...", "above": 0 }, { "text": "...", "below": 0 } ] }
//
//   GaussicaHopplek.render(component)   the element
//   GaussicaHopplek.sum(from, hop)      "−3 + 5 = 2" as it is written
//
// Nothing here is graded and no coins are paid: it is for trying things out. The pet is the student's (GaussicaPet.current()), or a small round hopper when
// there is none. With reduced motion the pet just stands where it lands. Arrow keys on the line hop one step.

(function (root) {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const W = 640, H = 210, L = 36, R = 36, BASE = 140;

  function el(tag, className, content) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (content !== undefined) e.textContent = content;
    return e;
  }
  function s(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function minus(n) { return String(n).replace("-", "−"); }
  function signed(n) { return (n >= 0 ? "+" : "−") + Math.abs(n); }
  function motionOk() { return !(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); }

  // "−3 + 5 = 2", "2 − 6 = −4"
  function sum(from, hop) {
    return minus(from) + (hop >= 0 ? " + " : " − ") + Math.abs(hop) + " = " + minus(from + hop);
  }

  const DEFAULT_MISSIONS = [
    { text: "Hoppa till −3.", start: 0, target: -3, done: "Rätt! Åt vänster om noll är talen negativa. −3 är tre steg till vänster om 0." },
    { text: "Du står på −2. Hoppa till 3.", start: -2, target: 3, done: "Rätt! Från −2 är det 2 steg till noll och sedan 3 steg till: 5 steg åt höger." },
    { text: "Du står på 4. Hoppa till −4.", start: 4, target: -4, done: "Rätt! Det är 4 steg ner till noll och 4 steg till. Sammanlagt 8 steg åt vänster." },
    { text: "Du står på −3. Hoppa över noll och landa på ett positivt tal.", start: -3, above: 0, done: "Rätt! Du gick förbi noll. Där byter talen tecken." },
    { text: "Du står på −6. Hoppa till talet som ligger mitt emellan −6 och 2.", start: -6, target: -2, done: "Rätt! Det är 4 steg åt varje håll: −2 ligger mitt emellan −6 och 2." }
  ];

  // the pet of the student, or a round hopper
  function petPicture(mood) {
    const P = root.GaussicaPet, A = root.GaussicaPetArt;
    const pet = P && P.current ? P.current() : null;
    if (pet && A && A.svg) return { markup: A.svg(pet, { bare: true, mood: mood || "", label: pet.name + " på tallinjen" }), name: pet.name };
    return { name: "Hopparen", markup: '<svg class="hl-hopper" viewBox="0 0 200 200" role="img" aria-label="Hopparen" xmlns="http://www.w3.org/2000/svg"><ellipse cx="100" cy="176" rx="46" ry="8" fill="#000" opacity=".12"/><circle cx="100" cy="112" r="58" fill="#f08aa0"/><circle cx="100" cy="132" r="34" fill="#f7b3c2"/><circle cx="78" cy="98" r="11" fill="#fff"/><circle cx="122" cy="98" r="11" fill="#fff"/><circle cx="80" cy="100" r="5.5" fill="#2a2630"/><circle cx="120" cy="100" r="5.5" fill="#2a2630"/><path d="M84,124 Q100,140 116,124" fill="none" stroke="#2a2630" stroke-width="4" stroke-linecap="round"/><circle cx="62" cy="116" r="7" fill="#ff8fb0" opacity=".7"/><circle cx="138" cy="116" r="7" fill="#ff8fb0" opacity=".7"/></svg>' };
  }

  function render(comp) {
    const min = Number.isFinite(Number(comp.min)) ? Number(comp.min) : -10;
    const max = Number.isFinite(Number(comp.max)) && Number(comp.max) > min ? Number(comp.max) : 10;
    const hops = (Array.isArray(comp.hops) && comp.hops.length ? comp.hops : [1, 3, 5]).map(Number).filter(function (n) { return n > 0 && Number.isFinite(n); }).slice(0, 4);
    const missions = Array.isArray(comp.missions) ? comp.missions : DEFAULT_MISSIONS;
    const clamp = function (v) { return Math.max(min, Math.min(max, v)); };
    const x = function (v) { return L + ((v - min) / (max - min)) * (W - L - R); };
    const pct = function (v) { return (x(v) / W * 100).toFixed(3) + "%"; };

    let value = clamp(Number.isFinite(Number(comp.start)) ? Number(comp.start) : 0);
    let mission = 0, done = false, busy = false;
    const history = [];

    const box = el("section", "hl");
    box.setAttribute("data-value", String(value));
    box.appendChild(el("p", "eyebrow", "EXPERIMENTERA"));
    box.appendChild(el("h3", "hl-title", comp.title || "Hoppa på tallinjen"));
    if (comp.intro) box.appendChild(el("p", "body-copy", comp.intro));

    // the mission
    const missionBox = el("div", "hl-mission");
    const missionText = el("p", "hl-mission-text");
    const missionNext = el("button", "secondary-button hl-next", "Nästa uppdrag");
    missionNext.type = "button";
    missionNext.hidden = true;
    missionBox.append(missionText, missionNext);
    if (missions.length) box.appendChild(missionBox);

    // the stage: the line, the zones, the pet
    const board = el("div", "hl-board");
    const stage = el("div", "hl-stage");
    stage.setAttribute("tabindex", "0");
    stage.setAttribute("role", "group");
    stage.setAttribute("aria-label", "Tallinjen från " + minus(min) + " till " + max + ". Pilknapparna hoppar ett steg.");
    const svg = s("svg", { viewBox: "0 0 " + W + " " + H, "class": "hl-svg", "aria-hidden": "true", focusable: "false" });
    s("rect", { x: x(min) - 22, y: 28, width: x(0) - x(min) + 22, height: BASE - 28 + 34, rx: 14, "class": "hl-zone is-neg" }, svg);
    s("rect", { x: x(0), y: 28, width: x(max) - x(0) + 22, height: BASE - 28 + 34, rx: 14, "class": "hl-zone is-pos" }, svg);
    const zoneText = function (cx, str, cls) { const t = s("text", { x: cx, y: 50, "text-anchor": "middle", "class": "hl-zonename " + cls }, svg); t.textContent = str; };
    if (min < 0) zoneText((x(min) + x(0)) / 2, "under noll", "is-neg");
    if (max > 0) zoneText((x(0) + x(max)) / 2, "över noll", "is-pos");
    s("line", { x1: x(0), y1: 58, x2: x(0), y2: BASE + 8, "class": "hl-zeroline" }, svg);
    s("line", { x1: L - 14, y1: BASE, x2: W - R + 14, y2: BASE, "class": "hl-axis" }, svg);
    const every = max - min > 24 ? 5 : 1;
    for (let v = min; v <= max; v++) {
      const major = v % every === 0;
      s("line", { x1: x(v), y1: BASE - (v === 0 ? 11 : 7), x2: x(v), y2: BASE + (v === 0 ? 11 : 7), "class": v === 0 ? "hl-tick is-zero" : "hl-tick" }, svg);
      if (major) { const t = s("text", { x: x(v), y: BASE + 30, "text-anchor": "middle", "class": "hl-label" + (v === 0 ? " is-zero" : v < 0 ? " is-neg" : "") }, svg); t.textContent = minus(v); }
    }
    const arcs = s("g", { "class": "hl-arcs" }, svg);
    stage.appendChild(svg);

    const pet = el("div", "hl-pet");
    const body = el("div", "hl-pet-body");
    pet.appendChild(body);
    const look = petPicture();
    body.innerHTML = look.markup;
    pet.style.left = pct(value);
    stage.appendChild(pet);
    board.appendChild(stage);

    // the thermometer: the same number as a temperature
    let mercury = null, bulb = null, bubble = null;
    if (comp.thermometer !== false) {
      const th = el("div", "hl-thermo");
      const tsvg = s("svg", { viewBox: "0 0 120 230", "class": "hl-thermo-svg", "aria-hidden": "true", focusable: "false" });
      s("rect", { x: 40, y: 14, width: 24, height: 176, rx: 12, "class": "hl-tube" }, tsvg);
      s("circle", { cx: 52, cy: 196, r: 20, "class": "hl-tube" }, tsvg);
      const ty = function (v) { return 190 - ((v - min) / (max - min)) * 166; };
      mercury = s("rect", { x: 46, y: 24, width: 12, height: 166, rx: 6, "class": "hl-mercury" }, tsvg);
      mercury.setAttribute("style", "transform-origin: 52px 190px;");
      bulb = s("circle", { cx: 52, cy: 196, r: 15, "class": "hl-mercury" }, tsvg);
      for (let g = Math.ceil(min / 5) * 5; g <= max; g += 5) {
        s("line", { x1: 68, y1: ty(g), x2: 78, y2: ty(g), "class": g === 0 ? "hl-tick is-zero" : "hl-tick" }, tsvg);
        const t = s("text", { x: 84, y: ty(g) + 5, "class": "hl-label" + (g === 0 ? " is-zero" : "") }, tsvg); t.textContent = minus(g);
      }
      bubble = el("p", "hl-temp");
      th.append(tsvg, bubble);
      board.appendChild(th);
    }
    box.appendChild(board);

    const say = el("p", "hl-say");
    say.setAttribute("role", "status");
    say.setAttribute("aria-live", "polite");
    box.appendChild(say);

    // the buttons: hops to the left, hops to the right
    const controls = el("div", "hl-controls");
    const left = el("div", "hl-side");
    const right = el("div", "hl-side");
    const buttons = [];
    const addButton = function (parent, delta) {
      const b = el("button", "hl-hop" + (delta < 0 ? " is-left" : " is-right"), (delta < 0 ? "◀ " : "") + signed(delta) + (delta > 0 ? " ▶" : ""));
      b.type = "button";
      b.setAttribute("aria-label", "Hoppa " + Math.abs(delta) + (Math.abs(delta) === 1 ? " steg" : " steg") + (delta < 0 ? " åt vänster" : " åt höger"));
      b.addEventListener("click", function () { hop(delta); });
      parent.appendChild(b);
      buttons.push(b);
    };
    hops.slice().reverse().forEach(function (h) { addButton(left, -h); });
    hops.forEach(function (h) { addButton(right, h); });
    controls.append(left, right);
    box.appendChild(controls);

    const trail = el("ol", "hl-history");
    trail.setAttribute("aria-label", "Dina hopp");
    box.appendChild(trail);
    const foot = el("div", "hl-foot");
    const reset = el("button", "hl-reset", "Börja om från " + minus(clamp(Number.isFinite(Number(comp.start)) ? Number(comp.start) : 0)));
    reset.type = "button";
    foot.appendChild(reset);
    box.appendChild(foot);

    function describe(v) {
      if (v < 0) return minus(v) + " är " + Math.abs(v) + (Math.abs(v) === 1 ? " steg" : " steg") + " till vänster om noll: ett negativt tal.";
      if (v === 0) return "0 är gränsen mellan de negativa och de positiva talen.";
      return v + " är " + v + (v === 1 ? " steg" : " steg") + " till höger om noll.";
    }

    // the thermometer shows v (the mercury rises or falls in ms milliseconds)
    function showTemperature(v, ms) {
      if (!mercury) return;
      const ratio = Math.max(0.02, (v - min) / (max - min));
      mercury.style.transition = ms ? "transform " + ms + "ms ease-in-out" : "none";
      mercury.style.transform = "scaleY(" + ratio.toFixed(3) + ")";
      const tone = v < 0 ? " is-cold" : v > 0 ? " is-warm" : "";
      mercury.setAttribute("class", "hl-mercury" + tone);
      bulb.setAttribute("class", "hl-mercury" + tone);
      bubble.textContent = minus(v) + " °C";
      bubble.className = "hl-temp" + (v < 0 ? " is-cold" : v > 0 ? " is-warm" : "");
    }

    function showMission() {
      if (!missions.length) return;
      if (done) { missionText.textContent = "Alla uppdrag är klara! Experimentera fritt: hur långt kan du hoppa, och vilka vägar finns till samma tal?"; missionNext.hidden = true; missionBox.className = "hl-mission is-done"; return; }
      const m = missions[mission];
      missionText.textContent = "Uppdrag " + (mission + 1) + " av " + missions.length + ": " + m.text;
      missionNext.hidden = true;
      missionBox.className = "hl-mission";
    }

    function setValue(v) {
      value = clamp(v);
      box.setAttribute("data-value", String(value));
      pet.style.left = pct(value);
      showTemperature(value, 0);
    }

    function drawArc(from, to, label) {
      Array.prototype.slice.call(arcs.children).forEach(function (g, i, all) { g.setAttribute("class", "hl-arc is-old"); if (all.length - i > 2) arcs.removeChild(g); });
      const x1 = x(from), x2 = x(to), span = Math.abs(x2 - x1), h = Math.min(70, 22 + span * 0.28), ya = BASE - 6;
      const g = s("g", { "class": "hl-arc" }, arcs);
      s("path", { d: "M" + x1 + " " + ya + " C" + x1 + " " + (ya - h * 1.2) + " " + x2 + " " + (ya - h * 1.2) + " " + x2 + " " + (ya - 4), "class": "hl-arcline" }, g);
      s("polygon", { points: (x2 - 6) + "," + (ya - 10) + " " + (x2 + 6) + "," + (ya - 10) + " " + x2 + "," + (ya - 1), "class": "hl-arrowhead" }, g);
      const t = s("text", { x: (x1 + x2) / 2, y: ya - h * 0.9 - 8, "text-anchor": "middle", "class": "hl-arclabel" }, g);
      t.textContent = label;
    }

    function cheer() {
      const p = petPicture("happy");
      body.innerHTML = p.markup;
      pet.classList.add("is-happy");
      setTimeout(function () { body.innerHTML = petPicture().markup; pet.classList.remove("is-happy"); }, 1300);
    }

    function checkMission() {
      if (!missions.length || done) return;
      const m = missions[mission];
      const ok = (m.target !== undefined && value === Number(m.target)) || (m.above !== undefined && value > Number(m.above)) || (m.below !== undefined && value < Number(m.below));
      if (!ok) return;
      say.textContent = m.done || "Rätt!";
      missionBox.className = "hl-mission is-solved";
      missionText.textContent = "✓ " + m.text;
      cheer();
      if (mission + 1 < missions.length) missionNext.hidden = false;
      else { done = true; setTimeout(showMission, 2600); }
    }

    function hop(delta) {
      if (busy) return;
      const from = value, to = clamp(from + delta);
      if (to === from) {
        say.textContent = look.name + " kan inte hoppa längre åt det hållet: tallinjen slutar vid " + minus(delta < 0 ? min : max) + ".";
        pet.classList.remove("is-bump"); void pet.offsetWidth; pet.classList.add("is-bump");
        return;
      }
      const real = to - from;
      busy = true;
      const crossed = (from < 0 && to > 0) || (from > 0 && to < 0);
      history.push(sum(from, real));
      while (history.length > 6) history.shift();
      trail.textContent = "";
      history.forEach(function (line, i) { trail.appendChild(el("li", i === history.length - 1 ? "is-last" : "", line)); });
      drawArc(from, to, signed(real));
      say.textContent = look.name + " hoppade " + signed(real) + " och landade på " + minus(to) + ". " + (crossed ? "Hoppet gick över noll! " : "") + describe(to);

      const finish = function () { busy = false; buttons.forEach(function (b) { b.disabled = false; }); setValue(to); checkMission(); };
      buttons.forEach(function (b) { b.disabled = true; });
      if (!motionOk() || typeof pet.animate !== "function") { finish(); return; }
      const dist = Math.abs(real), dur = Math.min(900, 380 + dist * 70), height = Math.min(70, 26 + dist * 6), tilt = real > 0 ? 9 : -9;
      pet.style.left = pct(to);
      pet.animate([{ left: pct(from) }, { left: pct(to) }], { duration: dur, easing: "ease-in-out" });
      const anim = body.animate([
        { transform: "translateY(0) rotate(0deg) scale(1,1)" },
        { transform: "translateY(" + (-height) + "px) rotate(" + tilt + "deg) scale(0.96,1.05)", offset: 0.5 },
        { transform: "translateY(0) rotate(0deg) scale(1.1,0.88)", offset: 0.92 },
        { transform: "translateY(0) rotate(0deg) scale(1,1)" }
      ], { duration: dur + 120, easing: "ease-in-out" });
      showTemperature(to, dur);
      anim.onfinish = finish;
      anim.oncancel = finish;
    }

    stage.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); hop(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); hop(-1); }
    });
    stage.addEventListener("click", function (e) {
      const r = svg.getBoundingClientRect();
      if (!r.width) return;
      const px = (e.clientX - r.left) / r.width * W;
      const v = Math.round(min + (px - L) / (W - L - R) * (max - min));
      if (v >= min && v <= max && v !== value) hop(v - value);
    });
    reset.addEventListener("click", function () {
      if (busy) return;
      history.length = 0; trail.textContent = ""; arcs.textContent = "";
      setValue(Number.isFinite(Number(comp.start)) ? Number(comp.start) : 0);
      say.textContent = look.name + " står på " + minus(value) + ". Tryck på en knapp, tryck på tallinjen eller använd pilknapparna.";
    });
    missionNext.addEventListener("click", function () {
      if (mission + 1 >= missions.length) return;
      mission += 1;
      const m = missions[mission];
      history.length = 0; trail.textContent = ""; arcs.textContent = "";
      if (m.start !== undefined) setValue(Number(m.start));
      say.textContent = look.name + " står på " + minus(value) + ".";
      showMission();
    });

    // the first mission starts where it says
    if (missions.length && missions[0].start !== undefined) value = clamp(Number(missions[0].start));
    pet.style.left = pct(value);
    box.setAttribute("data-value", String(value));
    showTemperature(value, 0);
    showMission();
    say.textContent = look.name + " står på " + minus(value) + ". Tryck på en knapp, tryck på tallinjen eller använd pilknapparna.";
    return box;
  }

  const api = { render: render, sum: sum };
  root.GaussicaHopplek = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
