// Editor for "Öva mer" templates (used by the lesson editor, pane "Övningsmallar").
//
// A template makes new questions with new numbers or words each time. This file draws a form for one
// template at a time (random numbers, random words, calculated values, conditions, question, answers and
// common mistakes), shows a few generated examples, and checks the template the same way `npm test` does.
// Specialised templates (figures, answer forms, expressions, trigonometry) come from the gallery of ready-made
// starters, and anything the form cannot express can be edited as JSON underneath each template.
//
//   GaussicaPracticeEditor.render(form, ctx)   ctx: { lesson, tasks() -> [{ id, label }], changed(), toast(text), redraw() }
//   GaussicaPracticeEditor.clean(templates)    templates ready to be saved (empty parts removed)
//   GaussicaPracticeEditor.check(template)     { errors: [], warnings: [] }
//   GaussicaPracticeEditor.problems(lesson)    error messages for the whole lesson (used when saving)
//   GaussicaPracticeEditor.STARTERS            the gallery

window.GaussicaPracticeEditor = (function () {
  "use strict";

  const NAME_RE = /^[A-Za-zåäöÅÄÖ_][A-Za-z0-9_åäöÅÄÖ]*$/;
  const ID_RE = /^[A-Za-z0-9_-]+$/;
  const FORMS = [
    { value: "", label: "Vilken som helst rätt form" },
    { value: "blandad", label: "Blandad form (1 3/4)" },
    { value: "brak", label: "Bråk utan hela tal (7/4)" },
    { value: "forenklat", label: "Förenklat bråk eller förhållande" },
    { value: "utanparentes", label: "Utan parentes (uttryck som är utmultiplicerade)" },
    { value: "grundpotens", label: "Grundpotensform (3,5 · 10^4)" }
  ];

  // ----- the gallery: ready-made templates for the common and the specialised cases -----
  const STARTERS = [
    {
      id: "summa", label: "Räkna ut (heltal)", note: "Det enklaste: två slumptal och en uträkning.",
      template: { vars: { a: [10, 99], b: [10, 99] }, derive: [{ name: "s", expr: "a+b" }], prompt: "Räkna ut {a} + {b}.", answer: ["=s"], correct: "Rätt! {a} + {b} = {s}.",
        steps: ["Lägg ihop entalen, tiotalen och hundratalen var för sig.", "{a} + {b} = {s}"],
        feedback: [{ answers: ["=a-b"], message: "Du har tagit bort. Här ska du lägga ihop." }] }
    },
    {
      id: "decimal", label: "Decimaltal", note: "Slumpa hela tal och dela med 10 eller 100 för att få decimaler. Svaret skrivs med decimalkomma av sig självt.",
      template: { vars: { a: [11, 99], b: [11, 99] }, derive: [{ name: "x", expr: "a/10" }, { name: "y", expr: "b/10" }, { name: "s", expr: "(a+b)/10" }],
        prompt: "Räkna ut {x} + {y}.", answer: ["=s"], correct: "Rätt! {x} + {y} = {s}.",
        feedback: [{ answers: ["=(a+b)/100", "=a+b"], message: "Kommatecknet har hamnat fel. Ställ upp komma under komma." }] }
    },
    {
      id: "namn", label: "Med namn och saker", note: "pick väljer ett slumpord. Skriv {$namn} i frågan. Ett ord per rad i listan ger fler olika frågor.",
      template: { pick: { namn: ["Mira", "Omar", "Elsa", "Hugo"], sak: ["äpplen", "kulor", "klistermärken"] }, vars: { a: [12, 60], b: [3, 9] }, derive: [{ name: "r", expr: "a*b" }],
        prompt: "{$namn} har {b} påsar med {a} {$sak} i varje. Hur många {$sak} har {$namn} sammanlagt?", answer: ["=r"], correct: "Rätt! {b} · {a} = {r}.",
        feedback: [{ answers: ["=a+b"], message: "Du har lagt ihop talen. Det är {b} påsar med {a} i varje, så multiplicera." }] }
    },
    {
      id: "villkor", label: "Med villkor (aldrig negativt svar)", note: "where väljer bort tal som inte passar. Här måste a vara större än b.",
      template: { vars: { a: [20, 99], b: [10, 89] }, where: [{ expr: "a-b", min: 1 }], derive: [{ name: "d", expr: "a-b" }],
        prompt: "Räkna ut {a} − {b}.", answer: ["=d"], correct: "Rätt! {a} − {b} = {d}.", feedback: [{ answers: ["=a+b"], message: "Du har lagt ihop. Här ska du dra ifrån." }] }
    },
    {
      id: "procent", label: "Procent", note: "Slumpa procent och belopp i steg (tredje talet är steget), så att svaret blir ett helt tal.",
      template: { vars: { v: [100, 900, 50], p: [10, 50, 10] }, derive: [{ name: "r", expr: "v*p/100" }],
        prompt: "Hur mycket är {p} % av {v} kr?", answer: ["=r", "{r} kr"], correct: "Rätt! {p} % av {v} är {r} kr.",
        steps: ["10 % av {v} kr är {v/10} kr.", "{p} % är {p/10} gånger så mycket.", "{p/10} · {v/10} = {r} kr."],
        feedback: [{ answers: ["=v-r"], message: "Du har dragit bort procenten. Frågan gäller hur mycket procenten är." }] }
    },
    {
      id: "rest", label: "Svar med rest", note: "Svaret är text, så skriv båda varianterna som godtas.",
      template: { vars: { q: [4, 20], d: [3, 9], r: [1, 2] }, derive: [{ name: "n", expr: "q*d+r" }],
        prompt: "Räkna ut {n} delat med {d}. Skriv svaret med rest, till exempel 5 r 2.", answer: ["{q} r {r}", "{q} rest {r}"],
        correct: "Rätt! {d} · {q} = {q*d}, och {r} blir över.", feedback: [{ answers: ["=q"], message: "Du har glömt resten." }] }
    },
    {
      id: "brak", label: "Förkorta bråk (svarsform)", note: "form: forenklat avvisar ett rätt men ofullständigt förkortat svar. Svaret skrivs som a/b.",
      template: { vars: { a: [1, 5], b: [6, 9], k: [2, 5] }, where: [{ expr: "sgd(a,b)", max: 1 }],
        prompt: "Förkorta {a*k}/{b*k} så långt det går.", form: "forenklat", answer: ["{a}/{b}"], correct: "Rätt! Dela täljare och nämnare med {k}: {a}/{b}.",
        feedback: [{ answers: ["{a}/{b*k}"], message: "Du har bara delat täljaren. Dela både täljare och nämnare med {k}." }] }
    },
    {
      id: "uttryck", label: "Uttryck som svar (utan parentes)", note: "Svaret är ett uttryck med x. Rättningen jämför uttryck som algebra, så 3x+12 och 12+3x är lika. form: utanparentes kräver att parentesen är utmultiplicerad. keys ger en tangent för ^.",
      template: { vars: { a: [2, 9], b: [1, 9] }, prompt: "Förenkla {a}(x + {b}).", form: "utanparentes", keys: ["^"], answer: ["{a}x + {a*b}"],
        correct: "Rätt! {a} · x = {a}x och {a} · {b} = {a*b}.", feedback: [{ answers: ["{a}x + {b}"], message: "Multiplicera {a} med båda termerna i parentesen." }] }
    },
    {
      id: "grundpotens", label: "Grundpotensform", note: "Små tal som 0,0042 skrivs ut med alla decimaler. form: grundpotens kräver ett tal från 1 upp till 10 gånger en tiopotens. Skriv exponenten som 10^{e} i svaret.",
      template: { vars: { a: [11, 99], e: [3, 6] }, derive: [{ name: "n", expr: "a*pow(10,e-1)" }],
        prompt: "Skriv {n} i grundpotensform. Skriv · som * och upphöjt med ^, till exempel 3,5*10^4.", form: "grundpotens", answer: ["{a/10}·10^{e}", "{a/10}*10^{e}"],
        correct: "Rätt! {n} = {a/10} · 10^{e}.", feedback: [{ answers: ["{a/10}*10^{e-1}", "{a/10}·10^{e-1}"], message: "Räkna stegen igen." }] }
    },
    {
      id: "ekvation", label: "Ekvation (svar kan skrivas som x = 4)", note: "Skriv flera svar: bara talet och x = talet. Slumpa x först och bygg ekvationen baklänges, så blir svaret alltid ett heltal.",
      template: { vars: { x: [1, 12], a: [2, 9], b: [1, 15] }, derive: [{ name: "c", expr: "a*x+b" }],
        prompt: "Lös ekvationen {a}x + {b} = {c}.", answer: ["=x", "x={x}", "x = {x}"], correct: "Rätt! {a}x = {c-b}, så x = {x}.",
        steps: ["Ta bort {b} från båda sidor: {a}x = {c-b}.", "Dela båda sidor med {a}: x = {x}."],
        feedback: [{ answers: ["=c-b"], message: "{c-b} är {a}x. Dela med {a}." }] }
    },
    {
      id: "staplar", label: "Figur: stapeldiagram", note: "visual är en figur där \"=a\" hämtar slumptalet a. Figurtyperna finns i README (tabellen över figurer).",
      template: { vars: { a: [3, 12], b: [3, 12], c: [3, 12] }, derive: [{ name: "s", expr: "a+b+c" }],
        prompt: "Titta på diagrammet. Hur många är det sammanlagt?", visual: { type: "staplar", data: [{ label: "Äpple", value: "=a" }, { label: "Banan", value: "=b" }, { label: "Päron", value: "=c" }], max: 14 },
        answer: ["=s"], correct: "Rätt! {a} + {b} + {c} = {s}.", feedback: [{ answers: ["=max(a,b,c)"], message: "Det är den högsta stapeln. Lägg ihop alla tre." }] }
    },
    {
      id: "graf", label: "Figur: linje i koordinatsystem", note: "En graf med lines: [{ k, m }]. Eleven läser av värdet. where (k*k minst 1) undviker en vågrät linje.",
      template: { vars: { k: [-3, 3], m: [-5, 5] }, where: [{ expr: "k*k", min: 1 }], prompt: "Titta på linjen. Var skär den y-axeln? Svara med y-värdet.",
        visual: { type: "graf", xmin: -4, xmax: 4, ymin: -8, ymax: 8, lines: [{ k: "=k", m: "=m" }] }, answer: ["=m"], correct: "Rätt! Linjen skär y-axeln där y = {m}.",
        feedback: [{ answers: ["=k"], message: "{k} är lutningen. Titta på var linjen korsar den lodräta axeln." }] }
    },
    {
      id: "klocka", label: "Figur: klocka", note: "Slumpa timme och minut och visa dem på en analog klocka.",
      template: { vars: { h: [1, 12], m: [0, 55, 5] }, prompt: "Vad är klockan? Skriv med siffror, till exempel 3:15.", visual: { type: "klocka", h: "=h", m: "=m" },
        answer: ["{h}:{m|2}"], correct: "Rätt! Klockan är {h}:{m|2}.", feedback: [] }
    },
    {
      id: "trig", label: "Trigonometri (grader)", note: "sin, cos, tan, asin, acos och atan räknar i grader. Runda svaret med round(x*10)/10 och välj bort tal nära en avrundningsgräns med where.",
      template: { vars: { h: [8, 30], v: [20, 70, 5] }, where: [{ expr: "abs(mod(h*sin(v)*100,10)-5)", min: 0.5 }], derive: [{ name: "r", expr: "round(h*sin(v)*10)/10" }],
        prompt: "Hypotenusan är {h} cm och vinkeln är {v}°. Hur lång är den motstående katetern? Svara med en decimal.", visual: { type: "trigonometri", angle: "=v", names: false, labels: { hyp: "{h} cm", opp: "x", angle: "{v}°" } },
        answer: ["=r"], correct: "Rätt! {h} · sin {v}° ≈ {r} cm.", feedback: [{ answers: ["=round(h*cos(v)*10)/10"], message: "Du har använt cos. Den motstående katetern hör ihop med sin." }] }
    },
    {
      id: "sf-tal", label: "Sant eller falskt: påståenden med slumptal", note: "Ett Sant/falskt-uppdrag där talen slumpas. answer är true eller false, eller ett villkor { expr, min, max } när sanningen beror på talen. Blanda sanna och falska påståenden. Ordningen är den du skriver.",
      template: { vars: { a: [12, 49], b: [12, 49] }, derive: [{ name: "s", expr: "a+b" }], prompt: "Sant eller falskt?",
        statements: [
          { text: "{a} + {b} = {s}", answer: true },
          { text: "{a} + {b} = {s+10}", answer: false, explain: "{a} + {b} är {s}, inte {s+10}." },
          { text: "{a} är större än {b}", answer: { expr: "a-b", min: 1 }, explain: "Jämför {a} och {b} siffra för siffra." }
        ] }
    },
    {
      id: "sortera-lista", label: "Sortera: saker i två grupper", note: "Ett Sortera-uppdrag. Varje gång dras size saker ur listan, med några från varje grupp. category är gruppens nummer (från 0).",
      template: { mode: "sortera", size: 6, prompt: "Sortera talen: är de jämna eller udda?", categories: ["Jämna", "Udda"],
        pool: [{ text: "14", category: 0, explain: "14 slutar på 4, alltså jämnt." }, { text: "27", category: 1, explain: "27 slutar på 7, alltså udda." }, { text: "30", category: 0 }, { text: "45", category: 1 },
          { text: "52", category: 0 }, { text: "63", category: 1 }, { text: "18", category: 0 }, { text: "71", category: 1 }] }
    },
    {
      id: "ordna-lista", label: "Ordna: tal som ska stå i ordning", note: "Ett Ordna-uppdrag. Varje gång dras size saker med olika value ur listan, och rätt ordning är den efter value.",
      template: { mode: "ordna", size: 4, prompt: "Sätt talen i ordning, det minsta först.", top: "Minst", bottom: "Störst",
        pool: [{ text: "53", value: 53 }, { text: "305", value: 305 }, { text: "350", value: 350 }, { text: "503", value: 503 }, { text: "35", value: 35 }, { text: "530", value: 530 }] }
    },
    {
      id: "hitta-felet-lista", label: "Hitta felet: lösningar med ett fel", note: "Ett Hitta felet-uppdrag. Varje gång dras en lösning ur listan. wrong är det felaktiga stegets nummer (från 0).",
      template: { mode: "hittafelet", prompt: "Vilket steg är fel?",
        pool: [{ steps: ["3x + 2 = 14", "3x = 14 + 2", "3x = 16", "x = 16/3"], wrong: 1, explain: "Du tar bort 2 på båda sidor: 14 − 2.", fix: "3x = 12 och x = 4", hint: "Vad gör du med 2:an?" },
          { steps: ["2x + 5 = 19", "2x = 19 − 5", "2x = 14", "x = 14 · 2"], wrong: 3, explain: "Du delar med 2: x = 14/2 = 7.", fix: "x = 7" },
          { steps: ["x + 4 = 9", "x = 9 + 4", "x = 13"], wrong: 1, explain: "Du tar bort 4 på båda sidor: 9 − 4.", fix: "x = 5" },
          { steps: ["x − 3 = 5", "x = 5 − 3", "x = 2"], wrong: 1, explain: "Du lägger till 3 på båda sidor: 5 + 3.", fix: "x = 8" },
          { steps: ["2x = 12", "x = 12 · 2", "x = 24"], wrong: 1, explain: "Du delar med 2: 12/2.", fix: "x = 6" }] }
    },
    {
      id: "luckor-tal", label: "Fyll i luckorna: text med slumptal", note: "Ett Fyll i luckorna-uppdrag där talen slumpas. Luckorna skrivs [[1]], [[2]] ... och rätt svar som uttryck. Ett svar kan vara flera: [\"=a*7\", \"sju\"].",
      template: { mode: "lucktext", vars: { w: [2, 9], d: [2, 6] }, prompt: "Fyll i luckorna om tid.", text: "{w} veckor är [[1]] dagar. {d} dygn är [[2]] timmar.", blanks: [{ answer: ["=w*7"] }, { answer: ["=d*24"], hint: "Ett dygn är 24 timmar." }] }
    },
    {
      id: "sf-ord", label: "Sant eller falskt: ordlista (begrepp)", note: "Ett Sant/falskt-uppdrag av en lista påståenden. Varje gång väljs size stycken slumpmässigt, med både sanna och falska när listan har båda. Bra för begreppslektioner: lägg till ett sant och ett falskt påstående per begrepp.",
      template: { mode: "santfalskt", size: 4, prompt: "Sant eller falskt?",
        pool: [
          { text: "En triangel har tre sidor.", answer: true, explain: "Tri betyder tre." },
          { text: "En kvadrat har tre hörn.", answer: false, explain: "En kvadrat har fyra hörn." },
          { text: "En cirkel har inga raka sidor.", answer: true, explain: "En cirkel är rund." },
          { text: "En rektangel har fem sidor.", answer: false, explain: "En rektangel har fyra sidor." },
          { text: "En sexhörning har sex hörn.", answer: true, explain: "Sex sidor och sex hörn." },
          { text: "En femhörning har fyra sidor.", answer: false, explain: "En femhörning har fem sidor." }
        ] }
    },
    {
      id: "ord", label: "Ord som svar (större eller mindre)", note: "Svaret kan vara ett ord. Lägg slumpord i pick så att frågorna blir olika.",
      template: { pick: { namn: ["Mira", "Omar", "Elsa", "Hugo"] }, vars: { a: [3, 50], b: [1, 9] }, prompt: "{$namn} räknar {a} · 0,{b}. Blir svaret större eller mindre än {a}? Skriv större eller mindre.",
        answer: ["mindre"], correct: "Rätt! 0,{b} är mindre än 1, så svaret blir mindre än {a}.", feedback: [{ answers: ["större"], message: "När du multiplicerar med ett tal under 1 blir svaret mindre." }] }
    }
  ];

  // figures the template can show; "=a" and "{a}" are replaced by the question's numbers
  const FIGURES = [
    { label: "Stapeldiagram", json: { type: "staplar", data: [{ label: "A", value: "=a" }, { label: "B", value: "=b" }], max: 12 } },
    { label: "Graf med linje", json: { type: "graf", xmin: -4, xmax: 4, ymin: -8, ymax: 8, lines: [{ k: "=a", m: "=b" }] } },
    { label: "Klocka", json: { type: "klocka", h: "=h", m: "=m" } },
    { label: "Tallinje med punkt", json: { type: "tallinje", min: 0, max: 20, step: 1, points: [{ value: "=a", label: "?" }] } },
    { label: "Rektangel med sidor", json: { type: "rektangel", w: "=a", h: "=b", unit: "cm" } },
    { label: "Triangel", json: { type: "triangel", base: "=a", height: "=b", unit: "cm", showHeight: true } },
    { label: "Vinkel", json: { type: "vinkel", deg: "=a" } },
    { label: "Hundrarutor", json: { type: "hundrarutor", filled: "=a" } },
    { label: "Strecktabell", json: { type: "strecktabell", rows: [{ label: "Kull", n: "=a" }, { label: "Tafatt", n: "=b" }] } },
    { label: "Uppställning", json: { type: "uppstallning", op: "+", a: "=a", b: "=b" } },
    { label: "Trigonometri (triangel)", json: { type: "trigonometri", angle: "=v", labels: { hyp: "{h} cm", opp: "x", angle: "{v}°" } } },
    { label: "Balansvåg", json: { type: "vag", left: [{ n: "=a", tone: "x" }], right: [{ n: "=b" }] } }
  ];

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

  function input(value, placeholder, onInput, type) {
    const i = el("input");
    i.type = type || "text";
    if (type === "number") i.step = "any";
    if (placeholder) i.placeholder = placeholder;
    i.value = value === undefined || value === null ? "" : value;
    i.addEventListener("input", function () { onInput(i.value, i); });
    return i;
  }

  function textarea(value, rows, placeholder, onInput) {
    const t = el("textarea");
    t.rows = rows;
    if (placeholder) t.placeholder = placeholder;
    t.value = value || "";
    t.addEventListener("input", function () { onInput(t.value); });
    return t;
  }

  function section(title, hint) {
    const box = el("div", "pe-section");
    box.appendChild(el("h5", "pe-title", title));
    if (hint) box.appendChild(el("p", "le-hint", hint));
    return box;
  }

  function lines(text) { return String(text || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); }

  function num(v) { return v === "" || v === undefined || v === null || isNaN(Number(v)) ? undefined : Number(v); }

  function PR() { return window.GaussicaPractice; }

  // The templates of the new formats (see formats.js): a list to draw from (sortera, ordna, hittafelet) or numbers in a text with gaps (lucktext).
  // They are edited as JSON, and checked here by making questions and asking the format what is wrong with them.
  const FORMAT_MODES = { sortera: "so", ordna: "or", hittafelet: "hf", lucktext: "lt" };
  const FORMAT_NAMES = { sortera: "Sortera", ordna: "Ordna", hittafelet: "Hitta felet", lucktext: "Fyll i luckorna" };
  function isFormat(t) { return Boolean(t && FORMAT_MODES[t.mode]); }

  function checkFormat(t) {
    const errors = [], warnings = [];
    const FM = window.GaussicaFormats;
    if (t.mode !== "lucktext" && (!Array.isArray(t.pool) || t.pool.length < 2)) errors.push("Listan (pool) behöver minst två " + (t.mode === "hittafelet" ? "lösningar." : "saker."));
    if (t.mode === "lucktext" && (typeof t.text !== "string" || !Array.isArray(t.blanks) || !t.blanks.length)) errors.push("Texten med luckor (text, med [[1]], [[2]] ...) och blanks krävs.");
    if (errors.length || !PR() || !FM) return { errors: errors, warnings: warnings };
    const N = 100;
    let fails = 0;
    const variants = new Set();
    const said = {};
    for (let i = 0; i < N; i++) {
      const q = PR().build(t, 1000 + i * 7919);
      if (!q) { fails += 1; continue; }
      variants.add(JSON.stringify([q.items, q.steps, q.text, q.blanks]));
      FM.problems(Object.assign({}, q, { type: q.format })).forEach(function (m) { if (!said[m]) { said[m] = true; errors.push(FORMAT_NAMES[t.mode] + ": " + m + "."); } });
      if ((/NaN|undefined|Infinity/.test([q.items, q.steps, q.text, q.blanks].filter(function (x) { return x !== undefined; }).map(function (x) { return JSON.stringify(x); }).join(" ")) || /\[\[|\]\]/.test(String(q.text || ""))) && !said.unresolved) { said.unresolved = true; errors.push("Något i texten blev inte ifyllt. Kontrollera namnen på slumptalen."); }
    }
    if (fails === N) errors.push("Det går inte att skapa en enda fråga. Kontrollera listan och villkoren.");
    else if (fails > N * 0.2) warnings.push("Det misslyckades att skapa en fråga i " + fails + " av " + N + " försök.");
    if (variants.size < 5 && fails < N) warnings.push("Frågorna blir för lika: bara " + variants.size + " olika på " + N + " försök. Lägg till fler i listan eller bredare talintervall.");
    if (t.mode === "sortera" && Array.isArray(t.pool) && t.categories && t.categories.length) {
      const per = t.categories.map(function (c, k) { return t.pool.filter(function (p) { return (typeof p.category === "number" ? p.category : t.categories.map(String).indexOf(String(p.category))) === k; }).length; });
      if (Math.min.apply(null, per) < 2) warnings.push("Någon grupp har färre än två saker i listan, så varje runda ser likadan ut.");
    }
    return { errors: errors, warnings: warnings };
  }

  const BUILTIN = new Set(["abs", "sqrt", "round", "floor", "ceil", "min", "max", "pow", "lg", "ln", "log", "exp", "mod", "sgd", "divcount", "isprime", "primecount", "nextprime", "fact", "sin", "cos", "tan", "asin", "acos", "atan", "pi"]);

  // Names written in {…}, in "=…" answers and in uträkningar that are neither a random number, a calculated value nor a random word.
  function unknownNames(t) {
    const known = new Set(Object.keys(t.vars || {}).concat((t.derive || []).map(function (d) { return d.name; })));
    const picks = new Set(Object.keys(t.pick || {}));
    const missing = new Set();
    const scan = function (expr) {
      String(expr).split("|")[0].replace(/[0-9]+(?:.[0-9]+)?/g, " ").replace(/[A-Za-zåäöÅÄÖ_][A-Za-z0-9_åäöÅÄÖ]*/g, function (name) {
        if (!known.has(name) && !BUILTIN.has(name)) missing.add(name);
        return name;
      });
    };
    const text = function (s) {
      String(s || "").replace(/{([^}]*)}/g, function (m, inner) {
        if (inner.charAt(0) === "$") { if (!picks.has(inner.slice(1))) missing.add("$" + inner.slice(1)); } else scan(inner);
        return m;
      });
    };
    [t.prompt, t.correct].forEach(text);
    (t.steps || []).forEach(text);
    (t.statements || []).forEach(function (s) {
      text(s.text); text(s.explain);
      if (typeof s.answer === "string" && s.answer.charAt(0) === "=") scan(s.answer.slice(1));
      if (s.answer && typeof s.answer === "object") scan(s.answer.expr || "");
    });
    (t.answer || []).forEach(function (a) { text(a); if (String(a).charAt(0) === "=") scan(String(a).slice(1)); });
    (t.feedback || []).forEach(function (f) { text(f.message); (f.answers || []).forEach(function (a) { text(a); if (String(a).charAt(0) === "=") scan(String(a).slice(1)); }); });
    (t.derive || []).forEach(function (d) { scan(d.expr || ""); });
    (t.where || []).forEach(function (w) { scan(w.expr || ""); });
    return Array.from(missing);
  }

  // ----- checks (the same ideas as tests/practice.js, in plain Swedish) -----
  function check(t) {
    const errors = [], warnings = [];
    const isPool = Array.isArray(t.pool);
    if (!t.id || !ID_RE.test(t.id)) errors.push("Mallens namn får bara ha bokstäver, siffror, bindestreck och understreck.");
    if (isFormat(t)) { const r = checkFormat(t); return { errors: errors.concat(r.errors), warnings: r.warnings }; }
    if (isPool) {
      if (t.pool.length < 2) errors.push(t.mode === "santfalskt" ? "En sant/falskt-lista behöver minst två påståenden." : "En begreppsmall behöver minst två begrepp.");
      if (t.mode === "santfalskt") {
        t.pool.forEach(function (p, i) {
          if (!p || !String(p.text || "").trim()) errors.push("Påstående " + (i + 1) + " i listan saknar text.");
          else if (typeof p.answer !== "boolean") errors.push("Påstående " + (i + 1) + " i listan: answer ska vara true eller false.");
        });
        if (t.pool.length > 1 && t.pool.every(function (p) { return p && p.answer === t.pool[0].answer; })) warnings.push("Alla påståenden har samma svar, så det är lätt att gissa. Lägg till både sanna och falska.");
      }
      return { errors: errors, warnings: warnings };
    }
    const isStatements = Array.isArray(t.statements);
    if (isStatements) {
      if (!t.statements.length) errors.push("Minst ett påstående krävs.");
      t.statements.forEach(function (s, i) {
        if (!s || !String(s.text || "").trim()) errors.push("Påstående " + (i + 1) + " saknar text.");
        else if (s.answer === undefined || s.answer === null || s.answer === "") errors.push("Påstående " + (i + 1) + " saknar rätt svar (true, false eller ett villkor).");
      });
    } else {
      if (!t.prompt || !String(t.prompt).trim()) errors.push("Frågan saknas.");
      if (!Array.isArray(t.answer) || !t.answer.some(function (a) { return String(a).trim(); })) errors.push("Minst ett rätt svar krävs.");
    }
    unknownNames(t).forEach(function (n) {
      errors.push(n.charAt(0) === "$" ? "Frågan använder {" + n + "}, men det finns inget slumpord som heter " + n.slice(1) + "." : "\"" + n + "\" används, men det finns inget slumptal eller uträknat värde med det namnet.");
    });
    if (errors.length || !PR()) return { errors: errors, warnings: warnings };
    const M = window.MATTE_SYMBOLIC;
    const N = 200;
    let fails = 0;
    const prompts = new Set();
    const seen = {};
    const once = function (key, list, msg) { if (!seen[key]) { seen[key] = true; list.push(msg); } };
    for (let i = 0; i < N; i++) {
      const q = PR().build(t, 1000 + i * 7919);
      if (!q) { fails += 1; continue; }
      prompts.add(q.prompt + JSON.stringify(q.visual || "") + JSON.stringify(q.statements || ""));
      const strings = [q.prompt, q.correct].concat(q.solution || []).concat(q.answer).concat(q.feedback.map(function (f) { return f.message; }))
        .concat((q.statements || []).reduce(function (all, s) { return all.concat([s.text, s.explain || ""]); }, []));
      if (strings.some(function (s) { return /NaN|undefined|Infinity|[{}$]/.test(s); })) once("unresolved", errors, "Något i texten blev inte ifyllt (\"" + q.prompt + "\"). Kontrollera namnen på slumptal och uträknade värden.");
      if (strings.some(function (s) { return /×|—/.test(s); })) once("hygiene", warnings, "Använd · (gångerpunkten) i stället för × och undvik långa tankstreck.");
      if (M) {
        q.answer.forEach(function (a) { if (!M.areEquivalent(a, a)) once("self", errors, "Svaret \"" + a + "\" godtas inte ens när eleven skriver det precis så. Kontrollera stavning och tecken."); });
        q.feedback.forEach(function (f) { f.answers.forEach(function (w) { q.answer.forEach(function (a) {
          if (M.areEquivalent(w, a)) once("hint", errors, "Felsvaret \"" + w + "\" är samma sak som ett rätt svar (frågan \"" + q.prompt + "\").");
        }); }); });
      }
      if (q.answer.some(function (a) { return a === "?"; })) once("q", errors, "Ett svar blev \"?\". Kontrollera uttrycken.");
    }
    if (fails === N) errors.push("Det går inte att skapa en enda fråga. Villkoren (where) är för stränga, eller ett uttryck har fel.");
    else if (fails > N * 0.2) warnings.push("Det misslyckades att skapa en fråga i " + fails + " av " + N + " försök. Villkoren är ganska stränga, så frågor tar längre tid att skapa.");
    if (!fails || fails < N) {
      if (prompts.size < 5) warnings.push("Frågorna blir för lika: bara " + prompts.size + " olika på " + N + " försök. Lägg till slumpord eller bredare talintervall.");
    }
    return { errors: errors, warnings: warnings };
  }

  function problems(lesson) {
    const out = [];
    (lesson && Array.isArray(lesson.practice) ? lesson.practice : []).forEach(function (t) {
      const r = check(t);
      r.errors.forEach(function (e) { out.push("Övningsmall \"" + (t.id || "utan namn") + "\": " + e); });
    });
    const ids = {};
    (lesson && lesson.practice || []).forEach(function (t) { if (ids[t.id]) out.push("Två övningsmallar heter \"" + t.id + "\"."); ids[t.id] = true; });
    return out;
  }

  // ----- turning the rows of the form back into the template -----
  function varsOf(rows) {
    const out = {};
    rows.forEach(function (r) {
      const min = num(r.min), max = num(r.max), step = num(r.step);
      if (!NAME_RE.test(r.name || "") || min === undefined || max === undefined) return;
      out[r.name] = step !== undefined && step > 0 ? [min, max, step] : [min, max];
    });
    return out;
  }

  function pickOf(rows) {
    const out = {};
    rows.forEach(function (r) {
      const list = String(r.text || "").split(/[\n;,]/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (NAME_RE.test(r.name || "") && list.length) out[r.name] = list;
    });
    return out;
  }

  function clean(list) {
    return (list || []).map(function (src) {
      const t = JSON.parse(JSON.stringify(src));
      if (!Array.isArray(t.pool)) {
        if (Array.isArray(t.derive)) t.derive = t.derive.filter(function (d) { return d.name && d.expr; });
        if (Array.isArray(t.where)) t.where = t.where.filter(function (w) { return w.expr; });
        if (Array.isArray(t.feedback)) t.feedback = t.feedback.filter(function (f) { return f.answers && f.answers.length && f.message; });
        if (t.vars && !Object.keys(t.vars).length) delete t.vars;
        if (t.pick && !Object.keys(t.pick).length) delete t.pick;
        ["derive", "where", "feedback", "for", "keys"].forEach(function (k) { if (Array.isArray(t[k]) && !t[k].length) delete t[k]; });
        if (Array.isArray(t.answer)) t.answer = t.answer.map(function (a) { return String(a).trim(); }).filter(Boolean);
        if (Array.isArray(t.steps)) t.steps = t.steps.map(function (s) { return String(s).trim(); }).filter(Boolean);
        if (Array.isArray(t.steps) && !t.steps.length) delete t.steps;
        if (!t.form) delete t.form;
        if (!t.visual) delete t.visual;
        if (!t.correct || !String(t.correct).trim()) delete t.correct;
      }
      return t;
    }).filter(function (t) { return t.id; });
  }

  // ----- the form for one template -----
  function rowsHeader(labels) {
    const h = el("div", "pe-row pe-row-head");
    labels.forEach(function (l) { h.appendChild(el("span", "", l)); });
    return h;
  }

  function uniqueId(list, base) {
    const taken = new Set(list.map(function (t) { return t.id; }));
    let id = base, n = 2;
    while (taken.has(id)) id = base + "-" + n++;
    return id;
  }

  function templateCard(t, i, ctx, list) {
    const card = el("details", "pe-card");
    card.open = ctx.open[t.id] !== undefined ? ctx.open[t.id] : list.length === 1;
    card.addEventListener("toggle", function () { ctx.open[t.id] = card.open; });
    const isPool = Array.isArray(t.pool) || Array.isArray(t.statements) || isFormat(t);   // edited as JSON, not in the form

    const sum = el("summary", "pe-sum");
    sum.append(el("span", "pe-sum-id", t.id || "utan namn"), el("span", "pe-sum-text", Array.isArray(t.statements) ? "Sant eller falskt (påståenden)" : t.mode === "santfalskt" ? "Sant eller falskt (lista)" : isFormat(t) ? FORMAT_NAMES[t.mode] + " (" + (t.prompt || "") + ")" : isPool ? "Begreppsmall" : (t.prompt || "")));
    card.appendChild(sum);
    const body = el("div", "pe-body");
    card.appendChild(body);

    const bar = el("div", "pe-bar");
    bar.append(
      field("Namn på mallen", input(t.id, "t.ex. summa", function (v) { t.id = v.trim(); ctx.changed(); updateSummary(); })),
      el("span"));
    const move = el("div", "pe-move");
    move.append(
      button("↑", "le-btn le-btn-small", function () { if (i > 0) { list.splice(i - 1, 0, list.splice(i, 1)[0]); ctx.changed(); ctx.redraw(); } }, "Flytta upp"),
      button("↓", "le-btn le-btn-small", function () { if (i < list.length - 1) { list.splice(i + 1, 0, list.splice(i, 1)[0]); ctx.changed(); ctx.redraw(); } }, "Flytta ned"),
      button("Kopiera", "le-btn le-btn-small", function () { const c = JSON.parse(JSON.stringify(t)); c.id = uniqueId(list, t.id + "-kopia"); list.splice(i + 1, 0, c); ctx.open[c.id] = true; ctx.changed(); ctx.redraw(); }),
      button("Ta bort", "le-btn le-btn-small le-btn-danger", function () {
        const removed = list.splice(i, 1)[0];
        ctx.changed(); ctx.redraw();
        ctx.toast("Mallen \"" + removed.id + "\" togs bort.", function () { list.splice(i, 0, removed); ctx.changed(); ctx.redraw(); });
      }));
    bar.appendChild(move);
    body.appendChild(bar);

    function updateSummary() {
      sum.querySelector(".pe-sum-id").textContent = t.id || "utan namn";
      const text = sum.querySelector(".pe-sum-text");
      if (!isPool) text.textContent = t.prompt || "";
    }

    const samples = el("div", "pe-samples");
    let timer = null;
    const refresh = function () {
      clearTimeout(timer);
      timer = setTimeout(function () { drawSamples(samples, t); }, 350);
    };
    const edited = function () { ctx.changed(); refresh(); };

    if (isFormat(t)) {
      body.appendChild(el("p", "le-hint", "Det här är en mall för " + FORMAT_NAMES[t.mode] + " (se README, avsnittet Nya format). Den ändras som JSON längst ned. " + (t.mode === "lucktext" ? "Luckorna skrivs [[1]], [[2]] ... och rätt svar som uttryck, till exempel \"=a*7\"." : "Varje gång dras några saker ur listan (pool).")));
      body.appendChild(forSection(t, ctx, edited));
    } else if (isPool) {
      body.appendChild(el("p", "le-hint", Array.isArray(t.statements) || t.mode === "santfalskt"
        ? "Det här är ett Sant/falskt-uppdrag. Påståendena ändras som JSON längst ned (se galleriet för ett exempel). Kontrollen och exemplen nedan fungerar som vanligt."
        : "Det här är en begreppsmall (para ihop eller fråga efter begrepp). Den fylls i av knappen \"Skapa av begreppskorten\" och kan ändras som JSON längst ned."));
    } else {
      body.appendChild(forSection(t, ctx, edited));
      body.appendChild(varsSection(t, edited));
      body.appendChild(pickSection(t, edited));
      body.appendChild(deriveSection(t, edited, ctx));
      body.appendChild(whereSection(t, edited, ctx));
      body.appendChild(questionSection(t, edited, updateSummary));
      body.appendChild(answerSection(t, edited));
      body.appendChild(mistakesSection(t, edited, ctx));
      body.appendChild(extraSection(t, edited));
    }
    body.appendChild(jsonSection(t, ctx, edited));
    body.appendChild(el("h5", "pe-title", "Exempel och kontroll"));
    body.appendChild(samples);
    drawSamples(samples, t);
    return card;
  }

  function field(label, control, hint) {
    const w = el("label", "le-field");
    w.appendChild(el("span", "le-label", label));
    w.appendChild(control);
    if (hint) w.appendChild(el("small", "le-hint", hint));
    return w;
  }

  function forSection(t, ctx, edited) {
    const box = section("Liknar uppgiften", "Vilka av lektionens uppgifter mallen motsvarar. Används när eleven ska repetera en uppgift som blev fel, så att rätt sorts övning väljs.");
    const wrap = el("div", "pe-checks");
    const tasks = ctx.tasks();
    if (!tasks.length) wrap.appendChild(el("p", "le-hint", "Lektionen har inga uppgifter än."));
    tasks.forEach(function (task) {
      const row = el("label", "le-check");
      const cb = el("input"); cb.type = "checkbox";
      cb.checked = (t["for"] || []).indexOf(task.id) >= 0;
      cb.addEventListener("change", function () {
        const set = new Set(t["for"] || []);
        if (cb.checked) set.add(task.id); else set.delete(task.id);
        t["for"] = Array.from(set);
        edited();
      });
      row.append(cb, el("span", "", task.label));
      wrap.appendChild(row);
    });
    box.appendChild(wrap);
    return box;
  }

  function varsSection(t, edited) {
    const box = section("Slumptal", "Talen som ändras varje gång. Ett namn, lägsta och högsta värde. Steg är valfritt: 10 till 100 med steg 10 ger bara tiotal.");
    let rows = Object.keys(t.vars || {}).map(function (k) { const r = t.vars[k]; return { name: k, min: r[0], max: r[1], step: r[2] }; });
    const list = el("div", "pe-rows");
    const write = function () { t.vars = varsOf(rows); edited(); };
    const draw = function () {
      list.replaceChildren();
      if (rows.length) list.appendChild(rowsHeader(["Namn", "Lägst", "Högst", "Steg", ""]));
      rows.forEach(function (r, idx) {
        const row = el("div", "pe-row");
        const name = input(r.name, "a", function (v, i) { r.name = v.trim(); i.classList.toggle("is-bad", Boolean(v.trim()) && !NAME_RE.test(v.trim())); write(); });
        row.append(name,
          input(r.min, "10", function (v) { r.min = v; write(); }, "number"),
          input(r.max, "99", function (v) { r.max = v; write(); }, "number"),
          input(r.step, "1", function (v) { r.step = v; write(); }, "number"),
          button("✕", "le-btn le-btn-small le-btn-danger", function () { rows.splice(idx, 1); write(); draw(); }, "Ta bort slumptalet"));
        list.appendChild(row);
      });
    };
    draw();
    box.append(list, button("+ Slumptal", "le-btn le-btn-small", function () {
      const used = new Set(rows.map(function (r) { return r.name; }));
      const next = ["a", "b", "c", "d", "e", "k", "m", "n", "p", "q"].find(function (c) { return !used.has(c); }) || "x" + rows.length;
      rows.push({ name: next, min: 1, max: 20 }); write(); draw();
    }));
    return box;
  }

  function pickSection(t, edited) {
    const box = section("Slumpord", "Ord eller namn som slumpas. Skriv {$namn} i frågan. Skilj alternativen med komma eller ny rad.");
    let rows = Object.keys(t.pick || {}).map(function (k) { return { name: k, text: t.pick[k].join(", ") }; });
    const list = el("div", "pe-rows");
    const write = function () { t.pick = pickOf(rows); edited(); };
    const draw = function () {
      list.replaceChildren();
      rows.forEach(function (r, idx) {
        const row = el("div", "pe-row pe-row-pick");
        row.append(
          input(r.name, "namn", function (v, i) { r.name = v.trim(); i.classList.toggle("is-bad", Boolean(v.trim()) && !NAME_RE.test(v.trim())); write(); }),
          input(r.text, "Mira, Omar, Elsa", function (v) { r.text = v; write(); }),
          button("✕", "le-btn le-btn-small le-btn-danger", function () { rows.splice(idx, 1); write(); draw(); }, "Ta bort slumpordet"));
        list.appendChild(row);
      });
    };
    draw();
    box.append(list, button("+ Slumpord", "le-btn le-btn-small", function () {
      rows.push({ name: rows.length ? "sak" + rows.length : "namn", text: "Mira, Omar, Elsa, Hugo" }); write(); draw();
    }));
    return box;
  }

  function deriveSection(t, edited) {
    const box = section("Uträknade värden", "Värden som räknas ut av slumptalen, i ordning. Uttryck: + - * / ^ samt abs sqrt round floor ceil min max pow mod sgd, och sin cos tan (grader). Exempel: s = a+b.");
    let rows = (t.derive || []).map(function (d) { return { name: d.name, expr: d.expr }; });
    const list = el("div", "pe-rows");
    const write = function () { t.derive = rows.filter(function (r) { return NAME_RE.test(r.name || "") && r.expr; }).map(function (r) { return { name: r.name, expr: r.expr }; }); edited(); };
    const draw = function () {
      list.replaceChildren();
      rows.forEach(function (r, idx) {
        const row = el("div", "pe-row pe-row-derive");
        row.append(
          input(r.name, "s", function (v, i) { r.name = v.trim(); i.classList.toggle("is-bad", Boolean(v.trim()) && !NAME_RE.test(v.trim())); write(); }),
          el("span", "pe-eq", "="),
          input(r.expr, "a+b", function (v) { r.expr = v; write(); }),
          button("✕", "le-btn le-btn-small le-btn-danger", function () { rows.splice(idx, 1); write(); draw(); }, "Ta bort värdet"));
        list.appendChild(row);
      });
    };
    draw();
    box.append(list, button("+ Uträknat värde", "le-btn le-btn-small", function () { rows.push({ name: "s", expr: "" }); draw(); }));
    return box;
  }

  function whereSection(t, edited) {
    const box = section("Villkor", "Väljer bort tal som inte passar. Uttrycket måste vara minst (och/eller högst) ett värde. Exempel: a-b minst 1 betyder att a är större än b.");
    let rows = (t.where || []).map(function (w) { return { expr: w.expr, min: w.min, max: w.max }; });
    const list = el("div", "pe-rows");
    const write = function () {
      t.where = rows.filter(function (r) { return r.expr; }).map(function (r) {
        const w = { expr: r.expr };
        if (num(r.min) !== undefined) w.min = num(r.min);
        if (num(r.max) !== undefined) w.max = num(r.max);
        if (w.min === undefined && w.max === undefined) w.equals = 0;
        return w;
      });
      edited();
    };
    const draw = function () {
      list.replaceChildren();
      if (rows.length) list.appendChild(rowsHeader(["Uttryck", "Minst", "Högst", ""]));
      rows.forEach(function (r, idx) {
        const row = el("div", "pe-row pe-row-where");
        row.append(
          input(r.expr, "a-b", function (v) { r.expr = v; write(); }),
          input(r.min, "1", function (v) { r.min = v; write(); }, "number"),
          input(r.max, "", function (v) { r.max = v; write(); }, "number"),
          button("✕", "le-btn le-btn-small le-btn-danger", function () { rows.splice(idx, 1); write(); draw(); }, "Ta bort villkoret"));
        list.appendChild(row);
      });
    };
    draw();
    box.append(list, button("+ Villkor", "le-btn le-btn-small", function () { rows.push({ expr: "", min: 1 }); draw(); }));
    return box;
  }

  function questionSection(t, edited, updateSummary) {
    const box = section("Frågan", "Skriv {a} där talet a ska stå, {$namn} för ett slumpord och {a+b} för en uträkning. Decimaler skrivs med komma. Bråk skrivs 1/2 och potenser x^2.");
    const area = textarea(t.prompt, 3, "Räkna ut {a} + {b}.", function (v) { t.prompt = v; edited(); updateSummary(); });
    box.appendChild(area);
    return box;
  }

  function answerSection(t, edited) {
    const box = section("Rätt svar", "Ett svar per rad. \"=s\" betyder talet s. Text får innehålla {uttryck}, till exempel \"{q} r {r}\". Skriv flera rader om fler skrivsätt ska godtas, till exempel \"5\" och \"5 kr\".");
    box.appendChild(textarea((t.answer || []).join("\n"), 3, "=s", function (v) { t.answer = lines(v); edited(); }));
    const correct = el("div");
    correct.appendChild(field("När svaret är rätt", textarea(t.correct, 2, "Rätt! {a} + {b} = {s}.", function (v) { t.correct = v; edited(); })));
    correct.appendChild(field("Lösningssteg (valfritt, ett per rad)", textarea((t.steps || []).join("\n"), 3, "{a} + {b}: börja med entalen",
      function (v) { const s = lines(v); if (s.length) t.steps = s; else delete t.steps; edited(); }),
      "Visas som ett löst exempel med andra tal när en elev har svarat fel två gånger. Skriv stegen med {namn} från mallen. Finns inga steg används texten ovan."));
    box.appendChild(correct);
    return box;
  }

  function mistakesSection(t, edited) {
    const box = section("Vanliga fel", "Ett felsvar som eleven ofta skriver, och vad eleven ska få veta. Felsvaret kan vara ett uttryck: \"=a+b\" betyder summan. Det är det som ger hjälp i stället för bara \"fel\".");
    let rows = (t.feedback || []).map(function (f) { return { answers: (f.answers || []).join("\n"), message: f.message || "" }; });
    const list = el("div", "pe-rows");
    const write = function () { t.feedback = rows.map(function (r) { return { answers: lines(r.answers), message: r.message }; }).filter(function (f) { return f.answers.length && f.message; }); edited(); };
    const draw = function () {
      list.replaceChildren();
      rows.forEach(function (r, idx) {
        const row = el("div", "pe-mistake");
        row.append(
          field("Felsvar (ett per rad)", textarea(r.answers, 2, "=a-b", function (v) { r.answers = v; write(); })),
          field("Meddelande till eleven", textarea(r.message, 2, "Du har tagit bort i stället för att lägga ihop.", function (v) { r.message = v; write(); })),
          button("Ta bort", "le-btn le-btn-small le-btn-danger", function () { rows.splice(idx, 1); write(); draw(); }));
        list.appendChild(row);
      });
    };
    draw();
    box.append(list, button("+ Vanligt fel", "le-btn le-btn-small", function () { rows.push({ answers: "", message: "" }); draw(); }));
    return box;
  }

  function extraSection(t, edited) {
    const box = el("details", "pe-extra");
    box.appendChild(el("summary", "", "Svarsform, extra tangenter och figur"));
    const form = el("select");
    FORMS.forEach(function (f) { const o = el("option", "", f.label); o.value = f.value; form.appendChild(o); });
    form.value = t.form || "";
    form.addEventListener("change", function () { if (form.value) t.form = form.value; else delete t.form; edited(); });
    box.appendChild(field("Svarsform", form, "Kräver att ett rätt svar skrivs på ett visst sätt. Eleven får ett tips om svaret är rätt men skrivet på fel sätt."));
    box.appendChild(field("Extra tangenter (komma emellan)", input((t.keys || []).join(", "), "^, √", function (v) { const k = v.split(",").map(function (s) { return s.trim(); }).filter(Boolean); if (k.length) t.keys = k; else delete t.keys; edited(); }),
      "Knappar under svarsrutan för tecken som är svåra att hitta, till exempel ^ och √."));
    box.appendChild(visualField(t, edited));
    return box;
  }

  function visualField(t, edited) {
    const wrap = el("div", "le-field");
    wrap.appendChild(el("span", "le-label", "Figur (JSON, valfritt)"));
    const pick = el("select");
    const first = el("option", "", "Sätt in en figur…"); first.value = ""; pick.appendChild(first);
    FIGURES.forEach(function (f, i) { const o = el("option", "", f.label); o.value = String(i); pick.appendChild(o); });
    const ta = el("textarea", "le-json"); ta.rows = 6; ta.spellcheck = false;
    ta.value = t.visual ? JSON.stringify(t.visual, null, 2) : "";
    const msg = el("p", "le-error"); msg.hidden = true;
    ta.addEventListener("input", function () {
      if (!ta.value.trim()) { delete t.visual; msg.hidden = true; edited(); return; }
      try { t.visual = JSON.parse(ta.value); msg.hidden = true; edited(); } catch (e) { msg.textContent = "Ogiltig JSON: " + e.message; msg.hidden = false; }
    });
    pick.addEventListener("change", function () {
      if (pick.value === "") return;
      t.visual = JSON.parse(JSON.stringify(FIGURES[Number(pick.value)].json));
      ta.value = JSON.stringify(t.visual, null, 2);
      pick.value = "";
      edited();
    });
    wrap.append(pick, ta, msg, el("small", "le-hint", "\"=a\" blir talet a och \"{a} cm\" blir text med talet. Namnen ska vara dina slumptal. Alla figurtyper och deras inställningar finns i README."));
    return wrap;
  }

  function jsonSection(t, ctx, edited) {
    const box = el("details", "pe-extra");
    box.appendChild(el("summary", "", "Avancerat: mallens JSON"));
    const ta = el("textarea", "le-json"); ta.rows = 12; ta.spellcheck = false;
    ta.value = JSON.stringify(t, null, 2);
    const msg = el("p", "le-error"); msg.hidden = true;
    ta.addEventListener("input", function () {
      try {
        const v = JSON.parse(ta.value);
        if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Det ska vara ett objekt.");
        Object.keys(t).forEach(function (k) { delete t[k]; });
        Object.assign(t, v);
        msg.textContent = "Ändringen är sparad. Stäng och öppna mallen igen för att se den i formuläret.";
        msg.hidden = false; msg.className = "le-hint";
        edited();
      } catch (e) { msg.className = "le-error"; msg.textContent = "Ogiltig JSON (ändringen används inte än): " + e.message; msg.hidden = false; }
    });
    box.append(el("p", "le-hint", "Här kan du ändra allt, även det formuläret inte har: till exempel allowExpression, mode och pool för begreppsmallar."), ta, msg);
    return box;
  }

  // ----- generated examples and the check -----
  function drawSamples(host, t) {
    host.replaceChildren();
    const res = check(t);
    const status = el("div", "pe-status " + (res.errors.length ? "is-bad" : res.warnings.length ? "is-warn" : "is-ok"));
    if (res.errors.length) status.appendChild(el("strong", "", "Det här behöver fixas:"));
    else if (res.warnings.length) status.appendChild(el("strong", "", "Fungerar, men:"));
    else status.appendChild(el("strong", "", "✓ Mallen ser bra ut. Testade 200 frågor utan problem."));
    const ul = el("ul");
    res.errors.forEach(function (e) { ul.appendChild(el("li", "", e)); });
    res.warnings.forEach(function (w) { ul.appendChild(el("li", "", w)); });
    if (ul.children.length) status.appendChild(ul);
    host.appendChild(status);
    if (res.errors.length || !PR()) return;

    const list = el("div", "pe-sample-list");
    let shown = 0;
    for (let tries = 0; tries < 30 && shown < 4; tries++) {
      const q = PR().build(t, Math.floor(Math.random() * 1e9) + 1);
      if (!q) continue;
      shown += 1;
      const card = el("div", "pe-sample");
      const prompt = el("p", "pe-sample-prompt");
      if (window.GaussicaText) window.GaussicaText.set(prompt, q.prompt); else prompt.textContent = q.prompt;
      card.appendChild(prompt);
      if (q.visual && window.GaussicaFigures && window.GaussicaFigures.supports(q.visual.type)) {
        const fig = window.GaussicaFigures.render(q.visual);
        if (fig) { fig.classList.add("pe-fig"); card.appendChild(fig); }
      }
      if (q.format && window.GaussicaFormats) card.appendChild(el("p", "le-hint", window.GaussicaFormats.summary(q)));
      if (q.pairs) card.appendChild(el("p", "le-hint", "Par: " + q.pairs.map(function (p) { return p.term; }).join(", ")));
      if (q.statements) {
        // a true/false round: every statement with its right answer
        q.statements.forEach(function (s, i) {
          const line = el("p", "pe-sample-answer");
          if (window.GaussicaText) window.GaussicaText.set(line, (i + 1) + ". " + s.text + "  →  " + (s.answer ? "Sant" : "Falskt"));
          else line.textContent = (i + 1) + ". " + s.text + "  →  " + (s.answer ? "Sant" : "Falskt");
          card.appendChild(line);
        });
      } else card.appendChild(el("p", "pe-sample-answer", "Rätt svar: " + q.answer.join("  ·  ")));
      q.feedback.slice(0, 3).forEach(function (f) { card.appendChild(el("p", "pe-sample-hint", "Om eleven svarar " + f.answers.join(" eller ") + ": " + f.message)); });
      list.appendChild(card);
    }
    host.appendChild(list);
    host.appendChild(button("Visa nya exempel", "le-btn le-btn-small", function () { drawSamples(host, t); }));
  }

  // ----- the whole pane -----
  function help() {
    const d = el("details", "pe-help");
    d.appendChild(el("summary", "", "Så fungerar övningsmallar"));
    const ul = el("ul");
    [
      "En mall skapar nya frågor med nya tal eller ord varje gång eleven trycker Öva mer. Du skriver frågan en gång och anger vad som slumpas.",
      "Börja med att välja en färdig mall i galleriet nedan som liknar det du vill ha, och ändra den. Du ser genast fyra exempel på frågor som mallen ger.",
      "Slumptal ger siffrorna, uträknade värden ger svaret, och villkor väljer bort tal som inte går (till exempel negativa svar). Vanliga fel ger eleven en förklaring i stället för bara \"fel\".",
      "Kontrollen under mallen testar 200 frågor. Den varnar om texten blir fel, om frågorna blir för lika och om ett felsvar är samma som ett rätt svar.",
      "Specialfall som figurer, svar som uttryck, bråk, grundpotens och trigonometri finns som färdiga mallar i galleriet. De används på samma sätt. Se även README, avsnittet Övningsmallar."
    ].forEach(function (s) { ul.appendChild(el("li", "", s)); });
    d.appendChild(ul);
    return d;
  }

  function gallery(ctx, list) {
    const box = el("details", "pe-gallery");
    box.appendChild(el("summary", "", "Galleri: färdiga mallar att utgå från"));
    box.appendChild(el("p", "le-hint", "Tryck \"Lägg till\" så hamnar mallen i listan ovan, där du ändrar talen och texten. Varje mall visar hur ett specialfall görs."));
    STARTERS.forEach(function (s) {
      const row = el("div", "pe-gallery-row");
      const text = el("div");
      text.append(el("strong", "", s.label), el("p", "le-hint", s.note));
      row.append(text, button("Lägg till", "le-btn le-btn-small", function () {
        const t = Object.assign({ id: uniqueId(list, s.id) }, JSON.parse(JSON.stringify(s.template)));
        const firstTask = ctx.tasks()[0];
        if (FORMAT_MODES[t.mode]) t["for"] = ctx.tasks().filter(function (x) { return x.id.indexOf(FORMAT_MODES[t.mode] + "-") === 0; }).map(function (x) { return x.id; });
        else if (Array.isArray(t.statements) || t.mode === "santfalskt") t["for"] = ctx.tasks().filter(function (x) { return /^sf-/.test(x.id); }).map(function (x) { return x.id; });   // review of a true/false task gives a true/false round
        else if (firstTask && !t["for"]) t["for"] = [firstTask.id];
        list.push(t);
        ctx.open[t.id] = true;
        ctx.changed();
        ctx.redraw();
        ctx.toast("Mallen \"" + t.id + "\" lades till. Ändra talen och texten.");
      }));
      box.appendChild(row);
    });
    return box;
  }

  function render(form, ctx) {
    const lesson = ctx.lesson();
    if (!Array.isArray(lesson.practice)) lesson.practice = [];
    const list = lesson.practice;
    ctx.open = ctx.open || {};
    form.appendChild(help());
    if (!list.length) form.appendChild(el("p", "le-hint", "Den här lektionen har inga övningsmallar än. Välj en i galleriet längre ned, eller tryck \"Ny tom mall\"."));
    list.forEach(function (t, i) { form.appendChild(templateCard(t, i, ctx, list)); });

    const actions = el("div", "pe-actions");
    actions.appendChild(button("+ Ny tom mall", "le-btn le-btn-small", function () {
      const t = { id: uniqueId(list, "mall"), vars: { a: [1, 20] }, prompt: "", answer: [], correct: "Rätt!" };
      const firstTask = ctx.tasks()[0];
      if (firstTask) t["for"] = [firstTask.id];
      list.push(t);
      ctx.open[t.id] = true;
      ctx.changed();
      ctx.redraw();
    }));
    if (ctx.fromCards) actions.appendChild(button("Skapa av begreppskorten", "le-btn le-btn-small", ctx.fromCards, "Fyller i en matchningsmall och en fråga-mall utifrån begreppskorten"));
    form.appendChild(actions);
    form.appendChild(gallery(ctx, list));
  }

  return { render: render, clean: clean, check: check, problems: problems, STARTERS: STARTERS, FIGURES: FIGURES };
}());
