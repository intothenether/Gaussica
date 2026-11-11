const { test, expect } = require("@playwright/test");
const { signIn, openLesson, watchErrors } = require("./helpers");

// The steps of a method are in boxes, with an example that is followed through (step-boxes.js), and the clock pyssla talks about the hands, not "reglage".
test("långdivision: four boxes, each with what to do and what it looks like in the example, and no 'Steg 1:' in the text", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await openLesson(page, "langdivision", ".sb");
  const boxes = page.locator("#lesson-player .sb-step");
  await expect(boxes).toHaveCount(4);
  await expect(page.locator("#lesson-player .sb-no")).toHaveText(["1", "2", "3", "4"]);
  await expect(page.locator("#lesson-player .sb-example")).toContainText("378 kr lika på 14 elever");
  await expect(boxes.first().locator(".sb-do")).toContainText("Börja längst till vänster i 378");
  await expect(boxes.first().locator(".sb-show")).toContainText("37 är större än 14");
  for (let i = 0; i < 4; i++) await expect(boxes.nth(i).locator(".sb-show")).toBeVisible();
  await expect(page.locator("#lesson-player")).not.toContainText("Steg 1:");
  expect(errors).toEqual([]);
});

test("a column calculation is lined up, and every lesson with steps has its boxes", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "addition-uppstallning", ".sb");
  await expect(page.locator("#lesson-player .sb-step")).toHaveCount(4);
  const mono = page.locator("#lesson-player .sb-show.is-mono .sb-line").first();
  await expect(mono).toBeVisible();
  expect(await mono.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe("pre");
  expect(await mono.evaluate((e) => /mono|Consolas|Courier/i.test(getComputedStyle(e).fontFamily))).toBe(true);
});

test("the clock pyssla says visarna, not reglage", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "pyssla-klockan", ".py-controls");
  const lesson = page.locator("#lesson-player");
  await expect(lesson).toContainText("Flytta visarna");
  await expect(lesson).toContainText("Timvisaren");
  await expect(lesson).toContainText("Minutvisaren");
  await expect(lesson).not.toContainText(/reglag/i);
});
