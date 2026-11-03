// Common mistakes in numbers, recognised from the answer: when a wrong answer is exactly what a known misunderstanding gives, the student is told what
// probably happened and how to think instead, and the teacher or caregiver sees the pattern ("Att prata om"). symbolic-math.js recognises the mistakes
// of algebra (the chain rule, brackets, the order of operations); this file the ones of the lower and middle years:
//
//   addition and subtraction  forgetting to carry, taking the smaller digit from the larger, forgetting to borrow
//   multiplication            not moving the second line one place to the left, adding instead
//   fractions                 adding the numerators and the denominators, keeping one denominator
//   decimals                  "the longer number is the larger"
//   negative numbers          signs left out, minus and minus
//   percent                   forgetting to divide by 100, dividing by the percent
//   units                     the wrong factor between metre and centimetre, litre and decilitre and so on
//   place value               the digit instead of its value, the wrong place
//   time                      60 minutes in an hour, not 100
//
//   GaussicaMisconceptions.diagnose(raw, prompt, expected)  ->  { title, explanation } or null
//   (raw is what the student wrote, prompt the question, expected a right answer). Nothing is said unless the answer is exactly what the mistake gives.

(function (root) {
  "use strict";

  const NUMBER = "\\d{1,3}(?:[ \\u00a0]\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?";

  function toNumber(text) {
    const s = String(text).replace(/[  ]/g, "").replace(",", ".").replace("−", "-");
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  }

  function same(a, b) { return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9; }

  function shown(n) { return String(Math.round(n * 1e9) / 1e9).replace(".", ",").replace("-", "−"); }

  // a fraction written as a/b, or mixed as 1 3/4, as { n, d } (not simplified)
  function toFraction(text) {
    const s = String(text).trim();
    let m = /^(-?\d+)\s*\/\s*(\d+)$/.exec(s);
    if (m && Number(m[2]) !== 0) return { n: Number(m[1]), d: Number(m[2]) };
    m = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
    if (m && Number(m[3]) !== 0) return { n: Number(m[1]) * Number(m[3]) + Number(m[2]), d: Number(m[3]) };
    return null;
  }

  const sameFraction = (a, b) => Boolean(a && b) && a.n * b.d === b.n * a.d;

  const result = (title, explanation) => ({ title: title, explanation: explanation });

  // ----- two whole numbers and one sign: 358 + 176, 502 − 278, 23 · 14 -----
  function twoNumbers(prompt) {
    const re = new RegExp("(" + NUMBER + ")\\s*([+−·×*x:÷/-])\\s*(" + NUMBER + ")", "g");
    let m;
    while ((m = re.exec(prompt))) {
      const before = prompt.slice(0, m.index), after = prompt.slice(m.index + m[0].length);
      if (/[+−·×*÷\/-]\s*$/.test(before) || /^\s*[+−·×*÷\/-]\s*\d/.test(after)) return null;   // more than one sign: not one step
      if (/\d$/.test(before)) continue;
      return { a: toNumber(m[1]), op: m[2], b: toNumber(m[3]), sa: m[1], sb: m[3] };
    }
    return null;
  }

  function digits(n) { return String(Math.abs(n)).split("").map(Number); }

  // digit by digit, from the right, with f(upper, lower) for each place
  function byPlace(a, b, f) {
    const A = digits(a).reverse(), B = digits(b).reverse(), out = [];
    for (let i = 0; i < Math.max(A.length, B.length); i++) out.unshift(f(A[i] || 0, B[i] || 0));
    return Number(out.join(""));
  }

  function arithmetic(value, prompt, expected) {
    const p = twoNumbers(prompt);
    if (!p || !Number.isInteger(p.a) || !Number.isInteger(p.b)) return null;
    const { a, b } = p;
    // only when the question is that calculation: the right answer has to be what the two numbers and the sign give (not a puzzle about a balance, say)
    const ops = { "+": a + b, "−": a - b, "-": a - b, "·": a * b, "×": a * b, "*": a * b, x: a * b, ":": b ? a / b : NaN, "÷": b ? a / b : NaN, "/": b ? a / b : NaN };
    const wanted = toNumber(expected);
    const wantedValue = Number.isFinite(wanted) ? wanted : (toFraction(expected) ? toFraction(expected).n / toFraction(expected).d : NaN);
    if (!same(wantedValue, ops[p.op])) return null;
    if (p.op === "+") {
      if (a + b >= 0 && same(value, byPlace(a, b, (x, y) => (x + y) % 10)) && !same(value, a + b)) {
        // the first place, from the right, where the two digits make ten or more: the example is taken from the question itself
        const A = digits(a).reverse(), B = digits(b).reverse();
        let at = 0;
        while (at < Math.max(A.length, B.length) && (A[at] || 0) + (B[at] || 0) < 10) at++;
        const places = ["ental", "tiotal", "hundratal", "tusental", "tiotusental", "hundratusental"];
        const the = ["entalen", "tiotalen", "hundratalen", "tusentalen", "tiotusentalen", "hundratusentalen"];
        const sum = (A[at] || 0) + (B[at] || 0);
        const example = at < Math.max(A.length, B.length) && places[at + 1] ? " Titta på " + the[at] + ": " + (A[at] || 0) + " + " + (B[at] || 0) + " = " + sum + " " + places[at] + ". Hur många av dem blir kvar på platsen, och hur många flyttas till " + the[at + 1] + "?" : "";
        return result("Glömde att växla", "Du lade ihop plats för plats men glömde växla. När en plats får tio eller fler skriver du bara det som blir över och flyttar tiotalet, hundratalet och så vidare till nästa plats." + example);
      }
      return null;
    }
    if (p.op === "−" || p.op === "-") {
      if (a > b && same(value, byPlace(a, b, (x, y) => Math.abs(x - y))) && !same(value, a - b)) {
        return result("Minskade det mindre talet från det större", "I varje kolumn tog du det mindre talet från det större. Men det översta talet ska minska. Räcker det inte på en plats växlar du ett tiotal, hundratal eller tusental från platsen till vänster, så att du kan ta bort från det översta talet.");
      }
      if (a < b && same(value, b - a)) {
        return result("Vände på subtraktionen", "Det första talet är mindre än det andra, så svaret är under noll. Du räknade " + shown(b) + " − " + shown(a) + " i stället. Prova på en tallinje: starta på " + shown(a) + " och gå " + shown(b) + " steg åt vänster.");
      }
      return null;
    }
    if (p.op === "·" || p.op === "×" || p.op === "*" || p.op === "x") {
      if (b >= 10 && a >= 1) {
        // the lines of a column multiplication added without moving the second line one place to the left
        const unshifted = digits(b).reduce((s, d) => s + a * d, 0);
        if (same(value, unshifted) && !same(value, a * b)) {
          return result("Glömde flytta ett steg", "Du multiplicerade med varje siffra men lade ihop raderna utan att flytta den andra raden ett steg åt vänster. Tiotalen är värda tio gånger mer: skriv en nolla först när du multiplicerar med tiotalssiffran.");
        }
      }
      if (same(value, a + b) && !same(value, a * b)) {
        return result("Lade ihop i stället för att multiplicera", "Du räknade " + shown(a) + " + " + shown(b) + ". Multiplikation är lika stora grupper: " + shown(a) + " · " + shown(b) + " är " + shown(a) + " tagna " + shown(b) + " gånger.");
      }
      return null;
    }
    if (p.op === ":" || p.op === "÷" || p.op === "/") {
      if (b !== 0 && a !== 0 && a % b !== 0 && b % a === 0 && same(value, b / a)) {
        return result("Delade tvärtom", "Du delade det lilla talet med det stora. Det första talet är det som ska delas: " + shown(a) + " delas i " + shown(b) + " lika delar.");
      }
      return null;
    }
    return null;
  }

  // ----- fractions: a/b + c/d -----
  function fractions(raw, prompt) {
    const m = /(\d+)\s*\/\s*(\d+)\s*([+−-])\s*(\d+)\s*\/\s*(\d+)/.exec(prompt);
    if (!m) return null;
    const a = Number(m[1]), b = Number(m[2]), c = Number(m[4]), d = Number(m[5]), plus = m[3] === "+";
    const value = toFraction(raw);
    if (!value || b === 0 || d === 0) return null;
    const right = plus ? { n: a * d + c * b, d: b * d } : { n: a * d - c * b, d: b * d };
    if (sameFraction(value, right)) return null;
    if (sameFraction(value, { n: plus ? a + c : a - c, d: plus ? b + d : b - d })) {
      return result(plus ? "Lade ihop täljarna och nämnarna" : "Tog bort täljare och nämnare var för sig",
        "Nämnaren säger hur stora delarna är, och den ändras inte när du lägger ihop delar. Gör först nämnarna lika (samma storlek på delarna), räkna sedan bara täljarna.");
    }
    if (b !== d && (sameFraction(value, { n: plus ? a + c : a - c, d: b }) || sameFraction(value, { n: plus ? a + c : a - c, d: d }))) {
      return result("Räknade med olika stora delar", "Delarna " + a + "/" + b + " och " + c + "/" + d + " är inte lika stora, så du kan inte bara lägga ihop täljarna. Gör först nämnarna lika, till exempel med " + (b * d) + "-delar.");
    }
    return null;
  }

  // ----- decimals: which is the largest or the smallest -----
  function decimals(raw, prompt) {
    const asksMax = /störst|större|högst/i.test(prompt), asksMin = /minst|mindre|lägst/i.test(prompt);
    if (asksMax === asksMin) return null;
    const found = (prompt.match(/\d+[.,]\d+/g) || []).filter((x, i, all) => all.indexOf(x) === i);
    if (found.length < 2) return null;
    const value = toNumber(raw);
    const numbers = found.map(toNumber);
    const chosen = found.find((x) => same(toNumber(x), value));
    if (!chosen) return null;
    const places = (x) => x.split(/[.,]/)[1].length;
    const most = Math.max.apply(null, found.map(places)), fewest = Math.min.apply(null, found.map(places));
    const right = asksMax ? Math.max.apply(null, numbers) : Math.min.apply(null, numbers);
    if (same(value, right)) return null;
    if (asksMax && places(chosen) === most && most !== fewest) {
      const rightText = found.find((x) => same(toNumber(x), right));
      return result("Trodde att fler decimaler betyder större", "Ett tal med fler siffror efter kommat är inte större. Jämför plats för plats: först tiondelarna, sedan hundradelarna. Hur många tiondelar har " + chosen + ", och hur många har " + rightText + "?");
    }
    if (asksMin && places(chosen) === fewest && most !== fewest) {
      return result("Trodde att fler decimaler betyder större", "Ett tal med fler siffror efter kommat är inte större, så det med färre siffror är inte alltid minst. Jämför plats för plats: först tiondelarna, sedan hundradelarna.");
    }
    return null;
  }

  // ----- negative numbers: -3 + 5, 4 − (−2) -----
  function negatives(raw, prompt) {
    const m = /(?:^|[^\d])(−|-)?(\d+)\s*([+−-])\s*(\(?\s*(−|-)?\s*\d+\s*\)?)/.exec(prompt);
    if (!m) return null;
    const a = (m[1] ? -1 : 1) * Number(m[2]);
    const b = toNumber(String(m[4]).replace(/[()\s]/g, ""));
    if (!Number.isFinite(b) || (a >= 0 && b >= 0 && !(m[1] || /−\s*\(|-\s*\(/.test(prompt)))) return null;
    const plus = m[3] === "+";
    const right = plus ? a + b : a - b;
    const value = toNumber(raw);
    if (!Number.isFinite(value) || same(value, right)) return null;
    if (!plus && b < 0 && same(value, a - Math.abs(b))) {
      return result("Minus och minus blev bara minus", "Att dra ifrån ett negativt tal är samma sak som att lägga till: " + shown(a) + " − (" + shown(b) + ") = " + shown(a) + " + " + shown(Math.abs(b)) + ". Tänk att du tar bort en skuld.");
    }
    if (same(value, plus ? Math.abs(a) + Math.abs(b) : Math.abs(a) - Math.abs(b)) && (a < 0 || b < 0)) {
      return result("Räknade utan minustecknen", "Minustecknet framför ett tal betyder att talet ligger under noll, och det ändrar svaret. Rita en tallinje: plus går åt höger, minus åt vänster, och börja på rätt tal.");
    }
    if (a < 0 && b > 0 && plus && same(value, -(Math.abs(a) + b))) {
      return result("Lade ihop talen och behöll minus", "−" + Math.abs(a) + " + " + b + " betyder att du börjar under noll och går " + b + " steg åt höger, mot noll. Du hamnar därför högre upp än där du började.");
    }
    return null;
  }

  // ----- percent: what is 20 % of 50 -----
  function percent(raw, prompt) {
    const m = /(\d+(?:[.,]\d+)?)\s*(?:%|procent)\s*av\s*(\d+(?:[.,]\d+)?)/i.exec(prompt);
    if (!m) return null;
    const p = toNumber(m[1]), n = toNumber(m[2]), value = toNumber(raw);
    if (!Number.isFinite(value) || p === 0 || same(value, p * n / 100)) return null;
    if (same(value, p * n)) return result("Glömde dela med 100", "Procent betyder hundradelar. " + shown(p) + " % är " + shown(p) + "/100, så du ska multiplicera och sedan dela med 100.");
    if (same(value, n / p)) return result("Delade med procenttalet", shown(p) + " % betyder " + shown(p) + " hundradelar av helheten, inte att du delar med " + shown(p) + ". Ta " + shown(p) + "/100 av " + shown(n) + ".");
    if (same(value, p)) return result("Svarade med procenttalet", "Procenttalet säger hur stor del av helheten det är. Svaret är den delen av " + shown(n) + ", så räkna ut " + shown(p) + "/100 av " + shown(n) + ".");
    return null;
  }

  // ----- units: how many centimetres are 3 metres -----
  const UNITS = [
    ["kilometer", "km"], ["millimeter", "mm"], ["centimeter", "cm"], ["decimeter", "dm"], ["meter", "m"],
    ["milliliter", "ml"], ["centiliter", "cl"], ["deciliter", "dl"], ["liter", "l"], ["kilogram", "kg"], ["gram", "g"]
  ];
  const FACTOR = { "km>m": 1000, "m>cm": 100, "m>mm": 1000, "m>dm": 10, "dm>cm": 10, "cm>mm": 10, "dm>mm": 100, "l>dl": 10, "l>cl": 100, "l>ml": 1000, "dl>cl": 10, "dl>ml": 100, "cl>ml": 10, "kg>g": 1000 };

  function unitOf(word) {
    const w = word.toLowerCase();
    const hit = UNITS.find((u) => w === u[1] || w.indexOf(u[0]) === 0);
    return hit ? hit[1] : null;
  }

  function units(raw, prompt) {
    const m = /hur\s+många\s+(\p{L}+)\s+(?:är|blir|motsvarar)\s+(\d+(?:[.,]\d+)?)\s*(\p{L}+)/iu.exec(prompt);
    if (!m) return null;
    const to = unitOf(m[1]), from = unitOf(m[3]);
    if (!to || !from || !FACTOR[from + ">" + to]) return null;
    const n = toNumber(m[2]), value = toNumber(raw), f = FACTOR[from + ">" + to];
    if (!Number.isFinite(value) || same(value, n * f)) return null;
    const names = { km: "kilometer", m: "meter", dm: "decimeter", cm: "centimeter", mm: "millimeter", l: "liter", dl: "deciliter", cl: "centiliter", ml: "milliliter", kg: "kilogram", g: "gram" };
    for (const wrong of [10, 100, 1000]) {
      if (wrong !== f && same(value, n * wrong)) {
        return result("Fel växlingstal mellan enheterna", "1 " + names[from] + " är " + f + " " + names[to] + ", inte " + wrong + ". Det är " + n + " · " + f + " = " + shown(n * f) + ".");
      }
    }
    if (same(value, n / f)) return result("Delade i stället för att multiplicera", "Du går från en större enhet till en mindre, så det blir fler. Multiplicera: " + n + " · " + f + ".");
    return null;
  }

  // ----- place value: what is the 6 worth in 2 643 -----
  function placeValue(raw, prompt) {
    const m = new RegExp("(\\d):?ans\\s+värde\\s+i\\s+talet\\s+(" + NUMBER + ")", "i").exec(prompt);
    if (!m) return null;
    const digit = Number(m[1]), text = m[2].replace(/[  ]/g, "").replace(/[.,].*$/, "");
    const at = text.indexOf(String(digit));
    if (at < 0) return null;
    const right = digit * Math.pow(10, text.length - 1 - at), value = toNumber(raw);
    if (!Number.isFinite(value) || same(value, right)) return null;
    const names = ["ental", "tiotal", "hundratal", "tusental", "tiotusental"];
    const place = names[text.length - 1 - at] || "en plats längre till vänster";
    if (same(value, digit)) return result("Svarade med siffran i stället för dess värde", "Siffran " + digit + " står på platsen för " + place + ". Dess värde är " + digit + " " + place + ", alltså " + right + ".");
    for (let k = 0; k <= 5; k++) {
      if (k !== text.length - 1 - at && same(value, digit * Math.pow(10, k))) return result("Räknade med fel plats", "Titta på vilken plats siffran står på, räknat från höger: ental, tiotal, hundratal, tusental. Här står " + digit + ":an på platsen för " + place + ".");
    }
    return null;
  }

  // ----- time: 14:35 and 40 minutes later -----
  function time(raw, prompt) {
    const t = /(\d{1,2}):(\d{2})/.exec(prompt);
    const d = /(\d+)\s*minuter\s+(?:senare|efter|framåt)/i.exec(prompt);
    if (!t || !d) return null;
    const h = Number(t[1]), m = Number(t[2]), add = Number(d[1]);
    const written = /^\s*(\d{1,2})\s*[:.]\s*(\d{2,3})\s*$/.exec(String(raw));
    if (!written) return null;
    const wrongMinutes = m + add;
    if (wrongMinutes >= 60 && Number(written[2]) === wrongMinutes && (Number(written[1]) === h || Number(written[1]) === h + 1)) {
      return result("Räknade som om en timme har 100 minuter", "En timme har 60 minuter. " + m + " + " + add + " = " + wrongMinutes + " minuter är " + Math.floor(wrongMinutes / 60) + " timme och " + (wrongMinutes % 60) + " minuter, så klockan blir " + ((h + Math.floor(wrongMinutes / 60)) % 24) + ":" + ("0" + (wrongMinutes % 60)).slice(-2) + ".");
    }
    return null;
  }

  function diagnose(raw, prompt, expected) {
    const text = String(prompt || "");
    const value = String(raw === undefined || raw === null ? "" : raw).trim();
    if (!value || !text) return null;
    const asNumber = toNumber(value);
    const wanted = Array.isArray(expected) ? expected : [expected];
    // a right answer is never a mistake
    if (wanted.some((x) => x !== undefined && (String(x).trim() === value || (Number.isFinite(asNumber) && same(toNumber(x), asNumber))))) return null;
    return (Number.isFinite(asNumber) ? (
      arithmetic(asNumber, text, wanted[0]) || decimals(value, text) || negatives(value, text) || percent(value, text) || units(value, text) || placeValue(value, text)
    ) : null) || fractions(value, text) || decimals(value, text) || time(value, text) || null;
  }

  const api = { diagnose: diagnose };
  root.GaussicaMisconceptions = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
