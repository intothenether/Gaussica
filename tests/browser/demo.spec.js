const { test, expect } = require("@playwright/test");

// The trial for a parent: index.html#prova opens the site without an account, as the child first, with a family and a child made in this browser (demo.js).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem("gaussica.cookies-ok", "1"); } catch (e) { /* no storage */ } });
});

test("#prova opens the site without an account, with a bar that says it is a trial", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/index.html#prova");
  await expect(page.locator("#demo-bar")).toBeVisible();
  await expect(page.locator("#demo-bar")).toContainText("Du provar Gaussica");
  // as the child, not the sign-in screen and not the adult's page
  await expect(page.locator(".hp-stage, .hp-choose").first()).toBeVisible();
  await expect(page.locator("#switch-view, [id*=preview]").first()).toBeAttached();
  expect(await page.evaluate(() => window.location.hash)).toBe("#start");
  expect(errors).toEqual([]);
});

test("the parent can go to their own page and see the week of a child", async ({ page }) => {
  await page.goto("/index.html#prova");
  await expect(page.locator("#demo-bar")).toBeVisible();
  await page.getByRole("button", { name: /Tillbaka till mina barn/ }).first().click();
  await page.locator("#admin-top-link").click();
  await expect(page.locator(".tv-week-summary").first()).toContainText("Maja övade");
  await expect(page.locator(".tv-help").first()).toContainText("Att prata om");
});

test("Börja om clears what was done, and Skapa ett konto leaves the trial", async ({ page }) => {
  await page.goto("/index.html#prova");
  await expect(page.locator("#demo-bar")).toBeVisible();
  await page.locator("#demo-bar").getByRole("button", { name: "Börja om" }).click();
  await expect(page.locator("#demo-bar")).toBeVisible();
  await page.locator("#demo-bar").getByRole("button", { name: "Skapa ett konto" }).click();
  await expect(page.getByRole("tab", { name: "Skapa konto" })).toBeVisible();
  await expect(page.locator("#demo-bar")).toHaveCount(0);
});

test("the sign-in and the page for parents have a way in", async ({ page }) => {
  await page.goto("/index.html#start");
  await expect(page.getByRole("tab", { name: "Skapa konto" })).toBeVisible();
  await expect(page.locator('a[href="./index.html#prova"]').first()).toBeVisible();
  const parents = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "foraldrar.html"), "utf8");
  expect(parents).toContain('href="index.html#prova"');
});
