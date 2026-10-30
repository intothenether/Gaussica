const { test, expect } = require("@playwright/test");
const { signIn, openLesson } = require("./helpers");

// On a phone the keyboard closes when the field loses the focus. The keys under the answer field (a ^ for a power) and "Kolla svaret" must
// not take the focus, and a wrong answer must not take the field out of the page, so that the keyboard stays and the answer can be changed.
test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });

async function tap(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

const focusIsInField = (page) => page.evaluate(() => document.activeElement && document.activeElement.name === "answer");

test("phone: the ^ key writes a power and the field keeps the focus", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "kvadreringsreglerna", ".answer-key");
  const field = page.locator("#lesson-player input[name=answer]");
  await tap(page, field);
  expect(await focusIsInField(page)).toBe(true);
  await page.keyboard.type("x");
  await tap(page, page.locator("#lesson-player .answer-key", { hasText: "^" }).first());
  await expect(field).toHaveValue("x^");
  expect(await focusIsInField(page)).toBe(true);
  // the cursor is after the sign, so the next character goes there
  await page.keyboard.type("2");
  await expect(field).toHaveValue("x^2");
});

test("phone: Kolla svaret keeps the field and the focus, also after a wrong answer", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "kvadreringsreglerna", ".answer-key");
  const field = page.locator("#lesson-player input[name=answer]");
  await tap(page, field);
  await page.keyboard.type("1");
  await page.evaluate(() => { window.__answerField = document.querySelector("#lesson-player input[name=answer]"); });
  await tap(page, page.locator("#lesson-player .answer-button"));
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-wrong/);
  // the same field is still in the page, and it still has the focus
  expect(await page.evaluate(() => document.body.contains(window.__answerField) && document.activeElement === window.__answerField)).toBe(true);
  // and another try can be typed at once
  await page.keyboard.type("2");
  await expect(field).toHaveValue("12");
});
