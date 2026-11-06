const { test, expect } = require("@playwright/test");
const { signIn, openLesson, watchErrors } = require("./helpers");

// The overview of a lesson is a pop-up over the page: it opens from a node on the map or from "Mer om lektionen", and nothing is scrolled.
test.beforeEach(async ({ page }) => { await signIn(page); });

async function openMap(page) {
  const toggle = page.locator("#map-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(page.locator("#graph-viewport")).toBeVisible();
}

test("pop-up: a node on the map opens the overview as a pop-up, and the page stays where it is", async ({ page }) => {
  const errors = watchErrors(page);
  await openMap(page);
  const popup = page.locator("#lesson-popup");
  await expect(popup).toBeHidden();
  const node = page.locator("#lesson-graph button[data-lesson-id=\"inte-lika-med\"]");   // a lesson on its own (the first node on the map is a chapter, which opens a list of its lessons)
  await node.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await node.click();
  await expect(popup).toBeVisible();
  await expect(page.getByRole("dialog", { name: /.+/ })).toBeVisible();
  await expect(popup.locator(".panel-title")).toBeVisible();
  await expect(popup.locator(".start-card")).toBeVisible();
  // the card is on the screen, and the page behind it has not been scrolled
  const box = await page.locator("#lesson-popup-card").boundingBox();
  const view = page.viewportSize();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(2);
  expect(errors).toEqual([]);
});

test("pop-up: Esc, the cross and a click beside it close it, and the focus goes back to the node", async ({ page }) => {
  await openMap(page);
  const popup = page.locator("#lesson-popup");
  const node = page.locator("#lesson-graph button[data-lesson-id=\"inte-lika-med\"]");   // a lesson on its own (the first node on the map is a chapter, which opens a list of its lessons)
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(popup).toBeVisible();
  expect(await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest("#lesson-popup")))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();
  expect(await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest("#lesson-graph")))).toBe(true);

  await node.click();
  await expect(popup).toBeVisible();
  await page.locator("#lesson-popup-close").click();
  await expect(popup).toBeHidden();

  await node.click();
  await expect(popup).toBeVisible();
  await popup.click({ position: { x: 5, y: 5 } });
  await expect(popup).toBeHidden();
});

test("pop-up: a lesson that builds on another opens that one in the same pop-up", async ({ page }) => {
  await openMap(page);
  const popup = page.locator("#lesson-popup");
  // a lesson with a prerequisite
  await page.locator("#lesson-graph button[data-lesson-id]").nth(30).click();
  await expect(popup).toBeVisible();
  const title = await popup.locator(".panel-title").innerText();
  const link = popup.locator(".prerequisite-link").first();
  if (await link.count()) {
    await link.click();
    await expect(popup).toBeVisible();
    await expect(popup.locator(".panel-title")).not.toHaveText(title);
  }
});

test("pop-up: a student who has got going is told which lessons this builds on are still untouched", async ({ page }) => {
  const errors = watchErrors(page);
  await openMap(page);
  const popup = page.locator("#lesson-popup");
  const open = async (id) => {
    const node = page.locator('#lesson-graph button[data-lesson-id="' + id + '"]');
    await node.scrollIntoViewIfNeeded();
    await node.click();
    await expect(popup).toBeVisible();
    await expect(popup.locator(".panel-title")).toBeVisible();
  };
  // a new student: nothing is said, everything is new
  await open("ekvation");
  await expect(popup.locator(".prerequisite-link").first()).toBeVisible();
  await expect(popup.locator(".prerequisite-note")).toHaveCount(0);
  await page.locator("#lesson-popup-close").click();
  await expect(popup).toBeHidden();
  // after starting a lesson, the untouched ones are marked and named
  await openLesson(page, "ekvation", "input[name=answer]");
  await page.locator("#lesson-player input[name=answer]").fill("5");
  await page.locator("#lesson-player input[name=answer]").press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-wrong/, { timeout: 8000 });
  await page.evaluate(() => { location.hash = "#start"; });
  await expect(page.locator("#lesson-player .pl-foot")).toBeHidden();
  await openMap(page);
  await open("ekvation");
  await expect(popup.locator(".prerequisite-note")).toContainText("bygger på");
  await expect(popup.locator(".prerequisite-note")).toContainText("som du inte övat än");
  await expect(popup.locator(".prerequisite-link.is-new").first()).toBeVisible();
  // the note is about what the lesson builds on: a lesson with nothing untouched before it has none
  await page.locator("#lesson-popup-close").click();
  await open("addition");
  await expect(popup.locator(".prerequisite-note")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("pop-up: Mer om lektionen in the short path opens it, and Start closes it", async ({ page }) => {
  const popup = page.locator("#lesson-popup");
  await page.locator(".pv-more").first().click();
  await expect(popup).toBeVisible();
  const start = popup.locator(".start-card button").first();
  await start.click();
  await expect(page.locator("#lesson-player .pl-foot")).toBeVisible();
  await expect(popup).toBeHidden();
});

test("pop-up: the focus stays inside it when Tab is pressed", async ({ page }) => {
  await page.locator(".pv-more").first().click();
  const popup = page.locator("#lesson-popup");
  await expect(popup).toBeVisible();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest("#lesson-popup")))).toBe(true);
  }
});

test("pop-up: on a phone it fits the screen and can be scrolled inside", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.locator(".pv-more").first().click();
  const popup = page.locator("#lesson-popup");
  await expect(popup).toBeVisible();
  const box = await page.locator("#lesson-popup-card").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(391);
  expect(box.y + box.height).toBeLessThanOrEqual(701);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});
