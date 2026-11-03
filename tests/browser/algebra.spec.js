const { test, expect } = require("@playwright/test");
const { signIn, openLesson, watchErrors } = require("./helpers");

// The algebra lessons: an answer to an equation is put into the equation as on paper, the steps of a solution are checked line by line, the mistakes of
// algebra get a hint that says what happened, and maths can be written with buttons and a preview.

const field = (page) => page.locator("#lesson-player input[name=answer]");
const foot = (page) => page.locator("#lesson-player .pl-foot");
const hint = (page) => page.locator("#lesson-player .pl-foot-feedback .feedback-message");

async function toQuestion(page, lessonId, prompt) {
  await openLesson(page, lessonId, "input[name=answer]");
  await expect(page.locator("#lesson-player .pl-foot-q")).toContainText(prompt);
}

test("an answer to an equation is put into it: the equation, the answer in place of x, then 17 = 14 and a try again", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await toQuestion(page, "ekvation", "3x + 2 = 14");
  await field(page).fill("5");
  await field(page).press("Enter");
  const subst = page.locator("#lesson-player .subst");
  await expect(subst).toBeVisible();
  await expect(subst.locator(".subst-eq")).toContainText("3x + 2 = 14");
  await expect(subst.locator(".subst-put")).toContainText("3 · 5 + 2 = 14");
  await expect(subst.locator(".subst-left")).toHaveText("17");
  await expect(subst.locator(".subst-right")).toHaveText("14");
  await expect(subst.locator(".subst-verdict")).toHaveText("Det stämmer inte riktigt, försök igen");
  // the answer is marked after the check, not before
  await expect(foot(page)).toHaveClass(/is-wrong/, { timeout: 8000 });
  expect(errors).toEqual([]);
});

test("the right answer: both sides come to 14", async ({ page }) => {
  await signIn(page);
  await toQuestion(page, "ekvation", "3x + 2 = 14");
  await field(page).fill("x = 4");
  await field(page).press("Enter");
  const subst = page.locator("#lesson-player .subst");
  await expect(subst.locator(".subst-put")).toContainText("3 · 4 + 2 = 14");
  await expect(subst.locator(".subst-left")).toHaveText("14");
  await expect(subst.locator(".subst-right")).toHaveText("14");
  await expect(subst.locator(".subst-verdict")).toContainText("Det stämmer");
  await expect(foot(page)).toHaveClass(/is-correct/, { timeout: 8000 });
});

test("a click skips the animation, and with reduced motion everything is shown at once", async ({ page }) => {
  await signIn(page);
  await toQuestion(page, "ekvation", "3x + 2 = 14");
  await field(page).fill("5");
  await field(page).press("Enter");
  await page.locator("#lesson-player .subst").click();
  await expect(foot(page)).toHaveClass(/is-wrong/, { timeout: 1500 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await field(page).fill("6");
  await field(page).press("Enter");
  await expect(page.locator("#lesson-player .subst-verdict.is-in")).toBeVisible({ timeout: 1500 });
});

test("the steps of a solution are checked line by line, and a line that is wrong says what happened", async ({ page }) => {
  await signIn(page);
  await toQuestion(page, "ekvation", "3x + 2 = 14");
  const box = page.locator("#lesson-player .steps-box");
  await expect(box).toBeVisible();
  await expect(box.locator(".steps-row.is-start")).toContainText("3x + 2 = 14");
  const input = box.locator(".steps-input");
  await input.fill("3x=16");
  await input.press("Enter");
  await expect(box.locator(".steps-message")).toContainText("utan att byta tecken");
  await expect(box.locator(".steps-row.is-ok")).toHaveCount(0);
  await input.fill("3x=12");
  await input.press("Enter");
  await expect(box.locator(".steps-row.is-ok")).toHaveCount(1);
  // the same on both sides, by the site
  await box.locator(".steps-op").selectOption("/");
  await box.locator(".steps-number").fill("3");
  await box.getByRole("button", { name: "Gör det" }).click();
  await expect(box.locator(".steps-row.is-ok")).toHaveCount(2);
  await input.fill("x=4");
  await input.press("Enter");
  await expect(box.locator(".steps-message")).toContainText("Svaret är ifyllt");
  await expect(field(page)).toHaveValue("4");
  await field(page).press("Enter");
  await expect(foot(page)).toHaveClass(/is-correct/, { timeout: 8000 });
});

test("no steps in the first lesson about x: the solution method has not come yet", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "uttryck-med-x", "input[name=answer]");
  await expect(page.locator("#lesson-player .steps-box")).toHaveCount(0);
  await expect(page.locator("#lesson-player .math-keys")).toHaveCount(0);
});

test("maths is written with buttons and shown as on paper under the field", async ({ page }) => {
  await signIn(page);
  await toQuestion(page, "parenteser-uttryck", "Förenkla 3(x + 4)");
  const keys = page.locator("#lesson-player .math-keys");
  await expect(keys).toBeVisible();
  await field(page).fill("x");
  await keys.getByRole("button", { name: "upphöjt till 2" }).click();
  await expect(field(page)).toHaveValue("x^2");
  const preview = page.locator("#lesson-player .math-preview");
  await expect(preview).toBeVisible();
  expect(await preview.locator(".math-preview-math sup").count()).toBeGreaterThan(0);
  await field(page).fill("");
  await keys.getByRole("button", { name: "bråk" }).click();
  await expect(field(page)).toHaveValue("()/()");
  expect(await field(page).evaluate((i) => i.selectionStart)).toBe(1);
});

test("a mistake of algebra: 36 for 3x + 2 = 14 is told what happened, with the answer put into the equation", async ({ page }) => {
  await signIn(page);
  await toQuestion(page, "ekvation", "3x + 2 = 14");
  await field(page).fill("36");
  await field(page).press("Enter");
  await expect(hint(page)).toContainText("Upptäckt mönster", { timeout: 8000 });
  await expect(hint(page)).toContainText("Multiplicerade i stället för att dela");
  await expect(hint(page)).toContainText("vänster sida 110 och höger sida 14");
  await expect(hint(page)).not.toContainText("x = 4");
});

test("the equation with pieces goes from 3x + 2 = 14 to x = 4, step by step, with the symbols beside it", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await page.evaluate(() => { location.hash = "#start"; setTimeout(() => { location.hash = "#play/ekvation"; }, 150); });
  const model = page.locator("#lesson-player .eqm");
  await expect(model).toBeVisible({ timeout: 15000 });
  await expect(model.locator(".eqm-symbols")).toHaveText("3x + 2 = 14");
  expect(await model.locator(".eqm-x").count()).toBe(3);
  expect(await model.locator(".eqm-one").count()).toBe(16);
  await model.getByRole("button", { name: /Nästa steg/ }).click();
  await expect(model.locator(".eqm-symbols")).toHaveText("3x = 12", { timeout: 4000 });
  expect(await model.locator(".eqm-one").count()).toBe(12);
  await model.getByRole("button", { name: /Nästa steg/ }).click();
  await expect(model.locator(".eqm-symbols")).toHaveText("x = 4");
  await expect(model.locator(".eqm-group")).toHaveCount(3);
  await expect(model.getByRole("button", { name: "Klart" })).toBeDisabled();
  await model.getByRole("button", { name: "Börja om" }).click();
  await expect(model.locator(".eqm-symbols")).toHaveText("3x + 2 = 14");
  expect(errors).toEqual([]);
});

test("a worked example is read one step at a time", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await page.evaluate(() => { location.hash = "#start"; setTimeout(() => { location.hash = "#play/ekvation"; }, 150); });
  const ws = page.locator("#lesson-player .ws").first();
  await expect(ws).toBeVisible({ timeout: 15000 });
  await expect(ws.locator(".ws-line:visible")).toHaveCount(1);
  await ws.getByRole("button", { name: "Visa första steget" }).click();
  await expect(ws.locator(".ws-line:visible")).toHaveCount(2);
  await expect(ws.locator(".ws-live")).toContainText("Ta bort 2 från båda sidor");
  await ws.getByRole("button", { name: "Visa alla steg" }).click();
  await expect(ws.locator(".ws-line:visible")).toHaveCount(5);
  await expect(ws.locator(".ws-note")).toBeVisible();
  expect(errors).toEqual([]);
});

for (const [lesson, prompt, right, wrong, expected] of [
  ["samla-termer", "Förenkla 3x + 5x", "8x", "8", "tappat x"],
  ["bryta-ut", "Bryt ut den största gemensamma faktorn: 6x + 9", "3(2x + 3)", "3(2x + 9)", "Alla termer ska delas"],
  ["olikheter", "Lös olikheten 3x + 2 < 14", "4 > x", "x>4", "fel håll"]
]) {
  test("the new lesson " + lesson + ": the first question tells a mistake and accepts the right answer", async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await toQuestion(page, lesson, prompt);
    await field(page).fill(wrong);
    await field(page).press("Enter");
    await expect(hint(page)).toContainText(expected, { timeout: 8000 });
    await page.waitForTimeout(2800);
    await field(page).fill(right);
    await field(page).press("Enter");
    await expect(foot(page)).toHaveClass(/is-correct/, { timeout: 8000 });
    expect(errors).toEqual([]);
  });
}

test("a broken-out answer must have a bracket and the biggest factor out", async ({ page }) => {
  await signIn(page);
  await toQuestion(page, "bryta-ut", "6x + 9");
  await field(page).fill("6x+9");
  await field(page).press("Enter");
  await expect(hint(page)).toContainText("bryta ut en faktor", { timeout: 8000 });
  await expect(foot(page)).toHaveClass(/is-wrong/);
  await page.waitForTimeout(2800);
  await field(page).fill("3(2x+3)");
  await field(page).press("Enter");
  await expect(foot(page)).toHaveClass(/is-correct/, { timeout: 8000 });
});
