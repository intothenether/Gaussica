// Colour themes. The student picks one under "Mitt konto" (Utseende). Every theme is a complete set of the colour variables
// that styles.css uses for the page, the cards, the tints and the shadows, so nothing else on the page has to know which theme
// is on. Semantic colours (green for done, red for wrong, gold for coins, the colours of the pet and of the landscapes) are not
// part of a theme.
//
// This file is loaded in the <head>, before the page is painted, and puts the last chosen theme on the page at once (it is
// remembered in the browser, so there is no flash of the default). The choice is also saved in the student's progress under the
// key "theme", so it follows the account to other devices (app.js calls GaussicaTheme.sync).
//
//   GaussicaTheme.THEMES        [{ id, name, tagline, vars }], the default first
//   GaussicaTheme.DEFAULT       "bubbelgum"
//   GaussicaTheme.apply(id)     put a theme on the page (and remember it in the browser)
//   GaussicaTheme.current()     the id of the theme in use
//   GaussicaTheme.sync(record)  at sign-in: the theme saved in the account (record = { id }) wins over the one in the browser
//   GaussicaTheme.picker(onPick) the choice of themes as an element; onPick(id) is called after a theme is put on
//   GaussicaTheme.contrast(a, b) the contrast ratio of two colours (WCAG)
//
// The default theme must be the same as the defaults at the top of styles.css (tests/theme.js checks that).

window.GaussicaTheme = (function () {
  "use strict";

  const KEY = "gaussica.theme";
  const DEFAULT = "bubbelgum";

  const THEMES = [
    {
      id: "bubbelgum", name: "Bubbelgum och marin", tagline: "Rosa ytor, marin knapp",
      vars: {
        cream: "#ffeaf1", paper: "#fffafc", ink: "#1f2a44", muted: "#56627d",
        brand: "#3a4f8f", "brand-dark": "#2b3b70", "brand-light": "#5a74b5", "brand-soft": "#ffe1ea",
        border: "#f5cfdc", "border-mid": "#e6b3c6", "surface-soft": "#fff3f7",
        sky: "#ff8fb0", "sky-soft": "#ffe1ea", "sky-line": "#f5c3d4",
        coral: "#ff8fb0", "coral-soft": "#ffe4ec", "coral-dark": "#a63a5c",
        accent: "#ff8fb0", "accent-soft": "#ffe1ea", blue: "#ffe1ea", "pink-line": "#f5b9cc",
        "hero-1": "#ffd3e2", "hero-2": "#fff0f5", "hero-3": "#ffe1ea",
        "shadow-rgb": "58, 79, 143", focus: "#3a4f8f",
        pink: "#ef6f88", "pink-deep": "#bb3a52", "pink-soft": "#ffe3e9", "pink-pale": "#fff1f4"
      }
    },
    {
      id: "rosa", name: "Rosa dimma", tagline: "Mjuk rosa, rosenbrand",
      vars: {
        cream: "#fff1f5", paper: "#fffafc", ink: "#2d2140", muted: "#6b5873",
        brand: "#b2356b", "brand-dark": "#8a2756", "brand-light": "#d9608f", "brand-soft": "#ffe3ec",
        border: "#f3d3df", "border-mid": "#e6b9cb", "surface-soft": "#fff6f9",
        sky: "#7fb8e8", "sky-soft": "#e3f1fb", "sky-line": "#bcdcf3",
        coral: "#e8789a", "coral-soft": "#ffe3ec", "coral-dark": "#8a2756",
        accent: "#e8789a", "accent-soft": "#ffe3ec", blue: "#e3f1fb", "pink-line": "#f3b5c9",
        "hero-1": "#ffd9e5", "hero-2": "#fff4f7", "hero-3": "#e3f1fb",
        "shadow-rgb": "178, 53, 107", focus: "#b2356b",
        pink: "#e8789a", "pink-deep": "#b2356b", "pink-soft": "#ffe3ec", "pink-pale": "#fff6f9"
      }
    },
    {
      id: "hallon", name: "Hallon och plommon", tagline: "Djupare rosa och lila",
      vars: {
        cream: "#fdeef4", paper: "#fff9fb", ink: "#2a1f3d", muted: "#66526f",
        brand: "#b02a63", "brand-dark": "#82204a", "brand-light": "#cf5a8b", "brand-soft": "#f6dcea",
        border: "#efd0e0", "border-mid": "#deb2c9", "surface-soft": "#fff4f9",
        sky: "#8a5db5", "sky-soft": "#eadff5", "sky-line": "#cdb9e3",
        coral: "#d86a9c", "coral-soft": "#fbdfe9", "coral-dark": "#82204a",
        accent: "#d4568c", "accent-soft": "#f6dcea", blue: "#eadff5", "pink-line": "#eab3cc",
        "hero-1": "#f6d3e5", "hero-2": "#fdeaf2", "hero-3": "#eadff5",
        "shadow-rgb": "176, 42, 99", focus: "#b02a63",
        pink: "#d4568c", "pink-deep": "#b02a63", "pink-soft": "#f6dcea", "pink-pale": "#fff4f9"
      }
    },
    {
      id: "korall", name: "Korall och persika", tagline: "Varm rosa och persika",
      vars: {
        cream: "#fff2ec", paper: "#fffaf7", ink: "#3a2a3d", muted: "#6f5a66",
        brand: "#b4364e", "brand-dark": "#96293f", "brand-light": "#de6378", "brand-soft": "#ffe1d6",
        border: "#f6d6c9", "border-mid": "#e8b9a8", "surface-soft": "#fff6f2",
        sky: "#f2a65a", "sky-soft": "#ffeccf", "sky-line": "#f3cfa5",
        coral: "#ee7d6a", "coral-soft": "#ffe1d6", "coral-dark": "#a8324d",
        accent: "#ee7d6a", "accent-soft": "#ffeccf", blue: "#ffeccf", "pink-line": "#f6b9a8",
        "hero-1": "#ffdccf", "hero-2": "#fff3e8", "hero-3": "#ffe9c9",
        "shadow-rgb": "180, 54, 78", focus: "#b4364e",
        pink: "#ee7d6a", "pink-deep": "#b4364e", "pink-soft": "#ffe1d6", "pink-pale": "#fff6f2"
      }
    },
    {
      id: "bla", name: "Blå och kräm", tagline: "Blå och kräm, som förut",
      vars: {
        cream: "#fff8e6", paper: "#fffdf7", ink: "#1f2a44", muted: "#56627d",
        brand: "#425b9a", "brand-dark": "#2f4378", "brand-light": "#5c84c8", "brand-soft": "#e6f2fc",
        border: "#e2e8f4", "border-mid": "#cdd5e6", "surface-soft": "#f4f7fc",
        sky: "#76c0ec", "sky-soft": "#e3f3fc", "sky-line": "#bfe0f5",
        coral: "#ff95a5", "coral-soft": "#ffe8ec", "coral-dark": "#b23a56",
        accent: "#ff8ca0", "accent-soft": "#ffedef", blue: "#e3f1fb", "pink-line": "#ffc3cf",
        "hero-1": "#e3f3fc", "hero-2": "#fff6dc", "hero-3": "#ffe8ec",
        "shadow-rgb": "66, 91, 154", focus: "#425b9a",
        pink: "#ef6f88", "pink-deep": "#bb3a52", "pink-soft": "#ffe3e9", "pink-pale": "#fff1f4"
      }
    }
  ];

  function find(id) { return THEMES.find(function (t) { return t.id === id; }) || null; }
  function valid(id) { return Boolean(find(id)); }

  // ----- contrast (WCAG) -----
  function lum(hex) {
    const c = [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16) / 255; }).map(function (v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    const x = Math.max(lum(a), lum(b)), y = Math.min(lum(a), lum(b));
    return (x + 0.05) / (y + 0.05);
  }

  // ----- the browser -----
  let active = DEFAULT;

  function stored() {
    try { const v = window.localStorage.getItem(KEY); return valid(v) ? v : null; } catch (e) { return null; }
  }
  function remember(id) { try { window.localStorage.setItem(KEY, id); } catch (e) { /* storage blocked: the choice lasts until the page closes */ } }

  function apply(id, options) {
    const t = find(id) || find(DEFAULT);
    active = t.id;
    if (typeof document !== "undefined" && document.documentElement && document.documentElement.style) {
      const root = document.documentElement;
      Object.keys(t.vars).forEach(function (k) { root.style.setProperty("--" + k, t.vars[k]); });
      if (root.setAttribute) root.setAttribute("data-theme", t.id);
      const meta = document.querySelector && document.querySelector('meta[name="theme-color"]');
      if (meta && meta.setAttribute) meta.setAttribute("content", t.vars.cream);
    }
    if (!options || options.remember !== false) remember(t.id);
    return t.id;
  }

  function current() { return active; }

  // At sign-in: the theme saved in the account is the student's choice, wherever they sign in.
  function sync(record) {
    if (record && valid(record.id) && record.id !== active) apply(record.id);
    else if (record && valid(record.id)) remember(record.id);
  }

  // ----- the choice -----
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function picker(onPick) {
    const wrap = el("div", "theme-picker");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Färgtema");
    const mark = function () {
      Array.prototype.forEach.call(wrap.children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.theme === active)); });
    };
    THEMES.forEach(function (t) {
      const b = el("button", "theme-option");
      b.type = "button";
      b.dataset.theme = t.id;
      const dots = el("span", "theme-dots");
      ["cream", "hero-1", "brand", "accent"].forEach(function (k) {
        const d = el("i");
        d.style.background = t.vars[k];
        dots.appendChild(d);
      });
      b.append(dots, el("span", "theme-name", t.name), el("span", "theme-tag", t.tagline));
      b.addEventListener("click", function () { apply(t.id); mark(); if (onPick) onPick(t.id); });
      wrap.appendChild(b);
    });
    mark();
    return wrap;
  }

  // the theme of the last visit, before anything is drawn
  const first = stored();
  if (first && first !== DEFAULT) apply(first, { remember: false });
  else if (typeof document !== "undefined" && document.documentElement && document.documentElement.setAttribute) document.documentElement.setAttribute("data-theme", DEFAULT);

  return { KEY: KEY, DEFAULT: DEFAULT, THEMES: THEMES, find: find, valid: valid, apply: apply, current: current, sync: sync, picker: picker, contrast: contrast, lum: lum };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaTheme;
