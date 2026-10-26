// Reading support: read aloud (the browser's own Swedish voice) and settings for text size, typeface and spacing.
//
//   GaussicaSpeech.toSpeech(text)       maths written the way it is said: "3/4" -> "tre fjärdedelar", "x^2" -> "x i kvadrat"
//   GaussicaSpeech.speak(text, onEnd)   reads text aloud; GaussicaSpeech.stop()
//   GaussicaSpeech.button(getText)      a "Lyssna" button (null if the browser cannot speak)
//   GaussicaReading.open()              the dialog with the settings; GaussicaReading.apply() applies the saved ones
//
// Nothing is sent anywhere by this site: the voice is the one in the browser or on the device. The settings are kept
// on the device (localStorage) and are not tied to an account.

(function () {
  "use strict";

  // ===== maths as words =====
  const ORDINAL = { 2: ["halv", "halvor"], 3: ["tredjedel", "tredjedelar"], 4: ["fjärdedel", "fjärdedelar"], 5: ["femtedel", "femtedelar"],
    6: ["sjättedel", "sjättedelar"], 7: ["sjundedel", "sjundedelar"], 8: ["åttondel", "åttondelar"], 9: ["niondel", "niondelar"],
    10: ["tiondel", "tiondelar"], 100: ["hundradel", "hundradelar"], 1000: ["tusendel", "tusendelar"] };
  const ONE = { 1: "en", 2: "två", 3: "tre", 4: "fyra", 5: "fem", 6: "sex", 7: "sju", 8: "åtta", 9: "nio", 10: "tio" };

  function fractionWords(a, b) {
    const n = Number(a), d = Number(b);
    if (ORDINAL[d] && n >= 1 && n < d) {
      const word = ORDINAL[d][n === 1 ? 0 : 1];
      return (n === 1 ? (d === 2 ? "en" : "en") : (ONE[n] || String(n))) + " " + word;
    }
    return a + " delat med " + b;
  }

  function toSpeech(input) {
    let t = String(input === undefined || input === null ? "" : input);
    t = t.replace(/[\u{1F300}-\u{1FAFF}☀-➿️]/gu, " ");           // pictures and symbols
    t = t.replace(/(\d)[  ](?=\d{3}(?!\d))/g, "$1");                       // 3 482 106 is one number
    t = t.replace(/(\d+)\s*\/\s*(\d+)/g, function (m, a, b) { return fractionWords(a, b); });
    t = t.replace(/√\s*\(([^()]+)\)/g, " kvadratroten ur $1 ").replace(/√\s*(\d+(?:[.,]\d+)?|[A-Za-zåäö])/g, " kvadratroten ur $1 ");
    t = t.replace(/\^\s*\(?([-−]?)(\d+|[A-Za-z])\)?/g, function (m, minus, e) {
      if (!minus && e === "2") return " i kvadrat ";
      if (!minus && e === "3") return " i kubik ";
      return " upphöjt till " + (minus ? "minus " : "") + e + " ";
    });
    t = t.replace(/²/g, " i kvadrat ").replace(/³/g, " i kubik ");
    t = t.replace(/[·*]/g, " gånger ").replace(/÷/g, " delat med ");
    t = t.replace(/≠/g, " är inte lika med ").replace(/≈/g, " är ungefär lika med ").replace(/≤/g, " är mindre än eller lika med ").replace(/≥/g, " är större än eller lika med ");
    t = t.replace(/±/g, " plus minus ").replace(/→/g, " ger ");
    t = t.replace(/=/g, " är lika med ").replace(/</g, " är mindre än ").replace(/>/g, " är större än ");
    t = t.replace(/−/g, " minus ").replace(/(^|[\s(])-(?=\d)/g, "$1minus ").replace(/\s-\s/g, " minus ");
    t = t.replace(/\+/g, " plus ");
    t = t.replace(/%/g, " procent").replace(/°/g, " grader");
    t = t.replace(/,?\s*(?:\.{3}|…)/g, ", och så vidare ");
    return t.replace(/\s+/g, " ").trim();
  }

  // ===== speech =====
  let current = null;       // the button that is reading
  let voice = null;

  function synth() { return typeof window !== "undefined" && window.speechSynthesis && window.SpeechSynthesisUtterance ? window.speechSynthesis : null; }

  function pickVoice() {
    const s = synth();
    if (!s) return null;
    const list = s.getVoices() || [];
    voice = list.find(function (v) { return /^sv(-|_|$)/i.test(v.lang) && v.localService; }) || list.find(function (v) { return /^sv(-|_|$)/i.test(v.lang); }) || null;
    return voice;
  }

  function stop() {
    const s = synth();
    if (s) s.cancel();
    if (current) { current.reset(); current = null; }
  }

  function speak(text, onEnd) {
    const s = synth();
    if (!s) return false;
    s.cancel();
    const u = new window.SpeechSynthesisUtterance(toSpeech(text));
    u.lang = "sv-SE";
    if (!voice) pickVoice();
    if (voice) u.voice = voice;
    u.rate = settings().rate;
    u.onend = u.onerror = function () { if (onEnd) onEnd(); };
    s.speak(u);
    return true;
  }

  // A button that reads what getText() returns, and stops again when pressed a second time.
  function button(getText, className) {
    if (!synth()) return null;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "listen-btn" + (className ? " " + className : "");
    const label = function (playing) {
      b.textContent = "";
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = playing ? "⏹" : "🔊";
      b.append(icon, document.createTextNode(playing ? " Stoppa" : " Lyssna"));
      b.setAttribute("aria-pressed", String(playing));
      b.title = playing ? "Sluta läsa upp" : "Lyssna på texten";
    };
    const handle = { reset: function () { label(false); } };
    label(false);
    b.addEventListener("click", function () {
      if (current === handle) { stop(); return; }
      stop();
      const text = typeof getText === "function" ? getText() : String(getText || "");
      current = handle;
      label(true);
      speak(text, function () { if (current === handle) { current = null; label(false); } });
    });
    return b;
  }

  if (synth()) {
    pickVoice();
    if (synth().addEventListener) synth().addEventListener("voiceschanged", pickVoice);
    window.addEventListener("pagehide", function () { synth().cancel(); });
  }

  // ===== settings =====
  const KEY = "gaussica-reading";
  const DEFAULTS = { size: 0, font: "standard", spacing: false, rate: 1 };

  function settings() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return {
          size: [0, 1, 2].indexOf(s.size) >= 0 ? s.size : 0, font: s.font === "lexend" ? "lexend" : "standard",
          spacing: Boolean(s.spacing), rate: [0.8, 1, 1.25].indexOf(s.rate) >= 0 ? s.rate : 1
        };
      }
    } catch (e) { /* storage blocked: the defaults */ }
    return Object.assign({}, DEFAULTS);
  }

  function save(s) {
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* not kept */ }
  }

  function apply() {
    if (typeof document === "undefined" || !document.documentElement) return;
    const s = settings();
    const root = document.documentElement;
    root.classList.toggle("read-size-1", s.size === 1);
    root.classList.toggle("read-size-2", s.size === 2);
    root.classList.toggle("read-lexend", s.font === "lexend");
    root.classList.toggle("read-spacing", s.spacing);
  }

  let overlay = null;
  let opener = null;

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    stop();
    if (opener && opener.isConnected) opener.focus();
    opener = null;
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function open() {
    close();
    opener = document.activeElement;
    const s = settings();
    overlay = el("div", "chat-overlay reading-overlay");
    const panel = el("div", "chat-panel reading-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Läsning");
    const head = el("header", "chat-head");
    head.appendChild(el("h2", "chat-title", "Aa Läsning"));
    const x = el("button", "chat-close", "✕");
    x.type = "button";
    x.setAttribute("aria-label", "Stäng");
    x.addEventListener("click", close);
    head.appendChild(x);
    const body = el("div", "rd-body");

    // a row of choices where one is on
    const choice = function (title, options, get, set) {
      const box = el("div", "rd-group");
      box.appendChild(el("h3", "rd-title", title));
      const row = el("div", "rd-row");
      row.setAttribute("role", "radiogroup");
      row.setAttribute("aria-label", title);
      options.forEach(function (o) {
        const b = el("button", "rd-opt" + (get() === o.value ? " is-on" : ""), o.label);
        b.type = "button";
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(get() === o.value));
        if (o.style) b.style.cssText = o.style;
        b.addEventListener("click", function () {
          set(o.value);
          Array.prototype.forEach.call(row.children, function (c) { c.classList.remove("is-on"); c.setAttribute("aria-checked", "false"); });
          b.classList.add("is-on");
          b.setAttribute("aria-checked", "true");
        });
        row.appendChild(b);
      });
      box.appendChild(row);
      return box;
    };
    const update = function (key, value) { const cur = settings(); cur[key] = value; save(cur); apply(); };

    body.appendChild(choice("Textstorlek", [{ value: 0, label: "Vanlig" }, { value: 1, label: "Större", style: "font-size:18px" }, { value: 2, label: "Störst", style: "font-size:22px" }],
      function () { return s.size; }, function (v) { s.size = v; update("size", v); }));
    body.appendChild(choice("Typsnitt", [{ value: "standard", label: "Vanligt" }, { value: "lexend", label: "Lättläst" }],
      function () { return s.font; }, function (v) { s.font = v; update("font", v); }));
    const spacing = el("label", "rd-check");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = s.spacing;
    cb.addEventListener("change", function () { s.spacing = cb.checked; update("spacing", cb.checked); });
    spacing.append(cb, el("span", "", "Luftig text, med mer plats mellan rader och ord"));
    body.appendChild(spacing);

    if (synth()) {
      body.appendChild(choice("Uppläsningens hastighet", [{ value: 0.8, label: "Långsam" }, { value: 1, label: "Vanlig" }, { value: 1.25, label: "Snabb" }],
        function () { return s.rate; }, function (v) { s.rate = v; update("rate", v); }));
      const test = el("button", "rd-test", "🔊 Prova rösten");
      test.type = "button";
      test.addEventListener("click", function () { stop(); speak("Så här låter uppläsningen. Tre fjärdedelar plus en fjärdedel är lika med ett.", null); });
      body.appendChild(test);
      const note = el("p", "rd-note");
      note.textContent = pickVoice() ? "Rösten kommer från din enhet." : "Det finns ingen svensk röst på den här enheten än, så uppläsningen kan låta konstig. Prova en annan webbläsare, eller lägg till en svensk röst i enhetens inställningar.";
      body.appendChild(note);
    } else {
      body.appendChild(el("p", "rd-note", "Den här webbläsaren kan inte läsa upp text. Prova Chrome, Edge eller Safari."));
    }
    body.appendChild(el("p", "rd-note", "Inställningarna sparas på den här enheten."));
    const done = el("button", "chat-send rd-done", "Klart");
    done.type = "button";
    done.addEventListener("click", close);
    panel.append(head, body, done);
    overlay.appendChild(panel);
    overlay.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    done.focus({ preventScroll: true });
  }

  apply();
  if (typeof document !== "undefined") {
    const link = document.getElementById("reading-link");
    if (link) link.addEventListener("click", open);
  }
  const api = { open: open, apply: apply, settings: settings };
  if (typeof window !== "undefined") {
    window.GaussicaSpeech = { toSpeech: toSpeech, speak: speak, stop: stop, button: button, supported: function () { return Boolean(synth()); } };
    window.GaussicaReading = api;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { toSpeech: toSpeech };
}());
