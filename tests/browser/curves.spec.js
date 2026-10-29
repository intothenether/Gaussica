const { test, expect } = require("@playwright/test");
const { signIn, openLesson } = require("./helpers");

// The gymnasium lessons show their functions as curves, with the table of values after them.
for (const [id, curves, label] of [["exponentialfunktioner", 2, "y = 2^x"], ["andragradsfunktioner", 1, "y = x² − 4x + 3"], ["logaritmer", 1, "(10, 1)"]]) {
  test("a graph with " + curves + " curve(s) in " + id, async ({ page }) => {
    await signIn(page);
    await openLesson(page, id, ".fig-curve");
    const paths = page.locator("#lesson-player path.fig-curve");
    await expect(paths).toHaveCount(curves);
    for (const p of await paths.all()) {
      const d = await p.getAttribute("d");
      expect(d).toMatch(/^M/);
      expect(d).not.toMatch(/NaN|Infinity/);
    }
    await expect(page.locator("#lesson-player svg text", { hasText: label }).first()).toBeVisible();
    // the curve is inside of the picture: the box of the line is not wider than the picture
    const svg = await page.locator("#lesson-player svg:has(path.fig-curve)").first().boundingBox();
    const line = await paths.first().boundingBox();
    expect(line.x).toBeGreaterThanOrEqual(svg.x - 1);
    expect(line.x + line.width).toBeLessThanOrEqual(svg.x + svg.width + 1);
    // the table of values is still there, after the graph
    await expect(page.locator("#lesson-player table").first()).toBeVisible();
  });
}
