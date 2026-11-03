// Equations with pieces, step by step, with the symbols beside them (added to figures.js with register()): the step from the concrete to the abstract.
// An x is a box that holds some ones, a number is a pile of ones, and both sides of the equals sign weigh the same. Taking the same away from both sides
// is the step that is written 3x + 2 − 2 = 14 − 2. The pieces and the symbols change together, one step at a time.
//
//   ekvationsmodell  { a, b, c, d }   a x + b = d x + c   (d and c are optional: 3x + 2 = 14 is { a: 3, b: 2, c: 14 })
//                    or { left: { x, n }, right: { x, n } }
//   The steps: take the x's away from the right side (if there are any), take the ones away from the left side, share the right side between the x's.
//   A button goes on to the next step and one starts again. With reduced motion the pieces change at once.

(function () {
  "use strict";
  const F = typeof window !== "undefined" ? window.GaussicaFigures : null;

  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : d; };

  function symbols(L, R) {
    const side = (s) => {
      const parts = [];
      if (s.x > 0) parts.push(s.x === 1 ? "x" : s.x + "x");
      if (s.n > 0 || !parts.length) parts.push(String(s.n));
      return parts.join(" + ");
    };
    return side(L) + " = " + side(R);
  }

  // the states, from the start to x = something
  function states(cfg) {
    const L = cfg.left ? { x: num(cfg.left.x, 0), n: num(cfg.left.n, 0) } : { x: num(cfg.a, 1), n: num(cfg.b, 0) };
    const R = cfg.right ? { x: num(cfg.right.x, 0), n: num(cfg.right.n, 0) } : { x: num(cfg.d, 0), n: num(cfg.c, 0) };
    const out = [{ L: L, R: R, caption: "Båda sidor väger lika. Varje ruta x är värd lika många ettor.", groups: null }];
    let cur = { L: Object.assign({}, L), R: Object.assign({}, R) };
    const push = (caption, extra) => { out.push(Object.assign({ L: Object.assign({}, cur.L), R: Object.assign({}, cur.R), caption: caption, groups: null }, extra || {})); };
    if (cur.R.x > 0 && cur.L.x >= cur.R.x) {
      const k = cur.R.x;
      cur = { L: { x: cur.L.x - k, n: cur.L.n }, R: { x: 0, n: cur.R.n } };
      push("Ta bort " + (k === 1 ? "en ruta x" : k + " rutor x") + " från båda sidor. Vågen väger fortfarande lika.", { leaving: { L: { x: k, n: 0 }, R: { x: k, n: 0 } } });
    }
    if (cur.L.n > 0 && cur.R.n >= cur.L.n && cur.R.x === 0) {
      const k = cur.L.n;
      cur = { L: { x: cur.L.x, n: 0 }, R: { x: 0, n: cur.R.n - k } };
      push("Ta bort " + (k === 1 ? "en etta" : k + " ettor") + " från båda sidor.", { leaving: { L: { x: 0, n: k }, R: { x: 0, n: k } } });
    }
    if (cur.L.x > 1 && cur.L.n === 0 && cur.R.x === 0 && cur.R.n % cur.L.x === 0) {
      const per = cur.R.n / cur.L.x;
      push("Dela ettorna lika mellan de " + cur.L.x + " rutorna x: varje ruta x är värd " + per + (per === 1 ? " etta." : " ettor."), { groups: { count: cur.L.x, per: per } });
      cur = { L: { x: 1, n: 0 }, R: { x: 0, n: per } };
      out[out.length - 1].symbolsFor = { L: { x: 1, n: 0 }, R: { x: 0, n: per } };
    }
    return out;
  }

  function tiles(side, leaving) {
    const box = document.createElement("div");
    box.className = "eqm-side";
    const leave = leaving || { x: 0, n: 0 };
    const xs = document.createElement("div");
    xs.className = "eqm-xs";
    for (let i = 0; i < side.x; i++) {
      const t = document.createElement("span");
      t.className = "eqm-x" + (i >= side.x - leave.x ? " is-leaving" : "");
      t.textContent = "x";
      xs.appendChild(t);
    }
    const ones = document.createElement("div");
    ones.className = "eqm-ones";
    for (let i = 0; i < side.n; i++) {
      const t = document.createElement("span");
      t.className = "eqm-one" + (i >= side.n - leave.n ? " is-leaving" : "");
      ones.appendChild(t);
    }
    box.append(xs, ones);
    return box;
  }

  function groupsView(g) {
    const box = document.createElement("div");
    box.className = "eqm-groups";
    for (let i = 0; i < g.count; i++) {
      const row = document.createElement("div");
      row.className = "eqm-group";
      const x = document.createElement("span");
      x.className = "eqm-x";
      x.textContent = "x";
      const eq = document.createElement("span");
      eq.className = "eqm-eq";
      eq.textContent = "=";
      const ones = document.createElement("span");
      ones.className = "eqm-ones eqm-ones-row";
      for (let k = 0; k < g.per; k++) { const o = document.createElement("span"); o.className = "eqm-one"; ones.appendChild(o); }
      row.append(x, eq, ones);
      box.appendChild(row);
    }
    return box;
  }

  function render(cfg) {
    const list = states(cfg);
    const root = document.createElement("div");
    root.className = "eqm";
    const caption = document.createElement("p");
    caption.className = "eqm-caption";
    caption.setAttribute("role", "status");
    caption.setAttribute("aria-live", "polite");
    const stage = document.createElement("div");
    stage.className = "eqm-stage";
    stage.setAttribute("aria-hidden", "true");
    const sym = document.createElement("p");
    sym.className = "eqm-symbols";
    const controls = document.createElement("div");
    controls.className = "eqm-controls";
    const next = document.createElement("button");
    next.type = "button";
    next.className = "secondary-button eqm-next";
    const again = document.createElement("button");
    again.type = "button";
    again.className = "eqm-again";
    again.textContent = "Börja om";
    controls.append(next, again);
    root.append(caption, stage, sym, controls);

    let at = 0, busy = false;
    const motion = !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    function draw(i, leavingNow) {
      const s = list[i];
      stage.replaceChildren();
      if (s.groups) {
        stage.appendChild(groupsView(s.groups));
      } else {
        const eq = document.createElement("span");
        eq.className = "eqm-equals";
        eq.textContent = "=";
        stage.append(tiles(s.L, leavingNow && s.leaving ? s.leaving.L : null), eq, tiles(s.R, leavingNow && s.leaving ? s.leaving.R : null));
      }
      caption.textContent = s.caption;
      const forSymbols = s.symbolsFor || { L: s.L, R: s.R };
      if (window.GaussicaText) window.GaussicaText.set(sym, symbols(forSymbols.L, forSymbols.R)); else sym.textContent = symbols(forSymbols.L, forSymbols.R);
      next.textContent = i < list.length - 1 ? "Nästa steg ▶" : "Klart";
      next.disabled = i >= list.length - 1;
      again.hidden = i === 0;
    }

    next.addEventListener("click", function () {
      if (busy || at >= list.length - 1) return;
      const upcoming = list[at + 1];
      if (motion && upcoming.leaving) {
        // the pieces that go are shown going, then the new state
        busy = true;
        const keep = list[at];
        stage.replaceChildren();
        const eq = document.createElement("span");
        eq.className = "eqm-equals";
        eq.textContent = "=";
        stage.append(tiles(keep.L, upcoming.leaving.L), eq, tiles(keep.R, upcoming.leaving.R));
        caption.textContent = upcoming.caption;
        setTimeout(function () { at += 1; draw(at, false); busy = false; }, 650);
      } else {
        at += 1;
        draw(at, false);
      }
    });
    again.addEventListener("click", function () { at = 0; busy = false; draw(0, false); });
    draw(0, false);
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "Ekvationen med bitar: " + symbols(list[0].L, list[0].R));
    return F.kit.wrap([root]);
  }

  if (F && F.register) F.register("ekvationsmodell", "EKVATIONSMODELL", render);
  if (typeof module !== "undefined") module.exports = { states: states, symbols: symbols };
}());
