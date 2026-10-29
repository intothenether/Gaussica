const { test, expect } = require("@playwright/test");
const { signIn, openLesson } = require("./helpers");

test("pyssla: sliding past the right value does not tick a challenge, Kolla does", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "pyssla-vinklar", ".py-goals");
  const slider = page.locator("#lesson-player input[type=range]").first();
  const done = page.locator("#lesson-player .py-goal.is-done");
  const set = async (v) => slider.evaluate((el, value) => { el.value = String(value); el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
  for (const v of [0, 45, 90, 135, 180, 90, 135]) await set(v);   // through 90 and 135 on the way
  await expect(done).toHaveCount(0);
  await set(90);
  await page.locator("#lesson-player .py-check-btn").click();
  await expect(done).toHaveCount(1);
  await set(100);
  await page.locator("#lesson-player .py-check-btn").click();
  await expect(page.locator("#lesson-player .py-status")).toContainText("Inte riktigt");
  await expect(done).toHaveCount(1);
});

test("pyssla: Kolla is with the sliders, in the same box", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "pyssla-vinklar", ".py-goals");
  await expect(page.locator("#lesson-player .py-controls .py-check-btn")).toHaveCount(1);
  await expect(page.locator("#lesson-player .py-controls .py-status")).toHaveCount(1);
});
