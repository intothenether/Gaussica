const { test, expect } = require("@playwright/test");
const { signIn, openLesson, watchErrors } = require("./helpers");

// The lesson about steps up and down (upp-och-ner): the ladder is drawn, the exercise is checked, and Öva mer gives the other kinds of problems.
test("upp-och-ner: the ladder is drawn with the way up and down, and the exercise tells what a wrong answer means", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await openLesson(page, "upp-och-ner", "input[name=answer]");
  await expect(page.locator("#lesson-player .pl-foot-q")).toContainText("Elsa står på den mittersta pinnen");
  const field = page.locator("#lesson-player input[name=answer]");
  await field.fill("4");
  await field.press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-wrong/, { timeout: 8000 });
  await expect(page.locator("#lesson-player .pl-foot")).toContainText("på varje sida om mitten");
  await field.fill("9");
  await field.press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/, { timeout: 8000 });
  expect(errors).toEqual([]);
});

test("upp-och-ner: the lesson shows the ladder with its rungs, its start and its jumps", async ({ page }) => {
  await signIn(page);
  await page.evaluate(() => { location.hash = "#start"; setTimeout(() => { location.hash = "#play/upp-och-ner"; }, 150); });
  await expect(page.locator("#lesson-player .pl-foot")).toBeVisible();
  const ladder = page.locator("#lesson-player .fx-rung");
  for (let i = 0; i < 6 && !(await ladder.count()); i++) {
    const next = page.locator("#lesson-player .pl-foot").getByRole("button", { name: /Fortsätt|Börja med|Hoppa över/ }).first();
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
  }
  await expect(ladder).toHaveCount(11);
  await expect(page.locator("#lesson-player .fx-rail")).toHaveCount(2);
  await expect(page.locator("#lesson-player svg .fig-arrow")).toHaveCount(2);
  await expect(page.locator("#lesson-player svg", { hasText: "Start: mitten" }).first()).toBeVisible();
});
