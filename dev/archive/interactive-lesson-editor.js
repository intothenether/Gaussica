// Interactive Visual Lesson Editor - FIXED VERSION
// Proper event handling and component rendering

window.InteractiveEditor = (function() {
  "use strict";

  let currentLesson = null;
  let selectedComponentIdx = null;
  let editorState = {
    isDirty: false,
    activeTab: "content"
  };

  const COMPONENT_TYPES = {
    text: { label: "Tekst", icon: "📝" },
    heading: { label: "Rubrik", icon: "📌" },
    rule: { label: "Regel/Formel", icon: "📐" },
    diagram: { label: "Diagram", icon: "📊" },
    slider: { label: "Interaktiv skjutreglage", icon: "🎚️" },
    functionGraph: { label: "Funktionsgraf", icon: "📈" },
    problem: { label: "Uppgift", icon: "❓" },
    problemPattern: { label: "Uppgiftsmönster", icon: "🔄" }
  };

  // ===== PUBLIC API =====
  return {
    open: function(lesson) {
      currentLesson = JSON.parse(JSON.stringify(lesson));
      if (!currentLesson.components) currentLesson.components = [];
      selectedComponentIdx = null;
      editorState = { isDirty: false, activeTab: "content" };
      renderEditorUI();
    }
  };

  // ===== MAIN RENDERING =====
  function renderEditorUI() {
    // Remove any existing editor
    document.querySelectorAll(".editor-overlay").forEach(e => e.remove());

    const overlay = document.createElement("div");
    overlay.className = "editor-overlay";

    const editor = document.createElement("div");
    editor.id = "interactive-editor";

    // Header
    const header = document.createElement("div");
    header.className = "editor-header";
    const title = document.createElement("h2");
    title.textContent = escape(currentLesson.title || "Ny lektion");
    
    const actions = document.createElement("div");
    actions.className = "editor-actions";
    
    const saveBtn = document.createElement("button");
    saveBtn.className = "btn-primary";
    saveBtn.textContent = "💾 Spara";
    saveBtn.addEventListener("click", saveLessonFromEditor);
    
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn-secondary";
    cancelBtn.textContent = "✕ Avbryt";
    cancelBtn.addEventListener("click", closeEditor);

    actions.append(saveBtn, cancelBtn);
    header.append(title, actions);

    // Main content
    const main = document.createElement("div");
    main.className = "editor-main";

    const sidebar = document.createElement("div");
    sidebar.className = "editor-sidebar";
    renderSidebar(sidebar);

    const center = document.createElement("div");
    center.className = "editor-center";
    renderCanvas(center);

    const preview = document.createElement("div");
    preview.className = "editor-preview";
    renderPreview(preview);

    main.append(sidebar, center, preview);
    editor.append(header, main);

    // Setup overlay click handler
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeEditor();
    });

    overlay.appendChild(editor);
    document.body.appendChild(overlay);
  }

  function renderSidebar(container) {
    const tabs = document.createElement("div");
    tabs.className = "editor-tabs";

    const contentTab = document.createElement("button");
    contentTab.className = "editor-tab" + (editorState.activeTab === "content" ? " active" : "");
    contentTab.textContent = "📄 Innehål";
    contentTab.addEventListener("click", () => {
      editorState.activeTab = "content";
      renderSidebar(container);
    });

    const settingsTab = document.createElement("button");
    settingsTab.className = "editor-tab" + (editorState.activeTab === "settings" ? " active" : "");
    settingsTab.textContent = "⚙️ Inställningar";
    settingsTab.addEventListener("click", () => {
      editorState.activeTab = "settings";
      renderSidebar(container);
    });

    tabs.append(contentTab, settingsTab);

    const content = document.createElement("div");

    if (editorState.activeTab === "content") {
      // Component library
      const lib = document.createElement("div");
      lib.className = "component-library";

      Object.entries(COMPONENT_TYPES).forEach(([type, info]) => {
        const item = document.createElement("div");
        item.className = "component-library-item";
        item.draggable = true;
        item.innerHTML = `<span class="component-icon">${info.icon}</span><span class="component-label">${info.label}</span>`;

        item.addEventListener("dragstart", (e) => {
          e.dataTransfer.effectAllowed = "copy";
          e.dataTransfer.setData("componentType", type);
        });

        item.addEventListener("click", () => {
          addComponent(type);
        });

        lib.appendChild(item);
      });

      content.appendChild(lib);
    } else {
      // Settings panel
      const props = document.createElement("div");
      props.className = "component-properties";

      if (selectedComponentIdx !== null && currentLesson.components[selectedComponentIdx]) {
        const comp = currentLesson.components[selectedComponentIdx];
        renderComponentProperties(props, selectedComponentIdx, comp);
      } else {
        props.innerHTML = '<p style="color: var(--muted); font-size: 12px; padding: 12px;">Välj en komponent för att redigera</p>';
      }

      content.appendChild(props);
    }

    container.innerHTML = "";
    container.appendChild(tabs);
    container.appendChild(content);
  }

  function renderCanvas(container) {
    // *** CRITICAL: Clear container before rebuilding ***
    container.innerHTML = "";

    // Metadata section
    const metaSection = document.createElement("div");
    metaSection.className = "editor-section";
    metaSection.innerHTML = '<h3>Lektion metadata</h3>';

    const metaForm = document.createElement("div");
    metaForm.className = "meta-form";

    const titleField = createFormField("Titel", currentLesson.title || "");
    titleField.input.addEventListener("change", (e) => {
      currentLesson.title = e.target.value;
      editorState.isDirty = true;
      updateAllPanes();
    });

    const areaField = createFormField("Område", currentLesson.area || "");
    areaField.input.addEventListener("change", (e) => {
      currentLesson.area = e.target.value;
      editorState.isDirty = true;
      updateAllPanes();
    });

    const summaryField = createFormField("Sammanfattning", currentLesson.summary || "", true);
    summaryField.input.addEventListener("change", (e) => {
      currentLesson.summary = e.target.value;
      editorState.isDirty = true;
      updateAllPanes();
    });

    metaForm.append(titleField.div, areaField.div, summaryField.div);
    metaSection.appendChild(metaForm);
    container.appendChild(metaSection);

    // Components section
    const compSection = document.createElement("div");
    compSection.className = "editor-section";
    compSection.innerHTML = '<h3>Komponenter</h3>';

    const canvas = document.createElement("div");
    canvas.className = "component-canvas";

    // Setup drag-and-drop
    canvas.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      canvas.classList.add("dragover");
    });

    canvas.addEventListener("dragleave", () => {
      canvas.classList.remove("dragover");
    });

    canvas.addEventListener("drop", (e) => {
      e.preventDefault();
      canvas.classList.remove("dragover");
      const type = e.dataTransfer.getData("componentType");
      if (type) addComponent(type);
    });

    if (currentLesson.components.length === 0) {
      canvas.innerHTML = '<div class="canvas-empty">Dra komponenter här eller klicka på dem i biblioteket</div>';
    } else {
      currentLesson.components.forEach((comp, idx) => {
        canvas.appendChild(renderComponentCard(comp, idx));
      });
    }

    compSection.appendChild(canvas);
    container.appendChild(compSection);
  }

  function renderComponentCard(comp, idx) {
    const card = document.createElement("div");
    card.className = "component-card" + (selectedComponentIdx === idx ? " selected" : "");

    const header = document.createElement("div");
    header.className = "component-card-header";

    const info = COMPONENT_TYPES[comp.type] || { icon: "❓", label: comp.type };

    const titleDiv = document.createElement("div");
    titleDiv.innerHTML = `<span class="component-icon">${info.icon}</span><span class="component-type-label">${info.label}</span>`;

    const actions = document.createElement("div");
    actions.className = "component-card-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "component-btn-edit";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      selectComponent(idx);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "component-btn-delete";
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeComponent(idx);
    });

    actions.append(editBtn, deleteBtn);
    header.append(titleDiv, actions);

    const preview = document.createElement("div");
    preview.className = "component-preview";
    preview.textContent = getComponentPreviewText(comp);

    card.append(header, preview);

    // Select on click
    card.addEventListener("click", () => {
      selectComponent(idx);
    });

    return card;
  }

  function renderPreview(container) {
    const h3 = document.createElement("h3");
    h3.textContent = "Förhandsvisning";

    const content = document.createElement("div");
    content.className = "preview-content";

    // Metadata
    const meta = document.createElement("div");
    meta.className = "preview-metadata";
    meta.innerHTML = `
      <h2>${escape(currentLesson.title || "Namnlös")}</h2>
      <div class="preview-meta">Område: <strong>${escape(currentLesson.area || "okänt")}</strong></div>
      <p class="preview-summary">${escape(currentLesson.summary || "Ingen sammanfattning")}</p>
    `;
    content.appendChild(meta);

    // Components
    currentLesson.components.forEach((comp) => {
      content.appendChild(renderComponentPreview(comp));
    });

    container.innerHTML = "";
    container.appendChild(h3);
    container.appendChild(content);
  }

  function renderComponentPreview(comp) {
    const div = document.createElement("div");
    div.className = "preview-component";

    switch (comp.type) {
      case "text":
        div.innerHTML = `<p>${escape(comp.text || "")}</p>`;
        break;

      case "heading":
        const level = comp.level || 1;
        div.innerHTML = `<h${level + 1}>${escape(comp.text || "")}</h${level + 1}>`;
        break;

      case "rule":
        div.innerHTML = `
          <div class="rule-card">
            <div class="rule-label">${escape(comp.label || "REGEL")}</div>
            <div class="rule-equation">${escape(comp.formula || "")}</div>
            <div class="rule-example">${escape(comp.example || "")}</div>
          </div>
        `;
        break;

      case "diagram":
        const data = comp.data || [];
        let dataPreview = "";
        if (Array.isArray(data) && data.length > 0) {
          dataPreview = data.map(d => `<div style="font-size: 11px; padding: 2px 0;">${escape(d.label || "")}: ${d.value || 0}</div>`).join("");
        } else {
          dataPreview = '<div style="font-size: 11px; color: var(--muted);">Ingen data</div>';
        }
        
        div.innerHTML = `
          <div class="rule-card">
            <div class="rule-label">📊 ${escape(comp.diagramType || "stapeldiagram")}</div>
            <div style="font-size: 12px; font-weight: 500; margin: 4px 0;">${escape(comp.title || "Diagram")}</div>
            <div style="font-size: 11px; color: var(--muted); margin-bottom: 6px;">${escape(comp.subtitle || "")}</div>
            <div>${dataPreview}</div>
            ${comp.unit ? `<div style="font-size: 10px; color: var(--muted); margin-top: 4px;">Enhet: ${escape(comp.unit)}</div>` : ""}
          </div>
        `;
        break;

      case "slider":
        div.innerHTML = `
          <div class="rule-card">
            <div class="rule-label">Skjutreglage</div>
            <div style="font-size: 12px; color: var(--muted);">Min: ${comp.min}, Max: ${comp.max}</div>
          </div>
        `;
        break;

      case "problem":
        div.className = "preview-component problem-card";
        div.innerHTML = `<p class="problem-prompt">❓ ${escape(comp.prompt || "")}</p>`;
        break;

      case "problemPattern":
        div.innerHTML = `
          <div class="rule-card">
            <div class="rule-label">Uppgiftsmönster</div>
            <div style="font-size: 12px; color: var(--muted);">${escape(comp.type || "")}</div>
          </div>
        `;
        break;

      case "functionGraph":
        div.innerHTML = `
          <div class="rule-card">
            <div class="rule-label">Funktionsgraf</div>
            <div style="font-size: 12px; color: var(--muted);">📈 Interaktiv graf</div>
          </div>
        `;
        break;

      default:
        div.innerHTML = `<div style="color: var(--muted);">${escape(comp.type)}</div>`;
    }

    return div;
  }

  function renderComponentProperties(container, idx, comp) {
    const form = document.createElement("div");

    // Type label
    const typeDiv = document.createElement("div");
    typeDiv.className = "property-field";
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Komponenttyp";
    const typeSpan = document.createElement("span");
    typeSpan.style.fontSize = "11px";
    typeSpan.style.color = "var(--muted)";
    typeSpan.textContent = COMPONENT_TYPES[comp.type]?.label || comp.type;
    typeDiv.append(typeLabel, typeSpan);
    form.appendChild(typeDiv);

    // Type-specific fields
    if (comp.type === "text" || comp.type === "heading") {
      const field = createPropertyField("text", "Innehål", "textarea", comp.text || "");
      field.input.addEventListener("change", (e) => {
        currentLesson.components[idx].text = e.target.value;
        editorState.isDirty = true;
        updateAllPanes();
      });
      form.appendChild(field.div);

      if (comp.type === "heading") {
        const levelField = createPropertyField("level", "Nivå (1-3)", "number", comp.level || 1);
        levelField.input.addEventListener("change", (e) => {
          currentLesson.components[idx].level = parseInt(e.target.value) || 1;
          editorState.isDirty = true;
          updateAllPanes();
        });
        form.appendChild(levelField.div);
      }
    } else if (comp.type === "rule") {
      const labelField = createPropertyField("label", "Regelnamn", "text", comp.label || "");
      labelField.input.addEventListener("change", (e) => {
        currentLesson.components[idx].label = e.target.value;
        editorState.isDirty = true;
        updateAllPanes();
      });
      form.appendChild(labelField.div);

      const formulaField = createPropertyField("formula", "Formel", "text", comp.formula || "");
      formulaField.input.addEventListener("change", (e) => {
        currentLesson.components[idx].formula = e.target.value;
        editorState.isDirty = true;
        updateAllPanes();
      });
      form.appendChild(formulaField.div);

      const exampleField = createPropertyField("example", "Exempel", "text", comp.example || "");
      exampleField.input.addEventListener("change", (e) => {
        currentLesson.components[idx].example = e.target.value;
        editorState.isDirty = true;
        updateAllPanes();
      });
      form.appendChild(exampleField.div);
    } else if (comp.type === "diagram") {
      const titleField = createPropertyField("title", "Titel", "text", comp.title || "");
      titleField.input.addEventListener("change", (e) => {
        currentLesson.components[idx].title = e.target.value;
        editorState.isDirty = true;
        updateAllPanes();
      });
      form.appendChild(titleField.div);

      const subtitleField = createPropertyField("subtitle", "Underrubrik", "text", comp.subtitle || "");
      subtitleField.input.addEventListener("change", (e) => {
        currentLesson.components[idx].subtitle = e.target.value;
        editorState.isDirty = true;
        updateAllPanes();
      });
      form.appendChild(subtitleField.div);

      const typeField = createPropertyField("diagramType", "Diagramtyp (stapeldiagram/cirkeldiagram/tabell)", "text", comp.diagramType || "stapeldiagram");
      typeField.input.addEventListener("change", (e) => {
        currentLesson.components[idx].diagramType = e.target.value;
        editorState.isDirty = true;
        updateAllPanes();
      });
      form.appendChild(typeField.div);

      const unitField = createPropertyField("unit", "Enhet (ex: röster)", "text", comp.unit || "");
      unitField.input.addEventListener("change", (e) => {
        currentLesson.components[idx].unit = e.target.value;
        editorState.isDirty = true;
        updateAllPanes();
      });
      form.appendChild(unitField.div);

      // Data array editor
      const dataLabel = document.createElement("label");
      dataLabel.style.cssText = "display: block; margin-top: 12px; font-weight: 500; font-size: 12px; color: var(--muted);";
      dataLabel.textContent = "Data (JSON format)";
      form.appendChild(dataLabel);

      const dataInput = document.createElement("textarea");
      dataInput.style.cssText = "width: 100%; min-height: 120px; font-size: 11px; font-family: monospace; border: 1px solid #ddd; padding: 8px;";
      dataInput.value = JSON.stringify(comp.data || [], null, 2);
      dataInput.addEventListener("change", (e) => {
        try {
          const parsed = JSON.parse(e.target.value);
          // Normalize data format
          let normalized = Array.isArray(parsed) ? parsed : [];
          normalized = normalized.map(item => {
            // Handle different input formats
            if (typeof item === "object" && item !== null) {
              // If has "label" and "value", keep as is
              if (item.hasOwnProperty("label") && item.hasOwnProperty("value")) {
                return item;
              }
              // If has "a" or first key, treat as value
              const keys = Object.keys(item);
              if (keys.length > 0) {
                return {
                  label: keys[0] === "a" ? "Värde" : keys[0],
                  value: item[keys[0]]
                };
              }
            }
            return item;
          });
          currentLesson.components[idx].data = normalized;
          editorState.isDirty = true;
          updateAllPanes();
        } catch (err) {
          alert("❌ JSON-fel: " + err.message + "\n\nRätt format:\n[{\"label\":\"Name\",\"value\":10}]");
        }
      });
      form.appendChild(dataInput);

      const dataHint = document.createElement("p");
      dataHint.style.cssText = "font-size: 11px; color: var(--muted); margin: 8px 0; line-height: 1.4;";
      dataHint.innerHTML = `
        <strong>Format:</strong> [{\"label\":\"Namn\",\"value\":123}, ...]<br>
        <strong>Exempel:</strong> [{\"label\":\"Äpple\",\"value\":10}, {\"label\":\"Päron\",\"value\":8}]
      `;
      form.appendChild(dataHint);
    } else if (comp.type === "slider") {
      const minField = createPropertyField("min", "Min värde", "number", comp.min || 0);
      minField.input.addEventListener("change", (e) => {
        currentLesson.components[idx].min = parseFloat(e.target.value) || 0;
        editorState.isDirty = true;
        updateAllPanes();
      });
      form.appendChild(minField.div);

      const maxField = createPropertyField("max", "Max värde", "number", comp.max || 100);
      maxField.input.addEventListener("change", (e) => {
        currentLesson.components[idx].max = parseFloat(e.target.value) || 100;
        editorState.isDirty = true;
        updateAllPanes();
      });
      form.appendChild(maxField.div);

      const stepField = createPropertyField("step", "Steg", "number", comp.step || 1);
      stepField.input.addEventListener("change", (e) => {
        currentLesson.components[idx].step = parseFloat(e.target.value) || 1;
        editorState.isDirty = true;
        updateAllPanes();
      });
      form.appendChild(stepField.div);
    } else if (comp.type === "problem") {
      const promptField = createPropertyField("prompt", "Fråga", "textarea", comp.prompt || "");
      promptField.input.addEventListener("change", (e) => {
        currentLesson.components[idx].prompt = e.target.value;
        editorState.isDirty = true;
        updateAllPanes();
      });
      form.appendChild(promptField.div);
    }

    container.appendChild(form);
  }

  function createFormField(label, value = "", isTextarea = false) {
    const div = document.createElement("div");
    div.className = "form-field";

    const labelEl = document.createElement("label");
    labelEl.textContent = label;

    let input;
    if (isTextarea) {
      input = document.createElement("textarea");
      input.value = value;
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.value = value;
    }

    div.append(labelEl, input);
    return { div, input };
  }

  function createPropertyField(name, label, type, value) {
    const div = document.createElement("div");
    div.className = "property-field";

    const labelEl = document.createElement("label");
    labelEl.textContent = label;

    let input;
    if (type === "textarea") {
      input = document.createElement("textarea");
      input.value = value || "";
    } else {
      input = document.createElement("input");
      input.type = type;
      input.value = value || "";
    }

    div.append(labelEl, input);
    return { div, input };
  }

  function getComponentPreviewText(comp) {
    if (comp.text) return comp.text.substring(0, 40);
    if (comp.formula) return comp.formula;
    if (comp.prompt) return comp.prompt.substring(0, 40);
    if (comp.title) return comp.title;
    return "[" + (COMPONENT_TYPES[comp.type]?.label || comp.type) + "]";
  }

  function addComponent(type) {
    const comp = {
      type: type,
      id: type + "-" + Date.now()
    };

    if (type === "text" || type === "heading") {
      comp.text = "Ny text";
      if (type === "heading") comp.level = 1;
    } else if (type === "rule") {
      comp.label = "REGEL";
      comp.formula = "a + b = c";
      comp.example = "Exempel";
    } else if (type === "diagram") {
      comp.diagramType = "stapeldiagram";
      comp.title = "Diagram";
      comp.subtitle = "";
      comp.unit = "";
      comp.data = [
        { "label": "Exempel 1", "value": 10 },
        { "label": "Exempel 2", "value": 20 }
      ];
    } else if (type === "slider") {
      comp.min = 0;
      comp.max = 100;
      comp.step = 1;
    } else if (type === "problem") {
      comp.prompt = "Din fråga här";
    } else if (type === "problemPattern") {
      comp.patternType = "arithmetic";
    }

    currentLesson.components.push(comp);
    editorState.isDirty = true;
    selectedComponentIdx = currentLesson.components.length - 1;
    updateAllPanes();
  }

  function selectComponent(idx) {
    selectedComponentIdx = idx;
    editorState.activeTab = "settings";
    updateAllPanes();
  }

  function removeComponent(idx) {
    if (confirm("Ta bort denna komponent?")) {
      currentLesson.components.splice(idx, 1);
      editorState.isDirty = true;
      selectedComponentIdx = null;
      updateAllPanes();
    }
  }

  function updateAllPanes() {
    const overlay = document.querySelector(".editor-overlay");
    if (!overlay) return;

    const editor = overlay.querySelector("#interactive-editor");
    if (!editor) return;

    const sidebar = editor.querySelector(".editor-sidebar");
    const center = editor.querySelector(".editor-center");
    const preview = editor.querySelector(".editor-preview");

    if (sidebar) renderSidebar(sidebar);
    if (center) renderCanvas(center);
    if (preview) renderPreview(preview);

    // Update header title
    const header = editor.querySelector(".editor-header h2");
    if (header) header.textContent = escape(currentLesson.title || "Ny lektion");
  }

  function saveLessonFromEditor() {
    if (!window.course) {
      alert("❌ Fel: Kursdata inte tillgänglig");
      return;
    }

    const idx = window.course.lessons.findIndex(l => l.id === currentLesson.id);
    if (idx >= 0) {
      Object.assign(window.course.lessons[idx], currentLesson);
    } else {
      window.course.lessons.push(currentLesson);
    }

    const backup = {
      areas: window.course.areas,
      areaNotes: window.course.areaNotes,
      lessons: window.course.lessons
    };
    localStorage.setItem("mattesteg-lessons-backup", JSON.stringify(backup));

    alert("✅ Lektion sparad!");
    editorState.isDirty = false;
    closeEditor();

    setTimeout(() => {
      location.reload();
    }, 500);
  }

  function closeEditor() {
    if (editorState.isDirty && !confirm("❗ Du har ändringar som inte är sparade. Vill du stänga ändå?")) {
      return;
    }

    const overlay = document.querySelector(".editor-overlay");
    if (overlay) overlay.remove();
  }

  function escape(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

})();
