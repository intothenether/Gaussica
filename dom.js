// Small tools that several files use.
//
//   GaussicaDom.makeElement(tag, className, text)   an element; the text is drawn as maths (powers, fractions) when there is any
//   GaussicaDom.downloadJSON(filename, value)       gives the browser a file to save

window.GaussicaDom = (function () {
  "use strict";

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) {
      if (window.GaussicaText) window.GaussicaText.set(element, text); else element.textContent = text;
    }
    return element;
  }

  function downloadJSON(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { makeElement: makeElement, downloadJSON: downloadJSON };
}());
