const { test, expect } = require("@playwright/test");
const { signIn, watchErrors } = require("./helpers");

// Search for a lesson: in the map (the lesson tree) and in the lesson pickers of the assignments.

const openMap = async (page) => {
  const toggle = page.locator("#map-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(page.locator("#map-search-input")).toBeVisible();
};

test("the map: what is typed finds lessons, dims the others, and a click opens the lesson", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await openMap(page);
  const input = page.locator("#map-search-input");
  await expect(page.locator("#map-search-results")).toBeHidden();
  await input.fill("tomma hinken");
  await expect(page.locator("#map-search-count")).toContainText(/lektion.* hittades/);
  const hit = page.locator("#map-search-results .map-search-hit", { hasText: "tomma hinken" }).first();
  await expect(hit).toBeVisible();
  await expect(hit.locator(".map-search-hit-meta")).toContainText("åk 4");
  // the map: the hit is lit and others are dimmed
  await expect(page.locator('#lesson-graph .graph-node[data-lesson-id="tom-behallare"]')).toHaveClass(/is-hit/);
  expect(await page.locator("#lesson-graph .graph-node.is-dim").count()).toBeGreaterThan(50);
  // a click opens the lesson
  await hit.click();
  await expect(page.locator("#lesson-popup")).toBeVisible();
  await expect(page.locator("#lesson-popup")).toContainText("tomma hinken");
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("the map: without the Swedish letters, in another area than the one chosen, and nothing found", async ({ page }) => {
  await signIn(page);
  await openMap(page);
  await page.locator(".area-filter", { hasText: "Form & rum" }).click();
  const input = page.locator("#map-search-input");
  await input.fill("brak");   // bråk, in the area of numbers, while Form & rum is chosen
  const first = page.locator("#map-search-results .map-search-hit").first();
  await expect(first).toBeVisible();
  await expect(first.locator(".map-search-hit-title")).toContainText(/[Bb]r[åa]k/);
  await first.click();
  await expect(page.locator("#lesson-popup")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".area-filter[aria-pressed=true]")).toHaveText("Alla områden");   // the area was changed so that the lesson is on the map
  await input.fill("qwertyuiop");
  await expect(page.locator("#map-search-count")).toContainText("Ingen lektion hittades");
  await expect(page.locator("#map-search-results")).toBeHidden();
  // the clear button and Escape bring everything back
  await expect(page.locator("#map-search-clear")).toBeVisible();
  await page.locator("#map-search-clear").click();
  await expect(input).toHaveValue("");
  await expect(page.locator("#lesson-graph .graph-node.is-dim")).toHaveCount(0);
  await input.fill("ekvation");
  await expect(page.locator("#map-search-results .map-search-hit").first()).toBeVisible();
  await input.press("Escape");
  await expect(input).toHaveValue("");
  await expect(page.locator("#lesson-graph .graph-node.is-hit")).toHaveCount(0);
});

test("the map: the keyboard works: Enter opens the best hit, the arrows move in the list", async ({ page }) => {
  await signIn(page);
  await openMap(page);
  const input = page.locator("#map-search-input");
  await input.fill("klocka");
  await expect(page.locator("#map-search-results .map-search-hit").nth(1)).toBeVisible();
  await input.press("ArrowDown");
  await expect(page.locator("#map-search-results .map-search-hit").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#map-search-results .map-search-hit").nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(input).toBeFocused();
  await input.press("Enter");
  await expect(page.locator("#lesson-popup")).toBeVisible();
});

test("the assignments: the lesson picker has a search that puts the best hits first, Enter chooses the best, and the choice stays", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await page.getByRole("button", { name: /Tillbaka till lärarvyn/ }).first().click();
  await page.evaluate(() => { location.hash = "#admin"; });
  await page.locator('input[placeholder*="Namn på ny klass"]').fill("5A");
  await page.getByRole("button", { name: "+ Skapa klass" }).click();
  const form = page.locator(".tv-assign-form");
  await expect(form).toBeVisible({ timeout: 15000 });
  const search = form.locator(".tv-pick-search").first();
  const select = form.locator(".tv-pick select").first();
  const all = await select.locator("option").count();
  expect(all).toBeGreaterThan(150);
  await search.fill("tomma hinken");
  await expect(form.locator(".tv-pick-count").first()).toContainText(/lektion.* hittades/);
  await expect(select.locator("option").nth(1)).toContainText("tomma hinken");
  expect(await select.locator("option").count()).toBeLessThan(all / 3);
  // Enter chooses the best hit and does not send the form
  await search.press("Enter");
  await expect(select).toHaveValue("tom-behallare");
  await expect(form.locator(".tv-compose-error")).toBeHidden();
  // a new search does not take the choice away
  await search.fill("bråk");
  // the chosen lesson stays at the top of the list, then the hits
  await expect(select.locator("option").nth(2)).toContainText("Bråk", { ignoreCase: true });
  await expect(select).toHaveValue("tom-behallare");
  await search.fill("qwertyuiop");
  await expect(form.locator(".tv-pick-count").first()).toContainText("Ingen lektion hittades");
  await expect(select).toHaveValue("tom-behallare");
  // an empty search is the whole list again
  await search.fill("");
  expect(await select.locator("option").count()).toBe(all);
  // the second picker is separate
  await form.getByRole("button", { name: /Lägg till fler lektioner/ }).click();
  await form.locator(".tv-pick-search").nth(1).fill("klocka");
  await expect(form.locator(".tv-pick select").nth(1).locator("option").nth(1)).toContainText(/klock/i);
  await expect(select).toHaveValue("tom-behallare");
  expect(errors).toEqual([]);
});
