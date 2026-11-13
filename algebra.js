// Algebra, checked and explained: what a line of a solution does to an equation, and what probably went wrong when it does not.
//
// symbolic-math.js can tell whether two answers are the same. This file knows more about equations and about the usual mistakes:
//
//   solutions(equation)               the solution set of an equation in one letter (up to degree two): { type: "set", roots }, { type: "all" } or { type: "none" }
//   sameSolutions(a, b)               true, false, or null when it is not known
//   stepCheck(previous, next)         { ok, kind, message }: does the next line of a solution keep the solutions of the line above it? If not, what
//                                     probably happened ("Du tog bort talet från ena sidan men inte från den andra", a term moved without changing sign ...)
//   diagnose(answer, question)        the mistake behind a wrong answer: an expression that is what one wrong rule gives (3(x + 4) as 3x + 4, (a + b)^2 as
//                                     a^2 + b^2 ...), or a value of x that one wrong step of solving gives. { title, explanation } with a check by numbers
//   extractMath(prompt)               the equation or the expression that a question is about, or null
//   substitution(prompt, answer)      the equation with the answer put in for the letter, and what each side comes to: { equation, variable, value,
//                                     left, right, equal, parts } (used for the animated check)
//   show(ast, options)                an expression as it is written on paper (3 · 5 + 2, 2x + 3, x^2), also with a letter replaced by a value
//
// Everything is about what an answer or a line IS, not what it should be: a hint never says the solution, it says what was done and why that does not work.

(function (root) {
  "use strict";

  function MS() { return root.MATTE_SYMBOLIC || (typeof require !== "undefined" ? require("./symbolic-math.js") : null); }

  const EPS = 1e-7;
  const close = (a, b) => Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));
  const shown = (n) => String(Math.round(n * 1e4) / 1e4).replace(".", ",").replace("-", "−");

  function parseSafe(text) {
    try { return MS().parse(String(text)); } catch (e) { return null; }
  }
  function evalAt(ast, scope) {
    try { const v = MS().evaluateAST(ast, scope); return typeof v === "number" ? v : NaN; } catch (e) { return NaN; }
  }
  function variablesOf(ast, set) {
    set = set || new Set();
    if (!ast) return set;
    if (ast.type === "VARIABLE") set.add(ast.name);
    ["left", "right", "operand", "arg"].forEach((k) => { if (ast[k]) variablesOf(ast[k], set); });
    return set;
  }

  // ----- polynomials of degree three or less, found by trying numbers -----
  function polynomial(fn) {
    const y = [0, 1, 2, 3].map(fn);
    if (y.some((v) => !Number.isFinite(v))) return null;
    const d1 = y[1] - y[0], d2 = y[2] - 2 * y[1] + y[0], d3 = y[3] - 3 * y[2] + 3 * y[1] - y[0];
    const c = [y[0], d1 - d2 / 2 + d3 / 3, d2 / 2 - d3 / 2, d3 / 6];
    for (const x of [-1, 4.5, -2.7, 7]) {
      const v = fn(x), p = c[0] + c[1] * x + c[2] * x * x + c[3] * x * x * x;
      if (!Number.isFinite(v) || Math.abs(v - p) > 1e-6 * (1 + Math.abs(v))) return null;
    }
    return c.map((v) => (Math.abs(v) < 1e-9 ? 0 : v));
  }

  function solutions(equation) {
    const ast = typeof equation === "string" ? parseSafe(equation) : equation;
    if (!ast || ast.type !== "EQUATION") return null;
    const vars = Array.from(variablesOf(ast));
    if (vars.length > 1) return null;
    const v = vars[0];
    const c = polynomial((x) => { const scope = {}; if (v) scope[v] = x; return evalAt(ast.left, scope) - evalAt(ast.right, scope); });
    if (!c) return null;
    let deg = 3;
    while (deg >= 0 && c[deg] === 0) deg--;
    if (deg < 0) return { type: "all" };
    if (deg === 0) return { type: "none" };
    if (deg === 1) return { type: "set", roots: [-c[0] / c[1]] };
    if (deg === 2) {
      const disc = c[1] * c[1] - 4 * c[2] * c[0];
      if (disc < -1e-9) return { type: "none" };
      if (Math.abs(disc) <= 1e-9) return { type: "set", roots: [-c[1] / (2 * c[2])] };
      const r = Math.sqrt(disc);
      return { type: "set", roots: [(-c[1] - r) / (2 * c[2]), (-c[1] + r) / (2 * c[2])].sort((a, b) => a - b) };
    }
    return null;
  }

  function sameSolutions(a, b) {
    const sa = solutions(a), sb = solutions(b);
    if (!sa || !sb) return null;
    if (sa.type !== sb.type) return false;
    if (sa.type !== "set") return true;
    return sa.roots.length === sb.roots.length && sa.roots.every((r, i) => close(r, sb.roots[i]));
  }

  // two expressions that are the same function: tried with several numbers for every letter
  function sameFunction(a, b) {
    const vars = Array.from(variablesOf(a, variablesOf(b)));
    const points = [-3.1, 0.7, 2.3, 1.9, -0.4, 5.2];
    for (let i = 0; i < points.length; i++) {
      const scope = {};
      vars.forEach((v, j) => { scope[v] = points[(i + j * 2) % points.length]; });
      const x = evalAt(a, scope), y = evalAt(b, scope);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (!close(x, y)) return false;
    }
    return true;
  }

  // ----- a side of an equation written as a·x + b (null if it is not like that) -----
  function linear(ast, v) {
    const f = (x) => { const s = {}; if (v) s[v] = x; return evalAt(ast, s); };
    const y = [0, 1, 2, 3].map(f);
    if (y.some((n) => !Number.isFinite(n))) return null;
    const a = y[1] - y[0];
    if (!close(y[2], y[0] + 2 * a) || !close(y[3], y[0] + 3 * a)) return null;
    return { a: Math.abs(a) < 1e-9 ? 0 : a, b: y[0] };
  }
  function sidesOf(equation) {
    const ast = typeof equation === "string" ? parseSafe(equation) : equation;
    if (!ast || ast.type !== "EQUATION") return null;
    const vars = Array.from(variablesOf(ast));
    if (vars.length > 1) return null;
    const L = linear(ast.left, vars[0]), R = linear(ast.right, vars[0]);
    return L && R ? { v: vars[0], L: L, R: R } : null;
  }
  const sameLin = (p, q) => close(p.a, q.a) && close(p.b, q.b);
  const sameSides = (s, t) => (sameLin(s.L, t.L) && sameLin(s.R, t.R)) || (sameLin(s.L, t.R) && sameLin(s.R, t.L));
  const lin = (a, b) => ({ a: a, b: b });

  // ----- inequalities: ax + b < cx + d -----
  const FLIPPED = { "<": ">", ">": "<", "<=": ">=", ">=": "<=" };
  function splitInequality(text) {
    const s = String(text).replace(/≤/g, "<=").replace(/≥/g, ">=");
    const m = /^(.+?)(<=|>=|<|>)(.+)$/.exec(s);
    return m ? { left: m[1], op: m[2], right: m[3] } : null;
  }
  // the solution of a linear inequality in one letter: { op, value } with the letter first ("x < 4"), or { all } / { none }
  function inequality(text) {
    const p = splitInequality(text);
    if (!p) return null;
    const l = parseSafe(p.left), r = parseSafe(p.right);
    if (!l || !r || l.type === "EQUATION" || r.type === "EQUATION") return null;
    const vars = Array.from(variablesOf(r, variablesOf(l)));
    if (vars.length > 1) return null;
    const L = linear(l, vars[0]), R = linear(r, vars[0]);
    if (!L || !R) return null;
    const A = L.a - R.a, B = R.b - L.b;
    if (close(A, 0)) {
      const holds = p.op === "<" ? 0 < B : p.op === ">" ? 0 > B : p.op === "<=" ? 0 <= B : 0 >= B;
      return holds ? { all: true } : { none: true };
    }
    return { op: A < 0 ? FLIPPED[p.op] : p.op, value: B / A, flipped: A < 0, v: vars[0] };
  }
  function sameInequality(a, b) {
    const x = inequality(a), y = inequality(b);
    if (!x || !y) return null;
    if (x.all || x.none || y.all || y.none) return Boolean(x.all) === Boolean(y.all) && Boolean(x.none) === Boolean(y.none);
    return x.op === y.op && close(x.value, y.value);
  }

  // ----- a line of a solution -----
  const SLIPS = [
    // a term moved across the equals sign keeps its sign
    function moveSign(p) {
      const out = [];
      if (p.L.b !== 0) out.push([lin(p.L.a, 0), lin(p.R.a, p.R.b + p.L.b)]);
      if (p.R.b !== 0) out.push([lin(p.L.a, p.L.b + p.R.b), lin(p.R.a, 0)]);
      if (p.R.a !== 0) out.push([lin(p.L.a + p.R.a, p.L.b), lin(0, p.R.b)]);
      if (p.L.a !== 0) out.push([lin(0, p.L.b), lin(p.R.a + p.L.a, p.R.b)]);
      return { kind: "sign", title: "Tecknet byttes inte", say: "Det ser ut som att en term flyttades över likhetstecknet utan att byta tecken. Flyttar du en term till andra sidan byter den tecken, eftersom du tar bort (eller lägger till) samma sak på båda sidor.", sets: out };
    },
    // something done to one side only
    function oneSide(p) {
      const out = [];
      if (p.L.b !== 0) out.push([lin(p.L.a, 0), lin(p.R.a, p.R.b)]);
      if (p.R.b !== 0) out.push([lin(p.L.a, p.L.b), lin(p.R.a, 0)]);
      if (p.R.a !== 0) out.push([lin(p.L.a, p.L.b), lin(0, p.R.b)]);
      if (p.L.a !== 0) out.push([lin(0, p.L.b), lin(p.R.a, p.R.b)]);
      return { kind: "one-side", title: "Bara ena sidan ändrades", say: "Det ser ut som att du tog bort ett tal från ena sidan men inte från den andra. Det du gör på ena sidan av likhetstecknet måste du göra på den andra också.", sets: out };
    },
    // divided or multiplied only some of the terms
    function someTerms(p) {
      const out = [];
      const nums = [p.L.a, p.L.b, p.R.a, p.R.b];
      const ks = [];
      nums.forEach((n) => { const k = Math.abs(n); if (Number.isInteger(k) && k >= 2 && ks.indexOf(k) < 0) ks.push(k); });
      [2, 3, 4, 5, 10].forEach((k) => { if (ks.indexOf(k) < 0) ks.push(k); });
      ks.forEach((k) => {
        for (let mask = 1; mask < 15; mask++) {
          const part = (op) => nums.map((n, i) => (mask & (1 << i) ? op(n) : n));
          const d = part((n) => n / k), m = part((n) => n * k);
          out.push([lin(d[0], d[1]), lin(d[2], d[3])], [lin(m[0], m[1]), lin(m[2], m[3])]);
        }
      });
      return { kind: "some-terms", title: "Inte alla termer", say: "Det ser ut som att du delade (eller multiplicerade) bara några av termerna. När du delar eller multiplicerar en ekvation måste du göra det med varje term på båda sidor.", sets: out };
    },
    // the right moves, but a wrong operation to free the letter: subtracted where it should be divided, and so on
    function wrongOperation(p) {
      const out = [];
      const A = p.L.a - p.R.a, B = p.R.b - p.L.b;
      if (A !== 0 && close(p.R.a, 0) && close(p.L.b, 0)) {
        out.push([lin(1, 0), lin(0, B - A)], [lin(1, 0), lin(0, B * A)], [lin(1, 0), lin(0, A / (B || 1))], [lin(1, 0), lin(0, B)]);
      }
      return { kind: "wrong-operation", title: "Fel räknesätt för att få x ensamt", say: "Det ser ut som att du gjorde något annat än motsatsen för att få x ensamt. Gör motsatsen till det som händer med x: det som multipliceras delas, och det som delas multipliceras.", sets: out };
    }
  ];

  function stepCheck(previous, next) {
    if (/[<>≤≥]/.test(String(previous) + String(next))) {
      if (!String(next).trim()) return { ok: false, kind: "empty", message: "Skriv nästa rad." };
      const x = inequality(previous), y = inequality(next);
      if (!y) return { ok: false, kind: "syntax", message: "Raden går inte att läsa. Skriv den som en olikhet, till exempel 3x < 12." };
      if (!x) return { ok: true, kind: "unchecked", message: "" };
      if (String(previous).replace(/\s+/g, "") === String(next).replace(/\s+/g, "")) return { ok: false, kind: "same", message: "Det är samma rad som förut. Vad gör du på båda sidorna för att komma närmare svaret?" };
      if (sameInequality(previous, next)) return { ok: true, kind: "ok", message: "" };
      // the right number and the sign the other way round: dividing or multiplying with a negative number turns the sign
      if (!x.all && !x.none && !y.all && !y.none && close(x.value, y.value) && FLIPPED[x.op] === y.op) {
        return { ok: false, kind: "sign-turn", title: "Tecknet vändes fel", message: "Talet stämmer men tecknet gör det inte. Tecknet ska vändas när du multiplicerar eller delar med ett negativt tal, och bara då." };
      }
      return { ok: false, kind: "changed", title: "Lösningarna ändrades", message: "Raden har inte samma lösningar som raden ovanför. Vad gjorde du med båda sidorna? Kontrollera steget och räkna om det." };
    }
    const a = parseSafe(previous), b = parseSafe(next);
    if (!String(next).trim()) return { ok: false, kind: "empty", message: "Skriv nästa rad." };
    if (!b) return { ok: false, kind: "syntax", message: "Raden går inte att läsa. Skriv den som en ekvation, till exempel 3x = 12." };
    if (!a) return { ok: true, kind: "unchecked", message: "" };
    const same = String(previous).replace(/\s+/g, "").toLowerCase() === String(next).replace(/\s+/g, "").toLowerCase();
    if (same) return { ok: false, kind: "same", message: "Det är samma rad som förut. Vad gör du på båda sidorna för att komma närmare svaret?" };
    const eqA = a.type === "EQUATION", eqB = b.type === "EQUATION";
    if (eqA !== eqB) return { ok: false, kind: "mix", message: eqA ? "Behåll likhetstecknet: varje rad ska vara en ekvation, med ett likhetstecken." : "Det här är ett uttryck och inget likhetstecken ska dyka upp mitt i en förenkling." };
    let ok;
    if (eqA) {
      ok = sameSolutions(a, b);
      if (ok === null) ok = MS().areEquivalent(next, previous);
    } else ok = sameFunction(a, b);
    if (ok) return { ok: true, kind: "ok", message: "" };
    return explainStep(a, b, eqA);
  }

  function explainStep(a, b, isEquation) {
    if (isEquation) {
      const p = sidesOf(a), n = sidesOf(b);
      if (p && n) {
        for (const slip of SLIPS) {
          const made = slip(p);
          if (made.sets.some((s) => sameSides(n, { L: s[0], R: s[1] }))) return { ok: false, kind: made.kind, title: made.title, message: made.say };
        }
        // the same shape as a right step, with a number that is wrong
        const sA = solutions(a), sB = solutions(b);
        if (sA && sB && sA.type === "set" && sB.type === "set") {
          return { ok: false, kind: "arithmetic", title: "Räknefel", message: "Raden stämmer inte med raden ovanför: lösningen blev en annan. Gå igenom vad du gjorde och räkna om siffrorna i steget." };
        }
      }
      return { ok: false, kind: "changed", title: "Lösningen ändrades", message: "Raden har inte samma lösning som raden ovanför. Vad gjorde du med båda sidorna? Kontrollera steget och räkna om det." };
    }
    return { ok: false, kind: "changed", title: "Uttrycket ändrades", message: "Det här uttrycket är inte lika med det du började med. Prova med ett tal på x i båda: blir de lika?" };
  }

  // ----- the usual mistakes with expressions: what one wrong rule gives -----
  const N = (v) => ({ type: "NUMBER", value: v });
  const B = (op, l, r) => ({ type: "BINARY_OP", op: op, left: l, right: r });
  const neg = (x) => ({ type: "UNARY_OP", op: "-", operand: x });
  const isAdd = (n) => n.type === "BINARY_OP" && n.op === "+";
  const isSub = (n) => n.type === "BINARY_OP" && n.op === "-";
  const isMul = (n) => n.type === "BINARY_OP" && n.op === "*";
  const isDiv = (n) => n.type === "BINARY_OP" && n.op === "/";
  const isPow = (n, k) => n.type === "BINARY_OP" && n.op === "^" && (k === undefined || (n.right.type === "NUMBER" && n.right.value === k));
  const sum = (n) => isAdd(n) || isSub(n);

  // every way to apply one wrong rule at the top of a node
  const RULES = [
    { name: "distribute-first", title: "Multiplicerade bara första termen", why: "Du multiplicerade bara den första termen i parentesen. Faktorn utanför ska multipliceras med varje term inuti.",
      at: (n) => (isMul(n) && sum(n.right) ? [B(n.right.op, B("*", n.left, n.right.left), n.right.right)] : isMul(n) && sum(n.left) ? [B(n.left.op, B("*", n.left.left, n.right), n.left.right)] : []) },
    { name: "square-sum", title: "Kvadrerade varje term för sig", why: "(a + b)² är inte a² + b². Kvadrera hela parentesen: (a + b)(a + b) ger också en mellanterm, 2ab.",
      at: (n) => (isPow(n, 2) && sum(n.left) ? [B(n.left.op, B("^", n.left.left, N(2)), B("^", n.left.right, N(2)))] : []) },
    { name: "square-product", title: "Kvadrerade bara en faktor", why: "I (2x)² är både 2 och x faktorer, och båda kvadreras: (2x)² = 4x², inte 2x².",
      at: (n) => (isPow(n, 2) && isMul(n.left) ? [B("*", n.left.left, B("^", n.left.right, N(2)))] : []) },
    { name: "minus-bracket", title: "Minustecknet gäller bara första termen", why: "Ett minustecken framför en parentes gäller varje term i parentesen: −(a + b) = −a − b.",
      at: (n) => (isSub(n) && sum(n.right) ? [B(n.right.op === "+" ? "+" : "-", B("-", n.left, n.right.left), n.right.right)] : n.type === "UNARY_OP" && sum(n.operand) ? [B(n.operand.op, neg(n.operand.left), n.operand.right)] : []) },
    { name: "divide-one", title: "Delade bara en term", why: "När en summa delas med ett tal ska varje term delas: (a + b)/k = a/k + b/k.",
      at: (n) => (isDiv(n) && sum(n.left) ? [B(n.left.op, B("/", n.left.left, n.right), n.left.right), B(n.left.op, n.left.left, B("/", n.left.right, n.right))] : []) },
    { name: "unlike-terms", title: "Lade ihop termer som inte är lika", why: "Bara lika termer går att lägga ihop: 3x och 2 är inte lika, och x och x² är det inte heller.",
      at: (n) => {
        if (isAdd(n) && isMul(n.left) && n.left.left.type === "NUMBER" && n.left.right.type === "VARIABLE" && n.right.type === "NUMBER") return [B("*", N(n.left.left.value + n.right.value), n.left.right)];
        if (isAdd(n) && n.left.type === "VARIABLE" && isPow(n.right, 2) && n.right.left.type === "VARIABLE") return [B("^", n.left, N(3))];
        return [];
      } },
    { name: "power-product", title: "Multiplicerade exponenterna", why: "När du multiplicerar potenser med samma bas lägger du ihop exponenterna: x² · x³ = x⁵, inte x⁶.",
      at: (n) => (isMul(n) && isPow(n.left) && isPow(n.right) && n.left.right.type === "NUMBER" && n.right.right.type === "NUMBER" ? [B("^", n.left.left, N(n.left.right.value * n.right.right.value))] : []) },
    { name: "root-sum", title: "Tog roten ur varje term", why: "√(a + b) är inte √a + √b. Roten går inte att dela upp över en summa.",
      at: (n) => (n.type === "FUNCTION" && n.name === "sqrt" && sum(n.arg) ? [B(n.arg.op, { type: "FUNCTION", name: "sqrt", arg: n.arg.left }, { type: "FUNCTION", name: "sqrt", arg: n.arg.right })] : []) },
    { name: "sign-product", title: "Teckenfel i produkten", why: "Minus gånger minus är plus, och minus gånger plus är minus. Kolla tecknet på varje term när du multiplicerar in.",
      at: (n) => (isMul(n) && sum(n.right) ? [B(n.right.op === "+" ? "-" : "+", B("*", n.left, n.right.left), B("*", n.left, n.right.right))] : []) }
  ];

  function nodeVariants(node) {
    const out = [];
    RULES.forEach((r) => r.at(node).forEach((m) => out.push({ ast: m, rule: r })));
    ["left", "right", "operand", "arg"].forEach((k) => {
      if (node[k] && typeof node[k] === "object") nodeVariants(node[k]).forEach((v) => { const copy = Object.assign({}, node); copy[k] = v.ast; out.push({ ast: copy, rule: v.rule }); });
    });
    return out;
  }

  // a check by numbers: a value of the letters where the answer and the question do not agree
  function demo(student, question) {
    const vars = Array.from(variablesOf(question, variablesOf(student)));
    for (const x of [2, 3, 1, -1, 4, 0.5]) {
      const scope = {};
      vars.forEach((v, i) => { scope[v] = x + i; });
      const p = evalAt(question, scope), q = evalAt(student, scope);
      if (Number.isFinite(p) && Number.isFinite(q) && !close(p, q)) {
        const at = vars.map((v) => v + " = " + shown(scope[v])).join(" och ");
        return { at: at, question: p, student: q };
      }
    }
    return null;
  }

  function expressionMistake(studentText, questionText) {
    const s = parseSafe(studentText), q = parseSafe(questionText);
    if (!s || !q || s.type === "EQUATION" || q.type === "EQUATION") return null;
    if (sameFunction(s, q)) return null;
    const found = nodeVariants(q).filter((v) => sameFunction(v.ast, s));
    if (!found.length) return null;
    const rules = Array.from(new Set(found.map((f) => f.rule.name)));
    if (rules.length > 1) return null;   // two wrong rules give the same: nothing is claimed
    const rule = found[0].rule, d = demo(s, q);
    const check = d ? " Prova: med " + d.at + " blir uttrycket i frågan " + shown(d.question) + ", men ditt svar blir " + shown(d.student) + ". De är inte lika." : "";
    return { kind: "rule", code: rule.name, title: rule.title, explanation: rule.why + check, demo: d };
  }

  // a number written as the student writes it: 4, −1,5, 3/2, 2·3
  function numberOf(text) {
    const norm = String(text).replace(/\s+/g, "").replace(",", ".");
    if (!/^[0-9+\-−–*/().·]+$/.test(norm)) return NaN;
    const ast = parseSafe(norm);
    return ast && !variablesOf(ast).size ? evalAt(ast, {}) : NaN;
  }

  // ----- the usual mistakes in solving: what one wrong step gives -----
  function solutionMistake(valueText, equationText) {
    const p = sidesOf(equationText);
    if (!p) return null;
    const value = numberOf(valueText);
    if (!Number.isFinite(value)) return null;
    const A = p.L.a - p.R.a, B2 = p.R.b - p.L.b;
    if (close(A, 0)) return null;
    const right = B2 / A;
    if (close(value, right)) return null;
    const v = p.v || "x";
    const A1 = p.L.a + p.R.a, A2 = p.L.b + p.R.b;
    const list = [
      { code: "sign-const", title: "Tecknet byttes inte vid överflyttning", say: "Det ser ut som att en term flyttades över likhetstecknet utan att byta tecken. Flyttar du en term till andra sidan byter den tecken.", value: (p.R.b + p.L.b) / A, also: p.R.b + p.L.b },
      { code: "sign-var", title: "Tecknet byttes inte på x-termen", say: "Det ser ut som att x-termen flyttades över likhetstecknet utan att byta tecken. Flyttar du en term till andra sidan byter den tecken.", value: B2 / (p.L.a + p.R.a) },
      { code: "halfway", title: "Halvfärdig lösning", say: "Du har ett rätt första steg, men " + v + " står inte ensamt än. Vad multipliceras " + v + " med, och hur gör du motsatsen?", value: B2 },
      { code: "multiply", title: "Multiplicerade i stället för att dela", say: "För att få " + v + " ensamt gör du motsatsen till det som händer med " + v + ". Multiplicerade du där du skulle dela?", value: B2 * A },
      { code: "subtract", title: "Drog ifrån i stället för att dela", say: "Talet framför " + v + " är en faktor: det delar du med, du drar inte ifrån det.", value: B2 - A },
      { code: "inverted", title: "Delade tvärtom", say: "Du delade fel tal med fel tal. Det som ska delas är det som blir kvar på andra sidan, med talet som står framför " + v + ".", value: A / B2 },
      { code: "negated", title: "Fel tecken på svaret", say: "Beloppet stämmer men tecknet gör det inte. Kontrollera vad som händer med minustecknen när du flyttar och delar.", value: -right },
      { code: "one-side", title: "Bara ena sidan ändrades", say: "Det ser ut som att du tog bort ett tal från ena sidan men inte från den andra. Det du gör på ena sidan måste du göra på den andra.", value: p.R.b / A }
    ].filter((m) => Number.isFinite(m.value) && !close(m.value, right) && !(m.code === "sign-const" && close(p.L.b, 0)) && !(m.code === "sign-var" && (close(A1, 0) || close(p.R.a, 0))) && !(m.code === "one-side" && close(p.L.b, 0)));
    const hit = list.filter((m) => close(m.value, value) || (m.also !== undefined && close(m.also, value) && !close(m.also, right)));
    const codes = Array.from(new Set(hit.map((m) => m.code)));
    if (codes.length !== 1) return null;
    const m = hit[0];
    // check by putting the answer in: the two sides do not agree
    const left = p.L.a * value + p.L.b, rightSide = p.R.a * value + p.R.b;
    return { kind: "solve", code: m.code, title: m.title, explanation: m.say + " Prova: med " + v + " = " + shown(value) + " blir vänster sida " + shown(left) + " och höger sida " + shown(rightSide) + ".", left: left, right: rightSide, A2: A2 };
  }

  // ----- finding the equation or the expression in a question -----
  const MATHCHARS = /^[0-9A-Za-z+\-−–·×*/÷^()=.,\s²³√]+$/;
  function extractMath(prompt) {
    const text = String(prompt || "").replace(/[”“"]/g, " ");
    const segments = text.split(/[.?!]\s+|[:;]\s+|\n/);
    const found = [];
    segments.forEach((seg) => {
      const words = seg.split(/\s+/);
      for (let i = 0; i < words.length; i++) {
        const tail = words.slice(i).join(" ").replace(/[.?!]+$/, "");
        if (!tail || !MATHCHARS.test(tail) || /[A-Za-z]{3,}/.test(tail.replace(/sqrt|sin|cos|tan/g, ""))) continue;
        if (!/[=+\-−*·×/^()]/.test(tail)) continue;   // something to calculate with
        // a word of the sentence that is not maths: "x om x + 8 = 21" (om) and "räknat ut 410 − 186" (ut) would be read as the letters o and m, or u and t, multiplied
        // with what is next to them. A word of two letters or more that has something else right beside it (not an operator) belongs to the sentence: the maths starts after it.
        const tokens = tail.split(/\s+/);
        const isWord = (w) => /^[A-Za-z]{2,}$/.test(w) && !/^(sqrt|sin|cos|tan)$/.test(w);
        if (tokens.some((w, k) => isWord(w) && ((tokens[k + 1] && /[A-Za-z0-9]/.test(tokens[k + 1])) || (tokens[k - 1] && /[A-Za-z0-9]/.test(tokens[k - 1]))))) continue;
        const ast = parseSafe(tail);
        if (!ast) continue;
        const vars = variablesOf(ast);
        if (!vars.size) continue;
        // "x = 4" tells a value, it is not an equation to solve
        if (ast.type === "EQUATION" && ((ast.left.type === "VARIABLE" && !variablesOf(ast.right).size) || (ast.right.type === "VARIABLE" && !variablesOf(ast.left).size))) break;
        found.push({ text: tail, kind: ast.type === "EQUATION" ? "equation" : "expression", ast: ast, vars: Array.from(vars) });
        break;
      }
    });
    return found.find((f) => f.kind === "equation") || found.sort((a, b) => b.text.length - a.text.length)[0] || null;
  }

  // ----- an expression as it is written on paper -----
  function show(ast, options) {
    const opt = options || {};
    const sub = opt.sub || {};
    const prec = (n) => (n.type === "BINARY_OP" ? ({ "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 })[n.op] : n.type === "UNARY_OP" ? 3 : 5);
    function go(n, parent, side) {
      let s, p = prec(n);
      switch (n.type) {
        case "NUMBER": return shown(n.value);
        case "VARIABLE":
          if (n.name in sub) { const v = sub[n.name]; const bare = parent === 0 || (parent === 1 && side === "l"); return v < 0 && !bare ? "(" + shown(v) + ")" : shown(v); }
          return n.name;
        case "FUNCTION": return (n.name === "sqrt" ? "√" : n.name) + "(" + go(n.arg, 0) + ")";
        case "UNARY_OP": s = "−" + go(n.operand, 3); break;
        case "EQUATION": return go(n.left, 0) + " = " + go(n.right, 0);
        default: {
          const l = go(n.left, p, "l"), r = go(n.right, p, "r");
          if (n.op === "*") {
            const implicit = !opt.dots && n.left.type === "NUMBER" && n.right.type === "VARIABLE" && !(n.right.name in sub);
            s = implicit ? l + r : l + " · " + r;
          } else if (n.op === "^") s = l + "^" + r;
          else s = l + " " + (n.op === "-" ? "−" : n.op) + " " + r;
        }
      }
      const need = p < parent || (p === parent && side === "r" && (n.op === "-" || n.op === "/"));
      return need ? "(" + s + ")" : s;
    }
    return go(ast, 0);
  }

  // the equation with the answer put in, step by step
  function substitution(prompt, answer) {
    const m = extractMath(prompt);
    if (!m || m.kind !== "equation" || m.vars.length !== 1) return null;
    const v = m.vars[0];
    // the answer: "4", "x = 4", "4 = x", "−1,5", "3/2"
    let raw = String(answer === undefined || answer === null ? "" : answer).trim();
    const lead = new RegExp("^" + v + "\\s*=\\s*(.+)$", "i").exec(raw) || new RegExp("^(.+?)\\s*=\\s*" + v + "$", "i").exec(raw);
    if (lead) raw = lead[1];
    const norm = raw.replace(",", ".");
    if (!/^[\s0-9+\-−–*/().,·]+$/.test(norm) || !/[0-9]/.test(norm)) return null;
    const valueAst = parseSafe(norm);
    if (!valueAst || variablesOf(valueAst).size) return null;
    const value = evalAt(valueAst, {});
    if (!Number.isFinite(value)) return null;
    const scope = {}; scope[v] = value;
    const left = evalAt(m.ast.left, scope), right = evalAt(m.ast.right, scope);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
    const sub = {}; sub[v] = value;
    return {
      equation: show(m.ast), variable: v, value: value, left: left, right: right, equal: close(left, right),
      parts: { before: show(m.ast), after: show(m.ast, { sub: sub, dots: true }), leftText: show(m.ast.left, { sub: sub, dots: true }), rightText: show(m.ast.right, { sub: sub, dots: true }), valueText: shown(value) }
    };
  }

  // ----- "Förenkla": a right value that is not simplified yet -----
  // The terms of an expression written out (no brackets): each with the letters it has, so that terms with the same letters are found. 4x + 5 − x has two
  // terms with x, and 5 and 2 are two numbers: both can be added.
  function termKeys(text) {
    const s = String(text).replace(/\s+/g, "").replace(/[−–]/g, "-").replace(/,/g, ".");
    if (!s) return null;
    const keys = [];
    const parts = s.split(/(?=[+-])/).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const m = /^[+-]?(\d+(?:\.\d+)?)?([*·]?)(.*)$/.exec(parts[i]);
      const rest = m[3].replace(/[*·]/g, "");
      if (m[1] && /^\d/.test(m[3])) return null;   // 2·3: a product of numbers, which is for another check
      if (!rest) { keys.push("#"); continue; }
      const factors = rest.match(/[a-zA-Z](?:\^\d+)?/g);
      if (!factors || factors.join("") !== rest) { keys.push("?" + i); continue; }   // a root, a fraction or something else: not compared
      keys.push(factors.slice().sort().join(""));
    }
    return keys;
  }
  function collectedNote(raw) {
    const keys = termKeys(raw);
    if (!keys) return "";
    const seen = new Set();
    for (const k of keys) {
      if (k.charAt(0) === "?") continue;
      if (seen.has(k)) return "Det stämmer, men du kan förenkla mer: det finns termer som är lika och går att lägga ihop (de med samma bokstäver, och de vanliga talen).";
      seen.add(k);
    }
    return "";
  }
  // For a question that says Förenkla or Utveckla: the answer has the right value, but is it as short as it can be? Only when the right answer itself is, so that
  // a question about something else (a factorised form, a root) is left alone.
  function simplifyNote(raw, prompt, expected) {
    if (!/^\s*(förenkla|utveckla)/i.test(String(prompt))) return "";
    const right = Array.isArray(expected) ? String(expected[0] || "") : String(expected || "");
    if (!right || /[<>=\/]/.test(right) || /[<>=\/]/.test(String(raw))) return "";
    // the brackets of sqrt(2) and sin(x) are part of the function, not brackets to multiply out
    const bare = (s) => String(s).replace(/(sqrt|sin|cos|tan|ln|lg|log|exp|abs)\([^()]*\)/gi, "F");
    if (/[()]/.test(bare(right)) || collectedNote(right)) return "";
    if (/[()]/.test(bare(raw))) return "Det stämmer, men skriv uttrycket utan parentes. Multiplicera ut parentesen först och samla sedan lika termer.";
    return collectedNote(raw);
  }

  // An answer to "bryt ut en faktor" is not enough as 6x + 9 (it is equal, but nothing is broken out), nor as 2(3x + 4,5) or 3(2x + 3) when 6 is there to break out
  function factoredNote(raw) {
    const text = String(raw).trim();
    if (!/[()]/.test(text)) return "Det stämmer, men du ska bryta ut en faktor: skriv uttrycket som en produkt, med en faktor utanför en parentes.";
    const inner = /\(([^()]*)\)/.exec(text);
    if (inner) {
      // the number in front of each term inside the bracket (a letter alone is 1)
      const terms = inner[1].split(/(?=[+\-−])/).map((t) => t.trim()).filter(Boolean);
      const coefficients = terms.map((t) => { const m = /^[+\-−]?\s*(\d+(?:[.,]\d+)?)/.exec(t); return m ? Number(m[1].replace(",", ".")) : /[a-z]/i.test(t) ? 1 : NaN; }).filter((n) => !Number.isNaN(n));
      if (coefficients.some((n) => !Number.isInteger(n))) return "Det stämmer, men en decimal inuti parentesen visar att du kan bryta ut en större faktor, så att bara heltal blir kvar inuti.";
      const gcd = (x, y) => (y ? gcd(y, x % y) : x);
      if (coefficients.length >= 2 && coefficients.reduce(gcd, 0) > 1) return "Det stämmer, men du kan bryta ut mer: det finns en faktor till som alla termer inuti parentesen går att dela med.";
    }
    return "";
  }

  // the mistake behind a wrong answer to a question, or null
  function diagnose(answer, prompt) {
    const m = extractMath(prompt);
    if (!m) return null;
    if (m.kind === "equation") return solutionMistake(String(answer).replace(/^\s*[a-z]\s*=\s*/i, ""), m.text);
    return expressionMistake(answer, m.text);
  }

  const api = { solutions: solutions, sameSolutions: sameSolutions, sameFunction: sameFunction, stepCheck: stepCheck, diagnose: diagnose, expressionMistake: expressionMistake,
    inequality: inequality, sameInequality: sameInequality, factoredNote: factoredNote, collectedNote: collectedNote, simplifyNote: simplifyNote,
    solutionMistake: solutionMistake, extractMath: extractMath, substitution: substitution, show: show, sidesOf: sidesOf, linear: linear, RULES: RULES };
  root.GaussicaAlgebra = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
