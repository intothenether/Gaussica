const { test, expect } = require("@playwright/test");

// The front page for somebody who has not been here before: only at the bare address, and not again once they have chosen to sign in (auth-view.js).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem("gaussica.cookies-ok", "1"); } catch (e) { /* no storage */ } });
});

test("a new visitor at the bare address meets the front page, with a way to try and a way to sign in", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator(".landing-title")).toHaveText("Matematik som hänger ihop");
  await expect(page.getByRole("link", { name: "Prova utan konto" })).toHaveAttribute("href", "./index.html#prova");
  for (const [name, href] of [["För föräldrar", "./foraldrar.html"], ["Så täcker Gaussica kursplanen", "./kursplan.html"], ["Villkor", "./villkor.html"], ["Integritet", "./integritet.html"]]) {
    await expect(page.locator(".landing-links").getByRole("link", { name })).toHaveAttribute("href", href);
  }
  await expect(page.locator(".landing-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Logga in eller skapa konto" }).click();
  await expect(page.getByRole("tab", { name: "Skapa konto" })).toBeVisible();
  await expect(page.locator(".landing")).toHaveCount(0);
});

test("a visitor who has chosen to sign in goes straight to the sign-in the next time", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("button", { name: "Logga in eller skapa konto" }).click();
  await page.reload();
  await expect(page.getByRole("tab", { name: "Skapa konto" })).toBeVisible();
  await expect(page.locator(".landing")).toHaveCount(0);
});

test("a link to a page of the site skips the front page", async ({ page }) => {
  await page.goto("/index.html#start");
  await expect(page.getByRole("tab", { name: "Skapa konto" })).toBeVisible();
  await expect(page.locator(".landing")).toHaveCount(0);
});

test("the front page fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/index.html");
  await expect(page.locator(".landing-title")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1 || document.querySelector(".auth-screen").scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
