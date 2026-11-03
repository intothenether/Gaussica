// The check of an answer to an equation, shown as it is done on paper: the equation, then the answer put in for the letter, then what each side comes to.
//   3x + 2 = 14   ->   3 · 5 + 2 = 14   ->   17 = 14   "Det stämmer inte riktigt, försök igen"
//   3x + 2 = 14   ->   3 · 4 + 2 = 14   ->   14 = 14   "Det stämmer: båda sidorna blir 14"
// It plays when a student answers a question about an equation (algebra.js finds the equation in the question and puts the answer in), before the
// answer is marked, so that the student sees why the answer is right or wrong. A click (or answering again) skips to the end. With reduced motion
// everything is shown at once.
//
//   GaussicaSubstitution.available(prompt, answer)     the info for the check (algebra.js substitution) or null
//   GaussicaSubstitution.play(info, { onDone, speed }) { el, skip }: the element to put in the page, and a function that ends the animation at once
//   GaussicaSubstitution.verdict(info)                  the sentence at the end

(function (root) {
  "use strict";

  function text(el, value) { if (root.GaussicaText) root.GaussicaText.set(el, value); else el.textContent = value; }

  function verdict(info) {
    return info.equal ? "Det stämmer: båda sidorna blir " + shownNumber(info.left) : "Det stämmer inte riktigt, försök igen";
  }
  function shownNumber(n) { return String(Math.round(n * 1e4) / 1e4).replace(".", ",").replace("-", "−"); }

  function row(label, math, className) {
    const r = document.createElement("div");
    r.className = "subst-row " + className;
    r.setAttribute("aria-hidden", "true");
    const l = document.createElement("span");
    l.className = "subst-label";
    l.textContent = label;
    const m = document.createElement("span");
    m.className = "subst-math";
    text(m, math);
    r.append(l, m);
    return r;
  }

  function available(prompt, answer) {
    return root.GaussicaAlgebra ? root.GaussicaAlgebra.substitution(prompt, answer) : null;
  }

  function lessMotion() {
    try { return Boolean(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }

  function play(info, options) {
    const opt = options || {};
    const speed = opt.speed > 0 ? opt.speed : 1;
    const box = document.createElement("div");
    box.className = "subst";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Svaret satt in i ekvationen");
    const p = info.parts;
    // what a screen reader gets: the whole thing as one sentence
    const sr = document.createElement("p");
    sr.className = "subst-sr";
    sr.textContent = "Ekvationen " + p.before + ". Med " + info.variable + " = " + p.valueText + " blir den " + p.after + ". Vänster sida blir " + shownNumber(info.left) + " och höger sida " + shownNumber(info.right) + ". " + verdict(info) + ".";
    const eq = row("Ekvationen", p.before, "subst-eq");
    const put = row(info.variable + " = " + p.valueText, p.after, "subst-put");
    const result = document.createElement("div");
    result.className = "subst-row subst-result";
    result.setAttribute("aria-hidden", "true");
    const sides = document.createElement("span");
    sides.className = "subst-sides";
    const left = document.createElement("span"), right = document.createElement("span"), equals = document.createElement("span");
    left.className = "subst-left";
    right.className = "subst-right";
    equals.className = "subst-equals";
    left.textContent = shownNumber(info.left);
    right.textContent = shownNumber(info.right);
    equals.textContent = " = ";
    sides.append(left, equals, right);
    result.appendChild(sides);
    const end = document.createElement("p");
    end.className = "subst-verdict " + (info.equal ? "is-right" : "is-wrong");
    end.textContent = verdict(info);
    end.setAttribute("aria-hidden", "true");
    box.append(sr, eq, put, result, end);

    const parts = [eq, put, left, equals, right, end, result];   // the row of the two sides comes with the first of them
    const timers = [];
    let finished = false;
    const show = (el) => el.classList.add("is-in");
    const finish = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      parts.forEach(show);
      box.classList.add("is-done", info.equal ? "is-right" : "is-wrong");
      if (opt.onDone) opt.onDone();
    };

    if (lessMotion()) {
      timers.push(setTimeout(finish, 0));
    } else {
      // when each part comes: the equation at once, the answer put in, the two sides one after the other, and the verdict
      const at = [0, 800, 1800, 2150, 2400, 3000, 1800].map((t) => t * speed);
      parts.forEach((part, i) => timers.push(setTimeout(() => show(part), at[i])));
      timers.push(setTimeout(finish, 3500 * speed));
    }
    box.addEventListener("click", finish);
    return { el: box, skip: finish };
  }

  const api = { available: available, play: play, verdict: verdict };
  root.GaussicaSubstitution = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
