// Charts, tables, and the figures of a lesson as blocks (the visuals of a lesson, see lesson-model.js), and the interactive fraction model.
// Cut out of app.js; it gets the page state and the progress functions from app.js through init().

window.GaussicaVisuals = (function () {
  "use strict";

  const makeElement = window.GaussicaDom.makeElement;
  // what app.js gives to init: the page state and the functions that keep the progress
  let dirtyLessons, scheduleSave, getLessonProgress, updateNodeProgress, getActiveLessonId;

  function init(d) {
    dirtyLessons = d.dirtyLessons;
    scheduleSave = d.scheduleSave;
    getLessonProgress = d.getLessonProgress;
    updateNodeProgress = d.updateNodeProgress;
    getActiveLessonId = d.getActiveLessonId;
  }

  function renderInteractiveModel(parent, config) {
    if (config.type !== "fraction-model") return;
    const model = makeElement("section", "experiment");
    model.setAttribute("aria-labelledby", "experiment-title");
    const heading = makeElement("div", "experiment-heading");
    const headingCopy = makeElement("div");
    headingCopy.append(
      makeElement("h3", "", "Prova själv"),
      makeElement("p", "body-copy", "Ändra täljaren och se hur stor del av helheten du har.")
    );
    heading.append(makeElement("span", "experiment-icon", "↔"), headingCopy);
    headingCopy.id = "experiment-title";

    const controls = makeElement("div", "fraction-controls");
    const numeratorLabel = makeElement("label", "", "Antal delar");
    const numerator = document.createElement("input");
    numerator.type = "range";
    numerator.min = "0";
    numerator.max = "8";
    numerator.value = String(config.numerator || 0);
    numerator.setAttribute("aria-label", "Antal delar, täljare");
    const denominatorLabel = makeElement("label", "", "Delar i helheten");
    const denominator = document.createElement("input");
    denominator.type = "range";
    denominator.min = "2";
    denominator.max = "8";
    denominator.value = String(config.denominator || 4);
    denominator.setAttribute("aria-label", "Delar i helheten, nämnare");
    const fractionValue = makeElement("output", "fraction-value");
    fractionValue.setAttribute("aria-live", "polite");
    const tiles = makeElement("div", "fraction-tiles");
    tiles.setAttribute("role", "img");
    const tileDescription = makeElement("p", "tile-caption");
    tileDescription.setAttribute("aria-live", "polite");
    const saved = getLessonProgress(getActiveLessonId()).interactive;
    let hasInteracted = false;
    numerator.value = String(saved.numerator === undefined ? config.numerator || 0 : saved.numerator);
    denominator.value = String(saved.denominator === undefined ? config.denominator || 4 : saved.denominator);

    function updateModel() {
      let parts = Number(numerator.value);
      const whole = Number(denominator.value);
      if (parts > whole) {
        parts = whole;
        numerator.value = String(whole);
      }
      fractionValue.textContent = parts + "/" + whole;
      tiles.replaceChildren();
      tiles.style.setProperty("--parts", String(whole));
      for (let index = 0; index < whole; index += 1) {
        tiles.appendChild(makeElement("span", index < parts ? "fraction-tile filled" : "fraction-tile"));
      }
      tiles.setAttribute("aria-label", parts + " av " + whole + " lika stora delar markerade");
      tileDescription.textContent = parts + " av " + whole + " lika stora delar är markerade.";
      if (hasInteracted && model.isConnected) {
        const progress = getLessonProgress(getActiveLessonId());
        progress.started = true;
        progress.interactive = { numerator: parts, denominator: whole };
        dirtyLessons.add(getActiveLessonId());
        scheduleSave(800);
        updateNodeProgress(getActiveLessonId());
      }
    }

    numeratorLabel.appendChild(numerator);
    denominatorLabel.appendChild(denominator);
    controls.append(numeratorLabel, denominatorLabel, fractionValue);
    numerator.addEventListener("input", function () {
      hasInteracted = true;
      updateModel();
    });
    denominator.addEventListener("input", function () {
      hasInteracted = true;
      updateModel();
    });
    model.append(heading, controls, tiles, tileDescription);
    parent.appendChild(model);
    updateModel();
  }

  const CHART_PALETTE = [
    "#425b9a", // Djupblå
    "#ff8ca0", // Korall
    "#4fa8dc", // Himmelsblå
    "#f0b04a", // Solgul
    "#8a74c9", // Violett
    "#47b79a", // Mynta
    "#f29a6b", // Persika
    "#7a8db8"  // Dimblå
  ];

  function makeSvg(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) {
      for (const key in attrs) {
        if (attrs[key] !== undefined && attrs[key] !== null) {
          el.setAttribute(key, String(attrs[key]));
        }
      }
    }
    return el;
  }

  function normalizeChartData(config) {
    if (Array.isArray(config.data)) {
      return config.data.map(function (item, index) {
        return {
          label: String(item.label || item.name || item.category || ""),
          value: Number(item.value !== undefined ? item.value : (item.y !== undefined ? item.y : 0)),
          color: item.color || CHART_PALETTE[index % CHART_PALETTE.length]
        };
      });
    }
    if (Array.isArray(config.labels) && Array.isArray(config.values)) {
      return config.labels.map(function (label, index) {
        return {
          label: String(label),
          value: Number(config.values[index] || 0),
          color: (config.colors && config.colors[index]) || CHART_PALETTE[index % CHART_PALETTE.length]
        };
      });
    }
    return [];
  }

  function calculateNiceScale(maxVal) {
    if (maxVal <= 0) return { max: 5, step: 1 };
    if (maxVal <= 5) return { max: 5, step: 1 };
    if (maxVal <= 10) return { max: 10, step: 2 };
    if (maxVal <= 16) return { max: 16, step: 4 };
    if (maxVal <= 20) return { max: 20, step: 5 };
    if (maxVal <= 30) return { max: 30, step: 5 };
    if (maxVal <= 50) return { max: 50, step: 10 };
    if (maxVal <= 100) return { max: 100, step: 20 };
    const rough = maxVal / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    let step = mag;
    if (norm > 5) step = 10 * mag;
    else if (norm > 2) step = 5 * mag;
    else if (norm > 1) step = 2 * mag;
    const max = Math.ceil(maxVal / step) * step;
    return { max: max, step: step };
  }

  function renderBarChart(config) {
    const data = normalizeChartData(config);
    const container = makeElement("div", "chart-wrapper bar-chart-wrapper");
    if (!data.length) return container;

    const unit = config.unit || "";
    const width = 500;
    const height = 230;
    const left = config.yAxis && config.yAxis.label ? 50 : 42;
    const right = 20;
    const top = 28;
    const bottom = config.xAxis && config.xAxis.label ? 46 : 38;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const values = data.map(function (d) { return d.value; });
    const maxVal = Math.max.apply(null, values.concat([1]));
    const scale = calculateNiceScale(config.yAxis && config.yAxis.max ? config.yAxis.max : maxVal);
    const maxY = config.yAxis && config.yAxis.max ? config.yAxis.max : scale.max;
    const step = config.yAxis && config.yAxis.step ? config.yAxis.step : scale.step;

    const svg = makeSvg("svg", {
      viewBox: "0 0 " + width + " " + height,
      class: "chart-svg",
      role: "img",
      "aria-label": config.ariaLabel || (config.title || "Stapeldiagram") + ": " +
        data.map(function (d) { return d.label + " " + d.value + (unit ? " " + unit : ""); }).join(", ")
    });

    if (config.yAxis && config.yAxis.label) {
      const yAxisTitle = makeSvg("text", {
        x: left,
        y: top - 12,
        class: "chart-axis-title",
        "text-anchor": "start"
      });
      yAxisTitle.textContent = config.yAxis.label.toUpperCase();
      svg.appendChild(yAxisTitle);
    }

    const numTicks = Math.round(maxY / step);
    for (let i = 0; i <= numTicks; i += 1) {
      const val = i * step;
      if (val > maxY + 0.0001) break;
      const y = top + plotHeight - (val / maxY) * plotHeight;
      const line = makeSvg("line", {
        x1: left,
        y1: y,
        x2: left + plotWidth,
        y2: y,
        class: i === 0 ? "chart-axis-line" : "chart-grid-line"
      });
      svg.appendChild(line);

      const tick = makeSvg("text", {
        x: left - 8,
        y: y + 4,
        class: "chart-tick-label",
        "text-anchor": "end"
      });
      tick.textContent = String(Math.round(val * 100) / 100);
      svg.appendChild(tick);
    }

    const slotWidth = plotWidth / data.length;
    const barWidth = Math.min(50, Math.max(16, slotWidth * 0.65));

    data.forEach(function (d, i) {
      const barHeight = Math.max(0, (d.value / maxY) * plotHeight);
      const x = left + i * slotWidth + (slotWidth - barWidth) / 2;
      const y = top + plotHeight - barHeight;

      const g = makeSvg("g", { class: "chart-bar-group" });
      const rect = makeSvg("rect", {
        x: x,
        y: y,
        width: barWidth,
        height: barHeight,
        rx: 4,
        ry: 4,
        fill: d.color,
        class: "chart-bar"
      });
      const titleEl = makeSvg("title");
      titleEl.textContent = d.label + ": " + d.value + (unit ? " " + unit : "");
      rect.appendChild(titleEl);

      const valText = makeSvg("text", {
        x: x + barWidth / 2,
        y: y - 6,
        class: "chart-value-label",
        "text-anchor": "middle"
      });
      valText.textContent = String(d.value);

      const catText = makeSvg("text", {
        x: x + barWidth / 2,
        y: top + plotHeight + 17,
        class: "chart-category-label",
        "text-anchor": "middle"
      });
      catText.textContent = d.label;

      g.append(rect, valText, catText);
      svg.appendChild(g);
    });

    if (config.xAxis && config.xAxis.label) {
      const xAxisTitle = makeSvg("text", {
        x: left + plotWidth / 2,
        y: height - 6,
        class: "chart-axis-title",
        "text-anchor": "middle"
      });
      xAxisTitle.textContent = config.xAxis.label.toUpperCase();
      svg.appendChild(xAxisTitle);
    }

    container.appendChild(svg);
    return container;
  }

  function renderPieChart(config) {
    const data = normalizeChartData(config);
    const container = makeElement("div", "chart-wrapper pie-chart-wrapper");
    if (!data.length) return container;

    const unit = config.unit || "";
    const isDonut = config.donut !== false;
    const total = data.reduce(function (sum, d) { return sum + d.value; }, 0);

    const layout = makeElement("div", "pie-layout-row");
    const svgBox = makeElement("div", "pie-svg-box");
    const legend = makeElement("div", "pie-legend");

    const size = 220;
    const cx = size / 2;
    const cy = size / 2;
    const r = 90;
    const rInner = isDonut ? 48 : 0;

    const svg = makeSvg("svg", {
      viewBox: "0 0 " + size + " " + size,
      class: "pie-svg",
      role: "img",
      "aria-label": config.ariaLabel || (config.title || "Cirkeldiagram") + ": " +
        data.map(function (d) {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return d.label + " " + d.value + (unit ? " " + unit : "") + " (" + pct + " %)";
        }).join(", ")
    });

    let currentAngle = -Math.PI / 2;

    data.forEach(function (d, i) {
      const pct = total > 0 ? (d.value / total) : 0;
      const angleSpan = pct * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSpan;
      currentAngle = endAngle;

      const group = makeSvg("g", { class: "pie-slice-group", "data-index": String(i) });

      if (data.length === 1 || pct >= 0.9999) {
        const circle = makeSvg("circle", {
          cx: cx,
          cy: cy,
          r: r,
          fill: d.color,
          class: "pie-slice",
          stroke: "#fffdf7",
          "stroke-width": "2"
        });
        const titleEl = makeSvg("title");
        titleEl.textContent = d.label + ": " + d.value + (unit ? " " + unit : "") + " (100 %)";
        circle.appendChild(titleEl);
        group.appendChild(circle);
      } else if (pct > 0) {
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = angleSpan > Math.PI ? 1 : 0;

        let pathData = "";
        if (isDonut) {
          const xi1 = cx + rInner * Math.cos(endAngle);
          const yi1 = cy + rInner * Math.sin(endAngle);
          const xi2 = cx + rInner * Math.cos(startAngle);
          const yi2 = cy + rInner * Math.sin(startAngle);
          pathData = [
            "M", x1, y1,
            "A", r, r, 0, largeArc, 1, x2, y2,
            "L", xi1, yi1,
            "A", rInner, rInner, 0, largeArc, 0, xi2, yi2,
            "Z"
          ].join(" ");
        } else {
          pathData = [
            "M", cx, cy,
            "L", x1, y1,
            "A", r, r, 0, largeArc, 1, x2, y2,
            "Z"
          ].join(" ");
        }

        const path = makeSvg("path", {
          d: pathData,
          fill: d.color,
          stroke: "#fffdf7",
          "stroke-width": "2",
          class: "pie-slice"
        });
        const titleEl = makeSvg("title");
        titleEl.textContent = d.label + ": " + d.value + (unit ? " " + unit : "") + " (" + Math.round(pct * 100) + " %)";
        path.appendChild(titleEl);
        group.appendChild(path);

        if (pct >= 0.12) {
          const midAngle = startAngle + angleSpan / 2;
          const rText = isDonut ? (r + rInner) / 2 : r * 0.66;
          const tx = cx + rText * Math.cos(midAngle);
          const ty = cy + rText * Math.sin(midAngle) + 4;
          const sliceText = makeSvg("text", {
            x: tx,
            y: ty,
            class: "pie-slice-label",
            "text-anchor": "middle"
          });
          sliceText.textContent = Math.round(pct * 100) + "%";
          group.appendChild(sliceText);
        }
      }

      svg.appendChild(group);

      const legendItem = makeElement("div", "pie-legend-item");
      legendItem.dataset.index = String(i);
      const swatch = makeElement("span", "pie-legend-swatch");
      swatch.style.backgroundColor = d.color;
      const label = makeElement("span", "pie-legend-label", d.label);
      const valSpan = makeElement("span", "pie-legend-value", String(d.value) + (unit ? " " + unit : ""));
      const pctSpan = makeElement("span", "pie-legend-pct", "(" + Math.round(pct * 100) + " %)");

      legendItem.append(swatch, label, valSpan, pctSpan);

      legendItem.addEventListener("mouseenter", function () {
        group.classList.add("is-hovered");
        legendItem.classList.add("is-hovered");
      });
      legendItem.addEventListener("mouseleave", function () {
        group.classList.remove("is-hovered");
        legendItem.classList.remove("is-hovered");
      });
      group.addEventListener("mouseenter", function () {
        legendItem.classList.add("is-hovered");
        group.classList.add("is-hovered");
      });
      group.addEventListener("mouseleave", function () {
        legendItem.classList.remove("is-hovered");
        group.classList.remove("is-hovered");
      });

      legend.appendChild(legendItem);
    });

    if (isDonut) {
      const centerTotal = makeSvg("text", {
        x: cx,
        y: cy - 2,
        class: "pie-center-total",
        "text-anchor": "middle"
      });
      centerTotal.textContent = String(total);
      const centerLabel = makeSvg("text", {
        x: cx,
        y: cy + 13,
        class: "pie-center-label",
        "text-anchor": "middle"
      });
      centerLabel.textContent = (config.unit || "TOTALT").toUpperCase();
      svg.append(centerTotal, centerLabel);
    }

    svgBox.appendChild(svg);
    layout.append(svgBox, legend);
    container.appendChild(layout);
    return container;
  }

  function renderLineChart(config) {
    const data = normalizeChartData(config);
    const container = makeElement("div", "chart-wrapper line-chart-wrapper");
    if (!data.length) return container;

    const unit = config.unit || "";
    const width = 500;
    const height = 230;
    const left = config.yAxis && config.yAxis.label ? 50 : 42;
    const right = 24;
    const top = 28;
    const bottom = config.xAxis && config.xAxis.label ? 46 : 38;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const values = data.map(function (d) { return d.value; });
    const maxVal = Math.max.apply(null, values.concat([1]));
    const scale = calculateNiceScale(config.yAxis && config.yAxis.max ? config.yAxis.max : maxVal);
    const maxY = config.yAxis && config.yAxis.max ? config.yAxis.max : scale.max;
    const step = config.yAxis && config.yAxis.step ? config.yAxis.step : scale.step;

    const chartId = "line-" + Math.random().toString(36).slice(2, 8);

    const svg = makeSvg("svg", {
      viewBox: "0 0 " + width + " " + height,
      class: "chart-svg",
      role: "img",
      "aria-label": config.ariaLabel || (config.title || "Linjediagram") + ": " +
        data.map(function (d) { return d.label + " " + d.value + (unit ? " " + unit : ""); }).join(", ")
    });

    const defs = makeSvg("defs");
    const grad = makeSvg("linearGradient", {
      id: chartId + "-grad",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    });
    const stop1 = makeSvg("stop", { offset: "0%", "stop-color": "#425b9a", "stop-opacity": "0.22" });
    const stop2 = makeSvg("stop", { offset: "100%", "stop-color": "#425b9a", "stop-opacity": "0.01" });
    grad.append(stop1, stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);

    if (config.yAxis && config.yAxis.label) {
      const yAxisTitle = makeSvg("text", {
        x: left,
        y: top - 12,
        class: "chart-axis-title",
        "text-anchor": "start"
      });
      yAxisTitle.textContent = config.yAxis.label.toUpperCase();
      svg.appendChild(yAxisTitle);
    }

    const numTicks = Math.round(maxY / step);
    for (let i = 0; i <= numTicks; i += 1) {
      const val = i * step;
      if (val > maxY + 0.0001) break;
      const y = top + plotHeight - (val / maxY) * plotHeight;
      const line = makeSvg("line", {
        x1: left,
        y1: y,
        x2: left + plotWidth,
        y2: y,
        class: i === 0 ? "chart-axis-line" : "chart-grid-line"
      });
      svg.appendChild(line);

      const tick = makeSvg("text", {
        x: left - 8,
        y: y + 4,
        class: "chart-tick-label",
        "text-anchor": "end"
      });
      tick.textContent = String(Math.round(val * 100) / 100);
      svg.appendChild(tick);
    }

    const points = data.map(function (d, i) {
      const x = left + (data.length > 1 ? i * (plotWidth / (data.length - 1)) : plotWidth / 2);
      const y = top + plotHeight - (d.value / maxY) * plotHeight;
      return { x: x, y: y, data: d };
    });

    if (points.length > 1) {
      let areaD = "M " + points[0].x + " " + (top + plotHeight) + " L " + points[0].x + " " + points[0].y;
      for (let i = 1; i < points.length; i += 1) {
        areaD += " L " + points[i].x + " " + points[i].y;
      }
      areaD += " L " + points[points.length - 1].x + " " + (top + plotHeight) + " Z";

      const areaPath = makeSvg("path", {
        d: areaD,
        fill: "url(#" + chartId + "-grad)",
        class: "line-chart-area"
      });
      svg.appendChild(areaPath);

      let lineD = "M " + points[0].x + " " + points[0].y;
      for (let j = 1; j < points.length; j += 1) {
        lineD += " L " + points[j].x + " " + points[j].y;
      }
      const linePath = makeSvg("path", {
        d: lineD,
        fill: "none",
        stroke: "#425b9a",
        "stroke-width": "3",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        class: "line-chart-stroke"
      });
      svg.appendChild(linePath);
    }

    points.forEach(function (pt) {
      const g = makeSvg("g", { class: "line-point-group" });
      const circle = makeSvg("circle", {
        cx: pt.x,
        cy: pt.y,
        r: 5,
        fill: "#fffdf7",
        stroke: "#425b9a",
        "stroke-width": "2.5",
        class: "line-point-dot"
      });
      const titleEl = makeSvg("title");
      titleEl.textContent = pt.data.label + ": " + pt.data.value + (unit ? " " + unit : "");
      circle.appendChild(titleEl);

      const valText = makeSvg("text", {
        x: pt.x,
        y: pt.y - 10,
        class: "chart-value-label",
        "text-anchor": "middle"
      });
      valText.textContent = String(pt.data.value);

      const catText = makeSvg("text", {
        x: pt.x,
        y: top + plotHeight + 17,
        class: "chart-category-label",
        "text-anchor": "middle"
      });
      catText.textContent = pt.data.label;

      g.append(circle, valText, catText);
      svg.appendChild(g);
    });

    if (config.xAxis && config.xAxis.label) {
      const xAxisTitle = makeSvg("text", {
        x: left + plotWidth / 2,
        y: height - 6,
        class: "chart-axis-title",
        "text-anchor": "middle"
      });
      xAxisTitle.textContent = config.xAxis.label.toUpperCase();
      svg.appendChild(xAxisTitle);
    }

    container.appendChild(svg);
    return container;
  }

  function renderTable(config) {
    const container = makeElement("div", "table-wrapper");
    const table = makeElement("table", "lesson-table");

    if (config.caption) {
      table.appendChild(makeElement("caption", "visually-hidden", config.caption));
    }

    let headers = config.headers || [];
    let rows = config.rows || [];

    if (!headers.length && config.data && Array.isArray(config.data)) {
      headers = [config.categoryHeader || "Kategori", config.valueHeader || (config.unit ? "Antal (" + config.unit + ")" : "Antal")];
      rows = config.data.map(function (d) {
        return [d.label, String(d.value)];
      });
    }

    if (headers.length) {
      const thead = document.createElement("thead");
      const tr = document.createElement("tr");
      headers.forEach(function (header, i) {
        const th = makeElement("th", "", String(header));
        th.setAttribute("scope", "col");
        if (config.align && config.align[i]) {
          th.classList.add("text-" + config.align[i]);
        } else if (i > 0) {
          th.classList.add("text-right");
        }
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    const tbody = document.createElement("tbody");
    rows.forEach(function (row) {
      const tr = document.createElement("tr");
      const rowArr = Array.isArray(row) ? row : Object.values(row);
      rowArr.forEach(function (cell, i) {
        const td = makeElement("td", "", String(cell));
        const strCell = String(cell).trim();
        const isNumeric = typeof cell === "number" || (!isNaN(Number(strCell)) && !isNaN(parseFloat(strCell))) || strCell.endsWith("%");
        if (config.align && config.align[i]) {
          td.classList.add("text-" + config.align[i]);
        } else if (isNumeric || i > 0) {
          td.classList.add("text-right");
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    if (config.summaryRow || config.footer) {
      const footerRow = config.summaryRow || config.footer;
      const tfoot = document.createElement("tfoot");
      const tr = document.createElement("tr");
      footerRow.forEach(function (cell, i) {
        const td = makeElement("td", "", String(cell));
        if (config.align && config.align[i]) {
          td.classList.add("text-" + config.align[i]);
        } else if (i > 0) {
          td.classList.add("text-right");
        }
        tr.appendChild(td);
      });
      tfoot.appendChild(tr);
      table.appendChild(tfoot);
    }

    container.appendChild(table);
    return container;
  }

  function renderSingleVisualContent(config) {
    if (!config) return null;
    const type = (config.type || "").toLowerCase();
    // Figures first: "tallinje" would otherwise be mistaken for a line chart.
    if (window.GaussicaFigures && window.GaussicaFigures.supports(type)) {
      return window.GaussicaFigures.render(config);
    }
    if (type.includes("stapel") || type.includes("bar")) {
      return renderBarChart(config);
    }
    if (type.includes("cirkel") || type.includes("pie")) {
      return renderPieChart(config);
    }
    if (type.includes("linje") || type.includes("line")) {
      return renderLineChart(config);
    }
    if (type.includes("tabel") || type.includes("table")) {
      return renderTable(config);
    }
    return null;
  }

  function renderVisualComponent(config) {
    if (!config) return null;

    const isTabs = config.type === "tabs" || (Array.isArray(config.views) && config.views.length > 0);
    const card = makeElement("figure", "visual-card");

    const header = makeElement("figcaption", "visual-header");
    const headerCopy = makeElement("div", "visual-header-copy");

    let badgeText = "";
    if (isTabs) {
      badgeText = "DIAGRAM & TABELL";
    } else {
      const type = (config.type || "").toLowerCase();
      if (window.GaussicaFigures && window.GaussicaFigures.supports(type)) badgeText = window.GaussicaFigures.badge(type);
      else if (type.includes("stapel") || type.includes("bar")) badgeText = "STAPELDIAGRAM";
      else if (type.includes("cirkel") || type.includes("pie")) badgeText = "CIRKELDIAGRAM";
      else if (type.includes("linje") || type.includes("line")) badgeText = "LINJEDIAGRAM";
      else if (type.includes("tabel") || type.includes("table")) badgeText = "TABELL";
      else badgeText = "DATA";
    }

    headerCopy.appendChild(makeElement("span", "visual-badge", badgeText));
    if (config.title) {
      headerCopy.appendChild(makeElement("h4", "visual-title", config.title));
    }
    if (config.subtitle) {
      headerCopy.appendChild(makeElement("p", "visual-subtitle", config.subtitle));
    }
    header.appendChild(headerCopy);

    const body = makeElement("div", "visual-body");

    if (isTabs) {
      const views = config.views || [];
      const tabNav = makeElement("div", "visual-tabs-nav");
      tabNav.setAttribute("role", "tablist");
      tabNav.setAttribute("aria-label", config.title || "Välj diagramtyp eller tabell");

      const viewContainers = [];

      views.forEach(function (view, index) {
        const tabTitle = view.tabTitle || view.title || (
          view.type === "stapeldiagram" ? "Stapel" :
          view.type === "cirkeldiagram" ? "Cirkel" :
          view.type === "linjediagram" ? "Linje" :
          view.type === "tabell" ? "Tabell" : ("Vy " + (index + 1))
        );
        const tabBtn = makeElement("button", "visual-tab-btn", tabTitle);
        tabBtn.type = "button";
        tabBtn.setAttribute("role", "tab");
        tabBtn.setAttribute("aria-selected", String(index === 0));

        const viewWrapper = makeElement("div", "visual-tab-panel");
        viewWrapper.setAttribute("role", "tabpanel");
        viewWrapper.hidden = index !== 0;

        const content = renderSingleVisualContent(view);
        if (content) viewWrapper.appendChild(content);
        viewContainers.push(viewWrapper);

        tabBtn.addEventListener("click", function () {
          tabNav.querySelectorAll(".visual-tab-btn").forEach(function (btn) {
            btn.setAttribute("aria-selected", "false");
          });
          tabBtn.setAttribute("aria-selected", "true");
          viewContainers.forEach(function (panel, pIndex) {
            panel.hidden = pIndex !== index;
          });
        });

        tabNav.appendChild(tabBtn);
      });

      header.appendChild(tabNav);
      viewContainers.forEach(function (vc) { body.appendChild(vc); });
    } else {
      const content = renderSingleVisualContent(config);
      if (content) body.appendChild(content);
    }

    card.append(header, body);

    if (config.caption) {
      card.appendChild(makeElement("p", "visual-caption", config.caption));
    }

    return card;
  }

  function renderVisualsFor(parent, target) {
    if (!target) return;
    const configs = [];
    if (target.visual) configs.push(target.visual);
    if (Array.isArray(target.visuals)) {
      configs.push.apply(configs, target.visuals);
    }
    if (target.chart) configs.push(target.chart);
    if (Array.isArray(target.charts)) configs.push.apply(configs, target.charts);
    if (target.diagram) configs.push(target.diagram);
    if (Array.isArray(target.diagrams)) configs.push.apply(configs, target.diagrams);
    if (target.table) configs.push(target.table);
    if (Array.isArray(target.tables)) configs.push.apply(configs, target.tables);

    configs.forEach(function (cfg) {
      const el = renderVisualComponent(cfg);
      if (el) parent.appendChild(el);
    });
  }

  return { init: init, renderInteractiveModel: renderInteractiveModel, renderSingleVisualContent: renderSingleVisualContent, renderVisualComponent: renderVisualComponent, renderVisualsFor: renderVisualsFor };
}());
