// Slips and wrong turns in a numeric answer, said with care: what probably happened, never what the answer is.
//
// misconceptions.js and symbolic-math.js recognise known misunderstandings. This file is for what is left when an answer is wrong and none of those fits.
// It looks at the numbers in the question and at the answer, and says something true and careful (a question or a pointer, not the solution):
//
//   step         the answer is the result of a first step of the way to the right one ("Det ser ut som att du har räknat 3 · 12 ...")
//   operation    the answer is what one other way of counting with two numbers of the question gives (added, subtracted, multiplied, divided)
//   number       the answer is a number that stands in the question
//   order        the answer is what the same numbers give when they are put together in another order ((40 + 12) · 5 for 40 + 12 · 5)
//   near         the answer is close in the way of a slip: digits in another order, a digit too many or too few, the decimal comma or the zeros,
//                one digit off, rounded
//   size         the answer is larger or smaller than the right one (or has the other sign): "Ditt svar verkar för stort. Vad kan ha blivit fel?"
//
//   GaussicaSlips.diagnose(raw, prompt, expected, { variant })  ->  { kind, title, explanation, generic? } or null
//   `expected` is the list of right answers, `variant` a number that picks between the ways of putting it (the tries so far, so that the same
//   thing is not said in the same words twice in a row). `generic: true` is a hint without a pattern in it (the size): it is shown as a plain hint and
//   counts as no pattern for the teacher. Nothing said here contains the right answer (tests/slips.js checks it on many questions).

(function (root) {
  "use strict";

  const NUMBER = /\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;
  const GENERIC_TITLE = "Generellt beräkningsfel";

  function toNumber(text) {
    const s = String(text).replace(/[  ]/g, "").replace(",", ".").replace("−", "-");
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  }

  // What stands in a plain answer: "24", "−3,5", "1 200 kr" -> the number. Not a fraction, not a calculation.
  function numberPart(raw) {
    const m = /^\s*([−-]?\d+(?:[  ]\d{3})*(?:[.,]\d+)?)\s*(?:[A-Za-zåäöÅÄÖ²³°%]+\.?)?\s*$/.exec(String(raw === undefined || raw === null ? "" : raw));
    if (!m) return null;
    const text = m[1].replace(/[  ]/g, "").replace(",", ".").replace("−", "-");
    const value = Number(text);
    return Number.isFinite(value) ? { text: text, value: value } : null;
  }

  const same = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  const shown = (n) => String(Math.round(n * 1e6) / 1e6).replace(".", ",").replace("-", "−");
  const pick = (list, variant) => list[Math.abs(Math.floor(Number(variant) || 0)) % list.length];
  const result = (kind, title, explanation, extra) => Object.assign({ kind: kind, title: title, explanation: explanation }, extra || {});

  // ----- the numbers of the question, and every way to count with some of them -----
  function numbersOf(prompt) {
    const text = String(prompt || "");
    if (/\d\s*[:/]\s*\d/.test(text) || /(?:^|[^A-Za-zåäöÅÄÖ])\d*[xyz](?:$|[^A-Za-zåäöÅÄÖ])/.test(text)) return [];   // times, fractions, equations: not what this is for
    const out = [];
    let m;
    NUMBER.lastIndex = 0;
    while ((m = NUMBER.exec(text))) out.push(toNumber(m[0]));
    return out.filter((n) => Number.isFinite(n));
  }

  // Every result of counting with the numbers (each used once, in any order, with + − · :), as nodes { v, mask, op, l, r }.
  // Only results that make sense in the lower years: not negative, not zero, divisions that come out even or with at most two decimals.
  function trees(nums) {
    const n = nums.length, full = (1 << n) - 1, by = new Array(full + 1);
    for (let i = 0; i < n; i++) by[1 << i] = [{ v: nums[i], mask: 1 << i, op: null, l: null, r: null }];
    const bits = (x) => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };
    const masks = [];
    for (let m = 1; m <= full; m++) if (bits(m) >= 2) masks.push(m);
    masks.sort((a, b) => bits(a) - bits(b));
    masks.forEach((mask) => {
      const list = [];
      for (let a = (mask - 1) & mask; a > 0; a = (a - 1) & mask) {
        const b = mask ^ a;
        if (!by[a] || !by[b]) continue;
        by[a].forEach((x) => by[b].forEach((y) => {
          const add = (v, op) => { if (Number.isFinite(v) && v > 1e-9 && v < 1e9) list.push({ v: Math.round(v * 1e6) / 1e6, mask: mask, op: op, l: x, r: y }); };
          if (a < b) { add(x.v + y.v, "+"); add(x.v * y.v, "·"); }
          add(x.v - y.v, "−");
          if (y.v !== 0) { const q = x.v / y.v; if (Math.abs(q * 100 - Math.round(q * 100)) < 1e-7) add(q, ":"); }
        }));
      }
      by[mask] = list;
    });
    return by;
  }

  const leaves = (node) => (node.op ? leaves(node.l).concat(leaves(node.r)) : [node.v]);
  const text = (node) => (node.op ? shown(node.l.v) + " " + node.op + " " + shown(node.r.v) : shown(node.v));
  function descendants(node, out) {
    if (!node.op) return out;
    [node.l, node.r].forEach((k) => { if (k.op) { out.push(k); descendants(k, out); } });
    return out;
  }
  const popcount = (x) => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };

  const OPERATION = {
    "+": (a, b) => ({ done: "lagt ihop " + shown(a) + " och " + shown(b), name: "lade ihop" }),
    "−": (a, b) => ({ done: "dragit " + shown(b) + " från " + shown(a), name: "drog ifrån" }),
    "·": (a, b) => ({ done: "multiplicerat " + shown(a) + " med " + shown(b), name: "multiplicerade" }),
    ":": (a, b) => ({ done: "dividerat " + shown(a) + " med " + shown(b), name: "dividerade" })
  };

  // ----- 1. the way of counting -----
  function counting(value, prompt, wanted, variant) {
    const nums = numbersOf(prompt);
    if (nums.length < 2 || nums.length > 4) return null;
    const by = trees(nums);
    const all = [];
    by.forEach((list, mask) => { if (list && popcount(mask) >= 2) list.forEach((nd) => all.push(nd)); });

    // the nodes that give the right answer, with the fewest numbers: if there are many ways, nothing is said about the steps
    const right = all.filter((nd) => same(nd.v, wanted));
    const fewest = right.length ? Math.min.apply(null, right.map((nd) => popcount(nd.mask))) : 0;
    const way = right.filter((nd) => popcount(nd.mask) === fewest);
    const steps = way.length && way.length <= 6 ? way.reduce((acc, nd) => descendants(nd, acc), []) : [];

    const step = steps.filter((nd) => same(nd.v, value));
    if (step.length) {
      const two = step.find((nd) => popcount(nd.mask) === 2);
      const part = two ? "räknat " + text(two) : "räknat en del av uppgiften";
      return result("step", "Räknade bara en del av uppgiften", pick([
        "Det ser ut som att du har " + part + ", och det kan vara ett första steg. Läs frågan en gång till: är du klar, eller fattas något?",
        "Det ser ut som att du har " + part + ". Är det hela det frågan vill veta, eller finns det mer att göra?"
      ], variant));
    }

    const pairs = all.filter((nd) => popcount(nd.mask) === 2 && same(nd.v, value));
    const kinds = new Map();
    pairs.forEach((nd) => kinds.set(nd.op + "|" + shown(nd.l.v) + "|" + shown(nd.r.v), nd));
    if (kinds.size === 1) {
      const nd = Array.from(kinds.values())[0];
      const what = OPERATION[nd.op](nd.l.v, nd.r.v);
      return result("operation", "Ett annat räknesätt än frågan vill ha (" + what.name + ")", pick([
        "Det ser ut som att du har " + what.done + ". Läs frågan en gång till: är det den uträkningen den vill ha?",
        "Ditt svar stämmer med att " + what.done + ". Stämmer det med vad frågan vill veta?"
      ], variant));
    }
    if (nums.some((n) => same(n, value))) {
      return result("number", "Svarade med ett tal ur frågan", pick([
        "Det talet står redan i frågan. Fundera på vad frågan vill veta och vad du ska göra med talen.",
        "Det talet fanns med i frågan från början. Vad är det frågan egentligen vill att du räknar ut?"
      ], variant));
    }
    return null;
  }

  // The same numbers as the right answer uses, but put together in another order (40 + 12 · 5 counted as (40 + 12) · 5). Three numbers or more.
  function reordering(value, prompt, wanted, variant) {
    const nums = numbersOf(prompt);
    if (nums.length < 3 || nums.length > 4) return null;
    const by = trees(nums);
    const all = [];
    by.forEach((list, mask) => { if (list && popcount(mask) >= 3) list.forEach((nd) => all.push(nd)); });
    const right = all.filter((nd) => same(nd.v, wanted));
    if (!right.length) return null;
    // the same numbers and the same signs as a way to the right answer (40 + 12 · 5 and (40 + 12) · 5 both use one + and one ·), put together in another order
    const signs = (nd) => (nd.op ? [nd.op].concat(signs(nd.l), signs(nd.r)) : []).sort().join("");
    const wayKeys = new Set(right.map((nd) => nd.mask + "|" + signs(nd)));
    if (!all.some((nd) => same(nd.v, value) && wayKeys.has(nd.mask + "|" + signs(nd)))) return null;
    return result("order", "Räknade i en annan ordning", pick([
      "Det ser ut som att du har räknat i en annan ordning än frågan vill ha. Tänk på vilken del som ska räknas först.",
      "Ditt svar kan komma av att delarna räknades i fel ordning. Vilken del av frågan hör ihop, och ska räknas först?"
    ], variant));
  }

  // ----- 2. a slip in the writing of the answer -----
  const digitsOf = (t) => t.replace(/[-.]/g, "");
  const stripped = (t) => digitsOf(t).replace(/^0+/, "").replace(/0+$/, "");
  const sortedOf = (t) => t.split("").sort().join("");

  function oneMissing(longer, shorter) {
    if (longer.length !== shorter.length + 1) return false;
    for (let i = 0; i < longer.length; i++) if (longer.slice(0, i) + longer.slice(i + 1) === shorter) return true;
    return false;
  }

  function decimalsOf(t) { const i = t.indexOf("."); return i < 0 ? 0 : t.length - i - 1; }

  function nearMiss(got, right, prompt, variant) {
    if (Math.sign(got.value) !== Math.sign(right.value) || same(got.value, right.value)) return null;
    const ds = digitsOf(got.text), de = digitsOf(right.text);
    const gap = Math.abs(got.value - right.value);

    // the same digits in the same order, so the comma or the zeros are what differs
    if (ds === de || (stripped(got.text) === stripped(right.text) && stripped(got.text).length >= 1)) {
      if (got.text.indexOf(".") >= 0 || right.text.indexOf(".") >= 0) {
        return result("near", "Kommatecknet på fel plats", pick([
          "Titta på var kommatecknet står i ditt svar.",
          "Kolla en gång till var kommatecknet ska sitta."
        ], variant));
      }
      return result("near", "Fel antal nollor", pick([
        "Titta på nollorna i ditt svar. Är det rätt antal?",
        "Räkna nollorna i ditt svar en gång till."
      ], variant));
    }
    // the same digits in another order: 45 and 54
    if (ds.length === de.length && ds.length >= 2 && sortedOf(ds) === sortedOf(de)) {
      return result("near", "Siffrorna i fel ordning", pick([
        "Tänk på ordningen i ditt svar.",
        "Titta en gång till på ordningen på siffrorna i ditt svar.",
        "Står alla siffror i ditt svar där de ska? Kolla ordningen."
      ], variant));
    }
    // rounded: fewer decimals than the right answer, and what you get by rounding it
    const dg = decimalsOf(got.text), dr = decimalsOf(right.text);
    if (dr > dg && Math.abs(Math.round(right.value * Math.pow(10, dg)) / Math.pow(10, dg) - got.value) < 1e-9) {
      return result("near", "Avrundat fel", pick([
        "Ditt svar kan vara avrundat. Titta på hur många decimaler frågan vill ha.",
        "Kolla om frågan säger hur många decimaler svaret ska ha."
      ], variant));
    }
    // one digit more or less
    if (oneMissing(ds, de) || oneMissing(de, ds)) {
      return result("near", "En siffra för mycket eller för lite", pick([
        "Kolla att ditt svar har med alla siffror, och inga för många.",
        "Det verkar som att en siffra har kommit med eller försvunnit. Skriv svaret en gång till, långsamt."
      ], variant));
    }
    // close: one digit different, or just next to it
    const hamming = ds.length === de.length ? ds.split("").filter((c, i) => c !== de[i]).length : 99;
    if (gap === 1 || (hamming === 1 && gap / Math.abs(right.value) <= 0.15)) {
      return result("near", "Mycket nära rätt svar", pick([
        "Du är mycket nära rätt svar. Gå igenom uträkningen en gång till, steg för steg.",
        "Nästan! Räkna en gång till och kontrollera varje steg.",
        "Det här är väldigt nära. Ett litet fel kan ha smugit sig in, så kolla stegen."
      ], variant));
    }
    return null;
  }

  // ----- 3. larger or smaller -----
  const TOO_BIG = [
    "Ditt svar verkar för stort. Vad kan ha blivit fel?",
    "Svaret blev större än det borde. Gå igenom stegen och se var det kan ha gått fel.",
    "Det här svaret är för stort. Vilket steg tror du blev fel?"
  ];
  const TOO_SMALL = [
    "Ditt svar verkar för litet. Vad kan ha blivit fel?",
    "Svaret blev mindre än det borde. Gå igenom stegen och se var det kan ha gått fel.",
    "Det här svaret är för litet. Vilket steg tror du blev fel?"
  ];
  const WAY_BIG = [
    "Ditt svar verkar mycket för stort. Är det rimligt? Vad kan ha blivit fel?",
    "Svaret är mycket större än det borde vara. Gör ett överslag och jämför.",
    "Svaret är för stort, och ganska långt ifrån. Gå tillbaka till frågan och ta det steg för steg."
  ];
  const WAY_SMALL = [
    "Ditt svar verkar mycket för litet. Är det rimligt? Vad kan ha blivit fel?",
    "Svaret är mycket mindre än det borde vara. Gör ett överslag och jämför.",
    "Svaret är för litet, och ganska långt ifrån. Gå tillbaka till frågan och ta det steg för steg."
  ];
  const A_LITTLE_BIG = [
    "Ditt svar är lite för stort. Kolla uträkningen en gång till.",
    "Svaret blev lite större än det borde. Gå igenom stegen igen."
  ];
  const A_LITTLE_SMALL = [
    "Ditt svar är lite för litet. Kolla uträkningen en gång till.",
    "Svaret blev lite mindre än det borde. Gå igenom stegen igen."
  ];
  const SIGN_NEGATIVE = [
    "Kan svaret verkligen vara negativt här? Tänk på vad frågan handlar om.",
    "Ditt svar är negativt. Passar det med vad frågan vill veta?"
  ];
  const SIGN_POSITIVE = [
    "Kan svaret verkligen vara positivt här? Tänk på vad frågan handlar om.",
    "Ditt svar är positivt. Passar det med vad frågan vill veta?"
  ];

  function size(got, right, variant) {
    if (same(got.value, right.value) || right.value === 0) return null;
    let list;
    if (got.value < 0 && right.value > 0) list = SIGN_NEGATIVE;
    else if (got.value > 0 && right.value < 0) list = SIGN_POSITIVE;
    else {
      const ratio = Math.abs(got.value) / Math.abs(right.value);
      const bigger = Math.abs(got.value) > Math.abs(right.value);
      if (ratio >= 4) list = WAY_BIG;
      else if (ratio <= 0.25) list = WAY_SMALL;
      else if (ratio >= 1 && ratio <= 1.25) list = A_LITTLE_BIG;
      else if (ratio <= 1 && ratio >= 0.8) list = A_LITTLE_SMALL;
      else list = bigger ? TOO_BIG : TOO_SMALL;
      if (right.value < 0) list = list === TOO_BIG ? TOO_SMALL : list === TOO_SMALL ? TOO_BIG : list;   // a negative answer: larger in size is smaller as a number
    }
    return result("size", GENERIC_TITLE, pick(list, variant), { generic: true });
  }

  function diagnose(raw, prompt, expected, options) {
    const variant = options && options.variant;
    const got = numberPart(raw);
    if (!got) return null;
    const wanted = (Array.isArray(expected) ? expected : [expected]).map(numberPart).filter(Boolean);
    if (!wanted.length || wanted.some((w) => same(w.value, got.value))) return null;   // a right answer is never a slip
    // two different right answers (both are accepted): there is no "larger than" and no "near"
    if (wanted.some((w) => !same(w.value, wanted[0].value))) return null;
    const right = wanted[0];
    return counting(got.value, prompt, right.value, variant) || nearMiss(got, right, prompt, variant) || reordering(got.value, prompt, right.value, variant) || size(got, right, variant);
  }

  const api = { diagnose: diagnose, GENERIC_TITLE: GENERIC_TITLE, trees: trees, numbersOf: numbersOf, numberPart: numberPart };
  root.GaussicaSlips = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
