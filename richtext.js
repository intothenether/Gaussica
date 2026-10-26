// Shows maths the way it is written on paper:
//   - division: "36/6" and "(5 + 7)/3" become a number over a number.
//   - powers written with a caret ("2^5", "x^2", "(a+b)^2", "10^-3") get a raised exponent.
//   - square roots: "√50", "√x" and "√(a + b)" are drawn with a bar over the number under the root sign,
//     and the brackets that only mark where the root ends are not shown.
// Only simple terms are turned into fractions (numbers, a bracketed expression or a single letter),
// so ordinary text such as "och/eller" or "km/h" is left alone.
//
//   GaussicaText.set(element, text)   replaces the content of element with text, drawn as above

window.GaussicaText = (function () {
  "use strict";

  const NUM = "\\d{1,3}(?:[ \\u00a0]\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?";
  const TERM = "(?:" + NUM + "|\\([^()]+\\)|\\b[A-Za-z]\\b)";
  const PATTERN = "(?<![A-Za-z0-9_.,)])(" + TERM + ")/(" + TERM + ")(?![A-Za-z0-9_])";

  // base^exponent: a number, a single letter or a bracketed expression, then a whole number (also negative,
  // also in brackets: x^(-1)) or a single letter
  const POWER = "(?<![A-Za-z0-9_])(\\d+(?:[.,]\\d+)?|[A-Za-z]|\\([^()]+\\))\\^([-−]?\\d+|\\([-−]?\\d+\\)|[-−]?[A-Za-z])(?![A-Za-z0-9_])";
  const SVG = "http://www.w3.org/2000/svg";

  function power(base, exponent) {
    const f = document.createDocumentFragment();
    f.appendChild(document.createTextNode(base));
    const sup = document.createElement("sup");
    sup.className = "pow";
    sup.textContent = exponent.replace(/^\(|\)$/g, "").replace("-", "−");
    f.appendChild(sup);
    return f;
  }

  // text with raised exponents added to the element
  function addPowers(element, text) {
    if (text.indexOf("^") < 0) { element.appendChild(document.createTextNode(text)); return; }
    const re = new RegExp(POWER, "g");
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) element.appendChild(document.createTextNode(text.slice(last, m.index)));
      element.appendChild(power(m[1], m[2]));
      last = m.index + m[0].length;
    }
    if (last < text.length) element.appendChild(document.createTextNode(text.slice(last)));
  }

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

  // A bracketed group raised to a power, "(p/2)^2": the brackets stay and what is inside is still drawn as a fraction.
  const BRACKET_POWER = new RegExp("\\(([^()]+)\\)\\^([-−]?\\d+|\\([-−]?\\d+\\)|[-−]?[A-Za-z])(?![A-Za-z0-9_])", "g");

  // plain text (no roots) with fractions and powers
  function addPlain(element, text) {
    BRACKET_POWER.lastIndex = 0;
    let at = 0, b;
    const parts = [];
    while ((b = BRACKET_POWER.exec(text))) {
      if (b[1].indexOf("/") < 0) continue;   // without a fraction inside, the ordinary power rule is enough
      parts.push({ text: text.slice(at, b.index) }, { inner: b[1], exponent: b[2] });
      at = b.index + b[0].length;
    }
    if (!parts.length) { addFractions(element, text); return; }
    parts.forEach(function (p) {
      if (p.inner === undefined) { if (p.text) addFractions(element, p.text); return; }
      element.appendChild(document.createTextNode("("));
      addFractions(element, p.inner);
      element.appendChild(document.createTextNode(")"));
      element.appendChild(power("", p.exponent));
    });
    if (at < text.length) addFractions(element, text.slice(at));
  }

  function addFractions(element, text) {
    const re = new RegExp(PATTERN, "g");
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) addPowers(element, text.slice(last, m.index));
      element.appendChild(fraction(strip(m[1]), strip(m[2])));
      last = m.index + m[0].length;
    }
    if (last < text.length) addPowers(element, text.slice(last));
  }

  // What is under the root sign that stands just before position `pos`: a bracketed expression (up to the matching
  // bracket), a number or a single letter. Returns { inner, end } or null.
  function radicand(text, pos) {
    if (text.charAt(pos) === "(") {
      let depth = 0;
      for (let i = pos; i < text.length; i++) {
        const c = text.charAt(i);
        if (c === "(") depth += 1;
        else if (c === ")") { depth -= 1; if (depth === 0) return { inner: text.slice(pos + 1, i).trim(), end: i + 1 }; }
      }
      return null;
    }
    const m = /^(\d+(?:[.,]\d+)?|[A-Za-zåäöÅÄÖ])/.exec(text.slice(pos));
    return m ? { inner: m[1], end: pos + m[1].length } : null;
  }

  // A root sign that stretches with what is under it, and a bar over the radicand.
  function root(inner) {
    const r = document.createElement("span");
    r.className = "sqrt";
    r.setAttribute("role", "math");
    r.setAttribute("aria-label", "kvadratroten ur " + inner);
    const body = document.createElement("span");
    body.className = "sqrt-body";
    body.setAttribute("aria-hidden", "true");
    addRich(body, inner);
    const sign = document.createElement("span");
    sign.className = "sqrt-sign";
    sign.setAttribute("aria-hidden", "true");
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 10 20");
    svg.setAttribute("preserveAspectRatio", "none");
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", "M0 13 L2.4 11.2 L5.2 18.8 L10 0.5");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-linejoin", "miter");
    svg.appendChild(path);
    sign.appendChild(svg);
    r.append(body, sign);   // the sign is drawn on the left (row-reverse), the text baseline comes from the radicand
    return r;
  }

  function addRich(element, text) {
    let last = 0, i;
    while ((i = text.indexOf("√", last)) >= 0) {
      const r = radicand(text, i + 1);
      if (!r) { addPlain(element, text.slice(last, i + 1)); last = i + 1; continue; }   // a lone root sign stays text
      if (i > last) addPlain(element, text.slice(last, i));
      element.appendChild(root(r.inner));
      last = r.end;
    }
    if (last < text.length) addPlain(element, text.slice(last));
  }

  function set(element, text) {
    text = text === undefined || text === null ? "" : String(text);
    if (text.indexOf("/") < 0 && text.indexOf("^") < 0 && text.indexOf("√") < 0) { element.textContent = text; return element; }
    element.textContent = "";
    addRich(element, text);
    return element;
  }

  return { set: set };
}());
