const { test, expect } = require("@playwright/test");
const { signIn, openLesson, watchErrors } = require("./helpers");

// The number line to play on (hopplek.js) in the lesson about negative numbers: the pet hops along the arrows of the figures and on the playground,
// the thermometer follows, the missions are checked, and the line ends where it ends.
async function toPlayground(page) {
  await openLesson(page, "negativa-tal", ".hl");
  await expect(page.locator("#lesson-player .hl")).toBeVisible();
}
const value = (page) => page.locator("#lesson-player .hl").getAttribute("data-value");

test("negativa-tal: the pet stands in the figure of the number line and hops along the arrow", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await openLesson(page, "negativa-tal", ".fig-pet");
  const pet = page.locator("#lesson-player .fig-pet").first();
  await expect(pet).toHaveCount(1);
  await expect(pet.locator("svg").first()).toBeVisible();
  // it moves: while the figure is played the pet is at more than one place (watched in the page, so that a slow machine does not miss it)
  const travelled = await page.evaluate(() => new Promise((resolve) => {
    const g = document.querySelector("#lesson-player .fig-pet");
    let lo = Infinity, hi = -Infinity;
    const t0 = performance.now();
    (function tick() {
      const x = new DOMMatrix(getComputedStyle(g).transform).m41;
      lo = Math.min(lo, x); hi = Math.max(hi, x);
      if (performance.now() - t0 < 5000) requestAnimationFrame(tick); else resolve(hi - lo);
    }());
  }));
  expect(travelled).toBeGreaterThan(40);
  expect(errors).toEqual([]);
});

test("negativa-tal: the playground: the pet hops, the thermometer and the sum follow, the missions are solved", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await toPlayground(page);
  const hl = page.locator("#lesson-player .hl");
  expect(await value(page)).toBe("0");
  await expect(hl.locator(".hl-pet svg").first()).toBeVisible();
  await expect(hl.locator(".hl-mission-text")).toContainText("Uppdrag 1 av 5: Hoppa till −3.");
  // a hop to the left: three steps
  await hl.getByRole("button", { name: /Hoppa 3 steg åt vänster/ }).click();
  await expect.poll(() => value(page)).toBe("-3");
  await expect(hl.locator(".hl-temp")).toHaveText("−3 °C");
  await expect(hl.locator(".hl-history li").last()).toHaveText("0 − 3 = −3");
  await expect(hl.locator(".hl-say")).toContainText("Rätt! Åt vänster om noll");
  await expect(hl.locator(".hl-mission")).toHaveClass(/is-solved/);
  await expect(hl.locator(".hl-arc")).toHaveCount(1);
  // next mission: from −2 to 3 with a hop of 5 to the right
  await hl.getByRole("button", { name: "Nästa uppdrag" }).click();
  expect(await value(page)).toBe("-2");
  await expect(hl.locator(".hl-mission-text")).toContainText("Uppdrag 2 av 5");
  await hl.getByRole("button", { name: /Hoppa 5 steg åt höger/ }).click();
  await expect.poll(() => value(page)).toBe("3");
  await expect(hl.locator(".hl-say")).toContainText("Rätt!");
  await expect(hl.locator(".hl-history li").last()).toHaveText("−2 + 5 = 3");
  await expect(hl.locator(".hl-temp")).toHaveText("3 °C");
  await page.screenshot({ path: "test-results/hopplek.png" });
  expect(errors).toEqual([]);
});

test("negativa-tal: the line ends where it ends, the arrow keys hop one step, a tap on the line hops there, and it can start again", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await toPlayground(page);
  const hl = page.locator("#lesson-player .hl");
  const stage = hl.locator(".hl-stage");
  await stage.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => value(page)).toBe("1");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => value(page)).toBe("0");
  // tapping the line: halfway between 0 and 10 is 5, the labels are in the picture so the tap is turned into a number
  const box = await stage.boundingBox();
  const px = (v) => box.x + ((36 + ((v + 10) / 20) * (640 - 72)) / 640) * box.width;
  await page.mouse.click(px(7), box.y + box.height * 0.5);
  await expect.poll(() => value(page)).toBe("7");
  // the right end: 7 + 5 would be 12, and the line stops at 10
  await hl.getByRole("button", { name: /Hoppa 5 steg åt höger/ }).click();
  await expect.poll(() => value(page)).toBe("10");
  await expect(hl.locator(".hl-history li").last()).toHaveText("7 + 3 = 10");
  await hl.getByRole("button", { name: /Hoppa 5 steg åt höger/ }).click();
  await expect(hl.locator(".hl-say")).toContainText("tallinjen slutar vid 10");
  expect(await value(page)).toBe("10");
  await hl.getByRole("button", { name: /Börja om/ }).click();
  expect(await value(page)).toBe("0");
  await expect(hl.locator(".hl-history li")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("negativa-tal: with reduced motion the pet just stands where it lands", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page);
  await toPlayground(page);
  const hl = page.locator("#lesson-player .hl");
  await hl.getByRole("button", { name: /Hoppa 5 steg åt vänster/ }).click();
  expect(await value(page)).toBe("-5");
  await expect(hl.locator(".hl-hop").first()).toBeEnabled();
});
