const { test, expect } = require("@playwright/test");
const { signIn, openLesson, watchErrors } = require("./helpers");

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

test("the shop is one place: no separate tab for themes, and the locked pieces sit among the others", async ({ page }) => {
  await signIn(page);
  await page.locator(".hp-shop").click();
  const tabs = page.locator("#pet-overlay .pet-tab");
  await expect(tabs).toHaveText(["Hattar", "Ansikte", "Halsband", "Rum", "Mat och lek", "Tricks", "Hjälp djuret", "Mitt djur"]);

  // hats: ordinary ones first, then a piece of a theme (locked by lessons), then the ones a badge opens (locked by badges)
  const names = await page.locator("#pet-overlay .pet-item .pet-item-name").allTextContents();
  expect(names.indexOf("Liten planta")).toBeGreaterThan(names.indexOf("Räknehatt"));
  const theme = page.locator("#pet-overlay .pet-item", { hasText: "Räknehatt" });
  await expect(theme).toHaveClass(/is-locked/);
  await expect(theme.locator(".pet-item-tag")).toHaveText(/Siffervännen/);
  await expect(theme.locator(".pet-item-price")).toContainText("🔒");
  const badge = page.locator("#pet-overlay .pet-item", { hasText: "Liten planta" });
  await expect(badge).toHaveClass(/is-locked/);
  await expect(badge.locator(".pet-item-tag")).toHaveText(/Märke/);

  // a locked piece says what opens it, and cannot be bought
  await badge.click();
  await expect(page.locator("#pet-overlay .pet-action .pet-short")).toContainText(/🔒.*märket/);
  await expect(page.locator("#pet-overlay .pet-action").getByRole("button", { name: /Köp/ })).toHaveCount(0);
  await theme.click();
  await expect(page.locator("#pet-overlay .pet-action .pet-short")).toContainText(/🔒.*lektion/);

  // every part of the shop has some of them, and an ordinary piece is not locked
  for (const tab of ["Ansikte", "Halsband", "Rum"]) {
    await tabs.filter({ hasText: new RegExp("^" + tab + "$") }).click();
    expect(await page.locator("#pet-overlay .pet-item.is-locked").count()).toBeGreaterThan(1);
    expect(await page.locator("#pet-overlay .pet-item:not(.is-locked)").count()).toBeGreaterThan(2);
  }

  // what opens them is told in one place
  const info = page.locator("#pet-overlay .pet-unlock-info");
  await info.locator("summary").click();
  await expect(info).toContainText("Siffervännen");
  await expect(info).toContainText("Regnbågen");
  await expect(info).toContainText(/märkena/);
});

test("the backgrounds are wallpapers: no tab for them, and a pet that owned one has the wallpaper", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  // the room has the wallpapers, with the old backgrounds among them and the ones a badge unlocks locked
  await page.locator(".hp-shop").click();
  await page.locator("#pet-overlay .pet-tab").filter({ hasText: /^Rum$/ }).click();
  const walls = page.locator("#pet-overlay .pet-set", { has: page.locator("h4", { hasText: /^Vägg$/ }) });
  await expect(walls.locator(".pet-item")).toHaveCount(22);
  for (const name of ["Äng", "Regnbåge", "Klassrummet", "Stjärnvägg", "Havsvägg"]) await expect(walls.locator(".pet-item", { hasText: name }).first()).toBeVisible();
  await expect(walls.locator(".pet-item", { hasText: "Träningshallen" })).toHaveClass(/is-locked/);
  // a wallpaper that is tried on is shown behind the pet at once
  await walls.locator(".pet-item", { hasText: "Skogen" }).click();
  await expect(page.locator("#pet-overlay .pet-stage svg.pet-room-svg")).toBeVisible();
  await page.locator("#pet-overlay .pet-close").click();

  // an old record, with a background that was bought and put on, is moved when the page is opened: the same coins, and the wallpaper is on the wall
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("gaussica.local.v1"));
    const id = db.users.find((u) => u.username === "testlarare").id;
    const pet = db.progress[id].pet;
    pet.owned = { "hatt-keps": 15, "bg-gras": 25, "bg-natt": 35 };
    pet.bg = "bg-natt";
    delete pet.scene;
    delete pet.room;
    localStorage.setItem("gaussica.local.v1", JSON.stringify(db));
  });
  await page.reload();
  await expect.poll(async () => page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("gaussica.local.v1"));
    const id = db.users.find((u) => u.username === "testlarare").id;
    const pet = db.progress[id].pet;
    return JSON.stringify({ owned: pet.owned, wall: pet.room && pet.room.wall, bg: pet.bg === undefined ? "none" : pet.bg, scene: pet.scene });
  }), { timeout: 15000 }).toBe(JSON.stringify({ owned: { "hatt-keps": 15, "rum-vagg-gras": 25, "rum-vagg-stjarnor": 35 }, wall: "rum-vagg-stjarnor", bg: "none", scene: "room" }));
  expect(errors).toEqual([]);
});
