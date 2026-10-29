const { test, expect } = require("@playwright/test");
const { signIn, openLesson, watchErrors } = require("./helpers");

test.beforeEach(async ({ page }) => { await signIn(page); });

test("sortera: a wrong group is told how many are right, and the right answer solves it", async ({ page }) => {
  const errors = watchErrors(page);
  await openLesson(page, "udda-jamna", ".fm-sortera");
  const rows = page.locator("#lesson-player .fm-row");
  const n = await rows.count();
  expect(n).toBe(6);
  const place = async (wrongText) => {
    for (let i = 0; i < n; i++) {
      const row = rows.nth(i);
      const text = (await row.locator(".tf-body").innerText()).trim();
      const right = Number(text) % 2 === 0 ? 0 : 1;
      await row.locator(".fm-choice").nth(text === wrongText ? 1 - right : right).click();
    }
  };
  const check = page.locator("#lesson-player .fm-check");
  await expect(check).toBeDisabled();
  await place("45");
  await check.click();
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-wrong/);
  await expect(page.locator("#lesson-player .feedback-message")).toContainText("5 av 6 ligger rätt");
  await check.click();
  await expect(page.locator("#lesson-player .fm-row.is-wrong")).toHaveCount(1);
  await page.locator("#lesson-player .fm-row", { hasText: "45" }).locator(".fm-choice").nth(1).click();
  await check.click();
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
  await expect(page.locator("#lesson-player .tf-explain")).toHaveCount(6);
  expect(errors).toEqual([]);
});

test("ordna: the arrows put the things in order, and it is checked", async ({ page }) => {
  await openLesson(page, "storre-mindre", ".fm-ordna");
  const items = () => page.locator("#lesson-player .fm-orow .tf-body").allInnerTexts();
  const target = ["53", "305", "350", "503"];
  expect((await items()).map((s) => s.trim())).not.toEqual(target);
  for (let guard = 0; guard < 20; guard++) {
    const now = (await items()).map((s) => s.trim());
    const i = now.findIndex((x, k) => x !== target[k]);
    if (i < 0) break;
    const from = now.indexOf(target[i]);
    await page.locator("#lesson-player .fm-orow").nth(from).locator(".fm-arrow").first().click();
  }
  expect((await items()).map((s) => s.trim())).toEqual(target);
  await page.locator("#lesson-player .fm-check").click();
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
});

test("hitta felet: a step that is right is not the mistake, and the mistake shows the explanation", async ({ page }) => {
  await openLesson(page, "addition-uppstallning", ".fm-hittafelet");
  const steps = page.locator("#lesson-player .fm-stepbtn");
  await expect(steps).toHaveCount(4);
  const check = page.locator("#lesson-player .fm-check");
  await expect(check).toBeDisabled();
  await steps.nth(0).click();
  await check.click();
  await expect(page.locator("#lesson-player .feedback-message")).toContainText("Steg 1 stämmer");
  await check.click();
  await expect(page.locator("#lesson-player .feedback-message")).toContainText("Tips");
  await steps.nth(1).click();
  await check.click();
  await expect(page.locator("#lesson-player .fm-explain")).toContainText("5 + 8 + 1 = 14");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
});

test("fyll i luckorna: wrong gaps are marked, and capital letters and spaces do not matter", async ({ page }) => {
  await openLesson(page, "kalendern", ".fm-lucktext");
  const gaps = page.locator("#lesson-player .fm-gap");
  await expect(gaps).toHaveCount(3);
  const check = page.locator("#lesson-player .fm-check");
  await expect(check).toBeDisabled();
  await gaps.nth(0).fill("7");
  await gaps.nth(1).fill("25");
  await gaps.nth(2).fill(" Tolv ");
  await check.click();
  await expect(page.locator("#lesson-player .fm-gap.is-wrong")).toHaveCount(1);
  await expect(page.locator("#lesson-player .feedback-message")).toContainText("2 av 3");
  await gaps.nth(1).fill("24");
  await gaps.nth(1).press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
  await expect(gaps.first()).toBeDisabled();
});

test("fyll i luckorna: a gap with choices is a list", async ({ page }) => {
  await openLesson(page, "rektangelns-area", ".fm-lucktext");
  const select = page.locator("#lesson-player select.fm-gap");
  await expect(select).toHaveCount(1);
  await select.selectOption("gånger");
  await page.locator("#lesson-player input.fm-gap").fill("24");
  await page.locator("#lesson-player .fm-check").click();
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
});
