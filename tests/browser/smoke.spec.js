const { test, expect } = require("@playwright/test");
const { signIn, watchErrors } = require("./helpers");

test("the start page opens, without errors, and a student with a pet sees the step of the day", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await expect(page.locator(".hs")).toBeVisible();
  await expect(page.locator(".hs-go")).toBeVisible();
  await expect(page.locator(".hp-stage")).toBeVisible();
  expect(errors).toEqual([]);
});
