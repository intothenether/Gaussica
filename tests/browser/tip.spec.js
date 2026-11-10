const { test, expect } = require("@playwright/test");
const { signIn, openLesson } = require("./helpers");

// The tip after a wrong answer comes in a box in the middle of the screen and stays until the student presses the button (tip-dialog.js).
// Many younger students do not read a line at the bottom of the page, so this one cannot be missed.

const LESSON = "addition-uppstallning";   // "Räkna ut 38 + 47 med uppställning." (right: 85)
const field = (page) => page.locator("#lesson-player input[name=answer]");
const box = (page) => page.locator("#lesson-player .tip-box");
const again = (page) => page.locator("#lesson-player .tip-again");

async function toExercise(page) {
  await signIn(page, { keepTips: true });
  await openLesson(page, LESSON, "input[name=answer]");
  await expect(page.locator("#lesson-player .pl-foot-q")).toContainText("38 + 47");
}

async function answer(page, text) {
  await field(page).fill(text);
  await field(page).press("Enter");
}

test("a wrong answer opens the tip in the middle of the screen, and it stays until the button is pressed", async ({ page }) => {
  await toExercise(page);
  await expect(box(page)).toHaveCount(0);
  await answer(page, "58");   // the digits of 85 the other way round
  await expect(box(page)).toBeVisible();
  await expect(box(page)).toContainText("Tänk på ordningen i ditt svar.");
  await expect(box(page)).not.toContainText("85");
  await expect(page.locator(".tip-box [role=dialog], .tip-box")).toHaveAttribute("role", "dialog");
  // in the middle
  const b = await box(page).boundingBox(), v = page.viewportSize();
  expect(Math.abs(b.x + b.width / 2 - v.width / 2)).toBeLessThan(4);
  expect(Math.abs(b.y + b.height / 2 - v.height / 2)).toBeLessThan(40);
  // the focus is on the button, and neither time nor a click beside the box closes it
  await expect(again(page)).toBeFocused();
  await page.waitForTimeout(3500);
  await page.mouse.click(5, 5);
  await expect(box(page)).toBeVisible();
  // the button closes it, and the focus is where the answer is written
  await again(page).click();
  await expect(box(page)).toHaveCount(0);
  await expect(field(page)).toBeFocused();
  // the same tip stays in the bottom bar for the moment when the answer is changed
  await expect(page.locator("#lesson-player .pl-foot-feedback .feedback-message")).toContainText("Tänk på ordningen i ditt svar.");
  // and another try is made as before: a wrong one opens it again, a right one does not
  await answer(page, "1000");
  await expect(box(page)).toBeVisible();
  await again(page).press("Enter");
  await expect(box(page)).toHaveCount(0);
  await answer(page, "85");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
  await expect(box(page)).toHaveCount(0);
});

test("Esc closes the tip and not the lesson, and Tab stays in the box", async ({ page }) => {
  await toExercise(page);
  await answer(page, "58");
  await expect(box(page)).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(box(page).locator("button:focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(box(page)).toHaveCount(0);
  await expect(page.locator("#lesson-player .pl-foot")).toBeVisible();
  await expect(field(page)).toBeFocused();
});

test("after two wrong answers the tip has the worked example, and the example opens from it", async ({ page }) => {
  await toExercise(page);
  await answer(page, "58");
  await again(page).click();
  await answer(page, "1000");
  const example = box(page).getByRole("button", { name: /löst exempel/ });
  await expect(example).toBeVisible();
  await example.click();
  await expect(box(page)).toHaveCount(0);
  await expect(page.locator("#lesson-player .rules-overlay")).toBeVisible();
});

test("the other kinds of questions have it too: a sorting task", async ({ page }) => {
  await signIn(page, { keepTips: true });
  await openLesson(page, "udda-jamna", ".fm-sortera");
  const rows = page.locator("#lesson-player .fm-row");
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const row = rows.nth(i);
    const text = (await row.locator(".tf-body").innerText()).trim();
    const right = Number(text) % 2 === 0 ? 0 : 1;
    await row.locator(".fm-choice").nth(text === "45" ? 1 - right : right).click();
  }
  await page.locator("#lesson-player .fm-check").click();
  await expect(box(page)).toContainText("5 av 6 ligger rätt");
  await again(page).click();
  await expect(box(page)).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 667 } });
  test("the box fits the screen and the button can be reached", async ({ page }) => {
    await toExercise(page);
    await answer(page, "58");
    await expect(box(page)).toBeVisible();
    const b = await box(page).boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(375);
    expect(b.y + b.height).toBeLessThanOrEqual(667);
    expect((await again(page).boundingBox()).height).toBeGreaterThanOrEqual(44);
    await again(page).click();
    await expect(box(page)).toHaveCount(0);
  });
});

test("the pet of the student looks at the tip with its head on one side", async ({ page }) => {
  await toExercise(page);
  await answer(page, "58");
  await expect(box(page)).toBeVisible();
  await expect(box(page).locator(".tip-pet svg")).toBeVisible();
  await expect(box(page).locator(".tip-icon")).toHaveClass(/tip-pet/);
});
