"use strict";
// Shared steps for the browser tests.
const fs = require("fs");
const path = require("path");
const { expect } = require("@playwright/test");

// The signed-in state that almost every test starts from (a teacher account, shown as a student, with the pet Kanin called Pixel, or with no pet) is made once,
// through the real sign-up, by global-setup.js and kept in .seed.json. A test then starts from that state at once instead of clicking through the sign-up and the
// choice of a pet, which was the biggest part of the time of the whole suite. A test that wants something else (another pet, or { ui: true }) clicks through it.
const SEED_FILE = path.join(__dirname, ".seed.json");
const SEED_KEY = "gaussica.local.v1";
function readSeed() { try { return JSON.parse(fs.readFileSync(SEED_FILE, "utf8")); } catch (e) { return null; } }

// Opens the site as a student with a pet: a teacher account is made in the demo mode (it lives only in this browser) and the site is
// shown as a student sees it. The code is the demo code of local-backend.js.
async function signIn(page, opts) {
  opts = Object.assign({ pet: "Kanin", petName: "Pixel" }, opts || {});
  const kind = opts.ui || process.env.PW_SIGNIN_UI === "1" ? null : opts.pet === null ? "nopet" : (opts.pet === "Kanin" && opts.petName === "Pixel" ? "pet" : null);
  const seed = kind && readSeed();
  if (seed && seed[kind]) return signInFromSeed(page, opts, seed[kind]);
  return signInViaUi(page, opts);
}

// the state of a signed-in teacher is put in the browser before the page starts (only into a browser that has nothing yet, so a reload keeps what the test did)
async function signInFromSeed(page, opts, state) {
  await page.addInitScript(() => { try { localStorage.setItem("gaussica.cookies-ok", "1"); } catch (e) { /* no storage */ } });
  if (!opts.keepTips) await page.addLocatorHandler(page.locator(".tip-overlay"), async (box) => { await box.locator(".tip-again").press("Enter"); });
  await page.addInitScript((s) => {
    try {
      if (localStorage.getItem(s.key)) return;
      Object.keys(s.local).forEach((k) => localStorage.setItem(k, s.local[k]));
      Object.keys(s.session).forEach((k) => sessionStorage.setItem(k, s.session[k]));
    } catch (e) { /* no storage */ }
  }, { key: SEED_KEY, local: state.local, session: state.session });
  await page.goto("/index.html#start");
  await expect(page.locator(".hp-stage, .hp-choose").first()).toBeVisible({ timeout: 25000 });   // the first load fetches 170 lesson files: slow when several tests start at once
  // the page is ready when the lessons are loaded and the top bar is shown: only then are the buttons bound (clicking through the sign-up took so long that this was always so)
  await page.waitForFunction(() => Boolean(window.course && window.course.lessons && window.course.lessons.length) && Boolean((document.querySelector("#reading-link") || {}).offsetParent));
  // and it has stopped drawing: a part of the page that is drawn a moment late would take the focus of a test that has just set it (at most three seconds)
  await page.evaluate(() => new Promise((resolve) => {
    let quiet = setTimeout(resolve, 400);
    const cap = setTimeout(resolve, 3000);
    new MutationObserver(() => { clearTimeout(quiet); quiet = setTimeout(() => { clearTimeout(cap); resolve(); }, 400); }).observe(document.body, { subtree: true, childList: true });
  }));
}

async function signInViaUi(page, opts) {
  opts = Object.assign({ pet: "Kanin", petName: "Pixel" }, opts || {});
  // the notice about cookies is a banner over the page: it is already answered, as for a student who has seen it
  await page.addInitScript(() => { try { localStorage.setItem("gaussica.cookies-ok", "1"); } catch (e) { /* no storage */ } });
  // the tip after a wrong answer is a box in the middle of the screen that stays until its button is pressed: the tests close it when it is in the
  // way of what they do next, with the keyboard so that the mouse does not move (the ones about the box itself, tests/browser/tip.spec.js, keep it with keepTips)
  if (!opts.keepTips) await page.addLocatorHandler(page.locator(".tip-overlay"), async (box) => { await box.locator(".tip-again").press("Enter"); });
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

module.exports = { signIn, signInViaUi, readSeed, SEED_FILE, openLesson, openWorkshop, watchErrors };
