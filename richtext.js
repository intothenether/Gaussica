// Shows division the way it is written in a fraction: "36/6" and "(5 + 7)/3" become a number over a number.
// Only simple terms are turned into fractions (numbers, a bracketed expression or a single letter),
// so ordinary text such as "och/eller" or "km/h" is left alone.
//
//   GaussicaText.set(element, text)   replaces the content of element with text, fractions drawn

window.GaussicaText = (function () {
  "use strict";

  const NUM = "\\d{1,3}(?:[ \\u00a0]\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?";
  const TERM = "(?:" + NUM + "|\\([^()]+\\)|\\b[A-Za-z]\\b)";
  const PATTERN = "(?<![A-Za-z0-9_.,)])(" + TERM + ")/(" + TERM + ")(?![A-Za-z0-9_])";

  function strip(term) {
    return term.charAt(0) === "(" ? term.slice(1, -1).trim() : term;
  }

  function fraction(top, bottom) {
    const f = document.createElement("span");
    f.className = "frac";
    f.setAttribute("role", "math");
    f.setAttribute("aria-label", top + "/" + bottom);
    const n = document.createElement("span");
    n.className = "frac-n";
    n.setAttribute("aria-hidden", "true");
    n.textContent = top;
    const d = document.createElement("span");
    d.className = "frac-d";
    d.setAttribute("aria-hidden", "true");
    d.textContent = bottom;
    f.append(n, d);
    return f;
  }

  function set(element, text) {
    text = text === undefined || text === null ? "" : String(text);
    if (text.indexOf("/") < 0) { element.textContent = text; return element; }
    element.textContent = "";
    const re = new RegExp(PATTERN, "g");
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) element.appendChild(document.createTextNode(text.slice(last, m.index)));
      element.appendChild(fraction(strip(m[1]), strip(m[2])));
      last = m.index + m[0].length;
    }
    if (last < text.length) element.appendChild(document.createTextNode(text.slice(last)));
    return element;
  }

  return { set: set };
}());
