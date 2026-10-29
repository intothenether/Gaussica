const { test, expect } = require("@playwright/test");
const { signIn } = require("./helpers");

// Öva mer gives fresh rounds of the new formats too. A round has questions of all the templates of the lesson, so the player is
// stepped through until the question of the format comes.
async function practiceUntil(page, lessonId, selector) {
  // the template that is drawn is the last of the lesson: the ones of the new formats are the last ones
  await page.evaluate((id) => { Math.random = () => 0.9999; location.hash = "#start"; setTimeout(() => { location.hash = "#practice/" + id; }, 150); }, lessonId);
  await expect(page.locator("#lesson-player .pl-foot")).toBeVisible();
  for (let i = 0; i < 25; i++) {
    if (await page.locator("#lesson-player " + selector).count()) return;
    const skip = page.locator("#lesson-player .pl-foot").getByRole("button", { name: /Hoppa över|Fortsätt/ }).first();
    if (!(await skip.isVisible().catch(() => false))) break;
    await skip.click();
  }
  await expect(page.locator("#lesson-player " + selector).first()).toBeVisible();
}

test.beforeEach(async ({ page }) => { await signIn(page); });

test("öva mer: a fresh sortera round, solved by sorting right", async ({ page }) => {
  await practiceUntil(page, "udda-jamna", ".fm-sortera");
  const rows = page.locator("#lesson-player .fm-row");
  const n = await rows.count();
  expect(n).toBe(6);
  for (let i = 0; i < n; i++) {
    const text = (await rows.nth(i).locator(".tf-body").innerText()).trim();
    await rows.nth(i).locator(".fm-choice").nth(Number(text) % 2 === 0 ? 0 : 1).click();
  }
  await page.locator("#lesson-player .fm-check").click();
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
});

test("öva mer: a fresh lucktext round with the numbers of the template", async ({ page }) => {
  await practiceUntil(page, "kalendern", ".fm-lucktext");
  const text = await page.locator("#lesson-player .fm-text").innerText();
  const [, w, d] = /(\d+) veckor är\s+dagar\.\s+(\d+) dygn/.exec(text.replace(/\s+/g, " ").replace(/ +dagar/, " dagar")) || /(\d+) veckor.*?(\d+) dygn/.exec(text.replace(/\s+/g, " ")) || [];
  expect(Number(w)).toBeGreaterThan(1);
  const gaps = page.locator("#lesson-player .fm-gap");
  await gaps.nth(0).fill(String(Number(w) * 7));
  await gaps.nth(1).fill(String(Number(d) * 24));
  await page.locator("#lesson-player .fm-check").click();
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
});

test("öva mer: a fresh ordna round", async ({ page }) => {
  await practiceUntil(page, "decimaltal", ".fm-ordna");
  const items = () => page.locator("#lesson-player .fm-orow .tf-body").allInnerTexts();
  const value = (s) => Number(s.trim().replace(",", "."));
  const target = (await items()).map((s) => s.trim()).sort((a, b) => value(a) - value(b));
  for (let guard = 0; guard < 30; guard++) {
    const now = (await items()).map((s) => s.trim());
    const i = now.findIndex((x, k) => x !== target[k]);
    if (i < 0) break;
    await page.locator("#lesson-player .fm-orow").nth(now.indexOf(target[i])).locator(".fm-arrow").first().click();
  }
  await page.locator("#lesson-player .fm-check").click();
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
});

test("öva mer: a fresh hitta felet round", async ({ page }) => {
  await practiceUntil(page, "ekvation", ".fm-hittafelet");
  const wrongStep = await page.locator("#lesson-player .fm-stepbtn").evaluateAll((els) => els.map((e) => e.textContent));
  expect(wrongStep.length).toBeGreaterThanOrEqual(3);
  // the steps are shown, and the right one is found by trying (it is not told in the page)
  for (let i = 0; i < wrongStep.length; i++) {
    await page.locator("#lesson-player .fm-stepbtn").nth(i).click();
    await page.locator("#lesson-player .fm-check").click();
    if (await page.locator("#lesson-player .pl-foot.is-correct").count()) break;
  }
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
});
