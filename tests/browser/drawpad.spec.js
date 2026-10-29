const { test, expect } = require("@playwright/test");
const { signIn, openLesson } = require("./helpers");

test("the drawing pad: a slash over the character before the cursor, and a second press takes it away", async ({ page }) => {
  await signIn(page, { pet: null });
  await openLesson(page, "subtraktion-uppstallning", ".cv-stage");
  const pad = page.locator("#lesson-player");
  await pad.getByRole("button", { name: /Skriv$/ }).click();
  const box = await pad.locator(".cv-stage").boundingBox();
  await page.mouse.click(box.x + 120, box.y + 70);
  await page.keyboard.type("52");
  const lines = () => pad.locator('.cv-svg g[data-t="line"]').count();
  expect(await lines()).toBe(0);
  const stryk = pad.getByRole("button", { name: /Stryk/ });
  await stryk.click();                       // the cursor is after the 2: the 2 is crossed out
  expect(await lines()).toBe(1);
  await expect(pad.locator(".cv-hint")).toContainText("överstruket");
  await stryk.click();                       // again: the slash goes away
  expect(await lines()).toBe(0);
});
