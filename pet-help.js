// "Hjälp djuret": the pet tried a problem from a lesson the student has finished, and is not sure about its answer. The student checks it: is it right or wrong? If it is
// wrong, what should it have been? Finding a mistake in somebody else's work is a good way to learn the method, and the pet becomes someone to help instead of only
// something to collect things for.
//
// The problems are the generated ones of the lessons (practice templates, see practice.js). A template that knows the usual wrong answers (its `feedback`) gives the
// pet a mistake that is really made: the pet answers with one of those, and the hint of the lesson explains it afterwards. About a third of the rounds the pet is right,
// so that the student has to check and cannot just say "wrong" every time.
//
//   GaussicaPetHelp.makeRound(lessons, Practice, rnd)   { lessonId, lessonTitle, prompt, shown, petRight, answers, why, how } or null
//   GaussicaPetHelp.isRight(round, text)                is what the student wrote the right answer? (numbers: 12 and 12 cm and 12,0 are the same)
//   GaussicaPetHelp.available(lessons, Practice)        how many of the lessons can give a round (the button is shown from two)
//   GaussicaPetHelp.render(container, ctx)              the activity, three rounds. ctx = { pet, lessons, Practice, face(mood) -> html, reward() -> { gained, levelUp } }
//
// Nothing is lost by a wrong guess and nothing is counted: it is a friendly game. A round gives the friendship a heart (up to three a day, see pet.js).

(function (root) {
  "use strict";

  const ROUNDS = 3;
  const WRONG_SHARE = 0.65;

  function norm(s) { return String(s === undefined || s === null ? "" : s).toLowerCase().replace(/\s+/g, "").replace(/[−–]/g, "-"); }
  function numberOf(s) {
    const m = /^(-?\d+(?:[.,]\d+)?)\D*$/.exec(String(s).trim().replace(/\s+(?=\d)/g, ""));
    return m ? Number(m[1].replace(",", ".")) : null;
  }

  // is the text the same as one of the answers? Numbers are compared as numbers, with or without a unit after them.
  function same(text, answers) {
    const t = norm(text);
    if (!t) return false;
    const n = numberOf(text);
    return (answers || []).some(function (a) {
      if (norm(a) === t) return true;
      const m = numberOf(a);
      return n !== null && m !== null && Math.abs(n - m) < 1e-9;
    });
  }
  function isRight(round, text) {
    if (!round) return false;
    if (same(text, round.answers)) return true;
    const MS = root.MATTE_SYMBOLIC;
    return Boolean(MS && MS.areEquivalent && round.answers.some(function (a) { try { return MS.areEquivalent(String(text), a); } catch (e) { return false; } }));
  }

  // a problem that fits: a plain question with a short answer, no picture, and a hint text that does not give the answer away to the pet's wrong answer
  function usable(problem) {
    if (!problem || problem.format || problem.visual || (problem.visuals && problem.visuals.length) || problem.statements || problem.pairs) return false;
    if (typeof problem.prompt !== "string" || problem.prompt.length > 230 || /\{|\}/.test(problem.prompt)) return false;
    const a = problem.answer;
    return Array.isArray(a) && a.length > 0 && String(a[0]).length <= 12 && !/[=]/.test(String(a[0]));
  }

  function pick(list, rnd) { return list[Math.floor(rnd() * list.length)]; }

  // lessons: the finished lessons (as in the course). Practice: GaussicaPractice. rnd: a function that gives a number from 0 up to 1.
  function makeRound(lessons, Practice, rnd) {
    rnd = rnd || Math.random;
    const pool = (lessons || []).filter(function (l) { return Practice && Practice.has(l); });
    if (!pool.length) return null;
    for (let attempt = 0; attempt < 60; attempt++) {
      const lesson = pick(pool, rnd);
      const q = Practice.fresh(lesson);
      if (!q || !usable(q.problem)) continue;
      const problem = q.problem;
      const right = String(problem.answer[0]);
      const slips = (problem.feedback || []).filter(function (f) {
        const a = f.answers && f.answers[0];
        return a !== undefined && String(a).length <= 12 && !same(a, problem.answer) && f.message;
      });
      const petRight = !slips.length || rnd() >= WRONG_SHARE;
      const slip = petRight ? null : pick(slips, rnd);
      return {
        lessonId: lesson.id, lessonTitle: lesson.title, prompt: problem.prompt,
        shown: petRight ? right : String(slip.answers[0]), petRight: petRight,
        answers: problem.answer.slice(), why: slip ? slip.message : null,
        how: String(problem.correct || "").replace(/^Rätt!\s*/, "")
      };
    }
    return null;
  }

  function available(lessons, Practice) {
    return (lessons || []).filter(function (l) { return Practice && Practice.has(l); }).length;
  }

  // ----- the screen -----
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function math(target, text) { if (root.GaussicaText && root.GaussicaText.set) root.GaussicaText.set(target, text); else target.textContent = text; }
  function button(label, className, onClick) {
    const b = el("button", className, label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function render(container, ctx) {
    const name = ctx.pet.name;
    let n = 0, helped = 0, round = null, wrongTries = 0;
    const draw = function (build) {
      container.replaceChildren();
      const wrap = el("div", "pet-help");
      build(wrap);
      container.appendChild(wrap);
      const first = wrap.querySelector("input, button");
      if (first) first.focus({ preventScroll: true });
    };
    const bubble = function (wrap, text, mood) {
      const row = el("div", "pet-help-say");
      const face = el("span", "pet-help-face");
      face.innerHTML = ctx.face(mood || "");
      face.setAttribute("aria-hidden", "true");
      const t = el("p", "pet-help-bubble", text);
      t.setAttribute("role", "status");
      row.append(face, t);
      wrap.appendChild(row);
    };
    const problem = function (wrap) {
      const card = el("div", "pet-help-card");
      card.appendChild(el("span", "eyebrow", "Runda " + (n + 1) + " av " + ROUNDS));
      const p = el("p", "pet-help-prompt");
      math(p, round.prompt);
      const said = el("p", "pet-help-said");
      said.append(document.createTextNode(name + " svarade: "));
      const v = el("strong", "pet-help-answer");
      math(v, round.shown);
      said.appendChild(v);
      card.append(p, said);
      wrap.appendChild(card);
    };

    const finishRound = function (message, mood) {
      const r = ctx.reward ? ctx.reward() : { gained: 0 };
      if (r.gained) helped += 1;
      draw(function (wrap) {
        bubble(wrap, message, mood || "happy");
        if (round.why && !round.petRight) {
          const why = el("p", "pet-help-why");
          why.append(el("strong", "", "Så kan man räkna fel: "), document.createTextNode(round.why));
          wrap.appendChild(why);
        }
        if (round.how) {
          const how = el("p", "pet-help-how");
          how.append(el("strong", "", "Så räknar man: "));
          const t = el("span");
          math(t, round.how);
          how.appendChild(t);
          wrap.appendChild(how);
        }
        wrap.appendChild(el("p", "pet-help-heart", r.gained ? "💛 Du och " + name + " blev lite bättre vänner." + (r.levelUp ? " 🎉 Nu är ni " + r.levelUp.toLowerCase() + "!" : "") : "Det är fint att hjälpa till, även om ni redan fått tre hjärtan idag."));
        n += 1;
        wrap.appendChild(button(n >= ROUNDS ? "Klar" : "Nästa uppgift", "primary-button", n >= ROUNDS ? summary : next));
      });
    };

    const fix = function (intro) {
      draw(function (wrap) {
        bubble(wrap, intro);
        problem(wrap);
        const form = el("form", "pet-help-form");
        const label = el("label", "", "Vad får du när du räknar själv?");
        const input = el("input");
        input.type = "text";
        input.autocomplete = "off";
        input.setAttribute("inputmode", "text");
        input.setAttribute("aria-label", "Ditt svar");
        const msg = el("p", "pet-help-note");
        msg.setAttribute("role", "status");
        form.append(label, input, button("Kolla", "primary-button", function () { form.requestSubmit(); }), msg);
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          if (!input.value.trim()) { msg.textContent = "Skriv ditt svar först."; return; }
          if (isRight(round, input.value)) {
            finishRound(round.petRight ? "Du fick samma svar som jag, så jag hade rätt! Tack för att du kollade." : "Nu ser jag det! Jag hade fel. Tack för hjälpen!");
            return;
          }
          wrongTries += 1;
          if (wrongTries >= 2) {
            finishRound("Det är svårt ibland! Rätt svar är " + round.answers[0] + ". Vi tittar på hur man kommer dit.", "");
            return;
          }
          msg.textContent = "Inte riktigt. Läs uppgiften en gång till och prova igen.";
          input.select();
        });
        wrap.appendChild(form);
      });
    };

    const ask = function () {
      draw(function (wrap) {
        bubble(wrap, n === 0 ? "Hjälp mig! Jag löste den här uppgiften, men jag är inte säker på att jag har rätt. Kan du kolla?" : "Här är en till som jag är osäker på. Kan du kolla den också?");
        problem(wrap);
        const row = el("div", "pet-help-choice");
        row.append(
          button("Det stämmer", "pet-btn", function () {
            if (round.petRight) finishRound("Tack för att du kollade! Jag hade rätt den här gången.");
            else { wrongTries = 0; fix("Hmm, är du säker? Räkna själv, så ser vi."); }
          }),
          button("Det stämmer inte", "pet-btn", function () {
            wrongTries = 0;
            fix(round.petRight ? "Åh! Då får vi räkna tillsammans, så ser vi vem som har rätt." : "Tack för att du säger det! Vad borde jag ha svarat?");
          })
        );
        wrap.appendChild(row);
      });
    };

    const next = function () {
      round = makeRound(ctx.lessons, ctx.Practice, ctx.rnd);
      if (!round) {
        draw(function (wrap) {
          bubble(wrap, "Jag hittar ingen uppgift just nu. Prova en lektion eller Öva mer, så har jag fler att fråga dig om!");
        });
        return;
      }
      ask();
    };

    const summary = function () {
      draw(function (wrap) {
        bubble(wrap, "Tack för hjälpen! Nu förstår jag uppgifterna bättre." + (helped ? "" : " Det var fint att du tog dig tid."), "happy");
        const row = el("div", "pet-help-choice");
        row.append(button("Fler uppgifter", "pet-btn", function () { n = 0; helped = 0; next(); }));
        wrap.appendChild(row);
      });
    };

    const start = function () {
      if (available(ctx.lessons, ctx.Practice) < 2) {
        draw(function (wrap) { bubble(wrap, "Jag behöver att du klarat några lektioner först, så att jag vet vad jag ska fråga om. Kom tillbaka sedan!"); });
        return;
      }
      next();
    };
    start();
  }

  const api = { makeRound: makeRound, isRight: isRight, available: available, render: render, ROUNDS: ROUNDS };
  root.GaussicaPetHelp = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
