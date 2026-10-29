"use strict";
// Shared steps for the browser tests.
const { expect } = require("@playwright/test");

// Opens the site as a student with a pet: a teacher account is made in the demo mode (it lives only in this browser) and the site is
// shown as a student sees it. The code is the demo code of local-backend.js.
async function signIn(page, opts) {
  opts = Object.assign({ pet: "Kanin", petName: "Pixel" }, opts || {});
  // the notice about cookies is a banner over the page: it is already answered, as for a student who has seen it
  await page.addInitScript(() => { try { localStorage.setItem("gaussica.cookies-ok", "1"); } catch (e) { /* no storage */ } });
  await page.goto("/index.html#start");
  await page.getByRole("tab", { name: "Skapa konto" }).click();
  await page.getByRole("button", { name: "Jag är lärare" }).click();
  await page.locator('input[name="displayName"]').fill("Test Lärare");
  await page.locator('input[name="username"]').fill("testlarare");
  await page.locator('input[name="password"]').fill("test-losenord-123");
  await page.locator('input[name="code"]').fill("GAUSSICA");
  await page.locator('button[type="submit"]:visible').click();
  await page.getByRole("button", { name: /Visa som elev/ }).first().click();
  if (opts.pet) {
    await page.locator(".hp-choose").click();
    await page.locator("#pet-overlay button").filter({ hasText: new RegExp("^" + opts.pet + "$") }).click();
    await page.locator("#pet-overlay input").fill(opts.petName);
    await page.locator("#pet-overlay").getByRole("button", { name: /Välj mig/ }).click();
    // the room of the new pet opens: it is closed, as a student does
    await page.locator("#pet-overlay .pet-close").click();
    await expect(page.locator("#pet-overlay")).toHaveCount(0);
    await expect(page.locator(".hp-stage")).toBeVisible();
  }
}

// Opens a lesson in the player and goes forward until `selector` is on the screen (a question of a kind, say).
async function openLesson(page, id, selector) {
  await page.evaluate((lesson) => { location.hash = "#start"; setTimeout(() => { location.hash = "#play/" + lesson; }, 150); }, id);
  await expect(page.locator("#lesson-player .pl-foot")).toBeVisible();
  for (let i = 0; i < 20; i++) {
    if (selector && await page.locator("#lesson-player " + selector).count()) return;
    const next = page.locator("#lesson-player .pl-foot").getByRole("button", { name: /Fortsätt|Börja med|Hoppa över/ }).first();
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
  }
  if (selector) await expect(page.locator("#lesson-player " + selector).first()).toBeVisible();
}

// Opens Verkstad (it is under "Mer att utforska" on the start page).
async function openWorkshop(page) {
  const more = page.locator("#more-cards");
  if (!(await more.evaluate((d) => d.open))) await more.locator("summary").click();
  await page.getByRole("button", { name: /Öppna verkstaden/ }).click();
}

// Errors on the page (not network errors for files that a plain static server does not have): the tests fail on these.
function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ServiceWorker|status of 404/.test(m.text())) errors.push(m.text()); });
  return errors;
}

module.exports = { signIn, openLesson, openWorkshop, watchErrors };
