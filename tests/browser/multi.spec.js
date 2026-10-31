const { test, expect } = require("@playwright/test");
const { watchErrors } = require("./helpers");

// Several adults per child and a child in more than one class: a school class and a family, two parents. The accounts live only in this browser
// (the demo mode), so people sign out and in again in the same browser.
async function start(page) {
  await page.addInitScript(() => { try { localStorage.setItem("gaussica.cookies-ok", "1"); } catch (e) { /* no storage */ } });
  await page.goto("/index.html#start");
}

async function register(page, role, username, name, extra) {
  await page.getByRole("tab", { name: "Skapa konto" }).click();
  await page.getByRole("button", { name: role }).click();
  await page.locator('input[name="displayName"]').fill(name);
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill("hemligt-losen-1");
  if (extra && extra.code) await page.locator('input[name="code"]').fill(extra.code);
  if (extra && extra.guideCode) await page.locator('input[name="guideCode"]').fill(extra.guideCode);
  await page.locator('button[type="submit"]:visible').click();
}

async function signOut(page) {
  await page.evaluate(() => window.GaussicaAuth.logout());
  await expect(page.getByRole("tab", { name: "Logga in" })).toBeVisible();
}

async function signIn(page, username) {
  await page.getByRole("tab", { name: "Logga in" }).click();
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill("hemligt-losen-1");
  await page.locator('button[type="submit"]:visible').click();
}

const api = (page, method, path, body) => page.evaluate(([m, p, b]) => window.GaussicaAPI[m](p, b), [method, path, body]);

test("a child in a school class and a family, and two parents in the family", async ({ page }) => {
  test.setTimeout(120000);
  const errors = watchErrors(page);
  await start(page);

  // a teacher with a class
  await register(page, "Jag är lärare", "multi.l", "Fröken Multi", { code: "GAUSSICA" });
  await expect(page.locator("#admin-top-link")).toBeVisible();
  const school = (await api(page, "post", "/api/teacher/classes", { name: "4B" }))["class"];
  await signOut(page);

  // a caregiver with a family
  await register(page, "Jag är vårdnadshavare", "multi.v", "Maria Multi");
  await expect(page.locator("#admin-top-link")).toBeVisible();
  const family = (await api(page, "get", "/api/teacher/classes")).classes[0];
  expect(family.guideCode).toBeTruthy();
  await signOut(page);

  // a child joins the school class, and then the family from the account
  await register(page, "Jag är elev", "multi.e", "Lo Multi", { code: school.code });
  await expect(page.locator(".student-profile-btn")).toContainText("4B");
  await page.locator(".student-profile-btn").click();
  const classes = page.locator(".account-classes");
  await expect(classes).toContainText("4B");
  await classes.locator('input').fill(family.code);
  await classes.getByRole("button", { name: "Gå med" }).click();
  await expect(page.locator(".student-profile-btn")).toContainText("Familjen Multi");
  await expect(page.locator(".student-profile-btn")).toContainText("4B");
  // the account lists both, and a class can be left
  await page.locator(".student-profile-btn").click();
  await expect(page.locator(".account-class-list li")).toHaveCount(2);

  // asking: the child chooses who
  await page.keyboard.press("Escape");
  await expect(page.locator("#chat-link")).toBeVisible();
  await page.locator("#chat-link").click();
  const to = page.locator(".chat-to select");
  await expect(to).toBeVisible();
  await expect(to.locator("option")).toHaveCount(2);
  await to.selectOption({ label: "Familjen Multi" });
  await page.locator(".chat-input").fill("Hjälp med bråk");
  await page.locator(".chat-send").click();
  await expect(page.locator(".chat-bubble").last()).toContainText("Hjälp med bråk");
  await expect(page.locator(".chat-bubble").last()).toContainText("Till Familjen Multi");
  await signOut(page);

  // the second parent signs up with the code for adults, and shares the family
  await register(page, "Jag är vårdnadshavare", "multi.v2", "Per Multi", { guideCode: family.guideCode });
  await expect(page.locator("#admin-top-link")).toBeVisible();
  await page.locator("#admin-top-link").click();
  await expect(page.locator(".tv-family-card")).toHaveCount(1);
  await expect(page.locator(".tv-guide-list li")).toHaveCount(2);
  await expect(page.locator(".tv-guide-list")).toContainText("Maria Multi");
  await expect(page.locator(".tv-guide-list")).toContainText("Per Multi (du)");
  await expect(page.locator(".tv-guide-code")).toHaveCount(0);   // only the one who made the family has the code for adults
  // the question of the child is here, and the school class is not
  await expect(page.locator(".tv-thread-card")).toHaveCount(1);
  await expect(page.locator(".tv-week .tv-child")).toHaveCount(1);
  await expect(page.locator(".tv-week .tv-child")).toContainText("Lo Multi");
  expect(errors).toEqual([]);
});
