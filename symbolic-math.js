(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MATTE_SYMBOLIC = factory();
  }
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // --- Normalisering av matematiska strängar ---
  function cleanMathString(str) {
    if (typeof str !== "string") str = String(str || "");
    return str
      .trim()
      // Ersätt decimalkomma med punkt
      .replace(/(\d+),(\d+)/g, "$1.$2")
      // Ersätt unicode-minus och tankstreck med vanligt bindestreck
      .replace(/[−–—]/g, "-")
      // Ersätt multiplikationstecken med asterisk
      .replace(/[·×]/g, "*")
      // Ersätt divisionstecken och kolon med snedstreck
      .replace(/[÷:]/g, "/")
      // Ersätt procent med bråkdel (t.ex. 50% -> (50/100))
      .replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)")
      // Normalisera blanksteg
      .replace(/\s+/g, " ");
  }

  // Tar bort vanliga enheter (t.ex. "cm", "kr", "röster", "böcker", "elever") för ren matematisk jämförelse
  function stripUnits(str) {
    // Ett tal direkt följt av en enhet utan mellanslag ("24cm", "36m", "25cm2") räknas som talet.
    const cleaned = cleanMathString(str)
      .replace(/^(\s*-?\d+(?:\.\d+)?)\s*(?:(?:mm|cm|dm|km|m)(?:²|2|\^2)?|kr|kg|dl|st)\s*$/i, "$1");
    return cleaned
      // kvadratenheter först (cm², m2 …), därefter vanliga enheter och ord
      .replace(/\b(mm|cm|dm|km|m)\s*(?:²|2|\^2)(?![0-9])/gi, "")
      .replace(/\b(kvadratcentimeter|kvadratmeter|centimeter|millimeter|meter|cm|m|mm|dm|km|kr|kronor|st|stycken|röster|böcker|elever|grader|mål|poäng|rutor|ruta|sidor|hörn|kg|dl|liter|timmar|minuter|dagar|korgar|kulor|kort)\b/gi, "")
      .trim();
  }

  // Sätter in explicit multiplikation: 3x -> 3*x, 3(x+1) -> 3*(x+1), (x+1)(x-1) -> (x+1)*(x-1)
  function insertImplicitMultiplication(expr) {
    return expr
      .replace(/(\d+)\s*([a-zA-Z])/g, "$1*$2")
      .replace(/(\d+)\s*(\()/g, "$1*$2")
      .replace(/(\))\s*(\()/g, "$1*$2")
      .replace(/(\))\s*([a-zA-Z])/g, "$1*$2")
      .replace(/([a-zA-Z])\s*(\()/g, function (match, p1, p2) {
        // Behåll funktionsnamn som sin, cos, sqrt osv.
        const fnNames = ["sin", "cos", "tan", "sqrt", "ln", "exp", "abs"];
        if (fnNames.includes(p1.toLowerCase())) return match;
        return p1 + "*" + p2;
      });
  }

  // --- Tokenizer & AST-parser ---
  function tokenize(input) {
    const s = insertImplicitMultiplication(cleanMathString(input)).replace(/\s+/g, "");
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/[0-9.]/.test(ch)) {
        let numStr = "";
        while (i < s.length && /[0-9.]/.test(s[i])) {
          numStr += s[i];
          i += 1;
        }
        tokens.push({ type: "NUMBER", value: parseFloat(numStr) });
      } else if (/[a-zA-Z]/.test(ch)) {
        let ident = "";
        while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) {
          ident += s[i];
          i += 1;
        }
        tokens.push({ type: "IDENT", value: ident });
      } else if ("+-*/^=()[]{}".includes(ch)) {
        const charMap = { "[": "(", "{": "(", "]": ")", "}": ")" };
        tokens.push({ type: "OP", value: charMap[ch] || ch });
        i += 1;
      } else {
        i += 1; // Ignorera okända tecken
      }
    }
    return tokens;
  }

  function parse(input) {
    const tokens = tokenize(input);
    let pos = 0;

    function peek() {
      return tokens[pos] || null;
    }

    function consume(expected) {
      const token = tokens[pos];
      if (!token) throw new Error("Oväntat slut på matematiskt uttryck");
      if (expected && token.value !== expected && token.type !== expected) {
        throw new Error("Väntade '" + expected + "' men fann '" + token.value + "'");
      }
      pos += 1;
      return token;
    }

    // Ekvation: Expr = Expr
    function parseEquation() {
      const left = parseExpression();
      if (peek() && peek().value === "=") {
        consume("=");
        const right = parseExpression();
        return { type: "EQUATION", left: left, right: right };
      }
      return left;
    }

    // Addition och subtraktion
    function parseExpression() {
      let node = parseTerm();
      while (peek() && (peek().value === "+" || peek().value === "-")) {
        const op = consume().value;
        const right = parseTerm();
        node = { type: "BINARY_OP", op: op, left: node, right: right };
      }
      return node;
    }

    // Multiplikation och division
    function parseTerm() {
      let node = parsePower();
      while (peek() && (peek().value === "*" || peek().value === "/")) {
        const op = consume().value;
        const right = parsePower();
        node = { type: "BINARY_OP", op: op, left: node, right: right };
      }
      return node;
    }

    // Potenser: a ^ b (högerassociativ)
    function parsePower() {
      let node = parseUnary();
      if (peek() && peek().value === "^") {
        consume("^");
        const right = parsePower();
        node = { type: "BINARY_OP", op: "^", left: node, right: right };
      }
      return node;
    }

    // Unärt minus / plus
    function parseUnary() {
      if (peek() && peek().value === "-") {
        consume("-");
        const operand = parseUnary();
        return { type: "UNARY_OP", op: "-", operand: operand };
      }
      if (peek() && peek().value === "+") {
        consume("+");
        return parseUnary();
      }
      return parsePrimary();
    }

    // Primära uttryck: tal, variabler, parenteser, funktionsanrop
    function parsePrimary() {
      const token = peek();
      if (!token) throw new Error("Väntade ett tal eller en variabel");

      if (token.type === "NUMBER") {
        consume();
        return { type: "NUMBER", value: token.value };
      }

      if (token.type === "IDENT") {
        const ident = consume().value;
        if (peek() && peek().value === "(") {
          consume("(");
          const arg = parseExpression();
          consume(")");
          return { type: "FUNCTION", name: ident.toLowerCase(), arg: arg };
        }
        return { type: "VARIABLE", name: ident };
      }

      if (token.value === "(") {
        consume("(");
        const expr = parseExpression();
        consume(")");
        return expr;
      }

      throw new Error("Oväntat tecken: " + token.value);
    }

    const ast = parseEquation();
    if (pos < tokens.length) {
      throw new Error("Överflödiga tecken i uttrycket");
    }
    return ast;
  }

  // --- AST-evaluering ---
  function evaluateAST(ast, scope) {
    scope = scope || {};
    if (!ast) return NaN;

    switch (ast.type) {
      case "NUMBER":
        return ast.value;

      case "VARIABLE":
        if (scope[ast.name] !== undefined) return scope[ast.name];
        if (ast.name.toLowerCase() === "pi") return Math.PI;
        if (ast.name.toLowerCase() === "e") return Math.E;
        return NaN;

      case "UNARY_OP":
        if (ast.op === "-") return -evaluateAST(ast.operand, scope);
        return evaluateAST(ast.operand, scope);

      case "BINARY_OP": {
        const a = evaluateAST(ast.left, scope);
        const b = evaluateAST(ast.right, scope);
        if (ast.op === "+") return a + b;
        if (ast.op === "-") return a - b;
        if (ast.op === "*") return a * b;
        if (ast.op === "/") return b === 0 ? NaN : a / b;
        if (ast.op === "^") return Math.pow(a, b);
        return NaN;
      }

      case "FUNCTION": {
        const val = evaluateAST(ast.arg, scope);
        const name = ast.name.toLowerCase();
        if (name === "sin") return Math.sin(val);
        if (name === "cos") return Math.cos(val);
        if (name === "tan") return Math.tan(val);
        if (name === "sqrt") return val < 0 ? NaN : Math.sqrt(val);
        if (name === "abs") return Math.abs(val);
        if (name === "ln") return val <= 0 ? NaN : Math.log(val);
        if (name === "exp") return Math.exp(val);
        return NaN;
      }

      case "EQUATION":
        return evaluateAST(ast.left, scope) - evaluateAST(ast.right, scope);

      default:
        return NaN;
    }
  }

  // Extrahera alla fria variabler i ett AST
  function extractVariables(ast, vars) {
    vars = vars || new Set();
    if (!ast) return vars;
    if (ast.type === "VARIABLE") {
      const n = ast.name.toLowerCase();
      if (n !== "pi" && n !== "e") vars.add(ast.name);
    } else if (ast.type === "BINARY_OP") {
      extractVariables(ast.left, vars);
      extractVariables(ast.right, vars);
    } else if (ast.type === "UNARY_OP" || ast.type === "FUNCTION") {
      extractVariables(ast.operand || ast.arg, vars);
    } else if (ast.type === "EQUATION") {
      extractVariables(ast.left, vars);
      extractVariables(ast.right, vars);
    }
    return vars;
  }

  // --- Symbolisk ekvivalensprövning ---
  // Jämför två matematiska uttryck med multi-point random sampling
  function areEquivalent(studentInput, expectedInput) {
    if (studentInput === undefined || studentInput === null) return false;
    if (expectedInput === undefined || expectedInput === null) return false;

    // 1. Direkt stränglikhet (normaliserad)
    const normStudent = cleanMathString(studentInput).toLowerCase().replace(/\s+/g, "");
    const normExpected = cleanMathString(expectedInput).toLowerCase().replace(/\s+/g, "");
    if (normStudent === normExpected) return true;

    // 2. Stränglikhet efter att enheter tagits bort (t.ex. "7" mot "7 röster")
    const cleanS = stripUnits(studentInput).toLowerCase().replace(/\s+/g, "");
    const cleanE = stripUnits(expectedInput).toLowerCase().replace(/\s+/g, "");
    if (cleanS === cleanE && cleanS !== "") return true;

    // 3. Ekvationsjämförelse för enkla former som "x = 4", "4 = x" och "4"
    function parseSimpleEq(str) {
      const m1 = str.match(/^([a-z])=([0-9.-]+)$/i);
      if (m1) return { v: m1[1].toLowerCase(), n: parseFloat(m1[2]) };
      const m2 = str.match(/^([0-9.-]+)=([a-z])$/i);
      if (m2) return { v: m2[2].toLowerCase(), n: parseFloat(m2[1]) };
      if (str !== "" && !isNaN(Number(str))) return { v: null, n: parseFloat(str) };
      return null;
    }
    const eqS = parseSimpleEq(cleanS);
    const eqE = parseSimpleEq(cleanE);
    if (eqS && eqE && Math.abs(eqS.n - eqE.n) < 1e-6) {
      if (!eqS.v || !eqE.v || eqS.v === eqE.v) return true;
    }

    // 4. Symbolisk parser-jämförelse
    try {
      const astStudent = parse(cleanS);
      const astExpected = parse(cleanE);

      // Om båda är rena ekvationer: t.ex. x - 4 = 0 eller 3x + 2 = 14
      if (astStudent.type === "EQUATION" || astExpected.type === "EQUATION") {
        const vars = new Set();
        extractVariables(astStudent, vars);
        extractVariables(astExpected, vars);
        const varList = Array.from(vars);

        // Om det bara finns en variabel och båda kan lösas numeriskt
        if (varList.length === 1) {
          const testPoints = [ -2.71, 0.43, 1.89, 3.14, 5.27 ];
          let matchCount = 0;
          for (let p of testPoints) {
            const scope = {};
            scope[varList[0]] = p;
            const diffS = evaluateAST(astStudent, scope);
            const diffE = evaluateAST(astExpected, scope);
            if (isNaN(diffS) || isNaN(diffE)) continue;
            // Ekvationer kan ha gemensam multipel: t.ex. 2x - 8 = 0 och x - 4 = 0
            if (Math.abs(diffS) < 1e-5 && Math.abs(diffE) < 1e-5) {
              matchCount += 1;
            }
          }
          if (matchCount >= 1) return true;
        }
      }

      // Hämta variabler i uttrycken
      const vars = new Set();
      extractVariables(astStudent, vars);
      extractVariables(astExpected, vars);
      const varList = Array.from(vars);

      // Om uttrycket inte har variabler (konstantuttryck, t.ex. bråk som 3/4 och 0.75 eller 2/4+1/4)
      if (varList.length === 0) {
        const valS = evaluateAST(astStudent, {});
        const valE = evaluateAST(astExpected, {});
        if (!isNaN(valS) && !isNaN(valE)) {
          return Math.abs(valS - valE) < 1e-7;
        }
      }

      // Om uttrycket har variabler: använd 7 slumpmässiga testpunkter
      const testCases = [
        [1.73, -2.41, 0.85, 3.19],
        [-1.38, 2.64, -0.92, 4.07],
        [3.81, 1.15, -3.22, -1.84],
        [0.47, -4.13, 2.36, 1.95],
        [-2.89, 3.72, 1.63, -0.71],
        [2.11, -1.54, 4.48, 2.83],
        [-3.65, 0.79, -2.17, 3.52]
      ];

      let allMatch = true;
      let validTests = 0;

      for (let tc of testCases) {
        const scope = {};
        varList.forEach(function (v, idx) {
          scope[v] = tc[idx % tc.length];
        });

        const valS = evaluateAST(astStudent, scope);
        const valE = evaluateAST(astExpected, scope);

        if (isNaN(valS) || isNaN(valE)) continue;
        validTests += 1;

        if (Math.abs(valS - valE) > 1e-6) {
          allMatch = false;
          break;
        }
      }

      return allMatch && validTests >= 3;
    } catch (e) {
      // Om parsern stöter på icke-matematiska uttryck, fall tillbaka till strängjämförelse
      return false;
    }
  }

  // --- Automatisk diagnos av vanliga missuppfattningar ---
  // Analyserar elevens svar mot förväntat svar och uppgiftskontext
  function diagnoseMisconception(studentAnswer, expectedAnswer, context) {
    if (!studentAnswer || !expectedAnswer) return null;
    const sClean = stripUnits(studentAnswer).toLowerCase().replace(/\s+/g, "");
    const eClean = stripUnits(expectedAnswer).toLowerCase().replace(/\s+/g, "");
    if (sClean === eClean) return null;

    const promptText = (context && context.prompt ? context.prompt : "").toLowerCase();
    const explanationText = (context && context.explanation ? context.explanation : "").toLowerCase();
    const fullContext = promptText + " " + explanationText;

    const sNum = parseFloat(sClean);
    const eNum = parseFloat(eClean);

    // 1. Kedjeregeln (Inre derivatan / funktion av funktion)
    if (fullContext.includes("kedjeregel") || fullContext.includes("derivat") || fullContext.includes("f(g(x))") || fullContext.includes("derivera")) {
      // Om svaret saknar inre derivatan: t.ex. derivera (2x+1)^3 -> förväntat 6*(2x+1)^2, svarat 3*(2x+1)^2
      const innerFactors = ["2", "3", "4", "5", "x", "2*x", "3*x", "-1", "-2"];
      for (let factor of innerFactors) {
        if (areEquivalent("(" + studentAnswer + ") * " + factor, expectedAnswer)) {
          return {
            code: "CHAIN_RULE_OMISSION",
            title: "Glömt inre derivatan (kedjeregeln)",
            explanation: "Du har deriverat den yttre funktionen rätt, men glömt att multiplicera med den inre derivatan (" + factor + "): (f(g(x)))' = f'(g(x)) · g'(x)."
          };
        }
      }
    }

    // 2. Distributiva lagen (endast multiplicerat första termen)
    // T.ex. 3(x + 4) -> svarat 3x + 4 i stället för 3x + 12
    if (fullContext.includes("(") || fullContext.includes("parentes") || fullContext.includes("multiplicer") || fullContext.includes("förenkla")) {
      const matchParen = (promptText + " " + fullContext).match(/(\d+)\s*\*?\s*\(\s*([a-z0-9]+)\s*([+-])\s*(\d+)\s*\)/i);
      if (matchParen) {
        const k = parseFloat(matchParen[1]);
        const innerTerm = matchParen[2];
        const op = matchParen[3];
        const constTerm = parseFloat(matchParen[4]);
        const partialDistributive = k + innerTerm + op + constTerm;
        if (areEquivalent(studentAnswer, partialDistributive)) {
          return {
            code: "DISTRIBUTIVE_RULE_PARTIAL",
            title: "Distributiva lagen (glömt multiplicera hela parentesen)",
            explanation: "Det ser ut som att faktorn " + k + " bara multiplicerades med den första termen (" + innerTerm + "). Kom ihåg att multiplicera in i hela parentesen: " + k + " · " + constTerm + " = " + (k * constTerm) + "."
          };
        }
      }
    }

    // 3. Associativa lagen & teckenfel vid subtraktion av parentes
    // a - (b + c) svarat som a - b + c
    if (fullContext.includes("-") && (fullContext.includes("(") || fullContext.includes("parentes"))) {
      if (areEquivalent(sClean + " - 2", eClean) || areEquivalent(sClean + " + 2", eClean)) {
        return {
          code: "ASSOCIATIVE_SIGN_ERROR",
          title: "Teckenfel vid parentes (associativa regeln)",
          explanation: "Se upp med minustecknet framför parentesen! När parentesen tas bort byter alla termer inuti tecken: a − (b + c) = a − b − c."
        };
      }
    }

    // 4. Bråkaddition: Adderat täljare med täljare och nämnare med nämnare
    // T.ex. 1/2 + 1/3 = 2/5 (eller 1/2 + 1/4 = 2/6 = 1/3)
    if (fullContext.includes("/") || fullContext.includes("bråk") || fullContext.includes("addera") || fullContext.includes("+") || fullContext.includes("fjärdedel") || fullContext.includes("halv")) {
      const fracMatch = (promptText + " " + fullContext).match(/(\d+)\s*\/\s*(\d+)\s*\+\s*(\d+)\s*\/\s*(\d+)/);
      if (fracMatch) {
        const num1 = parseInt(fracMatch[1], 10);
        const den1 = parseInt(fracMatch[2], 10);
        const num2 = parseInt(fracMatch[3], 10);
        const den2 = parseInt(fracMatch[4], 10);
        const badNum = num1 + num2;
        const badDen = den1 + den2;
        if (areEquivalent(studentAnswer, badNum + "/" + badDen) || sClean === badNum + "/" + badDen) {
          return {
            code: "FRACTION_ADDITION_ACROSS",
            title: "Bråkaddition utan gemensam nämnare",
            explanation: "Du har lagt ihop täljare med täljare (" + num1 + " + " + num2 + " = " + badNum + ") och nämnare med nämnare (" + den1 + " + " + den2 + " = " + badDen + "). Bråk kan bara adderas när delarna är lika stora. Hitta en gemensam nämnare först!"
          };
        }
      }
      if (sClean === "2/6" || sClean === "1/6" || sClean === "2/4" || sClean === "2/5" || sClean === "3/5" || sClean === "1/3") {
        if (!areEquivalent(studentAnswer, expectedAnswer) && (fullContext.includes("bråk") || fullContext.includes("/"))) {
          return {
            code: "FRACTION_ADDITION_ACROSS",
            title: "Bråkaddition utan gemensam nämnare",
            explanation: "Du verkar ha lagt ihop täljarna för sig och nämnarna för sig. För att addera bråk måste delarna ha samma nämnare (vara lika stora)!"
          };
        }
      }
    }

    // 5. Bråkdivision: Glömt att invertera det andra bråket
    if (fullContext.includes("dela") && fullContext.includes("bråk")) {
      return {
        code: "FRACTION_DIVISION_INVERT",
        title: "Glömt invertera vid bråkdivision",
        explanation: "Division med ett bråk beräknas genom att multiplicera med bråkets inverterade värde (vänd upp och ned på det andra bråket)."
      };
    }

    // 6. Ekvationsbalans: Teckenfel vid flytt över likhetstecknet
    // T.ex. 3x + 2 = 14 -> x = 16 i stället för 4 (eller 3x = 16)
    if (fullContext.includes("ekvation") || fullContext.includes("likhetstecknet") || fullContext.includes("=")) {
      if (sNum === 16 || sNum === 16/3) {
        return {
          code: "EQUATION_SIGN_INVERSION",
          title: "Ekvationsbalans: fel tecken vid överflyttning",
          explanation: "Det ser ut som att 2 lades till i stället för att subtraheras. För att nollställa +2 på vänster sida måste du ta bort 2 från båda sidor: 14 − 2 = 12."
        };
      }
      // Halvfärdig ekvationslösning (stannade vid 3x = 12)
      if (sNum === 12 && eNum === 4) {
        return {
          code: "EQUATION_HALFWAY",
          title: "Halvfärdig lösning",
          explanation: "Du subtraherade 2 och fick 12. Det är ett helt rätt första steg! Men 3x betyder 3 gånger x. Dela 12 med 3 för att få vad x ensamt är."
        };
      }
      // Multiplicerat i stället för dividerat (12 * 3 = 36)
      if (sNum === 36 && eNum === 4) {
        return {
          code: "EQUATION_MULT_INSTEAD_OF_DIV",
          title: "Multiplikation i stället för division",
          explanation: "För att få x ensamt ur 3x = 12 måste du göra motsatsen till multiplikation: dividera båda sidor med 3."
        };
      }
    }

    // 7. Räkneordning (PEMDAS / Multiplikation före addition)
    // T.ex. i 40 + 12 * 5 = 100, svarat (40 + 12) * 5 = 260
    // Eller i 2 + 3 * 4 = 14, svarat 20
    if (!isNaN(sNum) && !isNaN(eNum)) {
      const pemdasMatch = promptText.match(/(\d+)\s*([+−-])\s*(\d+)\s*([*·×])\s*(\d+)/);
      if (pemdasMatch) {
        const n1 = parseFloat(pemdasMatch[1]);
        const op1 = pemdasMatch[2];
        const n2 = parseFloat(pemdasMatch[3]);
        const n3 = parseFloat(pemdasMatch[5]);
        const leftToRight = (op1 === "-" || op1 === "−") ? (n1 - n2) * n3 : (n1 + n2) * n3;
        if (Math.abs(sNum - leftToRight) < 1e-5) {
          return {
            code: "ORDER_OF_OPERATIONS",
            title: "Räkneordningsfel (precedens)",
            explanation: "Multiplikation ska alltid räknas före addition och subtraktion! Beräkna först " + n2 + " · " + n3 + " = " + (n2 * n3) + ", och addera/subtrahera därefter med " + n1 + "."
          };
        }
      }
      if (sNum === 260 && eNum === 100) {
        return {
          code: "ORDER_OF_OPERATIONS",
          title: "Räkneordningsfel (precedens)",
          explanation: "Multiplikation ska alltid räknas före addition! Beräkna först sträckpriset 12 × 5 = 60 kr, och lägg sedan till startavgiften 40 kr: 40 + 60 = 100 kr."
        };
      }
      if (sNum === 10 && eNum === 9) {
        return {
          code: "ORDER_OF_OPERATIONS",
          title: "Räkneordningsfel (precedens)",
          explanation: "Räkna multiplikationen först: 2 · 4 = 8, och addera därefter 1: 8 + 1 = 9."
        };
      }
    }

    // 8. Summa i stället för skillnad (Diagram och textuppgifter)
    // T.ex. 12 och 5 röster, frågan gäller "hur många fler", studenten svarar 17 (12 + 5)
    // Eller 18 cyklar och 11 går, svarat 29 (18 + 11)
    if (fullContext.includes("fler") || fullContext.includes("skillnad") || fullContext.includes("diagram")) {
      if ((sNum === 17 && eNum === 7) || (sNum === 29 && eNum === 7)) {
        return {
          code: "SUM_INSTEAD_OF_DIFFERENCE",
          title: "Summa i stället för skillnad",
          explanation: "Du har lagt ihop värdena (addition). Frågan gäller 'hur många fler', vilket är skillnaden mellan grupperna. Använd subtraktion för att jämföra."
        };
      }
    }

    // 9. Enhetsfel (faktor 10, 100 eller 1000 fel)
    if (!isNaN(sNum) && !isNaN(eNum) && eNum !== 0) {
      if (Math.abs(sNum / eNum - 10) < 1e-4 || Math.abs(sNum / eNum - 100) < 1e-4) {
        return {
          code: "UNIT_SCALE_TOO_LARGE",
          title: "Enhets- eller tiopotensfel",
          explanation: "Ditt svar är 10 eller 100 gånger för stort. Kontrollera nollorna och omvandlingsfaktorn för enheten."
        };
      }
      if (Math.abs(eNum / sNum - 10) < 1e-4 || Math.abs(eNum / sNum - 100) < 1e-4) {
        return {
          code: "UNIT_SCALE_TOO_SMALL",
          title: "Enhets- eller tiopotensfel",
          explanation: "Ditt svar är 10 eller 100 gånger för litet. Kontrollera nollorna och omvandlingsfaktorn för enheten."
        };
      }
      // Teckenfel (svarade negativt när det skulle vara positivt eller vice versa)
      if (Math.abs(sNum + eNum) < 1e-4 && sNum !== 0) {
        return {
          code: "SIGN_REVERSAL",
          title: "Motsatt tecken (+ / −)",
          explanation: "Ditt värde stämmer i storlek men har fel tecken (+ eller −). Kontrollera om svaret ska vara positivt eller negativt."
        };
      }
    }

    return null;
  }

  // --- Kladdpapper-evaluator (Live-uträkning av rader) ---
  function evaluateScratchpad(text) {
    if (!text || typeof text !== "string") return { results: [], lastResult: null };
    const lines = text.split("\n");
    const results = [];
    let lastResult = null;

    lines.forEach(function (line) {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Om raden redan innehåller likhetstecken: t.ex. "14 - 2 = 12" eller "14 - 2 ="
      let exprToEval = trimmed;
      if (trimmed.includes("=")) {
        const parts = trimmed.split("=");
        // Om högra sidan är tom eller innehåller variabel, evaluera vänster
        exprToEval = parts[parts.length - 1].trim() || parts[0].trim();
      }

      const cleaned = stripUnits(exprToEval);
      try {
        const ast = parse(cleaned);
        // Endast uttryck utan okända variabler (eller med kända som x om det är en enkel beräkning)
        const vars = extractVariables(ast);
        if (vars.size === 0) {
          const val = evaluateAST(ast, {});
          if (!isNaN(val) && isFinite(val)) {
            const formatted = Math.round(val * 10000) / 10000;
            results.push({ line: trimmed, value: formatted });
            lastResult = formatted;
          }
        }
      } catch (err) {
        // Ignorera rader med ren text
      }
    });

    return { results: results, lastResult: lastResult };
  }

  // --- Svar som uträkning eller som tal ---
  // Ett svar som "36/6" eller "3*6" är rätt värde men ingen uträkning av svaret. Hjälpfunktionerna nedan
  // gör det möjligt att kräva ett uträknat tal när frågan går ut på att räkna ut något.

  // Svaret utan blanksteg, med decimalpunkt och utan inledande "x =".
  function bareAnswer(str) {
    return String(str === undefined || str === null ? "" : str).toLowerCase()
      .replace(/\s+/g, "").replace(/,/g, ".").replace(/[−–—]/g, "-").replace(/[·×]/g, "*").replace(/÷/g, "/")
      .replace(/^[a-zåäö]=/, "");
  }

  // Ett ensamt tal, med eller utan enhet ("24", "24cm", "3,14", "20%", "125°", "15:15").
  function isPlainNumber(str) {
    const s = bareAnswer(str);
    return /^-?\d+(?:\.\d+)?(?:[a-zåäö]+[2²]?|%|°)*$/.test(s) || /^\d{1,2}:\d{2}$/.test(s);
  }

  // Innehåller svaret en räkneoperation mellan tal, till exempel "36/6", "3*6", "10-4" eller "(2+3)*4"?
  function isCalculation(str) {
    const s = bareAnswer(str).replace(/[a-zåäö²°%]/g, "");
    return /[\d)][*\/+^-][\d(]/.test(s);
  }

  // Är det väntade svaret ett vanligt tal (inte ett bråk, ett uttryck eller ett ord)?
  function expectsPlainNumber(answers) {
    const list = Array.isArray(answers) ? answers : [answers];
    return list.some(isPlainNumber) && !list.some(function (a) { return isCalculation(a) || /\//.test(bareAnswer(a)); });
  }

  return {
    cleanMathString: cleanMathString,
    stripUnits: stripUnits,
    isPlainNumber: isPlainNumber,
    isCalculation: isCalculation,
    expectsPlainNumber: expectsPlainNumber,
    tokenize: tokenize,
    parse: parse,
    evaluateAST: evaluateAST,
    areEquivalent: areEquivalent,
    diagnoseMisconception: diagnoseMisconception,
    evaluateScratchpad: evaluateScratchpad
  };
}));
