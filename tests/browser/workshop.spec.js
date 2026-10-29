const { test, expect } = require("@playwright/test");
const { signIn, openWorkshop } = require("./helpers");

// Regression: clicking a square of the grid in Verkstad marked another one, because the picture does not fill its box.
for (const viewport of [{ width: 1280, height: 800 }, { width: 900, height: 700 }, { width: 390, height: 844 }]) {
  test("verkstad, rutnät: a click marks the square that was clicked (" + viewport.width + " wide)", async ({ page }) => {
    await page.setViewportSize(viewport);
    await signIn(page, { pet: null });
    await openWorkshop(page);
    await page.locator("button.pet-tab").filter({ hasText: "Rutnät" }).click();
    const svg = page.locator(".wk-grid");
    await expect(svg).toBeVisible();
    const filled = async () => page.evaluate(() => [...document.querySelectorAll(".wk-grid rect")].map((r, i) => (r.getAttribute("fill") === "#76c0ec" ? (i % 14) + "," + Math.floor(i / 14) : null)).filter(Boolean));
    for (const [cx, cy] of [[0, 0], [13, 9], [6, 4], [13, 0], [0, 9], [9, 6]]) {
      await svg.scrollIntoViewIfNeeded();
      const box = await svg.boundingBox();
      const k = Math.min(box.width / 422, box.height / 302);
      const x = box.x + (box.width - 422 * k) / 2 + (1 + cx * 30 + 15) * k;
      const y = box.y + (box.height - 302 * k) / 2 + (1 + cy * 30 + 15) * k;
      const before = await filled();
      await page.mouse.click(x, y);
      const after = await filled();
      const added = after.filter((c) => !before.includes(c));
      expect(added, "clicked square " + cx + "," + cy).toEqual([cx + "," + cy]);
    }
  });
}

test("verkstad, tallinje: the ball goes where it is dragged", async ({ page }) => {
  await signIn(page, { pet: null });
  await openWorkshop(page);
  await page.locator("button.pet-tab").filter({ hasText: "Tallinje" }).click();
  const dot = page.locator(".wk-dot");
  await expect(dot).toBeVisible();
  await dot.scrollIntoViewIfNeeded();
  const svg = page.locator(".wk-svg").first();
  const box = await svg.boundingBox();
  const d = await dot.boundingBox();
  await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.9, d.y + d.height / 2, { steps: 6 });
  await page.mouse.up();
  const after = await dot.boundingBox();
  expect(after.x).toBeGreaterThan(d.x + 50);
});
