// Lesson editor (teacher mode)
//
// Three panes: STRUKTUR (block list + "add" palette), REDIGERA (form for the selected
// block) and FÖRHANDSVISNING (live preview drawn with the app's own renderers, so
// what you see is what students get). Clicking a block in the list or in the preview
// selects it. Every change is applied to the working copy immediately.
//
// A lesson is a free-form, ordered list of blocks. Any block can be moved anywhere
// (drag in the list, or ↑/↓). On save the order is stored as `lesson.layout`
// (see lesson-model.js), and the data goes where app.js expects it:
//   explanationTitle/explanation  -> "explanation" block
//   visual                        -> "visual" block (one chart/table config)
//   components[]                  -> one block each (text, heading, rule, diagram, slider, problem)
//   ruleLabel/rule/example        -> "rule" block
//   interactive                   -> "interactive" block
//   exercise                      -> "exercise" block ("DIN TUR", required by the app)
//   wordProblems[]                -> one block each ("TEXTUPPGIFT n")
//   problemPatterns[]             -> "patterns" block (edited as JSON)

window.InteractiveEditor = (function () {
  "use strict";

  const CHART_TYPES = [
    { value: "stapeldiagram", label: "Stapeldiagram" },
    { value: "cirkeldiagram", label: "Cirkeldiagram" },
    { value: "linjediagram", label: "Linjediagram" }
  ];

  // Palette: each entry creates a block. `kind` "component" blocks live in lesson.components.
  const COMPONENT_TYPES = {
    text: {
      label: "Text", icon: "¶",
      create: () => ({ type: "text", text: "Skriv din text här." })
    },
    heading: {
      label: "Rubrik", icon: "H",
      create: () => ({ type: "heading", level: 1, text: "Ny rubrik" })
    },
    rule: {
      label: "Regelruta", icon: "＝",
      create: () => ({ type: "rule", label: "REGEL", formula: "a + b = b + a", example: "Exempel: 2 + 3 = 3 + 2" })
    },
    diagram: {
      label: "Diagram", icon: "▥",
      create: () => ({
        type: "diagram", diagramType: "stapeldiagram", title: "Nytt diagram", unit: "",
        data: [{ label: "A", value: 5 }, { label: "B", value: 8 }, { label: "C", value: 3 }]
      })
    },
    slider: {
      label: "Skjutreglage", icon: "⇆",
      create: () => ({ type: "slider", label: "Prova själv", min: 0, max: 100, step: 1, start: 50, unit: "" })
    },
    problem: {
      label: "Uppgift", icon: "?",
      create: () => ({ type: "problem", prompt: "Vad är 2 + 2?", answer: ["4"], correct: "Rätt!", feedback: [] })
    },
    // Interactive "pyssla" tools (pyssel.js). They are set up as JSON; see README, "Pyssla".
    pyssel: {
      label: "Pyssel", icon: "✦",
      create: () => ({
        type: "pyssel", title: "Ändra rektangeln", intro: "Dra i reglagen och se vad som händer med omkretsen och arean.",
        params: [{ name: "l", label: "Längd", min: 1, max: 12, step: 1, value: 6, unit: "cm" }, { name: "b", label: "Bredd", min: 1, max: 8, step: 1, value: 3, unit: "cm" }],
        vars: [{ name: "omkrets", expr: "2*(l+b)" }, { name: "area", expr: "l*b" }],
        view: { type: "rektangel", w: "=l", h: "=b", unit: "cm", grid: true },
        readouts: [{ label: "Omkrets", text: "2 · ({l} + {b}) = {omkrets} cm" }, { label: "Area", text: "{l} · {b} = {area} cm²" }],
        goals: [{ id: "a", text: "Gör rektangelns area exakt 12 cm².", conditions: [{ expr: "l*b", equals: 12 }] }]
      })
    },
    ritrutnat: {
      label: "Rutnät", icon: "▦",
      create: () => ({ type: "ritrutnat", title: "Rita en spegelbild", intro: "Färglägg rutor. Stryckad linje är spegellinjen.", cols: 8, rows: 6, autoMirror: true })
    },
    primtalssil: {
      label: "Primtalssil", icon: "∴",
      create: () => ({ type: "primtalssil", title: "Hitta primtalen", intro: "Klicka på det minsta talet som inte är överstruket.", from: 2, to: 50, goal: { id: "sil", text: "Hitta alla primtal mellan 2 och 50." } })
    },
    tarning: {
      label: "Tärning", icon: "⚄",
      create: () => ({ type: "tarning", title: "Kasta tärning", intro: "Kasta många gånger och jämför med vad man väntar sig.", kind: "tarning", sides: 6, goal: { id: "kasta", text: "Kasta minst 100 gånger.", minRolls: 100 } })
    }
  };

  const KIND_INFO = {
    meta: { label: "Lektionsinfo", icon: "ⓘ" },
    explanation: { label: "Förklaring", icon: "¶" },
    visual: { label: "Diagram/tabell", icon: "▥" },
    rule: { label: "Regel", icon: "＝" },
    interactive: { label: "Interaktiv modell", icon: "◔" },
    exercise: { label: "Övning (Din tur)", icon: "?" },
    word: { label: "Textuppgift", icon: "✎" },
    patterns: { label: "Uppgiftsmönster", icon: "∞" }
  };

  let lesson = null;       // everything except the ordered content, which lives in `blocks`
  let blocks = [];         // [{ id, kind, data? }] in display order
  let nextBlockId = 1;
  let isNew = false;
  let selected = "meta";   // "meta" or a block id
  let dirty = false;
  let idTouched = false;
  let root = null;
  let previewQueued = false;
  let toastTimer = null;
  let saving = false;

  // ===== PUBLIC API =====
  return {
    open: function (source, options) {
      closeEditor(true);
      lesson = normalize(JSON.parse(JSON.stringify(source)));
      blocks = makeBlocks(lesson);
      isNew = !!(options && options.isNew);
      idTouched = !isNew;
      selected = isNew ? "meta" : (blocks[0] ? blocks[0].id : "meta");
      dirty = false;
      build();
    },
    newLesson: function () {
      const stamp = Date.now().toString(36);
      this.open({
        id: "ny-lektion-" + stamp,
        area: firstArea(),
        title: "Ny lektion",
        level: "Ungefär åk 3–4",
        grade: 3,
        duration: "5 min",
        prerequisites: [],
        summary: "Kort sammanfattning av vad eleven lär sig.",
        explanationTitle: "Förstå idén",
        explanation: "Förklara idén här.",
        rule: "Huvudregeln eller formeln.",
        ruleLabel: "REGEL",
        example: "Ett exempel på hur regeln används.",
        exercise: { prompt: "Din fråga här.", answer: ["1"], correct: "Rätt!", feedback: [] },
        wordProblems: []
      }, { isNew: true });
    }
  };

  // ===== DATA HELPERS =====
  function normalize(l) {
    if (!Array.isArray(l.prerequisites)) l.prerequisites = [];
    if (!l.exercise || typeof l.exercise !== "object") {
      l.exercise = { prompt: "", answer: [""], correct: "Rätt!", feedback: [] };
    }
    fixProblem(l.exercise);
    if (l.wordProblems && !Array.isArray(l.wordProblems)) l.wordProblems = [];
    (l.wordProblems || []).forEach(fixProblem);
    if (l.components && !Array.isArray(l.components)) l.components = [];
    (l.components || []).forEach(c => { if (c && c.type === "problem") fixProblem(c); });
    // Older versions of the editor wrote `visual: []` which the app renders as an empty box.
    if (Array.isArray(l.visual) && l.visual.length === 0) delete l.visual;
    return l;
  }

  function fixProblem(p) {
    if (!Array.isArray(p.answer)) p.answer = p.answer ? [String(p.answer)] : [""];
    if (!Array.isArray(p.feedback)) p.feedback = [];
    if (p.correct === undefined) p.correct = "Rätt!";
    if (p.prompt === undefined) p.prompt = "";
  }

  function newBlock(kind, data) {
    return { id: "b" + (nextBlockId++), kind: kind, data: data };
  }

  function makeBlocks(l) {
    nextBlockId = 1;
    return window.GaussicaLesson.blockKeys(l).map(key => {
      if (key.startsWith("comp:")) return newBlock("component", l.components[Number(key.slice(5))]);
      if (key.startsWith("word:")) return newBlock("word", l.wordProblems[Number(key.slice(5))]);
      return newBlock(key);
    });
  }

  function blockById(id) { return blocks.find(b => b.id === id); }
  function indexOfBlock(id) { return blocks.findIndex(b => b.id === id); }
  function hasKind(kind) { return blocks.some(b => b.kind === kind); }
  function wordNumber(b) { return blocks.filter(x => x.kind === "word").indexOf(b) + 1; }

  function firstArea() {
    const areas = (window.course && window.course.areas) || [];
    const a = areas.find(x => x.id !== "alla");
    return a ? a.id : "tal";
  }

  function otherLessons() {
    return ((window.course && window.course.lessons) || []).filter(l => l.id !== lesson.id);
  }

  // Would adding `candidateId` as a prerequisite create a cycle?
  function dependsOn(startId, targetId, seen) {
    seen = seen || new Set();
    if (startId === targetId) return true;
    if (seen.has(startId)) return false;
    seen.add(startId);
    const l = window.course.lessons.find(x => x.id === startId);
    return !!l && (l.prerequisites || []).some(id => dependsOn(id, targetId, seen));
  }

  function slugify(text) {
    return String(text).toLowerCase()
      .replace(/å|ä/g, "a").replace(/ö/g, "o")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "lektion";
  }

  function lines(text) {
    return String(text).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }

  function describe(id) {
    if (id === "meta") return { ...KIND_INFO.meta, title: lesson.title || "Namnlös lektion", sub: "" };
    const b = blockById(id);
    if (!b) return { label: "", icon: "", sub: "" };
    const d = b.data;
    if (b.kind === "component") {
      const info = COMPONENT_TYPES[d.type] || { label: d.type || "Okänd", icon: "□" };
      let sub = "";
      if (d.type === "text" || d.type === "heading") sub = d.text;
      else if (d.type === "rule") sub = d.formula;
      else if (d.type === "diagram") sub = d.title;
      else if (d.type === "slider") sub = (d.label || "") + " (" + d.min + "–" + d.max + ")";
      else if (d.type === "problem") sub = d.prompt;
      else if (window.GaussicaLesson.isTool(d)) sub = d.title;
      return { label: info.label, icon: info.icon, sub: clip(sub) };
    }
    const info = KIND_INFO[b.kind];
    let sub = "";
    let label = info.label;
    if (b.kind === "explanation") sub = lesson.explanationTitle || lesson.explanation;
    else if (b.kind === "visual") sub = lesson.visual && (lesson.visual.title || lesson.visual.type);
    else if (b.kind === "rule") sub = lesson.rule;
    else if (b.kind === "interactive") sub = lesson.interactive && lesson.interactive.type;
    else if (b.kind === "exercise") sub = lesson.exercise.prompt;
    else if (b.kind === "word") { label = "Textuppgift " + wordNumber(b); sub = d.prompt; }
    else if (b.kind === "patterns") sub = (lesson.problemPatterns || []).length + " st";
    return { label: label, icon: info.icon, sub: clip(sub) };
  }

  function clip(s) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    return s.length > 48 ? s.slice(0, 47) + "…" : s;
  }

  // ===== DOM HELPERS =====
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function button(label, className, onClick, title) {
    const b = el("button", className, label);
    b.type = "button";
    if (title) { b.title = title; b.setAttribute("aria-label", title); }
    b.addEventListener("click", onClick);
    return b;
  }

  function field(labelText, control, hint) {
    const wrap = el("label", "le-field");
    wrap.appendChild(el("span", "le-label", labelText));
    wrap.appendChild(control);
    if (hint) wrap.appendChild(el("small", "le-hint", hint));
    return wrap;
  }

  // Binds an input to obj[key]; edits apply immediately (no "blur to commit").
  function bind(control, get, set, transform) {
    control.value = get();
    control.addEventListener("input", () => {
      set(transform ? transform(control.value) : control.value);
      changed();
    });
    return control;
  }

  function textInput(obj, key, placeholder) {
    const i = el("input"); i.type = "text";
    if (placeholder) i.placeholder = placeholder;
    return bind(i, () => obj[key] === undefined ? "" : obj[key], v => { obj[key] = v; });
  }

  function areaInput(obj, key, rows, placeholder) {
    const t = el("textarea"); t.rows = rows || 3;
    if (placeholder) t.placeholder = placeholder;
    return bind(t, () => obj[key] === undefined ? "" : obj[key], v => { obj[key] = v; });
  }

  function numberInput(obj, key) {
    const i = el("input"); i.type = "number"; i.step = "any";
    return bind(i, () => obj[key] === undefined ? "" : obj[key], v => { obj[key] = v === "" ? undefined : Number(v); });
  }

  function selectInput(options, get, set) {
    const s = el("select");
    options.forEach(o => {
      const opt = el("option", "", o.label); opt.value = o.value; s.appendChild(opt);
    });
    s.value = get();
    s.addEventListener("change", () => { set(s.value); changed(); });
    return s;
  }

  function changed() {
    dirty = true;
    updateStatus();
    renderOutline();
    queuePreview();
  }

  // Structure changed (blocks added/moved/removed): redraw everything but keep the form open.
  function structureChanged() {
    dirty = true;
    updateStatus();
    renderOutline();
    renderPreview();
  }

  // ===== EDITOR SHELL =====
  function build() {
    root = el("div", "le-overlay");
    root.dataset.pane = "edit";
    root.innerHTML = `
      <div class="le-window" role="dialog" aria-modal="true" aria-label="Lektionsredigerare" tabindex="-1">
        <header class="le-header">
          <div class="le-header-title">
            <h2></h2>
            <span class="le-status" aria-live="polite"></span>
          </div>
          <div class="le-header-actions"></div>
        </header>
        <nav class="le-tabs" aria-label="Visa">
          <button type="button" data-pane="outline">Struktur</button>
          <button type="button" data-pane="edit">Redigera</button>
          <button type="button" data-pane="preview">Förhandsvisning</button>
        </nav>
        <div class="le-body">
          <aside class="le-col le-outline-col" aria-label="Struktur"></aside>
          <section class="le-col le-inspector-col" aria-label="Redigera"></section>
          <section class="le-col le-preview-col" aria-label="Förhandsvisning">
            <div class="le-preview-bar"><span>Förhandsvisning</span><small>Klicka på ett block för att redigera det</small></div>
            <div class="le-preview-scroll"><article class="lesson-panel le-preview"></article></div>
          </section>
        </div>
        <div class="le-toast" role="status" aria-live="polite" hidden></div>
      </div>`;

    const actions = root.querySelector(".le-header-actions");
    actions.append(
      button("⬇ Ladda ner JSON", "le-btn", downloadJSON, "Ladda ner lektionen som en .json-fil att lägga i mappen lessons/"),
      button("Avbryt", "le-btn", () => closeEditor(false)),
      button("💾 Spara", "le-btn le-btn-primary", save, "Spara (Ctrl+S)")
    );

    root.querySelectorAll(".le-tabs button").forEach(b =>
      b.addEventListener("click", () => setPane(b.dataset.pane)));

    // Only close on a click that both started and ended on the backdrop (not a text selection drag).
    const overlay = root;
    overlay.addEventListener("mousedown", e => { overlay._downOnBackdrop = e.target === overlay; });
    overlay.addEventListener("click", e => {
      if (e.target === overlay && overlay._downOnBackdrop) closeEditor(false);
      overlay._downOnBackdrop = false;
    });
    root.addEventListener("keydown", onKey);

    document.body.appendChild(root);
    document.body.classList.add("le-open");
    renderAll();
    root.querySelector(".le-window").focus();
  }

  function onKey(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      closeEditor(false);
    }
  }

  function setPane(pane) {
    root.dataset.pane = pane;
    root.querySelectorAll(".le-tabs button").forEach(b =>
      b.setAttribute("aria-selected", String(b.dataset.pane === pane)));
  }

  function updateStatus() {
    if (!root) return;
    root.querySelector(".le-header h2").textContent =
      (isNew ? "Ny lektion: " : "Redigerar: ") + (lesson.title || "Namnlös");
    root.querySelector(".le-status").textContent = dirty ? "● Osparade ändringar" : "Allt sparat";
    root.classList.toggle("le-dirty", dirty);
  }

  function renderAll() {
    updateStatus();
    setPane(root.dataset.pane);
    renderOutline();
    renderInspector();
    renderPreview();
  }

  function queuePreview() {
    if (previewQueued) return;
    previewQueued = true;
    requestAnimationFrame(() => {
      previewQueued = false;
      if (root) renderPreview();
    });
  }

  // ===== BLOCK LIST + ADD PALETTE =====
  function renderOutline() {
    const col = root.querySelector(".le-outline-col");
    const scroll = col.scrollTop;
    col.replaceChildren();

    col.appendChild(outlineItem("meta"));

    const list = el("ol", "le-outline");
    blocks.forEach((b, i) => list.appendChild(outlineRow(b, i)));
    col.appendChild(list);

    col.appendChild(el("p", "le-outline-note",
      "Dra block eller använd ↑ ↓ för att välja ordning – så här ser eleven lektionen, uppifrån och ned."));

    const palette = el("div", "le-palette");
    palette.appendChild(el("h3", "", "Lägg till"));
    const grid = el("div", "le-palette-grid");
    const addButton = (label, icon, fn) => {
      const b = button("", "le-add", fn, "Lägg till " + label.toLowerCase());
      b.append(el("span", "le-add-icon", icon), el("span", "", label));
      grid.appendChild(b);
    };
    Object.entries(COMPONENT_TYPES).forEach(([type, info]) => addButton(info.label, info.icon, () => addComponent(type)));
    addButton("Textuppgift", KIND_INFO.word.icon, addWordProblem);
    if (!hasKind("explanation")) addButton("Förklaring", KIND_INFO.explanation.icon, () => addSingleton("explanation"));
    if (!hasKind("rule")) addButton("Regel", KIND_INFO.rule.icon, () => addSingleton("rule"));
    if (!hasKind("visual")) addButton("Diagram i förklaringen", KIND_INFO.visual.icon, () => addSingleton("visual"));
    if (!hasKind("interactive")) addButton("Bråkmodell", KIND_INFO.interactive.icon, () => addSingleton("interactive"));
    palette.appendChild(grid);
    col.appendChild(palette);
    col.scrollTop = scroll;
  }

  function outlineItem(id) {
    const d = describe(id);
    const b = el("button", "le-item" + (selected === id ? " is-selected" : ""));
    b.type = "button";
    b.dataset.key = id;
    b.append(el("span", "le-item-icon", d.icon));
    const text = el("span", "le-item-text");
    text.append(el("span", "le-item-title", d.label), el("span", "le-item-sub", id === "meta" ? d.title : d.sub));
    b.appendChild(text);
    b.addEventListener("click", () => select(id));
    return b;
  }

  function outlineRow(b, i) {
    const li = el("li", "le-row" + (selected === b.id ? " is-selected" : ""));
    li.appendChild(outlineItem(b.id));

    const tools = el("span", "le-row-tools");
    const up = button("↑", "le-tool", () => moveBlock(i, i - 1), "Flytta upp");
    const down = button("↓", "le-tool", () => moveBlock(i, i + 1), "Flytta ner");
    up.disabled = i === 0;
    down.disabled = i === blocks.length - 1;
    tools.append(up, down);
    if (b.kind === "component" || b.kind === "word") {
      tools.appendChild(button("⧉", "le-tool", () => duplicateBlock(i), "Duplicera"));
    }
    if (b.kind !== "exercise") {
      tools.appendChild(button("🗑", "le-tool le-tool-danger", () => removeBlock(i), "Ta bort"));
    }
    li.appendChild(tools);

    li.draggable = true;
    li.addEventListener("dragstart", e => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
      li.classList.add("is-dragging");
    });
    li.addEventListener("dragend", () => li.classList.remove("is-dragging"));
    li.addEventListener("dragover", e => { e.preventDefault(); li.classList.add("is-drop"); });
    li.addEventListener("dragleave", () => li.classList.remove("is-drop"));
    li.addEventListener("drop", e => {
      e.preventDefault();
      li.classList.remove("is-drop");
      const from = Number(e.dataTransfer.getData("text/plain"));
      if (!Number.isNaN(from)) moveBlock(from, i);
    });
    return li;
  }

  // ===== SELECTION =====
  function select(id, opts) {
    selected = id;
    renderOutline();
    renderInspector(opts && opts.focus);
    markPreviewSelection(!(opts && opts.fromPreview));
    // On narrow screens only one pane is visible: jump to the form. (No effect on wide layouts.)
    setPane("edit");
  }

  // ===== BLOCK OPERATIONS =====
  function insertBlock(block) {
    // New blocks go right after the selected one (or at the end).
    const at = selected === "meta" ? blocks.length : indexOfBlock(selected) + 1;
    blocks.splice(at, 0, block);
    structureChanged();
    select(block.id, { focus: true });
    scrollPreviewTo(block.id);
  }

  function addComponent(type) {
    insertBlock(newBlock("component", COMPONENT_TYPES[type].create()));
    toast(COMPONENT_TYPES[type].label + " tillagd.");
  }

  function addWordProblem() {
    insertBlock(newBlock("word", { prompt: "Ny textuppgift", answer: [""], correct: "Rätt!", feedback: [] }));
    toast("Textuppgift tillagd.");
  }

  function addSingleton(kind) {
    if (kind === "explanation") {
      if (lesson.explanation === undefined) { lesson.explanationTitle = "Förstå idén"; lesson.explanation = "Förklara idén här."; }
    } else if (kind === "rule") {
      if (lesson.rule === undefined) { lesson.ruleLabel = "REGEL"; lesson.rule = "Huvudregeln eller formeln."; lesson.example = ""; }
    } else if (kind === "visual") {
      if (!lesson.visual) {
        lesson.visual = { type: "stapeldiagram", title: "Nytt diagram", unit: "",
          data: [{ label: "A", value: 5 }, { label: "B", value: 8 }, { label: "C", value: 3 }] };
      }
    } else if (kind === "interactive") {
      if (!lesson.interactive) lesson.interactive = { type: "fraction-model", numerator: 1, denominator: 2 };
    }
    insertBlock(newBlock(kind));
    toast(KIND_INFO[kind].label + " tillagd.");
  }

  function moveBlock(from, to) {
    if (to < 0 || to >= blocks.length || from === to) return;
    const [item] = blocks.splice(from, 1);
    blocks.splice(to, 0, item);
    structureChanged();
    select(item.id);
  }

  function duplicateBlock(i) {
    const copy = newBlock(blocks[i].kind, JSON.parse(JSON.stringify(blocks[i].data)));
    blocks.splice(i + 1, 0, copy);
    structureChanged();
    select(copy.id);
  }

  function removeBlock(i) {
    const [removed] = blocks.splice(i, 1);
    const label = describe0(removed);
    selected = blocks[Math.min(i, blocks.length - 1)] ? blocks[Math.min(i, blocks.length - 1)].id : "meta";
    dirty = true;
    renderAll();
    toast(label + " borttagen.", () => {
      blocks.splice(i, 0, removed);
      selected = removed.id;
      dirty = true;
      renderAll();
    });
  }

  function describe0(b) {
    if (b.kind === "component") return (COMPONENT_TYPES[b.data.type] || { label: "Block" }).label;
    return KIND_INFO[b.kind].label;
  }

  // ===== INSPECTOR (forms) =====
  function renderInspector(focusFirst) {
    const col = root.querySelector(".le-inspector-col");
    col.scrollTop = 0;
    col.replaceChildren();
    const d = describe(selected);
    const head = el("div", "le-inspector-head");
    head.append(el("span", "le-item-icon", d.icon), el("h3", "", d.label));
    col.appendChild(head);

    const form = el("div", "le-form");
    try {
      buildForm(form, selected);
    } catch (err) {
      form.appendChild(el("p", "le-error", "Kunde inte visa formuläret: " + err.message));
    }
    col.appendChild(form);

    if (focusFirst) {
      const first = form.querySelector("input, textarea, select");
      if (first) first.focus({ preventScroll: true });
    }
  }

  function buildForm(form, id) {
    if (id === "meta") return metaForm(form);
    const b = blockById(id);
    if (!b) { form.appendChild(el("p", "le-hint", "Välj ett block i listan eller i förhandsvisningen.")); return; }
    switch (b.kind) {
      case "explanation":
        form.append(
          field("Rubrik", textInput(lesson, "explanationTitle", "T.ex. Varför fungerar det så här?")),
          field("Text", areaInput(lesson, "explanation", 8))
        );
        break;
      case "visual":
        if (lesson.visual) chartForm(form, lesson.visual, "visual", () => lesson.visual, v => { lesson.visual = v; });
        else form.appendChild(el("p", "le-hint", "Den här lektionens diagram har en avancerad uppbyggnad som inte kan redigeras här."));
        break;
      case "rule":
        form.append(
          field("Etikett", textInput(lesson, "ruleLabel", "T.ex. REGEL"), "Liten rubrik över regeln."),
          field("Regel / formel", areaInput(lesson, "rule", 3)),
          field("Exempel", areaInput(lesson, "example", 3))
        );
        break;
      case "interactive": interactiveForm(form); break;
      case "exercise": problemForm(form, lesson.exercise); break;
      case "word": problemForm(form, b.data); break;
      case "patterns":
        jsonForm(form, () => lesson.problemPatterns, v => { lesson.problemPatterns = v; },
          "Uppgiftsmönster genererar uppgifter automatiskt. De redigeras som JSON.");
        break;
      case "component": componentForm(form, b); break;
    }
  }

  function metaForm(form) {
    const idInput = textInput(lesson, "id");
    idInput.readOnly = !isNew;
    if (isNew) {
      idInput.addEventListener("input", () => { idTouched = true; });
    }
    const title = textInput(lesson, "title");
    title.addEventListener("input", () => {
      if (isNew && !idTouched) {
        lesson.id = slugify(title.value);
        idInput.value = lesson.id;
      }
    });
    const areas = ((window.course && window.course.areas) || []).filter(a => a.id !== "alla");
    form.append(
      field("Titel", title),
      field("Lektions-ID", idInput, isNew
        ? "Används som filnamn och i länkar. Små bokstäver, siffror och bindestreck."
        : "ID:t kan inte ändras eftersom andra lektioner kan peka på det."),
      field("Område", selectInput(
        areas.map(a => ({ value: a.id, label: a.name })),
        () => lesson.area, v => { lesson.area = v; })),
      field("Nivå", textInput(lesson, "level", "T.ex. Ungefär åk 3–5")),
      field("Längd", textInput(lesson, "duration", "T.ex. 6 min")),
      field("Årskurs", selectInput(
        [3, 4, 5, 6, 7, 8, 9, 10].map(g => ({ value: String(g), label: g >= 10 ? "Gymnasiet" : "Åk " + g })),
        () => String(lesson.grade || 3), v => { lesson.grade = Number(v); }),
        "Bestämmer var i lärstigen lektionen hamnar. Den placeras aldrig före sina förkunskaper."),
      field("Typ av nod", selectInput(
        [{ value: "lektion", label: "Lektion" }, { value: "pyssel", label: "Pyssla (interaktiv lek)" }],
        () => lesson.kind === "pyssel" ? "pyssel" : "lektion",
        v => { if (v === "pyssel") lesson.kind = "pyssel"; else delete lesson.kind; })),
      field("Sammanfattning", areaInput(lesson, "summary", 3))
    );

    const fs = el("fieldset", "le-fieldset");
    fs.appendChild(el("legend", "", "Bygger vidare på (förkunskaper)"));
    const candidates = otherLessons();
    if (!candidates.length) fs.appendChild(el("p", "le-hint", "Inga andra lektioner finns."));
    const box = el("div", "le-checklist");
    candidates.forEach(l => {
      const cyc = dependsOn(l.id, lesson.id);
      const row = el("label", "le-check" + (cyc ? " is-disabled" : ""));
      const cb = el("input"); cb.type = "checkbox";
      cb.checked = lesson.prerequisites.includes(l.id);
      cb.disabled = cyc && !cb.checked;
      cb.addEventListener("change", () => {
        const set = new Set(lesson.prerequisites);
        if (cb.checked) set.add(l.id); else set.delete(l.id);
        lesson.prerequisites = Array.from(set);
        changed();
      });
      row.append(cb, el("span", "", l.title));
      if (cyc) row.title = "Skulle skapa en cirkel i förkunskaperna";
      box.appendChild(row);
    });
    fs.appendChild(box);
    form.appendChild(fs);
  }

  function componentForm(form, b) {
    const c = b.data;
    switch (c.type) {
      case "text":
        form.appendChild(field("Text", areaInput(c, "text", 8)));
        break;
      case "heading":
        form.append(
          field("Rubriktext", textInput(c, "text")),
          field("Storlek", selectInput(
            [{ value: "1", label: "Stor" }, { value: "2", label: "Mellan" }, { value: "3", label: "Liten" }],
            () => String(c.level || 1), v => { c.level = Number(v); }))
        );
        break;
      case "rule":
        form.append(
          field("Etikett", textInput(c, "label", "REGEL")),
          field("Formel", textInput(c, "formula")),
          field("Exempel", areaInput(c, "example", 3))
        );
        break;
      case "diagram":
        chartForm(form, c, "component", () => b.data, v => { b.data = v; });
        break;
      case "slider":
        form.append(
          field("Text vid reglaget", textInput(c, "label")),
          row2(field("Minsta värde", numberInput(c, "min")), field("Största värde", numberInput(c, "max"))),
          row2(field("Steg", numberInput(c, "step")), field("Startvärde", numberInput(c, "start"))),
          field("Enhet", textInput(c, "unit", "T.ex. cm"))
        );
        break;
      case "problem":
        problemForm(form, c);
        break;
      default:
        jsonForm(form, () => b.data, v => { b.data = v; },
          window.GaussicaLesson.isTool(b.data)
            ? "Pyssel-verktyg ställs in som JSON: reglage (params), formler (vars), figur (view), text (readouts) och utmaningar (goals). Se README, avsnittet Pyssla."
            : "Okänd blocktyp – redigeras som JSON.");
    }
  }

  function row2(a, b) {
    const r = el("div", "le-row2");
    r.append(a, b);
    return r;
  }

  // Chart editor shared by `visual` (type key = "type") and diagram components (type key = "diagramType").
  function chartForm(form, cfg, mode, get, set) {
    const typeKey = mode === "visual" ? "type" : "diagramType";
    const supported = CHART_TYPES.some(t => t.value === cfg[typeKey]) && Array.isArray(cfg.data);
    if (!supported) {
      jsonForm(form, get, set,
        "Det här diagrammet (t.ex. flikar eller tabell) har en avancerad uppbyggnad och redigeras som JSON.");
      return;
    }
    form.append(
      field("Titel", textInput(cfg, "title")),
      field("Typ", selectInput(CHART_TYPES, () => cfg[typeKey], v => { cfg[typeKey] = v; })),
      field("Enhet", textInput(cfg, "unit", "T.ex. röster"))
    );
    if (mode === "visual") form.appendChild(field("Underrubrik", textInput(cfg, "subtitle")));

    const fs = el("fieldset", "le-fieldset");
    fs.appendChild(el("legend", "", "Data"));
    const rows = el("div", "le-data");
    const draw = () => {
      rows.replaceChildren();
      cfg.data.forEach((item, i) => {
        const r = el("div", "le-data-row");
        const label = textInput(item, "label", "Namn");
        const value = numberInput(item, "value");
        label.setAttribute("aria-label", "Namn");
        value.setAttribute("aria-label", "Värde");
        r.append(label, value, button("✕", "le-tool le-tool-danger", () => {
          cfg.data.splice(i, 1); draw(); changed();
        }, "Ta bort rad"));
        rows.appendChild(r);
      });
    };
    draw();
    fs.appendChild(rows);
    fs.appendChild(button("+ Lägg till rad", "le-btn le-btn-small", () => {
      cfg.data.push({ label: "", value: 0 });
      draw(); changed();
      const inputs = rows.querySelectorAll("input[type=text]");
      if (inputs.length) inputs[inputs.length - 1].focus();
    }));
    form.appendChild(fs);
  }

  function interactiveForm(form) {
    const m = lesson.interactive;
    if (m.type === "fraction-model") {
      form.append(
        row2(field("Täljare", numberInput(m, "numerator")), field("Nämnare", numberInput(m, "denominator"))),
        el("p", "le-hint", "Eleven får utforska bråket som en interaktiv modell.")
      );
      return;
    }
    jsonForm(form, () => lesson.interactive, v => { lesson.interactive = v; }, "Okänd modell – redigeras som JSON.");
  }

  // One problem (exercise / word problem / problem component).
  function problemForm(form, p) {
    const answers = el("textarea"); answers.rows = 2;
    bind(answers, () => p.answer.join("\n"), v => { p.answer = lines(v); });
    form.append(
      field("Fråga", areaInput(p, "prompt", 3)),
      field("Rätt svar", answers, "Ett per rad om flera svar ska godkännas."),
      field("Svar vid rätt", areaInput(p, "correct", 2), "Visas när eleven svarar rätt – förklara gärna varför."),
      mistakesEditor(p)
    );
  }

  function mistakesEditor(p) {
    const fs = el("fieldset", "le-fieldset");
    fs.appendChild(el("legend", "", "Vanliga felsvar och tips"));
    fs.appendChild(el("p", "le-hint", "När eleven skriver ett av felsvaren visas ditt tips i stället för ett allmänt meddelande."));
    const list = el("div", "le-mistakes");
    const draw = () => {
      list.replaceChildren();
      p.feedback.forEach((item, i) => {
        if (!Array.isArray(item.answers)) item.answers = [];
        const card = el("div", "le-mistake");
        const wrong = el("textarea"); wrong.rows = 2;
        bind(wrong, () => item.answers.join("\n"), v => { item.answers = lines(v); });
        card.append(
          field("Felsvar (ett per rad)", wrong),
          field("Tips till eleven", areaInput(item, "message", 2)),
          button("Ta bort", "le-btn le-btn-small le-btn-danger", () => {
            p.feedback.splice(i, 1); draw(); changed();
          })
        );
        list.appendChild(card);
      });
    };
    draw();
    fs.appendChild(list);
    fs.appendChild(button("+ Lägg till felsvar", "le-btn le-btn-small", () => {
      p.feedback.push({ answers: [], message: "" });
      draw(); changed();
    }));
    return fs;
  }

  // JSON fallback for structures without a dedicated form.
  function jsonForm(form, get, set, hint) {
    if (hint) form.appendChild(el("p", "le-hint", hint));
    const ta = el("textarea", "le-json"); ta.rows = 14; ta.spellcheck = false;
    ta.value = JSON.stringify(get(), null, 2);
    const msg = el("p", "le-error"); msg.hidden = true;
    ta.addEventListener("input", () => {
      try {
        set(JSON.parse(ta.value));
        msg.hidden = true;
        changed();
      } catch (err) {
        msg.textContent = "Ogiltig JSON (ändringen används inte än): " + err.message;
        msg.hidden = false;
      }
    });
    form.append(ta, msg);
  }

  // ===== PREVIEW =====
  function renderPreview() {
    const host = root.querySelector(".le-preview");
    const R = window.GaussicaRender;
    host.replaceChildren();
    const mk = R ? R.makeElement : el;

    const areaName = (((window.course && window.course.areas) || []).find(a => a.id === lesson.area) || {}).name || lesson.area || "";
    const header = mk("div", "panel-header");
    const meta = mk("div", "panel-metadata");
    meta.append(mk("span", "panel-kicker", String(areaName).toUpperCase()), mk("span", "panel-duration", lesson.duration || ""));
    header.append(meta, mk("span", "lesson-level panel-grade", lesson.level || ""));
    const top = wrapPreview("meta", [header, mk("h3", "panel-title", lesson.title || "Namnlös lektion"), mk("p", "panel-summary", lesson.summary || "")]);
    host.appendChild(top);

    const pre = mk("div", "prerequisite-box");
    pre.appendChild(mk("span", "prerequisite-label", "BYGGER VIDARE PÅ"));
    if (lesson.prerequisites.length) {
      lesson.prerequisites.forEach(id => {
        const l = ((window.course && window.course.lessons) || []).find(x => x.id === id);
        pre.appendChild(mk("span", "prerequisite-tag", l ? l.title : id));
      });
    } else {
      pre.appendChild(mk("span", "prerequisite-tag", "Börja här — inga förkunskaper behövs"));
    }
    top.appendChild(pre);

    blocks.forEach(b => host.appendChild(previewBlock(b, mk, R)));
    markPreviewSelection(false);
  }

  function previewBlock(b, mk, R) {
    const box = wrapPreview(b.id, []);
    switch (b.kind) {
      case "explanation": {
        const s = mk("section", "explanation-section");
        s.append(mk("p", "eyebrow", "FÖRSTÅ IDÉN"), mk("h3", "", lesson.explanationTitle || ""), mk("p", "body-copy", lesson.explanation || ""));
        box.appendChild(s);
        break;
      }
      case "visual":
        safely(box, () => R && R.renderVisualsFor(box, { visual: lesson.visual }));
        break;
      case "rule": {
        const rule = mk("div", "rule-card");
        rule.append(mk("span", "rule-label", lesson.ruleLabel || ""), mk("span", "rule-equation", lesson.rule || ""), mk("span", "rule-example", lesson.example || ""));
        box.appendChild(rule);
        break;
      }
      case "interactive": {
        const m = lesson.interactive;
        const s = mk("section", "experiment");
        s.append(mk("p", "eyebrow", "UTFORSKA"),
          mk("p", "body-copy", m.type === "fraction-model"
            ? "Interaktiv bråkmodell: " + m.numerator + "/" + m.denominator
            : "Interaktiv modell: " + m.type));
        box.appendChild(s);
        break;
      }
      case "exercise":
        box.appendChild(problemPreview(mk, lesson.exercise, "DIN TUR", "exercise"));
        break;
      case "word":
        box.appendChild(problemPreview(mk, b.data, "TEXTUPPGIFT " + wordNumber(b), "exercise word-problem"));
        break;
      case "patterns": {
        const s = mk("section", "explanation-section");
        s.append(mk("p", "eyebrow", "ÖVA MER"), mk("p", "body-copy", (lesson.problemPatterns || []).length + " uppgiftsmönster genererar övningsuppgifter automatiskt."));
        box.appendChild(s);
        break;
      }
      case "component":
        safely(box, () => R && R.renderLessonComponents(box, [b.data]));
        if (b.data.type === "problem") box.appendChild(mockProblemNote(mk, b.data));
        break;
    }
    return box;
  }

  function problemPreview(mk, p, eyebrow, cls) {
    const s = mk("section", cls);
    s.append(mk("p", "eyebrow", eyebrow), mk("h3", "", p.prompt || ""));
    s.appendChild(mockProblemNote(mk, p));
    return s;
  }

  function mockProblemNote(mk, p) {
    const note = mk("p", "le-preview-answer");
    note.textContent = "✔ Rätt svar: " + (p.answer || []).filter(Boolean).join("  /  ") +
      (p.feedback && p.feedback.length ? "   ·   " + p.feedback.length + " felsvar med tips" : "");
    return note;
  }

  function wrapPreview(id, children) {
    const w = el("div", "le-pv");
    w.dataset.key = id;
    w.tabIndex = 0;
    w.setAttribute("role", "button");
    w.setAttribute("aria-label", "Redigera " + describe(id).label);
    children.forEach(c => c && w.appendChild(c));
    w.addEventListener("click", () => {
      if (selected !== id) select(id, { fromPreview: true });
    });
    w.addEventListener("keydown", e => {
      if ((e.key === "Enter" || e.key === " ") && e.target === w) { e.preventDefault(); select(id, { fromPreview: true }); }
    });
    return w;
  }

  function safely(box, fn) {
    try { fn(); } catch (err) {
      box.appendChild(el("p", "le-error", "Förhandsvisningen misslyckades: " + err.message));
    }
  }

  function markPreviewSelection(scroll) {
    root.querySelectorAll(".le-pv").forEach(n => n.classList.toggle("is-selected", n.dataset.key === selected));
    if (scroll) scrollPreviewTo(selected);
  }

  function scrollPreviewTo(id) {
    const target = root.querySelector('.le-pv[data-key="' + String(id).replace(/"/g, "") + '"]');
    if (target) target.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // ===== TOAST =====
  function toast(message, undo) {
    const t = root.querySelector(".le-toast");
    t.replaceChildren(el("span", "", message));
    if (undo) {
      t.appendChild(button("Ångra", "le-toast-undo", () => { t.hidden = true; undo(); }));
    }
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, undo ? 7000 : 2500);
  }

  // ===== VALIDATION + SAVING =====
  function validate() {
    const problems = [];
    const add = (key, msg) => problems.push({ key, msg });
    if (!lesson.title || !lesson.title.trim()) add("meta", "Lektionen behöver en titel.");
    if (!/^[a-z0-9åäö_-]+$/i.test(lesson.id || "")) add("meta", "Lektions-ID får bara innehålla bokstäver, siffror och bindestreck.");
    else if (isNew && ((window.course && window.course.lessons) || []).some(l => l.id === lesson.id)) {
      add("meta", "ID:t \"" + lesson.id + "\" används redan av en annan lektion.");
    }
    if (!lesson.area) add("meta", "Välj ett område.");
    const checkProblem = (p, key, name) => {
      if (!p.prompt || !p.prompt.trim()) add(key, name + ": frågan saknas.");
      if (!p.answer.length || !p.answer.some(a => String(a).trim())) add(key, name + ": minst ett rätt svar krävs.");
    };
    blocks.forEach(b => {
      if (b.kind === "exercise") checkProblem(lesson.exercise, b.id, "Övningen");
      else if (b.kind === "word") checkProblem(b.data, b.id, "Textuppgift " + wordNumber(b));
      else if (b.kind === "component" && b.data.type === "problem") checkProblem(b.data, b.id, "Uppgiften");
    });
    return problems;
  }

  // The lesson as it will be stored: content fields rebuilt from the block order.
  function serialize() {
    const out = JSON.parse(JSON.stringify(lesson));
    out.title = out.title.trim();
    out.prerequisites = out.prerequisites.filter(Boolean);

    const clean = p => {
      p.answer = p.answer.map(a => String(a).trim()).filter(Boolean);
      p.feedback = p.feedback.filter(f => f.answers && f.answers.length && f.message);
    };
    const comps = [], words = [], layout = [];
    blocks.forEach(b => {
      if (b.kind === "component") {
        const copy = JSON.parse(JSON.stringify(b.data));
        if (copy.type === "problem") clean(copy);
        layout.push("comp:" + comps.length);
        comps.push(copy);
      } else if (b.kind === "word") {
        const copy = JSON.parse(JSON.stringify(b.data));
        clean(copy);
        layout.push("word:" + words.length);
        words.push(copy);
      } else {
        layout.push(b.kind);
      }
    });
    clean(out.exercise);

    // Singletons that were removed from the lesson should not linger in the data.
    const has = k => layout.includes(k);
    if (!has("explanation")) { delete out.explanation; delete out.explanationTitle; }
    if (!has("rule")) { delete out.rule; delete out.ruleLabel; delete out.example; }
    if (!has("visual")) delete out.visual;
    if (!has("interactive")) delete out.interactive;
    if (!has("patterns")) delete out.problemPatterns;

    if (comps.length) out.components = comps; else delete out.components;
    out.wordProblems = words;
    out.layout = layout;
    return out;
  }

  async function save() {
    if (saving) return;
    const problems = validate();
    if (problems.length) {
      select(problems[0].key);
      toast(problems[0].msg + (problems.length > 1 ? " (+" + (problems.length - 1) + " till)" : ""));
      return;
    }
    const out = serialize();

    // Lessons are stored on the server so every student gets the new version.
    saving = true;
    const saveBtn = root.querySelector(".le-btn-primary");
    saveBtn.disabled = true;
    try {
      await window.GaussicaAPI.put("/api/lessons/" + encodeURIComponent(out.id), { lesson: out });
    } catch (err) {
      saving = false;
      if (root) { saveBtn.disabled = false; toast("Kunde inte spara: " + err.message); }
      return;
    }
    saving = false;
    if (!root) return;   // editor was closed while saving
    saveBtn.disabled = false;

    const lessons = window.course.lessons;
    const at = lessons.findIndex(l => l.id === out.id);
    if (at >= 0) lessons[at] = out; else lessons.push(out);

    try {
      if (window.refreshCourseView) window.refreshCourseView(out.id);
    } catch (err) {
      console.error(err);
      alert("Lektionen sparades men sidan kunde inte ritas om: " + err.message);
    }

    // Reload the working copy from what was stored (indices in the layout are now canonical).
    const selectedIndex = indexOfBlock(selected);
    lesson = normalize(JSON.parse(JSON.stringify(out)));
    blocks = makeBlocks(lesson);
    selected = selected === "meta" || selectedIndex < 0 ? "meta" : blocks[Math.min(selectedIndex, blocks.length - 1)].id;
    isNew = false;
    dirty = false;
    renderAll();
    toast("Sparat – eleverna ser den nya versionen.");
  }

  function downloadJSON() {
    const problems = validate();
    if (problems.length) { select(problems[0].key); toast(problems[0].msg); return; }
    const out = serialize();
    const blob = new Blob([JSON.stringify(out, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = out.id + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(isNew || !dirty
      ? "Nedladdad som " + out.id + ".json. Lägg filen i lessons/ och nämn den i lessons/index.json."
      : "Nedladdad. Glöm inte att även spara.");
  }

  function closeEditor(force) {
    if (!root) return;
    if (!force && dirty && !confirm("Du har osparade ändringar. Stäng utan att spara?")) return;
    clearTimeout(toastTimer);
    root.remove();
    root = null;
    document.body.classList.remove("le-open");
    lesson = null;
    blocks = [];
  }

}());
