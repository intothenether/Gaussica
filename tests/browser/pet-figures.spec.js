const { test, expect } = require("@playwright/test");
const { signIn, openLesson, watchErrors } = require("./helpers");

// The pet in the figures of the lessons: it walks along the arrows of the number lines, up and down the ladder, over the map and along the path in the
// coordinate system; the digits that slide, the price that is shared out, the worked examples of mental arithmetic and the playground with its own missions.
const WALKERS = [
  ["tallinjen", ".fig-pet"],
  ["pengar-vaxel", ".fig-pet"],
  ["talfoljder", ".fig-pet"],
  ["upp-och-ner", ".fig-pet"],
  ["var-ar-det", ".fig-pet"],
  ["koordinatsystem", ".fig-pet"],
  ["tid-klocka", ".fig-pet"],
  ["tidsintervall", ".fig-pet"],
  ["brak-tallinje", ".fig-pet"]
];

for (const [id, selector] of WALKERS) {
  test("the pet moves in the figure of " + id, async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await openLesson(page, id, selector);
    // the figure plays when it is on the screen: then the pet gets a walk, from where it starts to where it ends
    await page.evaluate(() => document.querySelector("#lesson-player .fig-pet").scrollIntoView({ block: "center" }));
    await page.waitForFunction(() => document.querySelector("#lesson-player .fig-pet")._walk, null, { timeout: 30000 });
    const travelled = await page.evaluate(async () => {
      const walk = document.querySelector("#lesson-player .fig-pet")._walk;
      const frames = walk.effect.getKeyframes();
      const at = (k) => new DOMMatrix(frames[k].transform);
      const a = at(0), z = at(frames.length - 1);
      await walk.finished;
      return Math.max(Math.abs(z.m41 - a.m41), Math.abs(z.m42 - a.m42));
    });
    expect(travelled).toBeGreaterThan(30);
    expect(errors).toEqual([]);
  });
}

test("multiplikation-10-100-1000: the digits of 34 slide, and the zeros come", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await openLesson(page, "multiplikation-10-100-1000", ".fx-digitbox");
  const figure = page.locator("#lesson-player .figure-wrap", { has: page.locator(".fx-digitbox") }).first();
  await expect(figure.locator(".fx-shift")).toHaveCount(2);
  await expect(figure.locator(".fx-digitbox.is-zero")).toHaveCount(1);
  await expect(figure.locator("svg.fig-svg")).toContainText("34 · 10 = 340");
  await expect(figure.locator("svg.fig-svg")).toContainText("ental");
  expect(errors).toEqual([]);
});

test("division-med-10-100-1000: two zeros go when 45000 is divided by 100", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "division-med-10-100-1000", ".fx-digitbox");
  const figure = page.locator("#lesson-player .figure-wrap", { has: page.locator(".fx-digitbox") }).first();
  await expect(figure.locator(".fx-shift")).toHaveCount(3);
  await expect(figure.locator(".fx-leave")).toHaveCount(2);
  await expect(figure.locator("svg.fig-svg")).toContainText("= 450");
});

test("pris-per-enhet: the price of four kilos is shared into four prices of one", async ({ page }) => {
  await signIn(page);
  await openLesson(page, "pris-per-enhet", ".fx-pricebar");
  const figure = page.locator("#lesson-player .figure-wrap", { has: page.locator(".fx-pricebar") }).first();
  await expect(figure.locator(".fx-pricetag")).toHaveCount(4);
  await expect(figure.locator("svg.fig-svg")).toContainText("48/4 = 12 kr för en");
});

test("huvudrakning: a trick is shown one step at a time, and what to do next is chosen first", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await openLesson(page, "huvudrakning", ".wx");
  const wx = page.locator("#lesson-player .wx").first();
  await expect(wx).toContainText("49 + 36");
  await wx.getByRole("button", { name: "Visa första steget" }).click();
  await expect(wx.locator(".wx-choice")).toHaveCount(3);
  await wx.getByRole("button", { name: "Runda 49 uppåt till 50 och lägg till 1 i slutet." }).click();
  await expect(wx.locator(".wx-ask-note")).toContainText("Inte riktigt");
  await wx.getByRole("button", { name: "Runda 49 uppåt till 50 och ta bort 1 i slutet." }).click();
  await expect(wx.locator(".wx-line:visible")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("negativa-tal-rakna: the playground has missions about adding and subtracting negative numbers", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await openLesson(page, "negativa-tal-rakna", ".hl");
  const hl = page.locator("#lesson-player .hl");
  await expect(hl.locator(".hl-mission-text")).toContainText("Räkna ut 2 + (−5)");
  expect(await hl.getAttribute("data-value")).toBe("2");
  await hl.getByRole("button", { name: /Hoppa 5 steg åt vänster/ }).click();
  await expect.poll(() => hl.getAttribute("data-value")).toBe("-3");
  await expect(hl.locator(".hl-say")).toContainText("2 + (−5) = −3");
  await hl.getByRole("button", { name: "Nästa uppdrag" }).click();
  expect(await hl.getAttribute("data-value")).toBe("4");
  expect(errors).toEqual([]);
});
