// What happens around a wrong answer so that it is hard to miss for a student who does not read everything on the screen:
// the answer field shakes and gets a coral frame, a phone buzzes a little, the hint can be read aloud (both are settings in "Läsning"), and
// when a second wrong answer comes faster than the hint can have been read, the next wrong answer is not taken for three seconds and "Kolla svaret"
// says "Läs tipset först…" (every answer is still checked, and a right answer is never held back). Nothing here decides what is right.
//
//   GaussicaSignals.readingMs(text)                  how long the text takes to read: the shortest time before the next answer is a considered one
//   GaussicaSignals.wrong(input)                     shake and frame the answer field (not shaken for those who want less motion)
//   GaussicaSignals.buzz()                           a short buzz, if the device can and the student has not turned it off
//   GaussicaSignals.readAloud(text)                  reads the hint, if the student has asked for it
//   GaussicaSignals.pause(button, feedback, ms)      "Kolla svaret" asks for the hint to be read first; returns a function that ends the wait at once
//   GaussicaSignals.nudge(feedback)                  the hint pulses, so that the eye goes there
//   GaussicaSignals.clipped(feedback)                marks a hint that is taller than its box ("Fler rader"), so that it is never cut off silently

(function (root) {
  "use strict";

  const PAUSE_MS = 3000;

  // About four words a second is slow reading for a child, plus a moment to look at it. Not shorter than two and a half seconds, not longer than seven.
  function readingMs(text) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
    return Math.min(7000, Math.max(2500, 1200 + words * 260));
  }

  function settings() {
    const r = typeof window !== "undefined" && window.GaussicaReading && window.GaussicaReading.settings ? window.GaussicaReading.settings() : {};
    return { read: r.read === true, buzz: r.buzz !== false };
  }

  function lessMotion() {
    try { return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }

  function wrong(input) {
    if (!input) return;
    input.classList.add("is-wrong");
    if (lessMotion()) return;
    input.classList.remove("is-shaking");
    void input.offsetWidth;   // so that the same animation can start again
    input.classList.add("is-shaking");
    input.addEventListener("animationend", function done() { input.classList.remove("is-shaking"); input.removeEventListener("animationend", done); });
  }

  function buzz() {
    try {
      if (!settings().buzz || lessMotion() || typeof navigator === "undefined" || !navigator.vibrate) return;
      navigator.vibrate([35, 50, 35]);
    } catch (e) { /* the device does not allow it */ }
  }

  function readAloud(text) {
    try {
      if (!settings().read || !window.GaussicaSpeech || !window.GaussicaSpeech.supported()) return;
      window.GaussicaSpeech.stop();
      window.GaussicaSpeech.speak(text, null);
    } catch (e) { /* no voice */ }
  }

  function nudge(feedback) {
    if (!feedback) return;
    feedback.classList.remove("is-nudged");
    void feedback.offsetWidth;
    feedback.classList.add("is-nudged");
  }

  function pause(button, feedback, ms) {
    const label = button.textContent;
    let timer = null, finished = false;
    const end = function () {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      button.textContent = label;
      button.classList.remove("is-waiting");
      if (feedback) feedback.classList.remove("is-nudged");
    };
    button.classList.add("is-waiting");
    button.textContent = "Läs tipset först…";
    nudge(feedback);
    timer = setTimeout(end, ms || PAUSE_MS);
    return end;
  }

  // A hint that does not fit its box can be scrolled, and says so until the end is reached.
  function clipped(feedback) {
    if (!feedback) return;
    const check = function () {
      const more = feedback.scrollHeight - feedback.clientHeight > 3 && feedback.scrollTop + feedback.clientHeight < feedback.scrollHeight - 3;
      feedback.classList.toggle("is-clipped", more);
    };
    if (!feedback.dataset.clipWatch) {
      feedback.dataset.clipWatch = "1";
      feedback.addEventListener("scroll", check, { passive: true });
    }
    feedback.scrollTop = 0;
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(check); else check();
  }

  const api = { readingMs: readingMs, wrong: wrong, buzz: buzz, readAloud: readAloud, pause: pause, nudge: nudge, clipped: clipped, PAUSE_MS: PAUSE_MS };
  root.GaussicaSignals = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
