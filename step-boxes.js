// A method in boxes: the steps of how to do something, one box for each, and for each step what it looks like in an example that is followed all the way through,
// so that it is clear what the text of a step is talking about. Nothing is clicked: all the steps are on the page. (The worked example that is read one step at a
// time and has questions in it is "arbetat-exempel", see worked-steps.js.)
//
//   { "type": "steg", "title": "Så gör du långdivision", "example": "Vi delar 378 kr lika på 14 elever.",
//     "steps": [ { "do": "Börja längst till vänster i 378 ...", "show": ["3 är mindre än 14.", "37 är större än 14. Ta 37."], "mono": false } ] }
//
//   do     what to do (one or two sentences, in the words of a child)
//   show   what it looks like in the example: a line, or a list of lines (written the way maths is written: a fraction with a bar, a raised power)
//   mono   true when the lines are a column calculation, which has to be lined up (the lines are then written with a fixed width of the letters)
//
//   GaussicaStepBoxes.render(component)   the element

(function (root) {
  "use strict";

  function el(tag, className, content) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (content !== undefined) e.textContent = content;
    return e;
  }
  function math(target, value) { if (root.GaussicaText) root.GaussicaText.set(target, value); else target.textContent = value; }

  function render(comp) {
    const box = el("section", "sb");
    box.appendChild(el("p", "eyebrow", "STEG FÖR STEG"));
    box.appendChild(el("h3", "sb-title", comp.title || "Så gör du"));
    if (comp.example) {
      const ex = el("p", "sb-example");
      ex.appendChild(el("strong", "", "Exempel: "));
      const text = el("span");
      math(text, comp.example);
      ex.appendChild(text);
      box.appendChild(ex);
    }
    const list = el("ol", "sb-list");
    (comp.steps || []).forEach(function (step, i) {
      const item = el("li", "sb-step");
      item.appendChild(el("span", "sb-no", String(i + 1)));
      const body = el("div", "sb-body");
      const say = el("p", "sb-do");
      math(say, step.do || "");
      body.appendChild(say);
      const lines = Array.isArray(step.show) ? step.show : (step.show ? [step.show] : []);
      if (lines.length) {
        const show = el("div", "sb-show" + (step.mono ? " is-mono" : ""));
        show.appendChild(el("span", "sb-label", "I exemplet"));
        lines.forEach(function (line) {
          const row = el("div", "sb-line");
          if (step.mono) row.textContent = line; else math(row, line);
          show.appendChild(row);
        });
        body.appendChild(show);
      }
      item.appendChild(body);
      list.appendChild(item);
    });
    box.appendChild(list);
    return box;
  }

  const api = { render: render };
  root.GaussicaStepBoxes = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
