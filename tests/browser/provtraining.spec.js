const { test, expect } = require("@playwright/test");
const { signIn, watchErrors } = require("./helpers");

// Provträning: a test like the national tests that a student starts without a teacher (provtraining.js), from "Mer att utforska".
test("the card is on the start page with a set for each stage, and says that it is practice", async ({ page }) => {
  await signIn(page);
  await page.locator("#more-cards summary").click();
  const card = page.locator("#provtr-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Provträning");
  await expect(card).toContainText("inte de riktiga proven");
  await expect(card.locator(".provtr-btn")).toHaveCount(3);
  await expect(card.locator(".provtr-btn").first()).toContainText("Åk 3");
});

test("a round is started, answered by skipping, finished with a result, and the next one is a new round", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await page.locator("#more-cards summary").click();
  await page.locator("#provtr-card .provtr-btn").first().click();
  await expect(page.locator("#lesson-player")).toContainText("Provträning åk 3");
  await expect(page.getByRole("button", { name: /Starta provet/ })).toBeVisible();
  await page.getByRole("button", { name: /Starta provet/ }).click();
  await expect(page.locator("#lesson-player")).toContainText("FRÅGA");
  for (let i = 0; i < 40 && !(await page.locator("#lesson-player").getByText("PROV KLART").count()); i++) {
    const skip = page.locator("#lesson-player").getByRole("button", { name: "Hoppa över" });
    if (await skip.count()) await skip.first().click(); else await page.waitForTimeout(100);
  }
  await expect(page.locator("#lesson-player")).toContainText("PROV KLART");
  await page.locator("#lesson-player").getByRole("button", { name: "Tillbaka" }).click();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("#larstig");
  await page.locator("#more-cards").evaluate((d) => { d.open = true; });
  await expect(page.locator("#provtr-card .provtr-btn").first()).toContainText("Ny omgång");
  await expect(page.locator("#provtr-card .provtr-btn").first()).toContainText("Senast: 0 av");
  expect(errors).toEqual([]);
});
