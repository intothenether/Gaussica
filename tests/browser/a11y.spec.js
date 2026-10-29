const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { signIn, openLesson, openWorkshop } = require("./helpers");

// An automatic check of the main screens with axe-core (WCAG 2 A and AA). It finds what a program can find: missing names, bad roles,
// colours with too little contrast, wrong headings. What it cannot find (is the order sensible, does the text make sense) is for a person.
async function violations(page, scope) {
  let b = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (scope) b = b.include(scope);
  const r = await b.analyze();
  // The sleeping pet has a thought in its picture ("z z z"). Axe takes it for a visible label that the name of the button ("Klappa Pixel")
  // does not contain, but it is a drawing and not a label: the picture is hidden from the screen reader. That is the only thing left out.
  r.violations.forEach((v) => { if (v.id === "label-content-name-mismatch") v.nodes = v.nodes.filter((n) => !n.target.join(" ").includes(".hp-stage")); });
  return r.violations.filter((v) => v.nodes.length).map((v) => v.id + " (" + v.impact + "): " + v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ") + (v.nodes.length > 3 ? " +" + (v.nodes.length - 3) : ""));
}

test("a11y: the sign-in page", async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem("gaussica.cookies-ok", "1"); } catch (e) { /* no storage */ } });
  await page.goto("/index.html#start");
  await expect(page.getByRole("tab", { name: "Skapa konto" })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("a11y: the start page of a student", async ({ page }) => {
  await signIn(page);
  expect(await violations(page)).toEqual([]);
});

test("a11y: a lesson with a sort task", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "udda-jamna", ".fm-sortera");
  expect(await violations(page)).toEqual([]);
});

test("a11y: a lesson with a fill-in task", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "kalendern", ".fm-lucktext");
  expect(await violations(page)).toEqual([]);
});

test("a11y: a lesson with an ordering task", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "decimaltal", ".fm-ordna");
  expect(await violations(page)).toEqual([]);
});

test("a11y: a lesson with curves", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "exponentialfunktioner");
  expect(await violations(page)).toEqual([]);
});

test("a11y: the workshop", async ({ page }) => {
  await signIn(page);
  await openWorkshop(page);
  expect(await violations(page)).toEqual([]);
});

test("a11y: the room of the pet", async ({ page }) => {
  await signIn(page);
  await page.locator("#pet-chip").click();
  await expect(page.locator("#pet-overlay")).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("a11y: the reading settings", async ({ page }) => {
  await signIn(page);
  await page.locator("#reading-link").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("a11y: the number training and the notebook", async ({ page }) => {
  await signIn(page);
  await page.evaluate(() => { location.hash = "#traning"; });
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await page.evaluate(() => { location.hash = "#start"; setTimeout(() => { location.hash = "#knepiga"; }, 150); });
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("a11y: every tab of the room of the pet", async ({ page }) => {
  test.setTimeout(180000);   // one scan for each tab
  await signIn(page);
  await page.locator("#pet-chip").click();
  const tabs = page.locator("#pet-overlay .pet-tab");
  const n = await tabs.count();
  expect(n).toBeGreaterThanOrEqual(6);
  for (let i = 0; i < n; i++) {
    await page.locator("#pet-overlay .pet-tab").nth(i).click();
    expect(await violations(page), "tab " + i).toEqual([]);
  }
});
