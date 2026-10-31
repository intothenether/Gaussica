const { test, expect } = require("@playwright/test");
const { signIn, openLesson } = require("./helpers");

// A wrong answer that a known mistake gives is recognised in the lesson: the student is told what probably happened.
async function answer(page, text) {
  const field = page.locator("#lesson-player input[name=answer]");
  await field.fill(text);
  await page.locator("#lesson-player .answer-button").click();
}

test("a mistake in place value (the wrong place) is recognised", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "platsvarde", "input[name=answer]");
  await answer(page, "6000");
  await expect(page.locator("#lesson-player .feedback-diagnosed-badge")).toContainText("Räknade med fel plats");
  await expect(page.locator("#lesson-player .feedback-diagnosed")).toContainText("hundratal");
});

test("a mistake in percent (forgot to divide by 100) is recognised", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "procent", "input[name=answer]");
  await answer(page, "2000");
  await expect(page.locator("#lesson-player .feedback-diagnosed-badge")).toContainText("Glömde dela med 100");
});

test("what the lesson itself says about a wrong answer comes before the general pattern", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "addition", "input[name=answer]");
  await answer(page, "424");   // the lesson has a hint of its own for this one
  await expect(page.locator("#lesson-player .feedback-diagnosed-badge")).toHaveCount(0);
  await expect(page.locator("#lesson-player .feedback-hint")).toBeVisible();
});

test("a right answer and an unknown wrong answer say nothing about a pattern", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "addition", "input[name=answer]");
  await answer(page, "999");
  await expect(page.locator("#lesson-player .feedback-diagnosed-badge")).toHaveCount(0);
  await answer(page, "534");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
});

test("a mistake in a unit (centimetres and metres) is recognised", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "mata-langd", "input[name=answer]");
  await answer(page, "3000");
  await expect(page.locator("#lesson-player .feedback-diagnosed-badge")).toContainText("Fel växlingstal");
});
