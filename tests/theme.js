"use strict";
// Colour themes: every theme is complete and readable, the defaults in styles.css are the default theme, a theme can be put on
// the page and chosen, and the style sheet does not hold on to the old colours of the page.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

// a page to put themes on
const set = {};
const store = {};
const meta = { content: "", setAttribute(k, v) { if (k === "content") this.content = v; } };
function fakeEl() {
  const e = { children: [], dataset: {}, style: {}, className: "", textContent: "", attrs: {}, listeners: {},
    appendChild(c) { e.children.push(c); return c; }, append(...c) { c.forEach((x) => e.children.push(x)); },
    setAttribute(k, v) { e.attrs[k] = v; }, addEventListener(t, fn) { e.listeners[t] = fn; } };
  return e;
}
global.window = { localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } };
global.document = {
  documentElement: { style: { setProperty: (k, v) => { set[k] = v; } }, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } },
  querySelector: (q) => (/theme-color/.test(q) ? meta : null), createElement: fakeEl
};
const T = require(ROOT + "theme.js");

// ----- the themes -----
ok(T.THEMES.length === 5 && T.THEMES[0].id === T.DEFAULT && T.DEFAULT === "bubbelgum", "five themes, and Bubbelgum och marin is the default");
ok(new Set(T.THEMES.map((t) => t.id)).size === 5 && T.THEMES.every((t) => t.name && t.tagline), "every theme has its own id, a name and a tagline");
const keys = Object.keys(T.THEMES[0].vars).sort().join();
T.THEMES.forEach((t) => {
  ok(Object.keys(t.vars).sort().join() === keys, t.id + ": has every colour variable (and no others)");
  ok(Object.keys(t.vars).every((k) => /^#[0-9a-f]{6}$/i.test(t.vars[k]) || (k === "shadow-rgb" && /^\d+, \d+, \d+$/.test(t.vars[k]))), t.id + ": every value is a colour");
});

// ----- readable -----
const PAIRS = [
  ["ink", "cream", 7], ["ink", "paper", 7], ["ink", "hero-1", 7], ["ink", "brand-soft", 7], ["ink", "coral-soft", 7], ["ink", "sky-soft", 7], ["ink", "surface-soft", 7],
  ["muted", "cream", 4.5], ["muted", "paper", 4.5], ["muted", "surface-soft", 4.5], ["muted", "hero-2", 4.5], ["muted", "brand-soft", 4.5], ["muted", "sky-soft", 4.5], ["muted", "coral-soft", 4.5],
  ["brand", "cream", 4.5], ["brand", "paper", 4.5], ["brand", "brand-soft", 4.5], ["brand", "hero-1", 4.5], ["brand-dark", "brand-soft", 4.5], ["brand-dark", "sky-soft", 4.5],
  ["coral-dark", "coral-soft", 4.5], ["pink-deep", "paper", 4.5], ["pink-deep", "pink-soft", 4.5], ["pink-deep", "cream", 4.5]
];
T.THEMES.forEach((t) => {
  const bad = PAIRS.filter(([a, b, min]) => T.contrast(t.vars[a], t.vars[b]) < min).map(([a, b, min]) => a + " on " + b + " " + T.contrast(t.vars[a], t.vars[b]).toFixed(2) + " < " + min);
  ["brand", "pink-deep", "brand-dark"].forEach((k) => { if (T.contrast("#ffffff", t.vars[k]) < 4.5) bad.push("white on " + k); });
  ok(!bad.length, t.id + ": text and buttons have enough contrast (" + bad.join("; ") + ")");
  ok(T.contrast(t.vars.focus, t.vars.cream) >= 3 && T.contrast(t.vars.focus, t.vars.paper) >= 3, t.id + ": the focus ring can be seen against the page");
});
ok(Math.abs(T.contrast("#000000", "#ffffff") - 21) < 0.01 && T.contrast("#777777", "#777777") === 1, "the contrast function is right");

// ----- the style sheet starts from the default theme -----
const css = fs.readFileSync(ROOT + "styles.css", "utf8");
const def = T.find(T.DEFAULT).vars;
Object.keys(def).forEach((k) => {
  const re = new RegExp("--" + k.replace(/-/g, "\\-") + ":\\s*([^;]+);", "g");
  const found = [];
  let m;
  while ((m = re.exec(css))) found.push(m[1].trim().toLowerCase());
  ok(found.length >= 1 && found.every((v) => v === def[k].toLowerCase()), "styles.css starts from the default theme for --" + k + " (" + found.join(" / ") + " vs " + def[k] + ")");
});
ok(!/#fff8e6|#fffdf7/i.test(css), "the old page colours are not hard-coded in the style sheet any more");
ok(!/rgba\((66|38|51), ?(91|58|75), ?(154|107|131)/.test(css), "shadows follow the theme");
ok(!/font(?:-weight)?:\s*(?:italic\s+)?900\b/.test(css), "nothing is set in the heaviest weight (800 is for headings)");
ok(/^body \{[^}]*font-weight: 600/m.test(css), "text is read in 600");
ok(/:focus-visible \{ outline: 3px solid var\(--focus\)/.test(css) && /::selection \{[^}]*var\(--brand\)/.test(css), "focus and selection follow the theme");
ok(!/outline: 3px solid var\(--sky\)/.test(css), "the focus ring is no longer sky blue");

// ----- putting a theme on the page -----
ok(T.current() === T.DEFAULT && document.documentElement.attrs["data-theme"] === "bubbelgum", "the default is on at the start");
T.apply("rosa");
ok(T.current() === "rosa" && set["--brand"] === T.find("rosa").vars.brand && set["--cream"] === T.find("rosa").vars.cream && Object.keys(set).length === Object.keys(def).length, "a theme sets every variable");
ok(document.documentElement.attrs["data-theme"] === "rosa" && meta.content === T.find("rosa").vars.cream && store[T.KEY] === "rosa", "and the attribute, the browser's colour and the memory");
T.apply("finns-inte");
ok(T.current() === "bubbelgum" && store[T.KEY] === "bubbelgum", "an unknown theme becomes the default");
T.sync({ id: "hallon" });
ok(T.current() === "hallon" && set["--brand"] === T.find("hallon").vars.brand, "the theme of the account is put on at sign-in");
T.sync(null); T.sync({ id: "okänd" }); T.sync({});
ok(T.current() === "hallon", "a missing or unknown saved theme changes nothing");
ok(T.valid("korall") && !T.valid("x") && !T.valid(undefined) && !T.valid("__proto__"), "valid ids");

// ----- the choice -----
const picked = [];
const pk = T.picker((id) => picked.push(id));
ok(pk.children.length === 5 && pk.attrs.role === "group", "five options in a group");
ok(pk.children.every((b) => b.dataset.theme && b.children.length === 3), "each option has colour dots, a name and a tagline");
ok(pk.children.filter((b) => b.attrs["aria-pressed"] === "true").map((b) => b.dataset.theme).join() === "hallon", "the theme in use is marked");
pk.children[3].listeners.click();
ok(T.current() === "korall" && picked.join() === "korall" && pk.children[3].attrs["aria-pressed"] === "true" && pk.children[2].attrs["aria-pressed"] === "false", "choosing puts the theme on, tells the page and moves the mark");
ok(store[T.KEY] === "korall", "the choice is remembered in the browser");

// ----- the page -----
const html = fs.readFileSync(ROOT + "index.html", "utf8");
const app = fs.readFileSync(ROOT + "app.js", "utf8");
ok(html.indexOf('<script src="./theme.js"></script>') > 0 && html.indexOf("theme.js") < html.indexOf("</head>"), "theme.js is loaded in the head, without defer, so that the page is never shown in the wrong colours");
ok(/meta name="theme-color" content="#ffeaf1"/.test(html), "the browser colour starts as the default theme");
["today", "more-cards", "more-peek", "more-badge", "next-card", "hero-pet", "hero-step", "knep-card", "journey-card", "train-card", "workshop-card"].forEach((id) => ok(html.indexOf('id="' + id + '"') > 0, "the start page has #" + id));
const today = html.slice(html.indexOf('id="today"'), html.indexOf('id="more-cards"'));
const more = html.slice(html.indexOf('id="more-cards"'), html.indexOf('id="map-toggle-row"'));
ok(/next-card/.test(today) && !/pet-card/.test(today) && !/Idag/.test(today), "the path (without the step of the day) is under the hero");
const hero = html.slice(html.indexOf('class="hero"'), html.indexOf("</section>", html.indexOf('class="hero"')));
ok(/hero-title/.test(hero) && /hero-cta/.test(hero) && /id="hero-pet"/.test(hero) && /id="hero-step"/.test(hero) && hero.indexOf("hero-pet") < hero.indexOf("hero-main") && !/hg-svg|hero-chips|hero-note|hero-art/.test(hero), "the hero has the pet panel first, then the greeting and the step of the day, and none of the old clutter");
ok(["knep-card", "journey-card", "train-card", "workshop-card"].every((id) => more.indexOf(id) > 0), "the rest is under Mer att utforska");
ok(/function saveTheme/.test(app) && /GaussicaTheme\.sync\(lessonProgress\.theme\)/.test(app), "the choice is saved in the account and read at sign-in");

console.log(failures ? failures + " FAILED" : "All theme checks passed");
process.exit(failures ? 1 : 0);
