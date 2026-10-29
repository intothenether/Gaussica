// "Resan": the lessons of an area as a winding road through a landscape, with the student's pet standing at the stop where
// they are now. It is only a picture of the same progress that "Din väg" and the map show: nothing is stored, and nothing is
// lost by standing still. Each area has its own landscape (meadow, forest, mountains, beach, city), and the road is cut
// into stages of eight stops so that it never gets crowded.
//
//   GaussicaJourney.AREAS                                   the five areas: id, name, place
//   GaussicaJourney.plan(ctx, areaId, nowLessonId)          { area, stops: [{ lesson, number, state, grade }], current, done, total }
//   GaussicaJourney.stage(plan, n) / stageCount(plan) / stageOf(index)
//   GaussicaJourney.sceneSvg(area, stops, options)          the landscape and the road as SVG markup
//   GaussicaJourney.render(container, ctx, hooks)
//     ctx   = { lessons, student, getProgress }
//     hooks = { start(lessonId), nowLessonId, pet (the pet record or null), petSvg(pet, size) -> markup }
//
// state is "done" (finished), "going" (begun), "known" (the level test says it is known) or "todo".

window.GaussicaJourney = (function () {
  "use strict";

  const STAGE_SIZE = 8;
  const W = 720, H = 270;

  const AREAS = [
    { id: "tal", name: "Tal & räkning", place: "Ängen" },
    { id: "algebra", name: "Samband & algebra", place: "Skogen" },
    { id: "geometri", name: "Form & rum", place: "Bergen" },
    { id: "matning", name: "Tid & mätning", place: "Stranden" },
    { id: "data", name: "Data & slump", place: "Staden" }
  ];

  function L() { return window.GaussicaLesson; }
  function areaOf(id) { return AREAS.find(function (a) { return a.id === id; }) || AREAS[0]; }

  // ===== the route (pure) =====
  function plan(ctx, areaId, nowLessonId) {
    const area = areaOf(areaId);
    const index = new Map();
    ctx.lessons.forEach(function (l, i) { index.set(l.id, i); });
    const placement = (window.GaussicaPlacement && ctx.student && window.GaussicaPlacement.saved(ctx.student)) || null;
    const known = new Set(placement ? placement.known : []);
    const list = ctx.lessons.filter(function (l) { return !l.isParentLesson && l.kind !== "pyssel" && l.area === area.id; })
      .map(function (l) { return { lesson: l, grade: L().effectiveGrade(l, ctx.lessons) }; })
      .sort(function (a, b) { return a.grade - b.grade || index.get(a.lesson.id) - index.get(b.lesson.id); });
    const stops = list.map(function (x, i) {
      const sum = L().summarize(x.lesson, ctx.getProgress, ctx.lessons);
      let state = "todo";
      if (sum.total > 0 && sum.state === "complete") state = "done";
      else if (sum.state === "started" || sum.state === "fix") state = "going";
      else if (known.has(x.lesson.id)) state = "known";
      return { lesson: x.lesson, number: i + 1, state: state, grade: x.grade, sum: sum };
    });
    let current = null;
    if (nowLessonId) {
      const pinned = stops.findIndex(function (s) { return s.lesson.id === nowLessonId; });
      if (pinned >= 0) current = pinned;
    }
    if (current === null) {
      const going = stops.findIndex(function (s) { return s.state === "going"; });
      const todo = stops.findIndex(function (s) { return s.state === "todo"; });
      current = going >= 0 ? going : todo >= 0 ? todo : null;
    }
    const done = stops.filter(function (s) { return s.state === "done"; }).length;
    return { area: area, stops: stops, current: current, done: done, total: stops.length, allDone: stops.length > 0 && done === stops.length };
  }

  function stageCount(p) { return Math.max(1, Math.ceil(p.stops.length / STAGE_SIZE)); }
  function stageOf(index) { return Math.floor(index / STAGE_SIZE); }
  function stage(p, n) { return p.stops.slice(n * STAGE_SIZE, (n + 1) * STAGE_SIZE); }

  // where the stops of a stage lie on the road
  function points(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? W / 2 : 70 + i * (W - 140) / (n - 1);
      const y = 176 + 36 * Math.sin(i * 1.15 + 0.4);
      out.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
    return out;
  }

  // a smooth line through the points (Catmull-Rom turned into cubic curves)
  function roadPath(pts) {
    const all = [{ x: -20, y: pts[0].y + 12 }].concat(pts, [{ x: W + 20, y: pts[pts.length - 1].y - 8 }]);
    let d = "M" + all[0].x + "," + all[0].y;
    for (let i = 0; i < all.length - 1; i++) {
      const p0 = all[Math.max(0, i - 1)], p1 = all[i], p2 = all[i + 1], p3 = all[Math.min(all.length - 1, i + 2)];
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      d += " C" + c1.x.toFixed(1) + "," + c1.y.toFixed(1) + " " + c2.x.toFixed(1) + "," + c2.y.toFixed(1) + " " + p2.x + "," + p2.y;
    }
    return d;
  }

  // ===== the landscapes =====
  let counter = 0;
  function r1(v) { return Math.round(v * 10) / 10; }

  function meadow(id) {
    let flowers = "";
    [[40, 236, "#ff8fb0"], [96, 250, "#ffd54a"], [168, 242, "#fff"], [250, 252, "#ff8fb0"], [330, 238, "#ffd54a"], [420, 250, "#fff"], [510, 240, "#ff8fb0"], [590, 252, "#ffd54a"], [664, 238, "#fff"], [700, 254, "#ff8fb0"]].forEach(function (f) {
      flowers += '<g transform="translate(' + f[0] + ' ' + f[1] + ')"><path d="M0,0 V10" stroke="#4f9a5a" stroke-width="2"/><circle cx="0" cy="-1" r="4.5" fill="' + f[2] + '"/><circle cx="0" cy="-1" r="1.8" fill="#f2a900"/></g>';
    });
    return '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + '-sky)"/>' +
      '<circle cx="640" cy="52" r="46" fill="#ffe27a" opacity=".35"/><circle cx="640" cy="52" r="28" fill="#ffd54a"/>' +
      '<ellipse cx="150" cy="56" rx="48" ry="14" fill="#fff" opacity=".9"/><ellipse cx="182" cy="48" rx="30" ry="12" fill="#fff" opacity=".9"/><ellipse cx="430" cy="38" rx="42" ry="12" fill="#fff" opacity=".85"/>' +
      '<path d="M0,150 Q120,92 260,142 T520,128 T720,140 V' + H + ' H0 Z" fill="#a6dc95"/>' +
      '<path d="M0,190 Q160,140 340,184 T720,176 V' + H + ' H0 Z" fill="#82cb7c"/>' + flowers;
  }

  function forest(id) {
    let trees = "";
    [[30, 150, 1], [88, 138, 1.2], [150, 152, .9], [214, 134, 1.25], [286, 150, 1], [360, 136, 1.15], [430, 150, .9], [500, 132, 1.3], [574, 148, 1], [640, 136, 1.2], [700, 150, .95]].forEach(function (t, i) {
      const s = t[2], x = t[0], y = t[1];
      const c1 = i % 2 ? "#2f7a5a" : "#3a8c66", c2 = i % 2 ? "#3a8c66" : "#2f7a5a";
      trees += '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><rect x="-4" y="22" width="8" height="18" fill="#6b4a2a"/><polygon points="0,-34 -22,6 22,6" fill="' + c1 + '"/><polygon points="0,-18 -26,24 26,24" fill="' + c2 + '"/></g>';
    });
    let mush = "";
    [[60, 244], [220, 252], [380, 242], [560, 250], [676, 244]].forEach(function (m) {
      mush += '<g transform="translate(' + m[0] + ' ' + m[1] + ')"><rect x="-3" y="0" width="6" height="9" fill="#f4ead8"/><path d="M-11,1 Q0,-14 11,1 Z" fill="#e0506d"/><circle cx="-3" cy="-4" r="1.6" fill="#fff"/><circle cx="4" cy="-3" r="1.4" fill="#fff"/></g>';
    });
    return '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + '-sky)"/>' +
      '<circle cx="90" cy="46" r="20" fill="#f6f1d6"/><circle cx="98" cy="42" r="18" fill="#dcd4f5"/>' +
      '<g fill="#fff" opacity=".7"><circle cx="300" cy="30" r="1.6"/><circle cx="420" cy="52" r="1.4"/><circle cx="560" cy="34" r="1.6"/><circle cx="660" cy="62" r="1.3"/></g>' +
      trees + '<path d="M0,196 Q160,170 340,194 T720,186 V' + H + ' H0 Z" fill="#5aa877"/>' + mush;
  }

  function mountains(id) {
    return '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + '-sky)"/>' +
      '<circle cx="110" cy="52" r="24" fill="#fff6c8"/>' +
      '<polygon points="-10,190 120,70 250,190" fill="#9bb0cf"/><polygon points="120,70 98,102 112,96 124,108 138,98 144,104" fill="#fff"/>' +
      '<polygon points="170,190 340,40 510,190" fill="#8299bd"/><polygon points="340,40 308,86 326,76 342,92 358,78 376,88" fill="#fff"/>' +
      '<polygon points="430,190 590,84 730,190" fill="#9bb0cf"/><polygon points="590,84 566,116 582,108 594,120 610,110 616,116" fill="#fff"/>' +
      '<path d="M0,190 Q160,160 340,188 T720,180 V' + H + ' H0 Z" fill="#b4d1a4"/>' +
      '<polygon points="40,244 62,244 51,226" fill="#7fb1e8" opacity=".8"/><rect x="560" y="228" width="18" height="18" fill="#f2a24b" opacity=".8"/><circle cx="660" cy="238" r="10" fill="#e0506d" opacity=".75"/><polygon points="300,250 330,250 322,232 308,232" fill="#9a7be0" opacity=".7"/>';
  }

  function beach(id) {
    let waves = "";
    for (let i = 0; i < 9; i++) waves += '<path d="M' + (i * 86 - 10) + ',' + (146 + (i % 2) * 8) + ' q14,-8 28,0 t28,0" stroke="#fff" stroke-width="2.4" fill="none" opacity=".7" stroke-linecap="round"/>';
    return '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + '-sky)"/>' +
      '<circle cx="610" cy="54" r="26" fill="#ffd54a"/><circle cx="610" cy="54" r="42" fill="#ffe27a" opacity=".3"/>' +
      '<ellipse cx="200" cy="48" rx="46" ry="12" fill="#fff" opacity=".9"/><ellipse cx="460" cy="62" rx="36" ry="10" fill="#fff" opacity=".85"/>' +
      '<rect y="110" width="' + W + '" height="76" fill="#4fb0e0"/><rect y="110" width="' + W + '" height="14" fill="#7cc8ee"/>' + waves +
      '<g transform="translate(120 112)"><polygon points="0,-30 0,-2 22,-2" fill="#fff"/><polygon points="-4,-26 -4,-2 -22,-2" fill="#ffe0e6"/><path d="M-24,2 H24 L16,10 H-16 Z" fill="#b8683c"/></g>' +
      '<g transform="translate(520 116) scale(.8)"><polygon points="0,-30 0,-2 22,-2" fill="#fff"/><path d="M-24,2 H24 L16,10 H-16 Z" fill="#4c9be8"/></g>' +
      '<path d="M0,186 Q180,170 360,186 T720,180 V' + H + ' H0 Z" fill="#f4dfa6"/><path d="M0,226 Q200,210 420,228 T720,222 V' + H + ' H0 Z" fill="#ecd08f"/>' +
      '<g transform="translate(60 246)"><path d="M0,0 Q-8,-14 0,-22 Q8,-14 0,0" fill="#ff8fb0"/><circle cx="0" cy="-8" r="2" fill="#fff" opacity=".8"/></g>' +
      '<g transform="translate(640 244)"><path d="M-12,0 Q-12,-14 0,-14 Q12,-14 12,0 Z" fill="#f2a24b"/><path d="M-8,-4 Q0,-10 8,-4" stroke="#fff" stroke-width="2" fill="none"/></g>';
  }

  function city(id) {
    let blocks = "";
    [[10, 70, 52, "#8e9bc0"], [70, 40, 46, "#a3aed0"], [124, 96, 50, "#7b89b2"], [182, 60, 60, "#9aa7c8"], [250, 108, 48, "#7b89b2"], [306, 50, 56, "#a3aed0"], [370, 84, 54, "#8e9bc0"],
      [432, 118, 50, "#7b89b2"], [490, 64, 58, "#9aa7c8"], [556, 90, 50, "#8e9bc0"], [614, 52, 52, "#a3aed0"], [672, 100, 48, "#7b89b2"]].forEach(function (b) {
      const x = b[0], h = b[1], w = b[2], y = 186 - h;
      let win = "";
      for (let wy = y + 10; wy < 176; wy += 16) for (let wx = x + 8; wx < x + w - 8; wx += 14) win += '<rect x="' + wx + '" y="' + wy + '" width="7" height="8" rx="1" fill="' + ((wx + wy) % 3 ? "#ffe9a3" : "#d7defa") + '"/>';
      blocks += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + b[3] + '"/>' + win;
    });
    return '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + '-sky)"/>' +
      '<circle cx="640" cy="44" r="18" fill="#f6f1d6"/>' + blocks +
      '<path d="M0,186 H' + W + ' V' + H + ' H0 Z" fill="#b8c4d8"/>' +
      '<g transform="translate(560 214)"><rect x="-26" y="-22" width="52" height="30" rx="4" fill="#fff" stroke="#9aa7c8" stroke-width="2"/><rect x="-18" y="-6" width="8" height="10" fill="#4c9be8"/><rect x="-6" y="-14" width="8" height="18" fill="#43b581"/><rect x="6" y="-10" width="8" height="14" fill="#f2a24b"/><rect x="-2" y="8" width="4" height="14" fill="#9aa7c8"/></g>' +
      '<g transform="translate(110 240)"><rect x="-3" y="-16" width="6" height="22" fill="#8a97b8"/><circle cx="0" cy="-20" r="7" fill="#ffe9a3"/></g>';
  }

  const SKIES = {
    tal: ["#bfe3ff", "#eef8ff"], algebra: ["#cfc6ef", "#efe9ff"], geometri: ["#cde4f6", "#f3f9fe"], matning: ["#aee1ff", "#e6f6ff"], data: ["#dfe3f7", "#f7f1ff"]
  };
  const SCENES = { tal: meadow, algebra: forest, geometri: mountains, matning: beach, data: city };

  // ===== the picture of a stage =====
  const FILL = { done: "#43b581", going: "#4c9be8", known: "#cdeedd", todo: "#ffffff", current: "#ffd54a" };

  // stops: the stops of the stage; options = { current (index within the stage, or -1), startNumber, first (the road begins here),
  // last (the road ends here), allDone, pet (markup of the pet or ""), selected (index within the stage) }
  function sceneSvg(area, stops, options) {
    options = options || {};
    counter += 1;
    const id = "jn" + counter;
    const sky = SKIES[area.id] || SKIES.tal;
    const pts = points(stops.length || 1);
    const road = roadPath(pts);
    let s = '<svg class="jn-svg" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="' + (area.place + ": en väg med " + stops.length + " stopp").replace(/[<>&"]/g, "") + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="' + id + '-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sky[0] + '"/><stop offset="1" stop-color="' + sky[1] + '"/></linearGradient>' +
      '<clipPath id="' + id + '-clip"><rect width="' + W + '" height="' + H + '" rx="22"/></clipPath></defs><g clip-path="url(#' + id + '-clip)">' +
      (SCENES[area.id] || meadow)(id) +
      '<path d="' + road + '" fill="none" stroke="#bda26c" stroke-width="30" stroke-linecap="round"/>' +
      '<path d="' + road + '" fill="none" stroke="#efdfb6" stroke-width="24" stroke-linecap="round"/>' +
      '<path d="' + road + '" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="9 11" opacity=".75"/>';
    // the start and the finish
    if (options.first) s += '<g transform="translate(28 ' + (pts[0].y - 6) + ')"><rect x="-2" y="-34" width="4" height="40" fill="#6b4a2a"/><polygon points="2,-34 26,-27 2,-20" fill="#43b581"/><text x="0" y="22" text-anchor="middle" font-size="10" font-weight="800" fill="#4a5a3a">Start</text></g>';
    if (options.last) s += '<g transform="translate(' + (W - 30) + ' ' + (pts[pts.length - 1].y - 8) + ')"><rect x="-2" y="-44" width="4" height="52" fill="#6b4a2a"/><path d="M2,-44 H30 V-20 H2 Z" fill="#fff"/><path d="M2,-44 h7 v6 h-7 z M16,-44 h7 v6 h-7 z M9,-38 h7 v6 h-7 z M23,-38 h7 v6 h-7 z M2,-32 h7 v6 h-7 z M16,-32 h7 v6 h-7 z M9,-26 h7 v6 h-7 z M23,-26 h7 v6 h-7 z" fill="#2a2630"/><text x="14" y="22" text-anchor="middle" font-size="10" font-weight="800" fill="#4a5a3a">Mål</text></g>';
    // the stops
    stops.forEach(function (st, i) {
      const p = pts[i];
      const isCur = i === options.current;
      const isSel = i === options.selected;
      const r = isCur ? 19 : 15;
      const fill = isCur && st.state !== "done" ? FILL.current : FILL[st.state];
      const stroke = st.state === "todo" ? "#9aa4b8" : st.state === "known" ? "#7cc9a0" : st.state === "going" ? "#2f74c0" : st.state === "done" ? "#2f8f64" : "#d9a520";
      const label = "Stopp " + st.number + ": " + st.lesson.title + ". " + (st.state === "done" ? "Klar." : st.state === "going" ? "Påbörjad." : st.state === "known" ? "Verkar kunnas enligt nivåtestet." : "Inte börjad.");
      s += '<g class="jn-stop is-' + st.state + (isCur ? " is-current" : "") + (isSel ? " is-selected" : "") + '" data-index="' + i + '" data-lesson="' + st.lesson.id.replace(/[<>&"]/g, "") + '" tabindex="0" role="button" aria-label="' + label.replace(/[<>&"]/g, "") + '" transform="translate(' + p.x + ' ' + p.y + ')">' +
        '<circle class="jn-hit" r="27" fill="transparent"/>' +
        (isSel ? '<circle r="' + (r + 6) + '" fill="none" stroke="#2a2630" stroke-width="2.4" stroke-dasharray="4 3"/>' : "") +
        (isCur ? '<circle class="jn-pulse" r="' + (r + 4) + '" fill="none" stroke="#ffb300" stroke-width="3"/>' : "") +
        '<circle r="' + r + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="3"/>' +
        (st.state === "done" ? '<path d="M-6.5,0.5 L-2,5 L7,-5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'
          : '<text y="5" text-anchor="middle" font-size="' + (isCur ? 15 : 13) + '" font-weight="900" fill="' + (st.state === "going" ? "#fff" : "#2a2630") + '">' + st.number + '</text>') +
        '</g>';
    });
    if (options.pet && options.current >= 0 && pts[options.current]) {
      const p = pts[options.current];
      s += '<g class="jn-pet" transform="translate(' + r1(p.x - 36) + ' ' + r1(p.y - 92) + ')" pointer-events="none">' + options.pet + '</g>';
    } else if (options.current >= 0 && pts[options.current]) {
      const p = pts[options.current];
      s += '<g class="jn-hiker" transform="translate(' + p.x + ' ' + (p.y - 30) + ')" pointer-events="none"><text text-anchor="middle" font-size="30">🚶</text></g>';
    }
    if (options.allDone) {
      let conf = "";
      for (let i = 0; i < 26; i++) {
        const cx = 30 + (i * 53) % 660, cy = 20 + (i * 37) % 110;
        conf += '<rect class="jn-conf" x="' + cx + '" y="' + cy + '" width="7" height="11" rx="1.5" fill="' + ["#ff8fb0", "#ffd54a", "#4c9be8", "#43b581", "#9a7be0"][i % 5] + '" transform="rotate(' + ((i * 47) % 90) + ' ' + cx + ' ' + cy + ')"/>';
      }
      s += '<g pointer-events="none">' + conf + '</g>';
    }
    return s + '</g></svg>';
  }

  // ===== the card =====
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  const view = { area: null, stage: null, selected: null };

  function openingAreas(ctx, nowLessonId) {
    const stats = {};
    AREAS.forEach(function (a) { const p = plan(ctx, a.id, nowLessonId); stats[a.id] = p; });
    return stats;
  }

  function render(container, ctx, hooks) {
    if (!container) return;
    hooks = hooks || {};
    container.replaceChildren();
    const plans = openingAreas(ctx, hooks.nowLessonId);
    if (!AREAS.some(function (a) { return plans[a.id].total > 0; })) { container.hidden = true; return; }
    container.hidden = false;

    // which area to show: the one the student is in now, unless they have chosen another
    let areaId = view.area;
    if (!areaId || !plans[areaId] || !plans[areaId].total) {
      const nowArea = hooks.nowLessonId && (ctx.lessons.find(function (l) { return l.id === hooks.nowLessonId; }) || {}).area;
      areaId = nowArea && plans[nowArea] && plans[nowArea].total ? nowArea
        : (AREAS.find(function (a) { return plans[a.id].total && !plans[a.id].allDone; }) || AREAS.find(function (a) { return plans[a.id].total; })).id;
    }
    const p = plans[areaId];
    const count = stageCount(p);
    let st = view.area === areaId && view.stage !== null && view.stage < count ? view.stage : (p.current !== null ? stageOf(p.current) : count - 1);
    let sel = view.selected && view.selected.area === areaId ? view.selected.index : p.current;
    if (sel !== null && sel !== undefined && stageOf(sel) !== st) sel = null;
    view.area = areaId; view.stage = st;

    const root = el("div", "jn");
    const head = el("header", "jn-head");
    head.appendChild(el("span", "jn-emoji", "🗺️"));
    const title = el("div", "jn-title");
    title.appendChild(el("h3", "", "Resan"));
    title.appendChild(el("p", "", p.area.place + ": " + p.area.name + ". " + (p.allDone ? "Du har tagit dig hela vägen!" : p.done + " av " + p.total + " stopp klara.")));
    head.appendChild(title);
    root.appendChild(head);

    const chips = el("div", "jn-areas");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "Välj område");
    AREAS.forEach(function (a) {
      const ap = plans[a.id];
      if (!ap.total) return;
      const b = el("button", "tv-chip jn-area" + (a.id === areaId ? " is-on" : ""), a.place + (ap.allDone ? " ✓" : ""));
      b.type = "button";
      b.title = a.name + ": " + ap.done + " av " + ap.total;
      b.setAttribute("aria-pressed", String(a.id === areaId));
      b.addEventListener("click", function () { view.area = a.id; view.stage = null; view.selected = null; render(container, ctx, hooks); });
      chips.appendChild(b);
    });
    root.appendChild(chips);

    const stops = stage(p, st);
    const curIn = p.current !== null && stageOf(p.current) === st ? p.current - st * STAGE_SIZE : -1;
    const selIn = sel !== null && sel !== undefined && stageOf(sel) === st ? sel - st * STAGE_SIZE : -1;
    const pet = hooks.pet && hooks.petSvg ? hooks.petSvg(hooks.pet, 72) : "";
    const stageBox = el("div", "jn-stage");
    stageBox.innerHTML = sceneSvg(p.area, stops, { current: curIn, selected: selIn, first: st === 0, last: st === count - 1, allDone: p.allDone, pet: pet });
    root.appendChild(stageBox);

    // moving between the stages of the road
    if (count > 1) {
      const nav = el("div", "jn-nav");
      const prev = el("button", "pet-btn", "← Tidigare stopp");
      prev.type = "button";
      prev.disabled = st === 0;
      prev.addEventListener("click", function () { view.stage = st - 1; view.selected = null; render(container, ctx, hooks); });
      const next = el("button", "pet-btn", "Längre fram →");
      next.type = "button";
      next.disabled = st === count - 1;
      next.addEventListener("click", function () { view.stage = st + 1; view.selected = null; render(container, ctx, hooks); });
      const dots = el("div", "jn-dots");
      for (let i = 0; i < count; i++) {
        const part = stage(p, i);
        const full = part.every(function (x) { return x.state === "done"; });
        const d = el("button", "jn-dot" + (i === st ? " is-on" : "") + (full ? " is-full" : ""), "");
        d.type = "button";
        d.setAttribute("aria-label", "Etapp " + (i + 1) + " av " + count + (full ? ", klar" : ""));
        d.addEventListener("click", function () { view.stage = i; view.selected = null; render(container, ctx, hooks); });
        dots.appendChild(d);
      }
      nav.append(prev, dots, next);
      root.appendChild(nav);
    }

    // what is at the selected stop
    const caption = el("div", "jn-caption");
    caption.setAttribute("aria-live", "polite");
    const drawCaption = function (index) {
      caption.replaceChildren();
      const stop = index !== null && index !== undefined ? p.stops[index] : null;
      if (!stop) { caption.appendChild(el("p", "jn-hint", "Tryck på ett stopp på vägen för att se vad det är.")); return; }
      const text = el("div", "jn-caption-text");
      text.appendChild(el("strong", "", "Stopp " + stop.number + ": " + stop.lesson.title));
      const meta = [L().gradeLabel(stop.grade)];
      meta.push(stop.state === "done" ? "klar ✓" : stop.state === "going" ? "påbörjad" : stop.state === "known" ? "du verkar kunna den (nivåtestet)" : index === p.current ? "här är du nu" : "inte börjad");
      text.appendChild(el("span", "jn-meta", meta.join(" · ")));
      const go = el("button", "primary-button jn-go", stop.state === "done" ? "Öva igen" : stop.state === "going" ? "Fortsätt →" : "Börja →");
      go.type = "button";
      go.addEventListener("click", function () { if (hooks.start) hooks.start(stop.lesson.id); });
      caption.append(text, go);
    };
    drawCaption(sel);
    root.appendChild(caption);
    if (p.allDone) root.appendChild(el("p", "jn-party", "🎉 " + p.area.place + " är klarad! Prova ett annat område, eller repetera något du gillade."));

    const pickStop = function (g) {
      const i = Number(g.getAttribute("data-index"));
      const global = st * STAGE_SIZE + i;
      view.selected = { area: areaId, index: global };
      stageBox.querySelectorAll(".jn-stop").forEach(function (n) { n.classList.toggle("is-selected", n === g); });
      drawCaption(global);
    };
    stageBox.querySelectorAll(".jn-stop").forEach(function (g) {
      g.addEventListener("click", function () { pickStop(g); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickStop(g); } });
    });
    container.appendChild(root);
    // on a narrow screen the picture is wider than the screen and scrolls sideways: start with the current stop in view
    if (curIn >= 0 && stageBox.scrollWidth > stageBox.clientWidth) {
      stageBox.scrollLeft = Math.max(0, points(stops.length)[curIn].x / W * stageBox.scrollWidth - stageBox.clientWidth / 2);
    }
  }

  return { AREAS: AREAS, STAGE_SIZE: STAGE_SIZE, plan: plan, stageCount: stageCount, stageOf: stageOf, stage: stage, points: points, sceneSvg: sceneSvg, render: render };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaJourney;
