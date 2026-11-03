const { test, expect } = require("@playwright/test");
const { signIn, watchErrors } = require("./helpers");

// How well each term is known (terms.js), and the new kinds of Öva mer questions that teach the idea: a figure to read, a worked solution with a mistake,
// a text with gaps, sorting.

test("a lesson about terms shows how well each term is known: at first all of them are new", async ({ page }) => {
  await signIn(page);
  await page.evaluate(() => { location.hash = "#begrepp-rakna"; });
  const box = page.locator(".terms-box");
  await expect(box).toBeVisible();
  await expect(box.getByRole("heading")).toHaveText("Dina begrepp: 0 av 10 säkra");
  await expect(box.locator(".terms-chip")).toHaveCount(10);
  await expect(box.locator(".terms-chip.is-new")).toHaveCount(10);
  await expect(box.locator(".terms-chip", { hasText: "summa" })).toContainText("ny");
});

test("the box follows the answers: used on new numbers and written for its explanation is säker, and a recent mistake is marked", async ({ page }) => {
  await signIn(page);
  const html = await page.evaluate(async () => {
    const lesson = await (await fetch("lessons/begrepp-rakna.json")).json();
    const PR = window.GaussicaPractice;
    let t = Date.now();
    const at = (tpl, seed, ok) => ({ lessonId: lesson.id, taskId: PR.makeId(tpl, seed), feedbackType: ok ? "correct" : "hint", completed: ok, timestamp: new Date(t += 1000).toISOString() });
    let fraga = 0;
    for (let s = 1; s < 4000 && !fraga; s++) { const q = PR.generate(lesson, "fraga", s); if (q && q.problem.terms[0] === "summa") fraga = s; }
    const attempts = [at("r-roll-summa", 1, true), at("r-roll-summa", 2, true), at("fraga", fraga, true), at("r-roll-produkt", 1, true), at("r-roll-produkt", 2, false)];
    return window.GaussicaTerms.panel(lesson, { attempts: attempts }).outerHTML;
  });
  await page.evaluate((h) => { const d = document.createElement("div"); d.id = "fake"; d.innerHTML = h; document.body.appendChild(d); }, html);
  const fake = page.locator("#fake");
  await expect(fake.getByRole("heading")).toHaveText("Dina begrepp: 1 av 10 säkra");
  await expect(fake.locator(".terms-chip", { hasText: "summa" })).toHaveClass(/is-safe/);
  await expect(fake.locator(".terms-chip", { hasText: "produkt" })).toHaveClass(/is-weak/);
});

test("Öva mer in a lesson about terms starts, and asks with explanations and with examples", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await page.evaluate(() => { location.hash = "#practice/begrepp-rakna"; });
  await expect(page.locator("#lesson-player .pl-foot")).toBeVisible();
  await expect(page.locator("#lesson-player .pl-question, #lesson-player .pl-main").first()).toBeVisible();
  expect(errors).toEqual([]);
});

async function openQuestion(page, lessonId, template) {
  await page.evaluate(async ([id, t]) => {
    const lesson = await (await fetch("lessons/" + id + ".json")).json();
    const q = window.GaussicaPractice.generate(lesson, t);
    window.GaussicaPlayer.openSession({ kind: "practice", title: "Öva mer: " + lesson.title, items: [{ lessonId: id, taskId: q.taskId, templateId: q.templateId, problem: q.problem }], backLabel: "Tillbaka", onExit() {}, onDone() {}, again() {} });
  }, [lessonId, template]);
  await expect(page.locator("#lesson-player .pl-foot")).toBeVisible();
}

test("a question with two figures to compare, a worked solution to find the mistake in, a text with gaps and sorting", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await openQuestion(page, "brak-likavarda", "bl-figurer-ja");
  await expect(page.locator("#lesson-player")).toContainText("Första figuren");
  await expect(page.locator("#lesson-player")).toContainText("Andra figuren");
  await expect(page.locator("#lesson-player input[name=answer]")).toBeVisible();
  await openQuestion(page, "negativa-tal", "nt-hitta-felet");
  await expect(page.locator("#lesson-player .fm-step")).toHaveCount(3);
  await openQuestion(page, "platsvarde", "pv-luckor-flytta");
  await expect(page.locator("#lesson-player .fm-gap")).toHaveCount(3);
  await openQuestion(page, "procent", "pr-sortera-lika");
  await expect(page.locator("#lesson-player .fm-row")).toHaveCount(6);
  expect(errors).toEqual([]);
});
