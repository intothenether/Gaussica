// A worked example that is read one step at a time: the line you start with, and then a button for the next line, each with what was done to get to it.
//
//   { "type": "arbetat-exempel", "title": "Så löser du 3x + 2 = 14", "intro": "...",
//     "start": "3x + 2 = 14",
//     "steps": [ { "line": "3x + 2 − 2 = 14 − 2", "say": "Ta bort 2 från båda sidor.", "wrong": ["Ta bort 2 från bara vänstra sidan.", "Lägg till 2 på båda sidor."] },
//               { "line": "3x = 12", "say": "Räkna ut båda sidor." } ],
//     "figure": { "type": "ekvationsmodell", "a": 3, "b": 2, "c": 14 }          (optional: any figure of the lessons, shown above the lines)
//     "note": "Kontrollera: 3 · 4 + 2 = 14." }                                    (optional, shown after the last step)
//
//   GaussicaWorkedSteps.render(component)   the element
//
// Each line is shown the way maths is written (a power raised, a fraction with a bar). The comment is what the student should do: not what the answer is.
//
// A step with "wrong" (other things one could do, as common mistakes) is not shown at once: first the student picks what to do next, among the first sentence of
// "say" and the wrong ones, and the line comes when it is the right one. A step without "wrong" (a calculation, where there is nothing to choose) is shown straight
// away. After two wrong picks the step can be shown anyway, and "Visa alla steg" is always there: nobody gets stuck.

(function (root) {
  "use strict";

  function el(tag, className, content) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (content !== undefined) e.textContent = content;
    return e;
  }
  function math(target, value) { if (root.GaussicaText) root.GaussicaText.set(target, value); else target.textContent = value; }
  function firstSentence(text) { return String(text || "").split(/(?<=[.!?])\s+/)[0]; }
  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function render(comp) {
    const box = el("section", "wx");
    box.appendChild(el("p", "eyebrow", "ARBETAT EXEMPEL"));
    box.appendChild(el("h3", "wx-title", comp.title || "Så gör du"));
    if (comp.intro) box.appendChild(el("p", "body-copy", comp.intro));
    if (comp.figure && root.GaussicaFigures && root.GaussicaFigures.supports(comp.figure.type)) {
      const fig = root.GaussicaFigures.render(comp.figure);
      if (fig) box.appendChild(fig);
    }
    const steps = Array.isArray(comp.steps) ? comp.steps : [];
    const list = el("ol", "wx-list");
    const start = el("li", "wx-line is-in");
    start.appendChild(el("span", "wx-say", "Vi börjar med"));
    const startMath = el("span", "wx-math");
    math(startMath, comp.start || "");
    start.appendChild(startMath);
    list.appendChild(start);
    const rows = steps.map(function (s) {
      const li = el("li", "wx-line");
      li.hidden = true;
      li.appendChild(el("span", "wx-say", s.say || ""));
      const m = el("span", "wx-math");
      math(m, s.line || "");
      li.appendChild(m);
      list.appendChild(li);
      return li;
    });
    const note = comp.note ? el("p", "wx-note") : null;
    if (note) { math(note, comp.note); note.hidden = true; }
    const live = el("p", "wx-live");
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    live.className = "wx-live";

    // what to do next: picked before the line is shown
    const ask = el("div", "wx-ask");
    ask.hidden = true;
    ask.setAttribute("role", "group");
    ask.setAttribute("aria-label", "Vad gör vi nu?");
    const askTitle = el("p", "wx-ask-title", "Vad gör vi nu?");
    const askChoices = el("div", "wx-choices");
    const askNote = el("p", "wx-ask-note");
    askNote.setAttribute("role", "status");
    const askSkip = el("button", "wx-all", "Visa steget");
    askSkip.type = "button";
    askSkip.hidden = true;
    ask.append(askTitle, askChoices, askNote, askSkip);

    const controls = el("div", "wx-controls");
    const next = el("button", "secondary-button ws-next");
    next.type = "button";
    const all = el("button", "wx-all", "Visa alla steg");
    all.type = "button";
    const again = el("button", "wx-again", "Börja om");
    again.type = "button";
    controls.append(next, all, again);

    let shown = 0;
    let asking = false;
    let misses = 0;

    function choosable(i) {
      const s = steps[i];
      return Boolean(s && Array.isArray(s.wrong) && s.wrong.length && firstSentence(s.say));
    }
    function reveal() { asking = false; misses = 0; if (shown < rows.length) shown += 1; update(); }
    function openAsk() {
      const s = steps[shown];
      const right = firstSentence(s.say);
      asking = true;
      misses = 0;
      askNote.textContent = "";
      askSkip.hidden = true;
      askChoices.textContent = "";
      shuffled([right].concat(s.wrong.slice(0, 3))).forEach(function (choice) {
        const b = el("button", "wx-choice");
        b.type = "button";
        math(b, choice);
        b.addEventListener("click", function () {
          if (choice === right) { live.textContent = "Rätt. " + (s.say || ""); reveal(); return; }
          misses += 1;
          b.disabled = true;
          b.classList.add("is-wrong");
          askNote.textContent = "Inte riktigt. Titta på raden ovan och tänk på vad som är kvar att göra.";
          if (misses >= 2) askSkip.hidden = false;
        });
        askChoices.appendChild(b);
      });
      update();
      const first = askChoices.querySelector("button");
      if (first) first.focus();
    }
    function update() {
      rows.forEach(function (li, i) {
        const on = i < shown;
        if (on && li.hidden) { li.hidden = false; void li.offsetWidth; li.classList.add("is-in"); }
        if (!on) { li.hidden = true; li.classList.remove("is-in"); }
      });
      const done = shown >= rows.length;
      if (done) asking = false;
      ask.hidden = !asking;
      next.textContent = done ? "Klart" : shown === 0 ? "Visa första steget" : "Nästa steg";
      next.disabled = done;
      next.hidden = asking;
      all.hidden = done || rows.length < 2;
      again.hidden = shown === 0 && !asking;
      if (note) note.hidden = !done;
      if (!asking) live.textContent = shown > 0 ? steps[shown - 1].say || "" : "";
    }
    next.addEventListener("click", function () {
      if (shown >= rows.length) return;
      if (choosable(shown)) openAsk(); else reveal();
    });
    askSkip.addEventListener("click", reveal);
    all.addEventListener("click", function () { asking = false; shown = rows.length; update(); });
    again.addEventListener("click", function () { asking = false; shown = 0; update(); });
    update();

    box.append(list, ask);
    if (note) box.appendChild(note);
    box.append(controls, live);
    return box;
  }

  const api = { render: render };
  root.GaussicaWorkedSteps = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
