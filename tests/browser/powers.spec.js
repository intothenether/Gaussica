const { test, expect } = require("@playwright/test");
const { signIn } = require("./helpers");

// A power written with a caret in a lesson is drawn with a raised exponent, also with an expression as the exponent (a^(m+n)), a power in
// the base ((a^m)^n), in the prompt of a task of the new formats and in the text of a figure.
const carets = (page) => page.evaluate(() => {
  const root = document.querySelector("#lesson-player");
  const hits = [];
  const w = document.createTreeWalker(root, 4);
  let n;
  while ((n = w.nextNode())) {
    const p = n.parentElement;
    if (n.nodeValue.indexOf("^") >= 0 && !p.closest("input, textarea, .answer-key")) hits.push(n.nodeValue.trim().slice(0, 80));
  }
  return hits;
});

async function walk(page, id, each) {
  await page.evaluate((lesson) => { location.hash = "#start"; setTimeout(() => { location.hash = "#play/" + lesson; }, 100); }, id);
  await expect(page.locator("#lesson-player .pl-foot")).toBeVisible();
  for (let i = 0; i < 40; i++) {
    await each();
    const next = page.locator("#lesson-player .pl-foot").getByRole("button", { name: /Fortsätt|Börja med|Hoppa över/ }).first();
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
  }
}

test("powers: no caret is left in potenslagar", async ({ page }) => {
  await signIn(page);
  const left = [];
  await walk(page, "potenslagar", async () => { left.push(...(await carets(page))); });
  expect(left).toEqual([]);
  // the raised ones are there
  await page.evaluate(() => { location.hash = "#start"; setTimeout(() => { location.hash = "#play/potenslagar"; }, 100); });
  await expect(page.locator("#lesson-player sup.pow").first()).toBeVisible();
});

test("powers: the label of a curve has a raised exponent", async ({ page }) => {
  await signIn(page);
  let raised = 0, caret = false;
  await walk(page, "exponentialfunktioner", async () => {
    raised += await page.locator("#lesson-player svg.fig-svg text tspan[dy=\"-0.45em\"]").count();
    caret = caret || (await page.locator("#lesson-player svg.fig-svg").evaluateAll((all) => all.some((s) => s.textContent.indexOf("^") >= 0)));
  });
  expect(raised).toBeGreaterThan(0);
  expect(caret).toBe(false);
});
