// Shows maths the way it is written on paper:
//   - division: "36/6" and "(5 + 7)/3" become a number over a number.
//   - powers written with a caret ("2^5", "x^2", "(a+b)^2", "10^-3", "a^(m+n)", "(a^m)^n") get a raised exponent.
//   - square roots: "√50", "√x" and "√(a + b)" are drawn with a bar over the number under the root sign,
//     and the brackets that only mark where the root ends are not shown.
// Only simple terms are turned into fractions (numbers, a bracketed expression or a single letter),
// so ordinary text such as "och/eller" or "km/h" is left alone.
//
//   GaussicaText.set(element, text)   replaces the content of element with text, drawn as above
//   GaussicaText.svg(textElement, text)   the same for an svg <text> (only the powers)

window.GaussicaText = (function () {
  "use strict";

  const NUM = "\\d{1,3}(?:[ \\u00a0]\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?";
  const TERM = "(?:" + NUM + "|\\([^()]+\\)|\\b[A-Za-z]\\b)";
  const PATTERN = "(?<![A-Za-z0-9_.,)])(" + TERM + ")/(" + TERM + ")(?![A-Za-z0-9_])";

  const SVG = "http://www.w3.org/2000/svg";

  // ----- powers -----
  // The end of the bracket that opens at `open` (or the start of the one that closes at `open`, going backwards): the index, or -1.
  function matchingClose(text, open) {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
      if (text.charAt(i) === "(") depth += 1;
      else if (text.charAt(i) === ")") { depth -= 1; if (depth === 0) return i; }
    }
    return -1;
  }

  function matchingOpen(text, close) {
    let depth = 0;
    for (let i = close; i >= 0; i--) {
      if (text.charAt(i) === ")") depth += 1;
      else if (text.charAt(i) === "(") { depth -= 1; if (depth === 0) return i; }
    }
    return -1;
  }

  // What is raised, just before position `caret`: a bracketed group (the brackets stay), a number or a single letter. { start } or null.
  function baseBefore(text, caret, notBefore) {
    if (caret > 0 && text.charAt(caret - 1) === ")") {
      const open = matchingOpen(text, caret - 1);
      return open >= notBefore ? { start: open } : null;
    }
    const m = /(\d+(?:[.,]\d+)?|[A-Za-z])$/.exec(text.slice(notBefore, caret));
    if (!m) return null;
    const start = caret - m[1].length;
    // a letter is a base only when it stands alone ("x^2", not the end of "ax^2"); a number may follow a letter ("x2" is not a power)
    if (start > 0 && /[A-Za-z0-9_]/.test(text.charAt(start - 1))) return null;
    return { start: start };
  }

  // What is the exponent, just after position `caret`: a bracketed expression (a^(m+n)), a whole number (also negative) or a single letter. { exp, end } or null.
  function exponentAfter(text, caret) {
    const at = caret + 1;
    if (text.charAt(at) === "(") {
      const close = matchingClose(text, at);
      return close > at + 1 ? { exp: text.slice(at + 1, close), end: close + 1 } : null;
    }
    const m = /^[-−]?(?:\d+|[A-Za-z](?![A-Za-z0-9_]))/.exec(text.slice(at));
    return m ? { exp: m[0], end: at + m[0].length } : null;
  }

  // Splits the text into pieces of text and powers: [{ text }, { base, exp }, ...], or null when there is no power in it. The last caret is
  // taken first, so that the outer power of (a^m)^n is found before the one inside its base.
  function splitPowers(text) {
    if (text.indexOf("^") < 0) return null;
    const found = [];   // { start, end, base, exp }
    let caret = text.lastIndexOf("^");
    while (caret >= 0) {
      // not inside a power that is already taken, and a caret that is not a power stays as it is
      if (!found.some(function (p) { return caret >= p.start && caret < p.end; })) {
        const base = baseBefore(text, caret, 0);
        const exp = base ? exponentAfter(text, caret) : null;
        if (base && exp && !found.some(function (p) { return exp.end > p.start; })) {
          found.push({ start: base.start, end: exp.end, base: text.slice(base.start, caret), exp: exp.exp.replace(/-/g, "−") });
        }
      }
      caret = caret === 0 ? -1 : text.lastIndexOf("^", caret - 1);
    }
    if (!found.length) return null;
    found.sort(function (x, y) { return x.start - y.start; });
    const parts = [];
    let done = 0;
    found.forEach(function (p) {
      if (p.start > done) parts.push({ text: text.slice(done, p.start) });
      parts.push({ base: p.base, exp: p.exp });
      done = p.end;
    });
    if (done < text.length) parts.push({ text: text.slice(done) });
    return parts;
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

  // plain text (no roots): powers first (the base and the exponent are drawn in the same way, so (a^m)^n and 2^(1/2) work), then fractions
  function addPlain(element, text) {
    const parts = splitPowers(text);
    if (!parts) { addFractions(element, text); return; }
    parts.forEach(function (p) {
      if (p.base === undefined) { if (p.text) addFractions(element, p.text); return; }
      addPlain(element, p.base);
      const sup = document.createElement("sup");
      sup.className = "pow";
      addPlain(sup, p.exp);
      element.appendChild(sup);
    });
  }

  function addFractions(element, text) {
    const re = new RegExp(PATTERN, "g");
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) element.appendChild(document.createTextNode(text.slice(last, m.index)));
      element.appendChild(fraction(strip(m[1]), strip(m[2])));
      last = m.index + m[0].length;
    }
    if (last < text.length) element.appendChild(document.createTextNode(text.slice(last)));
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

  // The same for the text of an svg figure: the exponent is a smaller piece of the text, raised by dy (and the text after it is lowered again).
  function svg(textElement, text) {
    text = text === undefined || text === null ? "" : String(text);
    const parts = splitPowers(text);
    if (!parts) { textElement.textContent = text; return textElement; }
    textElement.textContent = "";
    let raised = false;
    const add = function (content, up) {
      const t = document.createElementNS(SVG, "tspan");
      if (up) { t.setAttribute("dy", "-0.45em"); t.setAttribute("font-size", "70%"); }
      else if (raised) t.setAttribute("dy", "0.45em");
      raised = Boolean(up);
      t.textContent = content;
      textElement.appendChild(t);
    };
    parts.forEach(function (p) {
      if (p.base === undefined) { add(p.text, false); return; }
      add(p.base, false);
      add(p.exp.replace(/^\(|\)$/g, ""), true);
    });
    return textElement;
  }

  return { set: set, svg: svg, powers: splitPowers };
}());
