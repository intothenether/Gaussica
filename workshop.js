// Verkstad: tools to build and try ideas with your hands. Place value blocks, fraction bars, a number line, a balance
// scale and a grid for area and perimeter. Nothing here is marked or counted. It is for playing and understanding, and it
// can be opened from the start page and from inside a lesson.
//
//   GaussicaWorkshop.open(options)    options = { tool: "tiobas" | "brak" | "tallinje" | "vag" | "rutnat", onClose() }
//   GaussicaWorkshop.close()
//   GaussicaWorkshop.logic            the calculations behind the tools, without any drawing (tested in tests/workshop.js)

window.GaussicaWorkshop = (function () {
  "use strict";

  // ===== the calculations =====
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; }

  // ----- place value blocks -----
  const ONES = ["noll", "ett", "två", "tre", "fyra", "fem", "sex", "sju", "åtta", "nio", "tio", "elva", "tolv", "tretton", "fjorton", "femton", "sexton", "sjutton", "arton", "nitton"];
  const TENS = ["", "", "tjugo", "trettio", "fyrtio", "femtio", "sextio", "sjuttio", "åttio", "nittio"];

  const baseTen = {
    value: function (s) { return s.h * 100 + s.t * 10 + s.e; },
    // 10 ones become 1 ten (up), or 1 ten becomes 10 ones (down); the same between tens and hundreds
    exchange: function (s, dir, col) {
      const n = { h: s.h, t: s.t, e: s.e };
      const from = col === "e" ? "e" : "t", to = col === "e" ? "t" : "h";
      if (dir === "up") { if (n[from] < 10) return null; n[from] -= 10; n[to] += 1; return n; }
      const src = col === "e" ? "t" : "h", dst = col === "e" ? "e" : "t";
      if (n[src] < 1) return null;
      n[src] -= 1; n[dst] += 10;
      return n;
    },
    normalized: function (s) { return s.e < 10 && s.t < 10; },
    words: function (n) {
      if (n === 0) return "noll";
      const parts = [];
      const h = Math.floor(n / 100), rest = n % 100;
      if (h) parts.push(h === 1 ? "ett hundra" : ONES[h] + " hundra");
      if (rest) parts.push(rest < 20 ? ONES[rest] : TENS[Math.floor(rest / 10)] + (rest % 10 ? ONES[rest % 10] : ""));
      return parts.join(" ");
    }
  };

  // ----- fractions -----
  const fractions = {
    // the sum of 1/d for every d in the list, as a reduced fraction { num, den }
    sum: function (dens) {
      let den = 1;
      dens.forEach(function (d) { den = den * d / gcd(den, d); });
      let num = 0;
      dens.forEach(function (d) { num += den / d; });
      const g = gcd(num, den);
      return { num: num / g, den: den / g };
    },
    equals: function (a, b) { return a.num * b.den === b.num * a.den; },
    text: function (f) { return f.num + "/" + f.den; },
    mixed: function (f) { return f.num >= f.den && f.den > 1 && f.num % f.den ? Math.floor(f.num / f.den) + " " + (f.num % f.den) + "/" + f.den : null; }
  };

  // ----- number line -----
  const numberLine = {
    jump: function (pos, delta, min, max) { return Math.max(min, Math.min(max, pos + delta)); },
    // the fewest jumps from a to b with the given sizes (each can go either way); null if it cannot be done
    minHops: function (a, b, sizes, min, max) {
      const dist = {}; dist[a] = 0;
      const queue = [a];
      while (queue.length) {
        const p = queue.shift();
        if (p === b) return dist[p];
        sizes.forEach(function (s) {
          [p + s, p - s].forEach(function (q) { if (q >= min && q <= max && !(q in dist)) { dist[q] = dist[p] + 1; queue.push(q); } });
        });
      }
      return null;
    }
  };

  // ----- balance scale -----
  const scale = {
    // the beam tilts towards the heavier side: -1 (left down) to 1 (right down)
    tilt: function (left, right) { const d = right - left; return Math.max(-1, Math.min(1, d / Math.max(6, Math.abs(d) + 4))); },
    balanced: function (left, right) { return left === right; }
  };

  // Where a pointer is in the coordinates of an svg picture. The picture does not always fill its box: a box that is capped in height
  // (.wk-svg has max-height) shows it centred and as large as it fits, with empty bands at the sides (preserveAspectRatio "meet"), so the
  // position in the box is not the position in the picture. Works for the viewBox "x y width height" of the svg.
  function svgPoint(svg, evt) {
    const r = svg.getBoundingClientRect();
    const vb = String(svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || !(r.width > 0) || !(r.height > 0)) return { x: 0, y: 0 };
    const k = Math.min(r.width / vb[2], r.height / vb[3]);     // pixels on the screen for one unit in the picture
    const left = r.left + (r.width - vb[2] * k) / 2, top = r.top + (r.height - vb[3] * k) / 2;
    return { x: vb[0] + (evt.clientX - left) / k, y: vb[1] + (evt.clientY - top) / k };
  }

  // ----- grid: area and perimeter -----
  const grid = {
    area: function (cells) { return Object.keys(cells).length; },
    perimeter: function (cells) {
      let p = 0;
      Object.keys(cells).forEach(function (k) {
        const xy = k.split(",").map(Number);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { if (!cells[(xy[0] + d[0]) + "," + (xy[1] + d[1])]) p += 1; });
      });
      return p;
    },
    // the width and height if the cells make a full rectangle, otherwise null
    rectangle: function (cells) {
      const keys = Object.keys(cells);
      if (!keys.length) return null;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      keys.forEach(function (k) { const xy = k.split(",").map(Number); x0 = Math.min(x0, xy[0]); x1 = Math.max(x1, xy[0]); y0 = Math.min(y0, xy[1]); y1 = Math.max(y1, xy[1]); });
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      return w * h === keys.length ? { w: w, h: h } : null;
    },
    // the shape that was asked for? (area and perimeter)
    fits: function (cells, area, perimeter) { return grid.area(cells) === area && grid.perimeter(cells) === perimeter; }
  };

  // ===== drawing =====
  const NS = "http://www.w3.org/2000/svg";
  let overlay = null;
  let onCloseHook = null;
  let keyHandler = null;

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function button(label, className, onClick) {
    const b = el("button", className, label);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  function s(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }

  function rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function task(host, title, hint) {
    const box = el("div", "wk-task");
    const text = el("p", "wk-task-text", title);
    const msg = el("p", "wk-task-msg", hint || "");
    msg.setAttribute("role", "status");
    msg.setAttribute("aria-live", "polite");
    box.append(text, msg);
    host.appendChild(box);
    return { set: function (t) { text.textContent = t; }, say: function (m, good) { msg.textContent = m; msg.classList.toggle("is-good", Boolean(good)); } };
  }

  // ----- tool 1: place value blocks -----
  function toolBaseTen(host) {
    const st = { h: 0, t: 0, e: 0 };
    let target = null;
    const out = el("div", "wk-big");
    const words = el("p", "wk-words");
    const cols = el("div", "wk-cols");
    const challenge = task(host, "Prova: lägg ut 10 ental. Vad kan du göra då?", "Tryck på + för att lägga till block, och på ett block för att ta bort det.");
    host.insertBefore(out, host.firstChild);
    host.insertBefore(words, out.nextSibling);
    host.insertBefore(cols, words.nextSibling);
    const names = { h: ["Hundratal", 100], t: ["Tiotal", 10], e: ["Ental", 1] };

    const draw = function () {
      cols.replaceChildren();
      ["h", "t", "e"].forEach(function (c) {
        const col = el("div", "wk-col");
        col.appendChild(el("h4", "", names[c][0] + " (" + names[c][1] + ")"));
        const pile = el("div", "wk-pile wk-pile-" + c);
        for (let i = 0; i < st[c]; i++) {
          const b = button("", "wk-block wk-" + c, function () { st[c] -= 1; draw(); });
          b.setAttribute("aria-label", "Ta bort ett " + names[c][0].toLowerCase().replace(/tal$/, "tal"));
          pile.appendChild(b);
        }
        col.appendChild(pile);
        const add = button("+ 1", "wk-btn", function () { if (st[c] < 30 && !(c === "h" && st.h >= 9)) { st[c] += 1; draw(); } });
        col.appendChild(add);
        if (c !== "h") {
          const up = button("Växla 10 till 1 " + (c === "e" ? "tiotal" : "hundratal"), "wk-btn wk-exch" + (st[c] >= 10 ? " is-hint" : ""), function () {
            const n = baseTen.exchange(st, "up", c);
            if (n) { Object.assign(st, n); draw(); challenge.say("Tio " + (c === "e" ? "ental" : "tiotal") + " är en " + (c === "e" ? "tiotalsstav" : "hundrarutan") + ". Värdet är detsamma, bara blocken är färre.", true); }
          });
          up.disabled = st[c] < 10;
          col.appendChild(up);
        }
        if (c !== "e") {
          const down = button("Växla 1 till 10 " + (c === "h" ? "tiotal" : "ental"), "wk-btn", function () {
            const n = baseTen.exchange(st, "down", c === "h" ? "t" : "e");
            if (n) { Object.assign(st, n); draw(); }
          });
          down.disabled = st[c] < 1;
          col.appendChild(down);
        }
        cols.appendChild(col);
      });
      out.textContent = String(baseTen.value(st));
      words.textContent = baseTen.value(st) ? baseTen.words(baseTen.value(st)) : "";
    };

    const row = el("div", "wk-row");
    row.append(
      button("Nytt tal att bygga", "wk-btn wk-primary", function () {
        target = rand(11, 999);
        st.h = st.t = st.e = 0; draw();
        challenge.set("Bygg talet " + target + " med så få block som möjligt.");
        challenge.say("Tips: när du har tio av något kan du växla.");
      }),
      button("Kolla", "wk-btn", function () {
        if (target === null) { challenge.say("Tryck på Nytt tal att bygga först."); return; }
        if (baseTen.value(st) !== target) challenge.say("Det blir " + baseTen.value(st) + ". Du ska bygga " + target + ".");
        else if (!baseTen.normalized(st)) challenge.say("Rätt tal, men du har tio eller fler av något. Växla till färre block.");
        else challenge.say("Rätt! " + target + " med så få block som möjligt.", true);
      }),
      button("Töm", "wk-btn", function () { st.h = st.t = st.e = 0; draw(); }));
    host.appendChild(row);
    draw();
  }

  // ----- tool 2: fraction bars -----
  function toolFractions(host) {
    const DEN = [2, 3, 4, 5, 6, 8, 10, 12];
    const COLORS = ["#4c9be8", "#43b581", "#f2c94c", "#e0861f", "#e0506d", "#8a5cd1", "#2f9d88", "#d6529a"];
    const mine = [];
    let target = null;
    const whole = el("div", "wk-bar wk-whole");
    whole.appendChild(el("span", "wk-bar-label", "1 hel"));
    const stack = el("div", "wk-bar wk-mine");
    const sum = el("p", "wk-sum");
    const challenge = task(host, "Prova: tryck på delar och se hur långt de når.", "Tryck på en bit i en rad för att lägga den i din stapel.");
    host.insertBefore(whole, host.firstChild);
    DEN.forEach(function (d, i) {
      const row = el("div", "wk-bar");
      row.appendChild(el("span", "wk-bar-label", "1/" + d));
      for (let k = 0; k < d; k++) {
        const seg = button("", "wk-seg", function () { mine.push(d); draw(); });
        seg.style.flex = "1";
        seg.style.background = COLORS[i];
        seg.setAttribute("aria-label", "Lägg till 1/" + d);
        row.appendChild(seg);
      }
      host.insertBefore(row, challenge ? host.lastChild : null);
    });
    host.insertBefore(el("p", "wk-label", "Din stapel"), host.lastChild);
    host.insertBefore(stack, host.lastChild);
    host.insertBefore(sum, host.lastChild);

    const draw = function () {
      stack.replaceChildren();
      mine.forEach(function (d) {
        const seg = el("span", "wk-piece", "1/" + d);
        seg.style.width = (100 / d) + "%";
        seg.style.background = COLORS[DEN.indexOf(d)];
        stack.appendChild(seg);
      });
      if (!mine.length) { sum.textContent = "Tom stapel."; return; }
      const f = fractions.sum(mine);
      const mixed = fractions.mixed(f);
      sum.textContent = "Tillsammans: " + fractions.text(f) + (mixed ? " = " + mixed : "") + " = " + (f.num / f.den).toFixed(3).replace(/\.?0+$/, "").replace(".", ",") + (f.num === f.den ? "  (en hel)" : "");
    };
    const row = el("div", "wk-row");
    row.append(
      button("Ta bort sista", "wk-btn", function () { mine.pop(); draw(); }),
      button("Töm", "wk-btn", function () { mine.length = 0; draw(); }),
      button("Ny utmaning", "wk-btn wk-primary", function () {
        const options = [[1, 2], [2, 3], [3, 4], [5, 6], [1, 1]];
        target = options[rand(0, options.length - 1)];
        mine.length = 0; draw();
        challenge.set("Bygg " + (target[0] === target[1] ? "en hel" : target[0] + "/" + target[1]) + " med minst två olika sorters bitar.");
        challenge.say("Tips: titta på hur många små bitar som går på en större.");
      }),
      button("Kolla", "wk-btn", function () {
        if (!target) { challenge.say("Tryck på Ny utmaning först."); return; }
        if (!mine.length) { challenge.say("Din stapel är tom."); return; }
        const f = fractions.sum(mine);
        if (!fractions.equals(f, { num: target[0], den: target[1] })) challenge.say("Det blir " + fractions.text(f) + ". Du söker " + target[0] + "/" + target[1] + ".");
        else if (new Set(mine).size < 2) challenge.say("Rätt längd, men du ska använda minst två olika sorters bitar.");
        else challenge.say("Rätt! Olika bitar kan vara lika långa, det är det som kallas likvärdiga bråk.", true);
      }));
    host.insertBefore(row, challenge ? host.lastChild : null);
    draw();
  }

  // ----- tool 3: number line -----
  function toolNumberLine(host) {
    const RANGES = { "0–10": [0, 10, [1, 2]], "0–20": [0, 20, [1, 2, 5]], "0–100": [0, 100, [1, 5, 10]], "−10–10": [-10, 10, [1, 2, 5]] };
    let range = "0–20";
    let pos = 0;
    let start = 0;
    const hops = [];
    let target = null;
    let best = null;
    const wrap = el("div", "wk-line");
    const eq = el("p", "wk-eq", "");
    const challenge = task(host, "Prova: hoppa med knapparna, eller dra kulan.", "Varje hopp ritas som en båge.");
    const W = 640, H = 130, pad = 28;
    let svg = null, arcs = null, dot = null, ring = null;
    const bounds = function () { return RANGES[range]; };
    const x = function (v) { return pad + (v - bounds()[0]) / (bounds()[1] - bounds()[0]) * (W - 2 * pad); };

    // the line itself is built once for a range; the arcs and the dot are moved afterwards, so that dragging works
    const build = function () {
      const min = bounds()[0], max = bounds()[1];
      wrap.replaceChildren();
      svg = s("svg", { viewBox: "0 0 " + W + " " + H, "class": "wk-svg", role: "img", "aria-label": "Tallinje från " + min + " till " + max }, wrap);
      s("line", { x1: pad, y1: 90, x2: W - pad, y2: 90, stroke: "#425b9a", "stroke-width": 3 }, svg);
      const every = max - min <= 20 ? 1 : 5;
      for (let v = min; v <= max; v += every) {
        s("line", { x1: x(v), y1: 82, x2: x(v), y2: 98, stroke: "#425b9a", "stroke-width": v % 10 === 0 || max - min <= 20 ? 2 : 1 }, svg);
        if (max - min <= 20 || v % 10 === 0) { const t = s("text", { x: x(v), y: 118, "text-anchor": "middle", "font-size": 13, fill: "#25304f" }, svg); t.textContent = String(v); }
      }
      arcs = s("g", {}, svg);
      ring = s("circle", { cx: 0, cy: 90, r: 9, fill: "none", stroke: "#43b581", "stroke-width": 3, "stroke-dasharray": "4 3", visibility: "hidden" }, svg);
      dot = s("circle", { cx: x(pos), cy: 90, r: 11, fill: "#425b9a", stroke: "#fff", "stroke-width": 3, "class": "wk-dot", tabindex: 0, role: "slider", "aria-label": "Kulan", "aria-valuemin": min, "aria-valuemax": max, "aria-valuenow": pos }, svg);
      const toValue = function (evt) {
        const px = svgPoint(svg, evt).x;
        return Math.max(min, Math.min(max, Math.round(min + (px - pad) / (W - 2 * pad) * (max - min))));
      };
      dot.addEventListener("pointerdown", function (evt) {
        dot.setPointerCapture(evt.pointerId);
        const move = function (e) { const v = toValue(e); if (v !== pos) { hops.length = 0; start = pos = v; show(); } };
        dot.addEventListener("pointermove", move);
        dot.addEventListener("pointerup", function () { dot.removeEventListener("pointermove", move); }, { once: true });
      });
      dot.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") { e.preventDefault(); jump(1); } if (e.key === "ArrowLeft") { e.preventDefault(); jump(-1); } });
      show();
    };

    const show = function () {
      dot.setAttribute("cx", x(pos));
      dot.setAttribute("aria-valuenow", pos);
      if (target === null) ring.setAttribute("visibility", "hidden");
      else { ring.setAttribute("cx", x(target)); ring.setAttribute("visibility", "visible"); }
      arcs.replaceChildren();
      let from = start;
      hops.forEach(function (d) {
        const to = from + d;
        const mid = (x(from) + x(to)) / 2;
        s("path", { d: "M" + x(from) + ",86 Q" + mid + ",34 " + x(to) + ",86", fill: "none", stroke: "#e0506d", "stroke-width": 2.5 }, arcs);
        const t = s("text", { x: mid, y: 38, "text-anchor": "middle", "font-size": 13, "font-weight": 800, fill: "#b23a56" }, arcs);
        t.textContent = (d > 0 ? "+" : "−") + Math.abs(d);
        from = to;
      });
      if (!hops.length) eq.textContent = "Kulan står på " + pos + ".";
      else {
        const last = hops[hops.length - 1];
        eq.textContent = (pos - last) + (last > 0 ? " + " : " − ") + Math.abs(last) + " = " + pos +
          (hops.length > 1 ? "   (" + start + " " + hops.map(function (d) { return (d > 0 ? "+ " : "− ") + Math.abs(d); }).join(" ") + " = " + pos + ")" : "");
      }
      if (target !== null && pos === target && hops.length) {
        challenge.say("Framme! " + hops.length + " hopp" + (hops.length === best ? ", så få det går." : ". Det går på " + best + ", kan du få färre?"), hops.length === best);
      }
    };

    const jump = function (d) {
      const next = numberLine.jump(pos, d, bounds()[0], bounds()[1]);
      if (next === pos) return;
      hops.push(next - pos);
      pos = next;
      show();
    };

    const controls = el("div", "wk-row");
    const drawControls = function () {
      controls.replaceChildren();
      const r = bounds();
      r[2].slice().reverse().forEach(function (d) { controls.appendChild(button("−" + d, "wk-btn", function () { jump(-d); })); });
      r[2].forEach(function (d) { controls.appendChild(button("+" + d, "wk-btn", function () { jump(d); })); });
      controls.appendChild(button("Börja om", "wk-btn", function () { hops.length = 0; pos = start; show(); }));
    };
    const sel = document.createElement("select");
    sel.setAttribute("aria-label", "Hur stor tallinje");
    Object.keys(RANGES).forEach(function (k) { const o = el("option", "", k); o.value = k; sel.appendChild(o); });
    sel.value = range;
    sel.addEventListener("change", function () { range = sel.value; hops.length = 0; target = null; pos = start = Math.max(bounds()[0], Math.min(bounds()[1], 0)); drawControls(); build(); });
    const row = el("div", "wk-row");
    row.append(sel, button("Ny utmaning", "wk-btn wk-primary", function () {
      const r = bounds();
      hops.length = 0;
      pos = start = rand(r[0], r[1] - 3);
      target = rand(r[0] + 1, r[1]);
      if (target === pos) target = Math.min(r[1], pos + 3);
      best = numberLine.minHops(pos, target, r[2], r[0], r[1]);
      show();
      challenge.set("Gå från " + pos + " till " + target + " (den gröna ringen). Hur få hopp klarar du?");
      challenge.say("Det går på " + best + " hopp. Klarar du det?");
    }));
    host.insertBefore(row, host.firstChild);
    host.insertBefore(wrap, row.nextSibling);
    host.insertBefore(eq, wrap.nextSibling);
    host.insertBefore(controls, eq.nextSibling);
    drawControls();
    build();
  }

  // ----- tool 4: balance scale -----
  function toolScale(host) {
    const st = { x: rand(1, 12), left: 0, right: 0, mode: "find", revealed: false };
    const wrap = el("div", "wk-scale");
    const info = el("p", "wk-eq", "");
    const challenge = task(host, "Vad väger det dolda blocket? Lägg vikter på höger sida tills vågen är i balans.", "Balans betyder lika tungt på båda sidor.");
    host.insertBefore(wrap, host.firstChild);
    host.insertBefore(info, wrap.nextSibling);

    const newGame = function (mode) {
      st.mode = mode;
      st.x = rand(1, 12);
      st.revealed = false;
      if (mode === "find") { st.left = 0; st.right = 0; challenge.set("Vad väger det dolda blocket x? Lägg vikter på höger sida tills vågen är i balans."); }
      else { st.left = rand(1, 6); st.right = st.x + st.left + rand(0, 6); st.x = st.right - st.left; challenge.set("Vågen visar x + " + st.left + " = " + st.right + ". Ta bort lika mycket från båda sidor, så att x blir ensamt."); }
      challenge.say("");
      draw();
    };

    const draw = function () {
      wrap.replaceChildren();
      const leftW = st.x + st.left, rightW = st.right;
      const t = scale.tilt(leftW, rightW);
      const svg = s("svg", { viewBox: "0 0 420 220", "class": "wk-svg", role: "img", "aria-label": "Balansvåg" }, wrap);
      s("polygon", { points: "210,60 190,200 230,200", fill: "#c9d3e6" }, svg);
      s("rect", { x: 160, y: 198, width: 100, height: 10, rx: 4, fill: "#8a94ab" }, svg);
      const ang = t * 14;
      const beam = s("g", { transform: "rotate(" + ang + " 210 60)" }, svg);
      s("rect", { x: 40, y: 54, width: 340, height: 10, rx: 5, fill: "#425b9a" }, beam);
      const pan = function (cx, blocks, extra) {
        const g = s("g", { transform: "rotate(" + (-ang) + " " + cx + " 64)" }, beam);
        s("line", { x1: cx, y1: 64, x2: cx, y2: 90, stroke: "#425b9a", "stroke-width": 3 }, g);
        s("rect", { x: cx - 62, y: 90, width: 124, height: 8, rx: 3, fill: "#8a94ab" }, g);
        let bx = cx - 58;
        blocks.forEach(function (b) {
          const w = 12 + Math.min(b.w, 10) * 2.4;
          s("rect", { x: bx, y: 90 - 22, width: w, height: 22, rx: 3, fill: b.color, stroke: "#fff", "stroke-width": 1.5 }, g);
          const tx = s("text", { x: bx + w / 2, y: 90 - 7, "text-anchor": "middle", "font-size": 11, "font-weight": 800, fill: "#fff" }, g);
          tx.textContent = b.label;
          bx += w + 3;
        });
        if (extra) extra(g);
      };
      const leftBlocks = [{ w: 8, color: st.revealed ? "#43b581" : "#e0506d", label: st.revealed ? String(st.x) : "x" }];
      if (st.left) leftBlocks.push({ w: st.left, color: "#4c9be8", label: String(st.left) });
      pan(90, leftBlocks);
      const rightBlocks = [];
      if (st.right) { let rest = st.right; [10, 5, 2, 1].forEach(function (v) { while (rest >= v && rightBlocks.length < 8) { rightBlocks.push({ w: v, color: "#4c9be8", label: String(v) }); rest -= v; } }); if (rest > 0) rightBlocks.push({ w: 3, color: "#4c9be8", label: "…" }); }
      pan(330, rightBlocks);
      const ok = scale.balanced(leftW, rightW);
      info.textContent = st.mode === "find"
        ? (ok && st.right ? "Balans! x = " + st.x + "." : "Höger sida väger " + st.right + ".")
        : "x + " + st.left + " = " + st.right + (st.left === 0 ? "   Då är x = " + st.right + "." : "");
      if (st.mode === "find" && ok && st.right) { st.revealed = true; challenge.say("Du hittade det: x = " + st.x + ".", true); }
      if (st.mode === "equal" && st.left === 0) { st.revealed = true; challenge.say("Ja! Du tog bort lika mycket från båda sidor, och x = " + st.right + ".", true); }
    };

    const row = el("div", "wk-row");
    const draw2 = function () { draw(); renderButtons(); };
    const renderButtons = function () {
      row.replaceChildren();
      if (st.mode === "find") {
        [1, 2, 5, 10].forEach(function (v) { row.appendChild(button("+" + v, "wk-btn", function () { st.right += v; draw2(); })); });
        row.appendChild(button("−1", "wk-btn", function () { if (st.right > 0) { st.right -= 1; draw2(); } }));
        row.appendChild(button("Töm", "wk-btn", function () { st.right = 0; st.revealed = false; challenge.say(""); draw2(); }));
      } else {
        row.appendChild(button("Ta bort 1 från båda sidor", "wk-btn wk-primary", function () { if (st.left > 0 && st.right > 0) { st.left -= 1; st.right -= 1; draw2(); } }));
      }
      row.appendChild(button("Nytt spel: hitta x", "wk-btn", function () { newGame("find"); renderButtons(); }));
      row.appendChild(button("Nytt spel: lika på båda sidor", "wk-btn", function () { newGame("equal"); renderButtons(); }));
    };
    host.appendChild(row);
    renderButtons();
    draw();
  }

  // ----- tool 5: grid for area and perimeter -----
  function toolGrid(host) {
    const COLS = 14, ROWS = 10, C = 30;
    const cells = {};
    let target = null;
    let mode = "rutor";
    let paint = null;
    let anchor = null;
    const wrap = el("div", "wk-gridwrap");
    const info = el("p", "wk-eq", "");
    const challenge = task(host, "Prova: fyll i rutor och se arean och omkretsen.", "Arean är antalet rutor. Omkretsen är kanten runt om.");
    host.insertBefore(wrap, host.firstChild);
    host.insertBefore(info, wrap.nextSibling);

    // the grid is built once; only the colours, the edge and the text change, so that dragging over it works
    const svg = s("svg", { viewBox: "0 0 " + (COLS * C + 2) + " " + (ROWS * C + 2), "class": "wk-svg wk-grid", role: "img", "aria-label": "Rutnät" }, wrap);
    const rects = {};
    for (let y = 0; y < ROWS; y++) for (let xx = 0; xx < COLS; xx++) rects[xx + "," + y] = s("rect", { x: xx * C + 1, y: y * C + 1, width: C, height: C, fill: "#fff", stroke: "#c9d3e6", "stroke-width": 1 }, svg);
    const edge = s("g", {}, svg);

    const refresh = function () {
      Object.keys(rects).forEach(function (k) { rects[k].setAttribute("fill", cells[k] ? "#76c0ec" : "#fff"); });
      edge.replaceChildren();
      Object.keys(cells).forEach(function (k) {
        const xy = k.split(",").map(Number);
        [[1, 0, "v", 1], [-1, 0, "v", 0], [0, 1, "h", 1], [0, -1, "h", 0]].forEach(function (d) {
          if (cells[(xy[0] + d[0]) + "," + (xy[1] + d[1])]) return;
          const x0 = (xy[0] + (d[2] === "v" ? d[3] : 0)) * C + 1, y0 = (xy[1] + (d[2] === "h" ? d[3] : 0)) * C + 1;
          s("line", d[2] === "v" ? { x1: x0, y1: y0, x2: x0, y2: y0 + C, stroke: "#e0506d", "stroke-width": 3.5 } : { x1: x0, y1: y0, x2: x0 + C, y2: y0, stroke: "#e0506d", "stroke-width": 3.5 }, edge);
        });
      });
      const a = grid.area(cells), p = grid.perimeter(cells), rect = grid.rectangle(cells);
      info.textContent = a
        ? "Area: " + a + " rutor.  Omkrets: " + p + " sidor." + (rect ? "   " + rect.w + " · " + rect.h + " = " + a + ", och omkretsen är 2 · (" + rect.w + " + " + rect.h + ") = " + p + "." : "")
        : "Tryck eller dra över rutorna för att fylla i dem.";
    };

    const at = function (evt) {
      const q = svgPoint(svg, evt);
      const xx = Math.floor((q.x - 1) / C), yy = Math.floor((q.y - 1) / C);   // the squares start 1 unit in, where the outline is
      return xx >= 0 && xx < COLS && yy >= 0 && yy < ROWS ? [xx, yy] : null;
    };
    svg.addEventListener("pointerdown", function (evt) {
      const p = at(evt);
      if (!p) return;
      svg.setPointerCapture(evt.pointerId);
      if (mode === "rutor") { const k = p[0] + "," + p[1]; paint = !cells[k]; if (paint) cells[k] = true; else delete cells[k]; }
      else anchor = p;
      refresh();
    });
    svg.addEventListener("pointermove", function (evt) {
      const p = at(evt);
      if (!p) return;
      if (mode === "rutor" && paint !== null) { const k = p[0] + "," + p[1]; if (paint) cells[k] = true; else delete cells[k]; refresh(); }
      else if (mode === "rektangel" && anchor) {
        Object.keys(cells).forEach(function (k) { delete cells[k]; });
        for (let xx = Math.min(anchor[0], p[0]); xx <= Math.max(anchor[0], p[0]); xx++) for (let yy = Math.min(anchor[1], p[1]); yy <= Math.max(anchor[1], p[1]); yy++) cells[xx + "," + yy] = true;
        refresh();
      }
    });
    const stop = function () { paint = null; anchor = null; };
    svg.addEventListener("pointerup", stop);
    svg.addEventListener("pointercancel", stop);

    const row = el("div", "wk-row");
    ["rutor", "rektangel"].forEach(function (m) {
      row.appendChild(button(m === "rutor" ? "Fria rutor" : "Dra en rektangel", "wk-btn wk-mode" + (mode === m ? " is-on" : ""), function (evt) {
        mode = m;
        Array.prototype.forEach.call(row.querySelectorAll(".wk-mode"), function (b) { b.classList.toggle("is-on", b === evt.currentTarget); });
      }));
    });
    row.append(
      button("Töm", "wk-btn", function () { Object.keys(cells).forEach(function (k) { delete cells[k]; }); refresh(); }),
      button("Ny utmaning", "wk-btn wk-primary", function () {
        // a shape that exists: a rectangle with a known area and perimeter
        const w = rand(2, 6), h = rand(2, 5);
        target = { area: w * h, perimeter: 2 * (w + h) };
        challenge.set("Gör en form med arean " + target.area + " och omkretsen " + target.perimeter + ".");
        challenge.say("Det finns flera sätt. Prova rektanglar, och former med hörn.");
      }),
      button("Kolla", "wk-btn", function () {
        if (!target) { challenge.say("Tryck på Ny utmaning först."); return; }
        const a = grid.area(cells), p = grid.perimeter(cells);
        if (grid.fits(cells, target.area, target.perimeter)) challenge.say("Rätt! Arean " + a + " och omkretsen " + p + ".", true);
        else challenge.say("Din form har arean " + a + " och omkretsen " + p + ". Du söker " + target.area + " och " + target.perimeter + ".");
      }));
    host.appendChild(row);
    refresh();
  }

  const TOOLS = [
    { id: "tiobas", name: "Platsvärdesblock", icon: "🧱", build: toolBaseTen, about: "Bygg tal med hundra-, tio- och entalsblock och växla mellan dem." },
    { id: "brak", name: "Bråkstavar", icon: "🍰", build: toolFractions, about: "Lägg bråkdelar efter varandra och se hur långt de når." },
    { id: "tallinje", name: "Tallinje", icon: "↔️", build: toolNumberLine, about: "Hoppa framåt och bakåt och se räknesättet som en rörelse." },
    { id: "vag", name: "Balansvåg", icon: "⚖️", build: toolScale, about: "Hitta det dolda talet genom att hålla vågen i balans." },
    { id: "rutnat", name: "Rutnät", icon: "🔲", build: toolGrid, about: "Fyll i rutor och se area och omkrets." }
  ];

  function close() {
    if (keyHandler) document.removeEventListener("keydown", keyHandler);
    keyHandler = null;
    if (overlay) overlay.remove();
    overlay = null;
    const hook = onCloseHook;
    onCloseHook = null;
    if (hook) hook();
  }

  function open(options) {
    options = options || {};
    if (overlay) close();
    onCloseHook = options.onClose || null;
    let current = TOOLS.some(function (t) { return t.id === options.tool; }) ? options.tool : "tiobas";
    overlay = el("div", "pv-overlay wk-overlay");
    const panel = el("div", "pv-card wk-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Verkstad");
    overlay.appendChild(panel);

    const draw = function () {
      panel.replaceChildren();
      const head = el("header", "wk-head");
      head.appendChild(el("h2", "", "🧰 Verkstad"));
      const x = button("✕", "pet-close", close);
      x.setAttribute("aria-label", "Stäng");
      head.appendChild(x);
      panel.appendChild(head);
      const tabs = el("div", "wk-tabs");
      tabs.setAttribute("role", "tablist");
      TOOLS.forEach(function (t) {
        const b = button(t.icon + " " + t.name, "pet-tab" + (current === t.id ? " is-on" : ""), function () { current = t.id; draw(); });
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(current === t.id));
        tabs.appendChild(b);
      });
      panel.appendChild(tabs);
      const tool = TOOLS.find(function (t) { return t.id === current; });
      panel.appendChild(el("p", "wk-about", tool.about));
      const host = el("div", "wk-host");
      panel.appendChild(host);
      tool.build(host);
    };
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    keyHandler = function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    document.addEventListener("keydown", keyHandler, true);
    document.body.appendChild(overlay);
    draw();
  }

  return { open: open, close: close, TOOLS: TOOLS, logic: { svgPoint: svgPoint, baseTen: baseTen, fractions: fractions, numberLine: numberLine, scale: scale, grid: grid, gcd: gcd } };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaWorkshop;
