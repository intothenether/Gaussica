const { test, expect } = require("@playwright/test");
const { signIn, openLesson } = require("./helpers");

test("the pet: petting gives hearts, and the bubble answers", async ({ page }) => {
  await signIn(page);
  await page.locator(".hp-stage").click();
  await expect(page.locator(".hp-stage .pet-hearts i")).toHaveCount(5);
  await expect(page.locator(".hp-bubble")).toContainText(/💛/);
});

test("the pet: the eyes follow the cursor", async ({ page }) => {
  await signIn(page);
  const svg = page.locator(".hp-stage .pet-svg");
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width + 300, box.y + box.height * 0.46, { steps: 4 });
  await expect.poll(() => svg.evaluate((el) => el.style.getPropertyValue("--gx"))).toBe("3.20px");
  await page.mouse.move(2, box.y + box.height * 0.46, { steps: 4 });   // the pet is near the left edge of the page: as far left as the page goes
  await expect.poll(() => svg.evaluate((el) => parseFloat(el.style.getPropertyValue("--gx")))).toBeLessThan(-0.5);
});

test("the pet peeks over the step card, and points with an arm of its own kind", async ({ page }) => {
  await signIn(page, { pet: "Nymfkakadua" });
  const arm = page.locator(".hs-peek .pet-arm");
  await expect(arm).toHaveAttribute("data-arm", "wing");
  const peek = await page.locator(".hs-peek").boundingBox();
  const button = await page.locator(".hs-go").boundingBox();
  expect(peek.x).toBeGreaterThan(button.x + button.width - 4);   // not on top of the button
  // nothing clips the arm: only the head is cut, at the chin
  expect(await page.locator(".hs-peek").evaluate((el) => getComputedStyle(el).overflow)).toBe("visible");
  expect(await page.locator(".hs-peek-head").evaluate((el) => getComputedStyle(el).overflow)).toBe("hidden");
});

test("the pet sits on its node on the map, whole: the gills of an axolotl are not cut off", async ({ page }) => {
  await signIn(page, { pet: "Axolotl" });
  await page.getByRole("button", { name: /Visa hela kartan/ }).click();
  const marker = page.locator(".gn-pet");
  await expect(marker).toBeVisible();
  await expect(marker.locator("svg")).toHaveAttribute("viewBox", "8 0 184 150");
  expect(await marker.locator("svg").evaluate((el) => getComputedStyle(el).overflow)).toBe("visible");
  await expect(marker).toHaveAttribute("aria-label", "Pixel är här");
});

test("in a lesson the pet peeks over the footer: calm, then looking at the hint, then happy", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "addition", ".pl-foot input[name=answer]");
  const eyesOf = () => page.locator("#lesson-player .pl-peek .pet-svg").evaluate((el) => [el.style.getPropertyValue("--gx"), el.style.getPropertyValue("--gy"), el.classList.contains("is-happy")]);
  const peekBox = await page.locator("#lesson-player .pl-peek").boundingBox();
  const footBox = await page.locator("#lesson-player .pl-foot").boundingBox();
  await page.waitForTimeout(700);
  const settled = await page.locator("#lesson-player .pl-peek").boundingBox();
  expect(settled.y + settled.height).toBeLessThanOrEqual(footBox.y + 2);   // above the top edge of the footer
  expect(peekBox).toBeTruthy();
  expect((await eyesOf())[2]).toBe(false);
  // Enter in the field, so that the mouse does not move: a moving mouse makes the pet look at the cursor instead
  await page.locator("#lesson-player .pl-foot input[name=answer]").fill("1");
  await page.locator("#lesson-player .pl-foot input[name=answer]").press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-wrong/);
  expect((await eyesOf())[1]).toBe("-2.8px");
  await page.locator("#lesson-player .pl-foot input[name=answer]").fill("534");
  await page.locator("#lesson-player .pl-foot input[name=answer]").press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
  expect((await eyesOf())[2]).toBe(true);
});
