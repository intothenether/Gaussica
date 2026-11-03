// "Lös steg för steg": the student writes a solution line by line, and every line is checked against the line above (algebra.js stepCheck). A line that
// keeps the solutions of the equation gets a tick. A line that does not says what probably happened (a term that moved without changing sign, something done to
// one side only ...), so the mistake is found where it is made and not after the last line. The student can also have the site do the same thing to both sides
// ("Gör samma sak på båda sidor"), which is what the solution method is.
//
//   GaussicaSteps.create({ start, kind, keepFocus, onSolved })   { el, text() }
//     start     the equation or expression that the solution begins with
//     kind      "equation" or "expression"
//     onSolved  called with the value when a line has the letter alone on one side ("x = 4": value "4"): the answer field can be filled in
//
// Nothing is required: the answer field is still there, and the steps are saved with the answer so that a teacher can read how the student thought.

(function (root) {
  "use strict";

  function A() { return root.GaussicaAlgebra; }
  function text(el, value) { if (root.GaussicaText) root.GaussicaText.set(el, value); else el.textContent = value; }
  function el(tag, className, content) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (content !== undefined) e.textContent = content;
    return e;
  }

  // x = 4, 4 = x: the letter alone on one side and a number on the other
  function solvedValue(line) {
    const parts = String(line).split("=");
    if (parts.length !== 2) return null;
    const side = (s) => s.trim();
    const [l, r] = [side(parts[0]), side(parts[1])];
    const isLetter = (s) => /^[a-zA-Z]$/.test(s);
    const number = (s) => (/^[0-9+\-−–*/().,·\s]+$/.test(s) && /[0-9]/.test(s) ? s : null);
    if (isLetter(l) && number(r)) return r;
    if (isLetter(r) && number(l)) return l;
    return null;
  }

  // the same thing on both sides of an equation: (L) op c = (R) op c
  function bothSides(line, op, number) {
    const parts = String(line).split("=");
    if (parts.length !== 2 || !String(number).trim()) return null;
    const c = String(number).trim();
    const wrap = (s) => (/[+\-−]/.test(s.trim().replace(/^[-−]/, "")) ? "(" + s.trim() + ")" : s.trim());
    const one = (s) => {
      const t = s.trim();
      if (op === "+") return t + " + " + c;
      if (op === "−") return t + " − " + c;
      if (op === "·") return c + " · " + wrap(t);
      return wrap(t) + "/" + c;
    };
    return one(parts[0]) + " = " + one(parts[1]);
  }

  function create(options) {
    const opt = options || {};
    const kind = opt.kind === "expression" ? "expression" : "equation";
    const box = el("section", "steps-box");
    box.setAttribute("aria-label", "Lös steg för steg");
    const title = el("h4", "steps-title", kind === "equation" ? "Lös steg för steg" : "Förenkla steg för steg");
    title.appendChild(el("span", "steps-optional", " (du behöver inte)"));
    const list = el("ol", "steps-list");
    const lines = [];
    const startRow = el("li", "steps-row is-start");
    startRow.appendChild(el("span", "steps-mark", "▶"));
    const startMath = el("span", "steps-math");
    text(startMath, opt.start);
    startRow.appendChild(startMath);
    list.appendChild(startRow);

    const message = el("p", "steps-message");
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");
    const form = el("form", "steps-form");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "steps-input";
    input.autocomplete = "off";
    input.setAttribute("autocapitalize", "none");
    input.setAttribute("autocorrect", "off");
    input.spellcheck = false;
    input.placeholder = "Skriv nästa rad";
    input.setAttribute("aria-label", "Nästa rad i lösningen");
    const add = el("button", "secondary-button steps-add", "Lägg till rad");
    add.type = "submit";
    if (opt.keepFocus) opt.keepFocus(add);
    form.append(input, add);

    const last = () => (lines.length ? lines[lines.length - 1] : opt.start);

    function addLine(value, how) {
      const row = el("li", "steps-row is-ok");
      row.appendChild(el("span", "steps-mark", "✓"));
      const math = el("span", "steps-math");
      text(math, value);
      row.appendChild(math);
      if (how) row.appendChild(el("span", "steps-how", how));
      list.appendChild(row);
      lines.push(value);
      undo.hidden = false;
      if (kind === "equation") {
        const v = solvedValue(value);
        if (v !== null && opt.onSolved) {
          say("Nu står " + (/^[a-zA-Z]/.test(value.trim()) ? value.trim().charAt(0) : "x") + " ensamt. Svaret är ifyllt, tryck på Kolla svaret.", "ok");
          opt.onSolved(v);
          return;
        }
      }
      say("", "");
    }

    function say(note, tone) {
      message.textContent = note;
      message.className = "steps-message" + (tone ? " is-" + tone : "");
      if (tone === "wrong") { message.classList.remove("is-nudged"); void message.offsetWidth; message.classList.add("is-nudged"); }
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const value = input.value.trim();
      const result = A().stepCheck(last(), value);
      if (!result.ok) {
        input.classList.add("is-wrong");
        say(result.message, "wrong");
        return;
      }
      input.classList.remove("is-wrong");
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      addLine(value);
      input.focus({ preventScroll: true });
    });
    input.addEventListener("input", function () { input.classList.remove("is-wrong"); });

    const undo = el("button", "steps-undo", "Ta bort sista raden");
    undo.type = "button";
    undo.hidden = true;
    if (opt.keepFocus) opt.keepFocus(undo);
    undo.addEventListener("click", function () {
      if (!lines.length) return;
      lines.pop();
      list.removeChild(list.lastChild);
      undo.hidden = !lines.length;
      say("", "");
    });

    box.append(title, list);

    // the same on both sides: what the method is
    let both = null;
    if (kind === "equation") {
      both = el("div", "steps-both");
      both.appendChild(el("span", "steps-both-label", "Gör samma sak på båda sidor:"));
      const op = document.createElement("select");
      op.className = "steps-op";
      op.setAttribute("aria-label", "Räknesätt");
      [["+", "plus"], ["−", "minus"], ["·", "gånger"], ["/", "delat med"]].forEach(function (o) {
        const option = document.createElement("option");
        option.value = o[0];
        option.textContent = o[1];
        op.appendChild(option);
      });
      const number = document.createElement("input");
      number.type = "text";
      number.className = "steps-number";
      number.setAttribute("inputmode", "decimal");
      number.setAttribute("aria-label", "Talet");
      number.placeholder = "tal";
      const go = el("button", "secondary-button steps-go", "Gör det");
      go.type = "button";
      if (opt.keepFocus) opt.keepFocus(go);
      go.addEventListener("click", function () {
        const made = bothSides(last(), op.value, number.value);
        if (!made) { say("Skriv talet du vill använda på båda sidor.", "wrong"); return; }
        addLine(made, (op.options[op.selectedIndex].textContent) + " " + number.value.trim() + " på båda sidor");
        number.value = "";
      });
      both.append(op, number, go);
    }
    box.append(form);
    if (both) box.appendChild(both);
    box.append(undo, message);

    return { el: box, text: function () { return [opt.start].concat(lines).join("\n"); }, input: input, lines: lines };
  }

  const api = { create: create, solvedValue: solvedValue, bothSides: bothSides };
  root.GaussicaSteps = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
