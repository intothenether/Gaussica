// Problem patterns: similar problems made in bulk with varying numbers (a lesson's problemPatterns), and the practice page for them.
// Cut out of app.js.

window.GaussicaPatterns = (function () {
  "use strict";

  const makeElement = window.GaussicaDom.makeElement;
  // ============ PROBLEM PATTERN GENERATION SYSTEM ============
  // Generates similar problems in bulk with varying parameters
  
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateProblemSet(lesson, patternId, count) {
    if (!lesson.problemPatterns) return [];
    
    const pattern = lesson.problemPatterns.find(function (p) { return p.id === patternId; });
    if (!pattern) return [];
    
    const problems = [];
    for (let i = 0; i < count; i++) {
      const problem = generateFromPattern(pattern);
      if (problem) problems.push(problem);
    }
    return problems;
  }

  function generateFromPattern(pattern) {
    if (pattern.type === 'arithmetic') {
      return generateArithmetic(pattern);
    } else if (pattern.type === 'multiStep') {
      return generateMultiStep(pattern);
    } else if (pattern.type === 'wordProblem') {
      return generateWordProblem(pattern);
    }
    return null;
  }

  function generateArithmetic(pattern) {
    const params = pattern.parameters;
    const a = randomInt(params.minA, params.maxA);
    const b = randomInt(params.minB, params.maxB);
    
    const templates = pattern.templates || [pattern.template];
    const template = templates[Math.floor(Math.random() * templates.length)];
    const prompt = template.replace('{a}', a).replace('{b}', b);
    
    let answer;
    if (pattern.operation === 'addition') {
      answer = a + b;
    } else if (pattern.operation === 'subtraction') {
      answer = a - b;
    } else if (pattern.operation === 'multiplication') {
      answer = a * b;
    } else if (pattern.operation === 'division' && b !== 0) {
      answer = Math.floor(a / b);
    } else {
      return null;
    }
    
    return { prompt: prompt, answer: String(answer), patternId: pattern.id };
  }

  function generateMultiStep(pattern) {
    const params = pattern.parameters;
    
    if (pattern.pattern === 'operator_precedence') {
      // Pattern: a op1 b op2 c (where op2 has higher precedence)
      const a = randomInt(params.minA, params.maxA);
      const b = randomInt(params.minB, params.maxB);
      const c = randomInt(params.minC, params.maxC);
      
      const templates = pattern.templates || [];
      const template = templates[Math.floor(Math.random() * templates.length)] || "{a} + {b} · {c} = ?";
      
      let prompt = template.replace('{a}', a).replace('{b}', b).replace('{c}', c);
      let answer;
      
      // Determine operation order
      if (pattern.parameters.operatorSequence[0] === 'multiplication') {
        // Multiplication first: a + b*c or a - b*c or b*c + a, etc.
        if (prompt.includes('·') && prompt.includes('+')) {
          answer = a + (b * c); // or other combo
          if (template.includes('{c} + {a}')) answer = c + (a * b);
          if (template.includes('{b} · {c} + {a}')) answer = (b * c) + a;
        } else if (prompt.includes('·') && prompt.includes('-')) {
          answer = a - (b * c);
        }
      } else if (pattern.parameters.operatorSequence[0] === 'division') {
        // Division first: a + b/2 or similar
        if (prompt.includes('/')) {
          const divisor = 2;
          const divResult = Math.floor(b / divisor);
          if (template.includes('{a} + {b}/')) {
            answer = a + divResult;
          } else if (template.includes('{b}/') && template.includes('+ {a}')) {
            answer = divResult + a;
          } else {
            answer = c + divResult;
          }
        }
      }
      
      return { prompt: prompt, answer: String(answer), patternId: pattern.id };
      
    } else if (pattern.pattern === 'parentheses') {
      const a = randomInt(params.minA, params.maxA);
      const b = randomInt(params.minB, params.maxB);
      const c = randomInt(params.minC, params.maxC);
      
      const templates = pattern.templates || [];
      const template = templates[Math.floor(Math.random() * templates.length)] || "({a} + {b}) · {c} = ?";
      
      const prompt = template.replace('{a}', a).replace('{b}', b).replace('{c}', c);
      let answer;
      
      // Handle parentheses: (a + b) * c, (a - b) * c, etc.
      if (template.includes('({a} + {b})') && template.includes('· {c}')) {
        answer = (a + b) * c;
      } else if (template.includes('{c} · ({a} + {b})')) {
        answer = c * (a + b);
      } else if (template.includes('({b} + {a})') && template.includes('· {c}')) {
        answer = (b + a) * c;
      } else if (template.includes('({a} - {b})') && template.includes('· {c}')) {
        answer = (a - b) * c;
      } else if (template.includes('{c} · ({a} - {b})')) {
        answer = c * (a - b);
      } else if (template.includes('({a} + {b}) - {c}')) {
        answer = (a + b) - c;
      } else if (template.includes('{a} + ({b} - {c})')) {
        answer = a + (b - c);
      } else if (template.includes('({a} - {b}) + {c}')) {
        answer = (a - b) + c;
      } else {
        answer = (a + b) * c; // default
      }
      
      return { prompt: prompt, answer: String(answer), patternId: pattern.id };
    }
    
    return null;
  }

  function generateWordProblem(pattern) {
    // Placeholder for word problem generation
    // Can be expanded with rich templates
    return null;
  }

  function renderProblemPatternUI(lesson, patternId, problems) {
    if (!problems || problems.length === 0) return null;
    
    const container = makeElement("div", "problem-pattern-container");
    const header = makeElement("h4", "pattern-header", "Träna fler liknande uppgifter");
    container.appendChild(header);
    
    const grid = makeElement("div", "problem-pattern-grid");
    problems.forEach(function (problem, index) {
      const problemBtn = makeElement("button", "problem-pattern-item");
      problemBtn.type = "button";
      problemBtn.textContent = (index + 1);
      problemBtn.title = problem.prompt;
      problemBtn.addEventListener("click", function () {
        alert("Uppgift: " + problem.prompt + "\n\nSvar: " + problem.answer);
      });
      grid.appendChild(problemBtn);
    });
    
    container.appendChild(grid);
    return container;
  }

  // ============ END PATTERN GENERATION ============

  return { generateProblemSet: generateProblemSet, renderProblemPatternUI: renderProblemPatternUI };
}());
