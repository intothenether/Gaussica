const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { signIn } = require("./helpers");

// The explanation of a lesson that is new to the student cannot be gone past in a moment (lesson-player.js): the button waits a few seconds, the last
// page has a short question (lesson.check) if the lesson has one, and a wrong answer after a quick pass points back to the explanation.
// The pacing is for people. A robot that tests the page is not slowed (navigator.webdriver), so these tests say that they are not one.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => false }); });
});

const foot = (page) => page.locator("#lesson-player .pl-foot");
const next = (page) => foot(page).getByRole("button", { name: /Fortsätt|Börja med/ });
const eyebrow = (page) => page.locator("#lesson-player .pl-eyebrow");

async function start(page, id, settings) {
  if (settings) await page.addInitScript((s) => { try { localStorage.setItem("gaussica-reading", JSON.stringify(s)); } catch (e) { /* no storage */ } }, settings);
  await signIn(page, { keepTips: true });
  await page.evaluate((lesson) => { location.hash = "#start"; setTimeout(() => { location.hash = "#play/" + lesson; }, 150); }, id);
  await expect(foot(page)).toBeVisible();
}

test("the button after the explanation waits while it is read, and the bar cannot jump past it", async ({ page }) => {
  await start(page, "stora-tal");
  await expect(eyebrow(page)).toHaveText("LÄR DIG");
  await expect(next(page)).toHaveAttribute("aria-disabled", "true");
  // a click on it does nothing, and neither does the last step in the bar
  await next(page).click({ force: true });
  await page.locator("#lesson-player .pl-seg").last().click({ force: true });
  await expect(eyebrow(page)).toHaveText("LÄR DIG");
  // the first page of the explanation is back at once
  await expect(next(page)).not.toHaveAttribute("aria-disabled", "true", { timeout: 9000 });
  await next(page).click();
  await expect(page.locator("#lesson-player .pl-card")).toBeVisible();
});

test("Läsning has the setting for the wait, and with it off the button is free at once", async ({ page }) => {
  await start(page, "stora-tal", { wait: false });
  await expect(eyebrow(page)).toHaveText("LÄR DIG");
  await expect(next(page)).not.toHaveAttribute("aria-disabled", "true");
  await page.evaluate(() => { location.hash = "#start"; });
  await expect(page.locator("#lesson-player")).toBeHidden();
  await page.locator("#reading-link").click();
  const box = page.getByLabel(/Vänta en liten stund/);
  await expect(box).not.toBeChecked();
  await box.check();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gaussica-reading")).wait)).toBe(true);
});

const LESSON = "addition-uppstallning";   // has a check
const checkOf = () => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "lessons", LESSON + ".json"), "utf8")).check;

async function toCheck(page) {
  await start(page, LESSON, { wait: false });
  for (let i = 0; i < 10 && !(await page.locator("#lesson-player .pl-intro-check").count()); i++) await next(page).click();
  await expect(page.locator("#lesson-player .pl-intro-check")).toBeVisible();
}

test("the last page of the explanation has a short question, and the button waits for it", async ({ page }) => {
  await toCheck(page);
  await expect(next(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#lesson-player .pl-intro-check .eyebrow")).toHaveText("KOLLA ATT DU HÄNGER MED");
  await page.locator("#lesson-player .pl-seg").last().click({ force: true });
  await expect(page.locator("#lesson-player .pl-intro-check")).toBeVisible();   // still here
  // the right answers
  const statements = checkOf().statements;
  const rows = page.locator("#lesson-player .pl-intro-check .tf-row");
  for (let i = 0; i < await rows.count(); i++) {
    const text = (await rows.nth(i).locator(".tf-body").innerText()).trim();
    const s = statements.find((x) => x.text === text);
    await rows.nth(i).locator(s.answer ? ".tf-yes" : ".tf-no-btn").click();
  }
  await page.locator("#lesson-player .pl-intro-check .tf-check").click();
  await expect(next(page)).not.toHaveAttribute("aria-disabled", "true");
  await next(page).click();
  await expect(page.locator("#lesson-player input[name=answer]")).toBeVisible();
});

test("two tries open the button whatever the answers are, so nobody is stuck", async ({ page }) => {
  await toCheck(page);
  const rows = page.locator("#lesson-player .pl-intro-check .tf-row");
  for (let i = 0; i < await rows.count(); i++) await rows.nth(i).locator(".tf-yes").click();   // all true: one of them is wrong
  await page.locator("#lesson-player .pl-intro-check .tf-check").click();
  await expect(page.locator("#lesson-player .pl-intro-check .feedback-hint")).toBeVisible();
  await expect(next(page)).toHaveAttribute("aria-disabled", "true");   // one try is not enough
  await page.locator("#lesson-player .pl-intro-check .tf-check").click();   // the same answers again
  await expect(next(page)).not.toHaveAttribute("aria-disabled", "true");
});

test("a wrong answer after a quick pass points back to the explanation, and not after it has been read", async ({ page }) => {
  await start(page, "stora-tal", { wait: false });
  for (let i = 0; i < 10 && !(await page.locator("#lesson-player input[name=answer]").count()); i++) await next(page).click();
  const field = page.locator("#lesson-player input[name=answer]");
  await field.fill("1");
  await field.press("Enter");
  const box = page.locator("#lesson-player .tip-box");
  await expect(box).toContainText("Du gick snabbt förbi genomgången");
  await box.getByRole("button", { name: /Läs genomgången/ }).click();
  await expect(box).toHaveCount(0);
  await expect(page.locator("#lesson-player .rules-overlay details.rules-more")).toHaveAttribute("open", "");
  await page.locator("#lesson-player .rules-done").click();
  // it has been read now
  await field.fill("2");
  await field.press("Enter");
  await expect(box).toBeVisible();
  await expect(box).not.toContainText("Du gick snabbt förbi");
});

test("a lesson that has been started before is not slowed", async ({ page }) => {
  await start(page, "stora-tal", { wait: false });
  for (let i = 0; i < 10 && !(await page.locator("#lesson-player input[name=answer]").count()); i++) await next(page).click();
  const field = page.locator("#lesson-player input[name=answer]");
  await field.fill("1");
  await field.press("Enter");
  await page.locator("#lesson-player .tip-again").click();
  // back to the lesson from its first page, with the wait on
  await page.addInitScript(() => { try { localStorage.setItem("gaussica-reading", JSON.stringify({ wait: true })); } catch (e) { /* no storage */ } });
  await page.evaluate(() => { localStorage.setItem("gaussica-reading", JSON.stringify({ wait: true })); location.hash = "#start"; setTimeout(() => { location.hash = "#play/stora-tal"; }, 150); });
  await page.locator("#lesson-player .pl-seg").first().click();
  await expect(eyebrow(page)).toHaveText("LÄR DIG");
  await expect(next(page)).not.toHaveAttribute("aria-disabled", "true");
});
