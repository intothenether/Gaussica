// Search in the map (cut out of app.js): A box above the map: what is typed finds lessons by name, by a word of the summary, by area or by kind (lesson-search.js). The hits are listed (a click opens the lesson,
// also one that is in another area than the one chosen) and the nodes of the map that are not hits are dimmed, so that it is clear where on the map they are.
//
//   GaussicaMapSearch.init({ getCourse, areas, openLesson, renderGraph })   from app.js
//   GaussicaMapSearch.bind()   binds the search box once (it is safe to call again)
//   GaussicaMapSearch.hits()   the ids of the hits while there is a query, otherwise null (the map dims the other nodes)

window.GaussicaMapSearch = (function () {
  "use strict";

  const makeElement = window.GaussicaDom.makeElement;
  let deps = null;

  const SEARCH_LIMIT = 8;
  let searchHits = null;   // the ids of the hits while there is a query, otherwise null
  let searchTimer = null;

  // more text to search in: the area, the kind of lesson, the school year, and the parts of a chapter
  function searchExtra(lesson) {
    const L = window.GaussicaLesson;
    const kind = lesson.isParentLesson ? "kapitel" : lesson.kind === "pyssel" ? "pyssla" : lesson.kind === "begrepp" ? "begrepp" : "lektion";
    const parts = lesson.isParentLesson ? L.children(lesson, deps.getCourse().lessons).map(function (c) { return c.title; }).join(" ") : "";
    return [deps.areas.get(lesson.area) || "", kind, L.gradeLabel(L.effectiveGrade(lesson, deps.getCourse().lessons)), parts].join(" ");
  }

  function runSearch() {
    const input = document.querySelector("#map-search-input");
    const list = document.querySelector("#map-search-results");
    const count = document.querySelector("#map-search-count");
    const clear = document.querySelector("#map-search-clear");
    if (!input || !list || !deps.getCourse()) return;
    const query = input.value.trim();
    clear.hidden = !input.value;
    list.replaceChildren();
    if (!query) {
      searchHits = null;
      list.hidden = true;
      count.textContent = "";
      deps.renderGraph();
      return;
    }
    const L = window.GaussicaLesson;
    const found = window.GaussicaSearch.find(deps.getCourse().lessons, query, { extra: searchExtra });
    searchHits = new Set(found.map(function (r) { return r.lesson.id; }));
    count.textContent = found.length === 0 ? "Ingen lektion hittades. Prova ett annat ord." : found.length === 1 ? "1 lektion hittades." : found.length + " lektioner hittades.";
    found.slice(0, SEARCH_LIMIT).forEach(function (r) {
      const lesson = r.lesson;
      const item = makeElement("li", "map-search-item");
      const button = makeElement("button", "map-search-hit");
      button.type = "button";
      button.dataset.lessonId = lesson.id;
      const kind = lesson.isParentLesson ? " · kapitel" : lesson.kind === "pyssel" ? " · pyssla" : lesson.kind === "begrepp" ? " · begrepp" : "";
      button.append(makeElement("span", "map-search-hit-title", lesson.title),
        makeElement("span", "map-search-hit-meta", L.gradeLabel(L.effectiveGrade(lesson, deps.getCourse().lessons)).toLowerCase() + " · " + (deps.areas.get(lesson.area) || lesson.area) + kind));
      button.addEventListener("click", function () { deps.openLesson(lesson.id); });
      item.appendChild(button);
      list.appendChild(item);
    });
    if (found.length > SEARCH_LIMIT) list.appendChild(makeElement("li", "map-search-more", "och " + (found.length - SEARCH_LIMIT) + " till. Skriv mer för att begränsa."));
    list.hidden = found.length === 0;
    deps.renderGraph();
  }

  function initSearch() {
    const input = document.querySelector("#map-search-input");
    if (!input || input.dataset.bound) return;
    input.dataset.bound = "1";
    input.addEventListener("input", function () { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 140); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(searchTimer);
        runSearch();
        const first = document.querySelector("#map-search-results .map-search-hit");
        if (first) first.click();
      } else if (e.key === "Escape" && input.value) {
        e.preventDefault();
        input.value = "";
        runSearch();
      } else if (e.key === "ArrowDown") {
        const first = document.querySelector("#map-search-results .map-search-hit");
        if (first) { e.preventDefault(); first.focus(); }
      }
    });
    document.querySelector("#map-search-results").addEventListener("keydown", function (e) {
      const hits = Array.prototype.slice.call(document.querySelectorAll("#map-search-results .map-search-hit"));
      const i = hits.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === "ArrowDown" && hits[i + 1]) { e.preventDefault(); hits[i + 1].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); (hits[i - 1] || input).focus(); }
    });
    document.querySelector("#map-search-clear").addEventListener("click", function () { input.value = ""; runSearch(); input.focus(); });
  }

  return {
    init: function (d) { deps = d; },
    bind: initSearch,
    hits: function () { return searchHits; }
  };
}());
