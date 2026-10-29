const { test, expect } = require("@playwright/test");
const { signIn, openLesson } = require("./helpers");

// Everything can be done with the keyboard: the dialogs open and close with it, and the focus goes back to where it came from.
test.beforeEach(async ({ page }) => { await signIn(page); });

test("keyboard: the room of the pet opens with Enter, closes with Esc, and the focus goes back", async ({ page }) => {
  const chip = page.locator("#pet-chip");
  await chip.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#pet-overlay")).toBeVisible();
  // the focus is inside the dialog, not behind it
  expect(await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest("#pet-overlay")))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#pet-overlay")).toHaveCount(0);
  await expect(chip).toBeFocused();
});

test("keyboard: the reading settings open and close, and the focus goes back", async ({ page }) => {
  const link = page.locator("#reading-link");
  await link.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog").last();
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('[role="dialog"]')))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(link).toBeFocused();
});

test("keyboard: a sort task is solved with the keyboard alone", async ({ page }) => {
  await openLesson(page, "udda-jamna", ".fm-sortera");
  const rows = page.locator("#lesson-player .fm-row");
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const text = (await rows.nth(i).locator(".tf-body").innerText()).trim();
    const choice = rows.nth(i).locator(".fm-choice").nth(Number(text) % 2 === 0 ? 0 : 1);
    await choice.focus();
    await page.keyboard.press("Space");
    await expect(choice).toHaveAttribute("aria-pressed", "true");
  }
  await page.locator("#lesson-player .fm-check").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
});

test("keyboard: an ordering task is solved with the arrow buttons and the keyboard", async ({ page }) => {
  await openLesson(page, "decimaltal", ".fm-ordna");
  const items = () => page.locator("#lesson-player .fm-orow .tf-body").allInnerTexts();
  const value = (s) => Number(s.trim().replace(",", "."));
  const target = (await items()).map((s) => s.trim()).sort((a, b) => value(a) - value(b));
  for (let guard = 0; guard < 30; guard++) {
    const now = (await items()).map((s) => s.trim());
    const i = now.findIndex((x, k) => x !== target[k]);
    if (i < 0) break;
    const arrow = page.locator("#lesson-player .fm-orow").nth(now.indexOf(target[i])).locator(".fm-arrow").first();
    await arrow.focus();
    await page.keyboard.press("Enter");
  }
  await page.locator("#lesson-player .fm-check").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
});

test("keyboard: Esc leaves a lesson", async ({ page }) => {
  await openLesson(page, "udda-jamna");
  await page.keyboard.press("Escape");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveCount(0);
});

test("keyboard: the first Tab on the page reaches a way past the menus", async ({ page }) => {
  await page.reload();
  await expect(page.locator(".hp-stage")).toBeVisible();
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => { const a = document.activeElement; return a ? (a.textContent || a.getAttribute("aria-label") || "").trim() : ""; });
  expect(first).toMatch(/Hoppa|innehåll|Gaussica/i);
});
