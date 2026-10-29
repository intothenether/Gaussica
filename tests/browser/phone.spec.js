const { test, expect } = require("@playwright/test");
const { signIn, openLesson } = require("./helpers");

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const SIDEWAYS = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

test.describe("iPhone, upright", () => {
  test.use(PHONE);

  test("no page needs sideways scrolling: the start page, a lesson, the pet room", async ({ page }) => {
    await signIn(page);
    const wide = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await wide()).toBeLessThanOrEqual(0);
    await page.locator(".hp-shop").click();
    await expect(page.locator("#pet-overlay")).toBeVisible();
    expect(await wide()).toBeLessThanOrEqual(0);
    await page.locator("#pet-overlay .pet-close").click();
    await openLesson(page, "addition", ".pl-foot input[name=answer]");
    expect(await wide()).toBeLessThanOrEqual(0);
  });

  test("the controls of the top bar and the lesson are big enough to hit (44 px)", async ({ page }) => {
    await signIn(page);
    for (const sel of [".student-profile-btn", ".rewards-chip", ".mail-link", ".area-filter", ".hp-shop"]) {
      const boxes = await page.locator(sel).evaluateAll((els) => els.filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().height));
      for (const h of boxes) expect(h, sel).toBeGreaterThanOrEqual(43);
    }
    await openLesson(page, "pyssla-vinklar", ".py-goals");
    for (const sel of ["#lesson-player .py-btn", "#lesson-player .pl-close"]) {
      const boxes = await page.locator(sel).evaluateAll((els) => els.filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().height));
      for (const h of boxes) expect(h, sel).toBeGreaterThanOrEqual(43);
    }
  });

  test("pyssla: Kolla is under the sliders and above the figure", async ({ page }) => {
    await signIn(page);
    await openLesson(page, "pyssla-vinklar", ".py-goals");
    const slider = await page.locator("#lesson-player input[type=range]").first().boundingBox();
    const kolla = await page.locator("#lesson-player .py-check-btn").boundingBox();
    const figure = await page.locator("#lesson-player .py-view").boundingBox();
    expect(kolla.y).toBeGreaterThan(slider.y);
    expect(kolla.y).toBeLessThan(figure.y);
  });

  test("the drawing pad is tall enough on a phone, and Stryk is right under the paper", async ({ page }) => {
    await signIn(page, { pet: null });
    await openLesson(page, "subtraktion-uppstallning", ".cv-stage");
    // on a phone the drawing pad starts folded, behind a button
    await page.locator("#lesson-player .scratchpad-toggle").click();
    await page.locator("#lesson-player").getByRole("button", { name: /Skriv$/ }).click();
    const stage = await page.locator("#lesson-player .cv-stage").boundingBox();
    expect(stage.height).toBeGreaterThan(240);
    const stryk = await page.locator("#lesson-player").getByRole("button", { name: /Stryk/ }).boundingBox();
    expect(stryk.y - (stage.y + stage.height)).toBeLessThan(24);
  });

  test("the formats work with touch: a gap, a list, and the arrows", async ({ page }) => {
    await signIn(page);
    await openLesson(page, "kalendern", ".fm-lucktext");
    const gaps = page.locator("#lesson-player .fm-gap");
    for (const g of await gaps.all()) expect((await g.boundingBox()).height).toBeGreaterThanOrEqual(43);
    await openLesson(page, "storre-mindre", ".fm-ordna");
    for (const a of await page.locator("#lesson-player .fm-arrow").all()) expect((await a.boundingBox()).height).toBeGreaterThanOrEqual(43);
  });
});

test.describe("iPhone, held sideways", () => {
  test.use(SIDEWAYS);

  test("the buttons to go on and back are there (they used to be hidden)", async ({ page }) => {
    await signIn(page);
    await page.evaluate(() => { location.hash = "#start"; setTimeout(() => { location.hash = "#play/subtraktion-uppstallning"; }, 150); });
    const next = page.locator("#lesson-player .pl-foot").getByRole("button", { name: /Fortsätt|Börja med/ });
    await expect(next).toBeVisible();
    const box = await next.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(390);
    await next.click();
    await next.click().catch(() => {});
    await openLesson(page, "subtraktion-uppstallning", ".pl-foot input[name=answer]");
    const foot = page.locator("#lesson-player .pl-foot");
    await expect(foot.getByRole("button", { name: "Kolla svaret" })).toBeVisible();
    await expect(foot.getByRole("button", { name: "Hoppa över" })).toBeVisible();
    await expect(foot.getByRole("button", { name: /Tillbaka/ })).toBeVisible();
  });
});
