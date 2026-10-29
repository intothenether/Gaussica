const { test, expect } = require("@playwright/test");
const { watchErrors } = require("./helpers");

// The lesson editor has a form for each of the new formats. The teacher account is made in the demo mode (it lives only in this browser).
async function openEditor(page) {
  await page.addInitScript(() => { try { localStorage.setItem("gaussica.cookies-ok", "1"); } catch (e) { /* no storage */ } });
  await page.goto("/index.html#start");
  await page.getByRole("tab", { name: "Skapa konto" }).click();
  await page.getByRole("button", { name: "Jag är lärare" }).click();
  await page.locator('input[name="displayName"]').fill("Test Lärare");
  await page.locator('input[name="username"]').fill("testlarare");
  await page.locator('input[name="password"]').fill("test-losenord-123");
  await page.locator('input[name="code"]').fill("GAUSSICA");
  await page.locator('button[type="submit"]:visible').click();
  await expect(page.locator("#btn-new-lesson")).toBeVisible();
  await page.locator("#btn-new-lesson").click();
  await expect(page.getByRole("dialog", { name: "Lektionsredigerare" })).toBeVisible();
}

async function addBlock(page, label) {
  await page.locator(".le-palette .le-add", { has: page.locator("span", { hasText: new RegExp("^" + label + "$") }) }).click();
}

const problems = (page) => page.locator(".le-problems");

test("editor: Sortera has a form, and tells what is wrong", async ({ page }) => {
  const errors = watchErrors(page);
  await openEditor(page);
  await addBlock(page, "Sortera");
  // the example is a good task
  await expect(problems(page)).toContainText("ser bra ut");
  // it is a form, not JSON
  await expect(page.getByLabel("Grupp 1")).toHaveValue("Jämna");
  await expect(page.getByLabel("Grupp 2")).toHaveValue("Udda");
  // an item with no group of its own makes the group too small
  await page.getByRole("button", { name: "+ Lägg till grupp" }).click();
  await expect(problems(page)).not.toContainText("ser bra ut");
  await page.getByLabel("Grupp 3", { exact: true }).fill("Annat");
  await expect(problems(page)).toContainText("ser bra ut");
  // the group is removed again, and the task is good as before
  await page.locator(".le-fieldset", { hasText: "Grupper" }).getByRole("button", { name: "Ta bort" }).last().click();
  await expect(page.getByLabel("Grupp 3", { exact: true })).toHaveCount(0);
  await expect(problems(page)).toContainText("ser bra ut");
  expect(errors).toEqual([]);
});

test("editor: Ordna, items can be added and moved", async ({ page }) => {
  const errors = watchErrors(page);
  await openEditor(page);
  await addBlock(page, "Ordna");
  await expect(problems(page)).toContainText("ser bra ut");
  await page.getByLabel("1.", { exact: true }).fill("53");     // the same as the second: two alike is wrong
  await page.getByLabel("2.", { exact: true }).fill("53");
  await expect(problems(page)).not.toContainText("ser bra ut");
  await page.getByLabel("2.", { exact: true }).fill("35");
  await expect(problems(page)).toContainText("ser bra ut");
  await page.getByRole("button", { name: "Flytta ned" }).first().click();
  await expect(page.getByLabel("1.", { exact: true })).toHaveValue("35");
  expect(errors).toEqual([]);
});

test("editor: Hitta felet marks which step is wrong", async ({ page }) => {
  const errors = watchErrors(page);
  await openEditor(page);
  await addBlock(page, "Hitta felet");
  await expect(problems(page)).toContainText("ser bra ut");
  const radios = page.locator('input[type="radio"][name^="hf-wrong-"]');
  await expect(radios).toHaveCount(4);
  await expect(radios.nth(1)).toBeChecked();
  await radios.nth(2).check();
  await expect(radios.nth(1)).not.toBeChecked();
  // removing the steps below three is a problem
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Ta bort" }).last().click();
  await expect(problems(page)).not.toContainText("ser bra ut");
  expect(errors).toEqual([]);
});

test("editor: Fyll i luckorna, a gap puts {n} in the text", async ({ page }) => {
  const errors = watchErrors(page);
  await openEditor(page);
  await addBlock(page, "Fyll i luckorna");
  await expect(problems(page)).toContainText("ser bra ut");
  await page.getByRole("button", { name: "+ Lägg till lucka" }).click();
  await expect(page.locator("textarea").nth(1)).toHaveValue(/\{3\}$/);
  // the new gap has no answer yet
  await expect(problems(page)).not.toContainText("ser bra ut");
  await page.getByLabel("Lucka {3}: rätt svar").fill("tre, 3");
  await expect(problems(page)).toContainText("ser bra ut");
  expect(errors).toEqual([]);
});
