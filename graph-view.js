// Lesson graph ("lärstig"), drawn as a Duolingo-style path.
//
// Three kinds of nodes:
//   lesson  – round node with an area symbol
//   unit    – hexagon "kapitel" (a lesson that has sub-lessons); its progress is the sum of its parts
//   step    – small numbered round node for a sub-lesson, chained under its unit
//   pyssel  – rounded-square "pyssla" node: play with a topic using interactive tools
//
// Each node has a segmented progress ring with one segment per task:
//   green = klar, orange = behöver rättas, grey = ej gjord.
//
// Layout: lessons/units are grouped by prerequisite depth (one band per level) and flow
// left-to-right, wrapping to fit the width. Steps sit under their unit.

window.GaussicaGraph = (function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const AREA_GLYPH = { tal: "123", algebra: "x", geometri: "△", matning: "cm", data: "▥" };
  const AREA_ORDER = ["tal", "algebra", "geometri", "matning", "data"];

  const M = {
    lesson: { size: 84, cellW: 156 },
    unit: { size: 112, cellW: 200 },
    step: { size: 56, slot: 104 },
    labelGap: 8, titleH: 34, metaH: 16, tagH: 18,
    gapX: 14, rowGap: 34, levelLabelH: 30, levelGap: 52, padX: 20, padTop: 18, padBottom: 28,
    unitStepsGap: 30
  };

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function svgEl(tag, attrs) {
    const e = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  // ===== MODEL =====
  // Turns the visible lessons into cells: one per lesson or unit (with its steps).
  function buildCells(lessons, allLessons, depthOf) {
    const L = window.GaussicaLesson;
    const visibleIds = new Set(lessons.map(function (l) { return l.id; }));
    const stepOwner = new Map();
    const cells = [];

    lessons.forEach(function (lesson) {
      L.children(lesson, allLessons).forEach(function (k) { stepOwner.set(k.id, lesson.id); });
    });

    const gradeMemo = new Map();
    lessons.forEach(function (lesson) {
      if (stepOwner.has(lesson.id) && visibleIds.has(stepOwner.get(lesson.id))) return; // drawn inside its unit
      const steps = L.children(lesson, allLessons);
      cells.push({
        lesson: lesson,
        kind: steps.length ? "unit" : (lesson.kind === "pyssel" ? "pyssel" : lesson.kind === "begrepp" ? "begrepp" : "lesson"),
        steps: steps,
        grade: L.effectiveGrade(lesson, allLessons, gradeMemo)
      });
    });

    // Rows: one band per school year. Inside a year, a lesson that builds on another lesson
    // from the same year is placed one row further down, so arrows always point downwards.
    const byId = new Map(cells.map(function (c) { return [c.lesson.id, c]; }));
    const ownerOf = function (id) { return stepOwner.has(id) && byId.has(stepOwner.get(id)) ? stepOwner.get(id) : id; };
    const localMemo = new Map();
    const local = function (c, trail) {
      if (localMemo.has(c)) return localMemo.get(c);
      if (trail.indexOf(c) >= 0) return 0;
      let d = 0;
      (c.lesson.prerequisites || []).forEach(function (pid) {
        const p = byId.get(ownerOf(pid));
        if (p && p !== c && p.grade === c.grade) d = Math.max(d, local(p, trail.concat(c)) + 1);
      });
      localMemo.set(c, d);
      return d;
    };
    cells.forEach(function (c) { c.local = local(c, []); });
    const keys = Array.from(new Set(cells.map(function (c) { return c.grade * 100 + c.local; }))).sort(function (a, b) { return a - b; });
    const labelled = new Set();
    cells.forEach(function (c) {
      c.depth = keys.indexOf(c.grade * 100 + c.local);
    });
    const rowLabels = new Map();
    keys.forEach(function (key, i) {
      const g = Math.floor(key / 100);
      if (!labelled.has(g)) { labelled.add(g); rowLabels.set(i, L.gradeLabel(g)); }
    });
    return { cells: cells, stepOwner: stepOwner, rowLabels: rowLabels };
  }

  // ===== LAYOUT =====
  function layout(cells, width, rowLabels) {
    const levels = new Map();
    cells.forEach(function (c) {
      if (!levels.has(c.depth)) levels.set(c.depth, []);
      levels.get(c.depth).push(c);
    });
    const depths = Array.from(levels.keys()).sort(function (a, b) { return a - b; });
    const usable = Math.max(200, width - M.padX * 2);

    const positions = new Map();
    const levelLabels = [];
    let y = M.padTop;

    depths.forEach(function (depth) {
      const list = levels.get(depth).slice().sort(function (a, b) {
        const ia = AREA_ORDER.indexOf(a.lesson.area), ib = AREA_ORDER.indexOf(b.lesson.area);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });

      list.forEach(function (c) {
        c.stepSlot = Math.min(M.step.slot, Math.max(66, usable / Math.max(1, c.steps.length)));
        c.w = c.kind === "unit" ? Math.max(M.unit.cellW, c.steps.length * c.stepSlot) : M.lesson.cellW;
        c.w = Math.min(c.w, usable);
        const nodeSize = c.kind === "unit" ? M.unit.size : M.lesson.size;
        c.nodeSize = nodeSize;
        c.h = nodeSize + M.labelGap + M.titleH + M.metaH + (c.kind === "unit" || c.kind === "pyssel" || c.kind === "begrepp" ? M.tagH + 4 : 0);
        if (c.kind === "unit") c.h += M.unitStepsGap + M.step.size + M.labelGap + M.titleH + 10;
      });

      // pack into rows
      const rows = [];
      let row = [], rowW = 0;
      list.forEach(function (c) {
        const need = c.w + (row.length ? M.gapX : 0);
        if (row.length && rowW + need > usable) { rows.push(row); row = []; rowW = 0; }
        rowW += c.w + (row.length ? M.gapX : 0);
        row.push(c);
      });
      if (row.length) rows.push(row);

      levelLabels.push({ depth: depth, top: y });
      y += rowLabels && rowLabels.has(depth) ? M.levelLabelH : 4;

      rows.forEach(function (r, ri) {
        const total = r.reduce(function (s, c) { return s + c.w; }, 0) + (r.length - 1) * M.gapX;
        let x = (width - total) / 2;
        const rowH = Math.max.apply(null, r.map(function (c) { return c.h; }));
        r.forEach(function (c) {
          const cx = x + c.w / 2;
          const pos = {
            kind: c.kind, cx: cx, nodeTop: y, nodeSize: c.nodeSize,
            cellLeft: x, cellTop: y, cellW: c.w, cellH: c.h, cellBottom: y + c.h
          };
          positions.set(c.lesson.id, pos);
          c.pos = pos;
          if (c.kind === "unit") {
            const stepsTop = y + c.nodeSize + M.labelGap + M.titleH + M.metaH + M.tagH + 4 + M.unitStepsGap;
            const rowW2 = c.steps.length * c.stepSlot;
            const sx = cx - rowW2 / 2;
            c.steps.forEach(function (s, i) {
              const scx = sx + c.stepSlot * i + c.stepSlot / 2;
              positions.set(s.id, {
                kind: "step", cx: scx, nodeTop: stepsTop, nodeSize: M.step.size,
                cellLeft: scx - c.stepSlot / 2, cellTop: stepsTop, cellW: c.stepSlot, cellH: M.step.size + M.labelGap + M.titleH,
                cellBottom: stepsTop + M.step.size + M.labelGap + M.titleH, ownerId: c.lesson.id, index: i
              });
            });
          }
          x += c.w + M.gapX;
        });
        y += rowH + (ri < rows.length - 1 ? M.rowGap : 0);
      });
      y += M.levelGap;
    });

    return { positions: positions, levelLabels: levelLabels, height: Math.max(240, y - M.levelGap + M.padBottom) };
  }

  // ===== RING =====
  function ring(kind, statuses, state) {
    const svg = svgEl("svg", { "class": "gn-ring", viewBox: "0 0 100 100", "aria-hidden": "true" });
    const shape = function (cls) {
      if (kind === "unit") {
        return svgEl("path", { "class": cls, d: "M50 5 L91 28 L91 72 L50 95 L9 72 L9 28 Z", pathLength: "100", fill: "none" });
      }
      if (kind === "pyssel") {
        return svgEl("rect", { "class": cls, x: "8", y: "8", width: "84", height: "84", rx: "26", pathLength: "100", fill: "none" });
      }
      return svgEl("circle", { "class": cls, cx: "50", cy: "50", r: "43", pathLength: "100", fill: "none" });
    };
    const g = svgEl("g", kind === "unit" || kind === "pyssel" ? {} : { transform: "rotate(-90 50 50)" });
    g.appendChild(shape("gn-track"));
    const n = statuses.length;
    if (n) {
      const gap = n > 1 ? Math.min(3, 40 / n) : 0;
      const len = 100 / n - gap;
      statuses.forEach(function (status, i) {
        const seg = shape("gn-seg is-" + status);
        seg.setAttribute("stroke-dasharray", len.toFixed(2) + " " + (100 - len).toFixed(2));
        seg.setAttribute("stroke-dashoffset", (-(i * 100 / n + gap / 2)).toFixed(2));
        g.appendChild(seg);
      });
    }
    svg.appendChild(g);
    return svg;
  }

  function sparkIcon() {
    const svg = svgEl("svg", { viewBox: "0 0 24 24", "class": "gn-icon", "aria-hidden": "true", fill: "currentColor" });
    svg.appendChild(svgEl("path", { d: "M12 2.5l2.2 6.3 6.3 2.2-6.3 2.2L12 19.5l-2.2-6.3L3.5 11l6.3-2.2L12 2.5z" }));
    svg.appendChild(svgEl("path", { d: "M19 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z", opacity: ".7" }));
    return svg;
  }

  function stackIcon() {
    const svg = svgEl("svg", { viewBox: "0 0 24 24", "class": "gn-icon", "aria-hidden": "true", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" });
    svg.appendChild(svgEl("path", { d: "M12 3 3 8l9 5 9-5-9-5z" }));
    svg.appendChild(svgEl("path", { d: "M3 13l9 5 9-5" }));
    svg.appendChild(svgEl("path", { d: "M3 17.5l9 5 9-5", opacity: ".55" }));
    return svg;
  }

  // ===== RENDER =====
  // opts: { container, lessons (visible), allLessons, areas (Map id->name), depthOf, activeId,
  //         getProgress, onSelect, emptyText }
  function render(opts) {
    const L = window.GaussicaLesson;
    const graph = opts.container;
    graph.replaceChildren();
    if (!opts.lessons.length) {
      graph.appendChild(el("p", "empty-path", opts.emptyText || "Inga lektioner finns ännu i det här området."));
      return;
    }

    const width = graph.parentElement.clientWidth || 800;
    const model = buildCells(opts.lessons, opts.allLessons, opts.depthOf);
    const lay = layout(model.cells, width, model.rowLabels);
    const summaries = new Map();
    const summaryOf = function (lesson) {
      if (!summaries.has(lesson.id)) summaries.set(lesson.id, L.summarize(lesson, opts.getProgress, opts.allLessons));
      return summaries.get(lesson.id);
    };

    graph.style.width = width + "px";
    graph.style.height = lay.height + "px";

    // edges first (behind nodes)
    const svg = svgEl("svg", { "class": "graph-edges", "aria-hidden": "true", viewBox: "0 0 " + width + " " + lay.height });
    const defs = svgEl("defs");
    ["", "-done"].forEach(function (suffix) {
      const marker = svgEl("marker", { id: "graph-arrow" + suffix, viewBox: "0 0 10 10", refX: "7", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto" });
      marker.appendChild(svgEl("path", { d: "M 0 1 L 9 5 L 0 9 z", "class": "graph-arrow" + suffix }));
      defs.appendChild(marker);
    });
    svg.appendChild(defs);
    graph.appendChild(svg);

    lay.levelLabels.forEach(function (lv) {
      const text = model.rowLabels.get(lv.depth);
      if (!text) return;   // later rows of the same school year carry no label
      const label = el("span", "graph-column-label", text);
      label.style.top = lv.top + "px";
      label.style.left = M.padX + "px";
      graph.appendChild(label);
    });

    const activeTop = (function () {
      const owner = model.stepOwner.get(opts.activeId);
      return owner && lay.positions.has(owner) ? owner : opts.activeId;
    }());

    // Prerequisite edges between top-level cells. A quiet default keeps the path readable: every lesson
    // gets ONE faint line to the nearest prerequisite on the row above (no arrowheads). The selected
    // lesson shows all of its connections, with arrows, in a stronger colour.
    const depthById = new Map();
    model.cells.forEach(function (c) { depthById.set(c.lesson.id, c.depth); });
    const seen = new Set();
    const edges = [];
    model.cells.forEach(function (cell) {
      const to = lay.positions.get(cell.lesson.id);
      const options = [];
      (cell.lesson.prerequisites || []).forEach(function (pid) {
        const topId = model.stepOwner.has(pid) && lay.positions.has(model.stepOwner.get(pid)) ? model.stepOwner.get(pid) : pid;
        const from = lay.positions.get(topId);
        if (!from || topId === cell.lesson.id || from.kind === "step") return;
        const pairKey = topId + ">" + cell.lesson.id;
        if (seen.has(pairKey)) return;
        seen.add(pairKey);
        const rows = cell.depth - (depthById.get(topId) || 0);
        const related = cell.lesson.id === activeTop || topId === activeTop;
        options.push({ topId: topId, from: from, to: to, cell: cell, rows: rows, dx: Math.abs(from.cx - to.cx), related: related });
      });
      // the one quiet default line: the nearest prerequisite on the row directly above, if it is reasonably close
      const adjacent = options.filter(function (o) { return o.rows === 1; }).sort(function (a, b) { return a.dx - b.dx; });
      options.forEach(function (o) {
        o.primary = adjacent[0] === o && o.dx <= width * 0.45 && o.to.nodeTop - o.from.cellBottom <= 380;
        // the selected lesson also shows connections up to two rows away; anything further is listed in the panel
        const near = o.related && o.rows <= 2 && o.dx <= width * 0.6;
        if (near || o.primary) edges.push(o);
      });
    });
    // faint lines first, the selected lesson's connections on top
    edges.sort(function (a, b) { return (a.related ? 1 : 0) - (b.related ? 1 : 0); }).forEach(function (o) {
      const srcLesson = opts.allLessons.find(function (l) { return l.id === o.topId; });
      const done = srcLesson && summaryOf(srcLesson).state === "complete";
      const attrs = {
        "class": "graph-edge" + (done ? " is-done" : "") + (o.related ? " graph-edge-active" : "") + (o.cell.kind === "pyssel" ? " is-play" : ""),
        d: busPath(o.from.cx, o.from.cellBottom + 2, o.to.cx, o.to.nodeTop - 8)
      };
      if (o.related) attrs["marker-end"] = "url(#graph-arrow" + (done ? "-done" : "") + ")";
      svg.appendChild(svgEl("path", attrs));
    });

    // unit -> steps chain
    model.cells.forEach(function (cell) {
      if (cell.kind !== "unit") return;
      const unit = lay.positions.get(cell.lesson.id);
      let prev = null;
      cell.steps.forEach(function (step, i) {
        const sp = lay.positions.get(step.id);
        const stepDone = summaryOf(step).state === "complete";
        const from = i === 0
          ? { x: unit.cx, y: unit.nodeTop + unit.nodeSize + M.labelGap + M.titleH + M.metaH + M.tagH + 4 }
          : { x: prev.cx + M.step.size / 2, y: prev.nodeTop + M.step.size / 2 };
        const to = i === 0
          ? { x: sp.cx, y: sp.nodeTop - 2 }
          : { x: sp.cx - M.step.size / 2, y: sp.nodeTop + M.step.size / 2 };
        const d = i === 0 ? edgePath(from.x, from.y, to.x, to.y)
          : "M " + from.x + " " + from.y + " L " + to.x + " " + to.y;
        svg.appendChild(svgEl("path", { "class": "graph-chain" + (i > 0 && summaryOf(cell.steps[i - 1]).state === "complete" ? " is-done" : "") + (stepDone ? " is-done-next" : ""), d: d }));
        prev = sp;
      });
    });

    // nodes
    const drawNode = function (lesson, pos, kind, stepIndex, ownerLesson) {
      const s = summaryOf(lesson);
      const area = opts.areas.get(lesson.area) || lesson.area;
      const isActive = lesson.id === opts.activeId;
      const button = el("button", "graph-node gn-" + kind + " state-" + s.state +
        (isActive ? " is-active" : "") + (kind === "unit" && model.stepOwner.get(opts.activeId) === lesson.id ? " is-ancestor" : ""));
      button.type = "button";
      button.dataset.lessonId = lesson.id;
      button.dataset.area = lesson.area;
      button.style.left = (pos.cx - pos.nodeSize / 2) + "px";
      button.style.top = pos.nodeTop + "px";
      button.style.width = pos.nodeSize + "px";
      button.style.height = pos.nodeSize + "px";
      button.setAttribute("aria-current", String(isActive));
      const kindLabel = kind === "unit" ? "kapitel" : kind === "step" ? "delmoment" : kind === "pyssel" ? "pyssla" : kind === "begrepp" ? "begreppslektion" : "lektion";
      const label = lesson.title + ", " + kindLabel + ", " + area + ", " + L.describe(s);
      button.dataset.baseLabel = label;
      button.setAttribute("aria-label", label);
      button.title = lesson.title;

      button.appendChild(ring(kind, s.statuses, s.state));
      const face = el("span", "gn-face");
      if (s.state === "complete") face.textContent = "✓";
      else if (kind === "unit") face.appendChild(stackIcon());
      else if (kind === "pyssel") face.appendChild(sparkIcon());
      else if (kind === "step") face.textContent = String(stepIndex + 1);
      else if (kind === "begrepp") { face.textContent = "Aa"; face.classList.add("gn-glyph-begrepp"); }
      else {
        face.textContent = AREA_GLYPH[lesson.area] || "•";
        face.classList.add("gn-glyph-" + lesson.area);
      }
      button.appendChild(face);
      if (s.fix > 0) {
        const badge = el("span", "gn-badge", "!");
        badge.title = s.fix + " att rätta";
        button.appendChild(badge);
      }
      button.addEventListener("click", function () { opts.onSelect(lesson.id); });
      graph.appendChild(button);

      const labelW = kind === "step" ? pos.cellW - 4 : Math.min(pos.cellW, 176);
      const text = el("div", "graph-node-label gnl-" + kind + (isActive ? " is-active" : ""));
      text.style.left = (pos.cx - labelW / 2) + "px";
      text.style.top = (pos.nodeTop + pos.nodeSize + M.labelGap) + "px";
      text.style.width = labelW + "px";
      text.appendChild(el("span", "graph-node-title", lesson.title));
      const meta = kind === "unit"
        ? el("span", "graph-node-meta state-" + s.state, L.describe(s))
        : el("span", "graph-node-meta state-" + s.state, kind === "step" ? shortStatus(s) : L.describe(s));
      text.appendChild(meta);
      if (kind === "unit") text.appendChild(el("span", "graph-node-tag", "KAPITEL · " + ownerCount(lesson) + " DELMOMENT"));
      if (kind === "pyssel") text.appendChild(el("span", "graph-node-tag is-play", "PYSSLA"));
      if (kind === "begrepp") text.appendChild(el("span", "graph-node-tag is-term", "BEGREPP"));
      text.addEventListener("click", function () { opts.onSelect(lesson.id); });
      graph.appendChild(text);
    };

    const ownerCount = function (lesson) { return L.children(lesson, opts.allLessons).length; };
    const shortStatus = function (s) {
      if (!s.total) return s.started ? "Påbörjad" : "";
      return s.done + "/" + s.total + (s.fix ? " · " + s.fix + " !" : "");
    };

    model.cells.forEach(function (cell) {
      drawNode(cell.lesson, lay.positions.get(cell.lesson.id), cell.kind);
      cell.steps.forEach(function (step, i) {
        drawNode(step, lay.positions.get(step.id), "step", i, cell.lesson);
      });
    });
  }

  // Lines run straight down from a lesson, sideways along a shared "bus" line just above the next row, and
  // straight down into the target. Lines into the same row therefore merge instead of crossing each other.
  function busPath(x1, y1, x2, y2) {
    const r = 12;
    const dx = x2 - x1;
    const ym = Math.max(y1 + r * 2, y2 - 30);
    if (Math.abs(dx) < r * 2 + 2 || ym > y2 - r) return edgePath(x1, y1, x2, y2);
    const dir = dx > 0 ? 1 : -1;
    return "M " + x1 + " " + y1 + " L " + x1 + " " + (ym - r) +
      " Q " + x1 + " " + ym + " " + (x1 + dir * r) + " " + ym +
      " L " + (x2 - dir * r) + " " + ym +
      " Q " + x2 + " " + ym + " " + x2 + " " + (ym + r) +
      " L " + x2 + " " + y2;
  }

  function edgePath(x1, y1, x2, y2) {
    const curve = Math.min(46, Math.max(22, Math.abs(y2 - y1) / 2.8));
    return "M " + x1 + " " + y1 + " C " + x1 + " " + (y1 + curve) + ", " + x2 + " " + (y2 - curve) + ", " + x2 + " " + y2;
  }

  return { render: render };
}());
