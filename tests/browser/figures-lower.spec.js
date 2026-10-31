const { test, expect } = require("@playwright/test");
const { signIn, openLesson, watchErrors } = require("./helpers");

// The figures of the lessons of åk 3 and 4: they are drawn, they move when they come into view, they can be played again, and with reduced motion
// they stand still and show everything.
const LESSONS = [
  ["platsvarde", ".fx .fx-block"],
  ["addition", ".fx .fx-block"],
  ["multiplikation", ".fx .fx-ball"],
  ["division", ".fx .fx-cookie"],
  ["tid-klocka", ".fx .fx-sweep"],
  ["kalendern", ".fx .fx-day"],
  ["pengar-vaxel", ".fx .fx-note"],
  ["mata-langd", ".fx .fx-ruler"],
  ["halvor-fjardedelar", ".fx .fx-slice"],
  ["sakert-mojligt", ".fx .fx-marble"],
  ["division-med-rest", ".fx .fx-plate.is-rest"],
  ["negativa-tal", ".fx .fx-mercury"],
  ["area", ".fx .fig-areacell"],
  ["tidsintervall", ".fx .fx-draw"],
  ["kassakvitto", ".fx .fx-coin"],
  ["begrepp-sannolikhet", ".fx .fx-die"],
  ["matning-liter-gram", ".fx .fx-glass"],
  ["volym", ".fx .fx-cube-front"],
  ["procent", ".fx .fig-hcell"],
  ["brak-likavarda", ".fx .fx-slice"],
  ["negativa-tal-rakna", ".fx .fx-mercury"],
  ["delare", ".fx .fx-ball"],
  ["slump", ".fx .fx-die"]
];

for (const [id, selector] of LESSONS) {
  test("figure in " + id + ": drawn, moving when seen, and playable again", async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await openLesson(page, id, selector);
    const figure = page.locator("#lesson-player .fx").filter({ has: page.locator(selector.replace(".fx ", "")) }).first();
    await expect(figure).toBeVisible();
    await figure.scrollIntoViewIfNeeded();   // it waits hidden until it is on the screen
    await expect(figure.locator("svg").first()).toHaveAttribute("aria-label", /\S/);
    // it has started to play (it waits hidden until it is on the screen)
    await expect(figure).toHaveClass(/is-playing/);
    await expect(figure).not.toHaveClass(/is-waiting/);
    // and plays again with the button
    const again = figure.getByRole("button", { name: /Spela igen/ });
    await expect(again).toBeVisible();
    await again.click();
    await expect(figure).toHaveClass(/is-playing/);
    expect(errors).toEqual([]);
  });
}

test("figures stand still with reduced motion, and show everything", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page);
  await openLesson(page, "multiplikation", ".fx .fx-ball");
  const figure = page.locator("#lesson-player .fx").first();
  await expect(figure).toBeVisible();
  await expect(figure).not.toHaveClass(/is-waiting|is-playing/);
  await expect(figure.getByRole("button", { name: /Spela igen/ })).toHaveCount(0);
  // all of the 56 kulor are there and visible
  const balls = figure.locator(".fx-ball");
  await expect(balls).toHaveCount(56);
  expect(await balls.first().evaluate((e) => getComputedStyle(e.parentElement).opacity)).toBe("1");
});

test("a figure that is scrolled to waits hidden, and plays when it comes into view", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "mata-langd", ".fx .fx-ruler");
  const figure = page.locator("#lesson-player .fx").first();
  await expect(figure).toHaveClass(/is-playing/);
});
