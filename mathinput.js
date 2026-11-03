// Writing maths in an answer field: buttons for the signs that are hard to find on a keyboard (x², a power, a root, a fraction, brackets), and a line under
// the field that shows what is written the way it is written on paper (the power raised, the fraction with a bar, the root with its sign).
//
//   GaussicaMathInput.keys(input, options)       the row of buttons for a text field: { keepFocus(button), keys: [...] }
//   GaussicaMathInput.preview(input)             the line that follows the field; it is hidden until there is something to show
//
// The buttons do not take the focus, so that the keyboard of a phone stays up. A key is a label and what it writes, and where the cursor ends up.

(function (root) {
  "use strict";

  const KEYS = [
    { label: "x²", insert: "^2", title: "upphöjt till 2" },
    { label: "xⁿ", insert: "^", title: "upphöjt till …" },
    { label: "√", insert: "√(", close: ")", title: "kvadratrot" },
    { label: "a/b", insert: "()/()", back: 4, title: "bråk" },
    { label: "( )", insert: "()", back: 1, title: "parentes" },
    { label: "·", insert: "·", title: "gånger" },
    { label: "−", insert: "−", title: "minus" }
  ];

  // text into the field at the cursor, with the cursor placed after it (or `back` signs from the end)
  function insertAt(input, text, back) {
    const start = input.selectionStart === null ? input.value.length : input.selectionStart;
    const end = input.selectionEnd === null ? start : input.selectionEnd;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const at = start + text.length - (back || 0);
    input.focus({ preventScroll: true });
    input.setSelectionRange(at, at);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function keys(input, options) {
    const opt = options || {};
    const row = document.createElement("div");
    row.className = "answer-keys math-keys";
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", "Matematiska tecken");
    const extra = (opt.extra || []).filter(function (k) { return !KEYS.some(function (x) { return x.insert === k || x.label === k; }); }).map(function (k) { return { label: k, insert: k, title: k }; });
    (opt.keys || KEYS).concat(extra).forEach(function (k) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "answer-key math-key";
      b.textContent = k.label;
      b.title = k.title || "";
      b.setAttribute("aria-label", k.title || k.label);
      if (opt.keepFocus) opt.keepFocus(b);
      b.addEventListener("click", function () { insertAt(input, k.insert, k.back); });
      row.appendChild(b);
    });
    return row;
  }

  // worth showing when what is written looks different on paper
  function worthShowing(text) { return /[\^\/√]|sqrt/.test(text); }

  function preview(input) {
    const line = document.createElement("p");
    line.className = "math-preview";
    line.setAttribute("aria-hidden", "true");
    line.hidden = true;
    const update = function () {
      const text = input.value.trim();
      if (!text || !worthShowing(text)) { line.hidden = true; return; }
      line.hidden = false;
      line.replaceChildren();
      const label = document.createElement("span");
      label.className = "math-preview-label";
      label.textContent = "Så här ser det ut: ";
      const math = document.createElement("span");
      math.className = "math-preview-math";
      if (root.GaussicaText) root.GaussicaText.set(math, text); else math.textContent = text;
      line.append(label, math);
    };
    input.addEventListener("input", update);
    update();
    line.update = update;
    return line;
  }

  const api = { keys: keys, preview: preview, insertAt: insertAt, KEYS: KEYS, worthShowing: worthShowing };
  root.GaussicaMathInput = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
