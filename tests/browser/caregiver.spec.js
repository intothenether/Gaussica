const { test, expect } = require("@playwright/test");
const { watchErrors } = require("./helpers");

// A caregiver (vårdnadshavare): an account without any code, a family instead of a class, the week of each child, and the words
// barn and vårdnadshavare instead of elev and lärare. The accounts live only in this browser (the demo mode).

// the lines of the page that still say elev, klass or lärare
function schoolWords(text) {
  const school = /(^|[^\p{L}])(elev|elever|eleverna|eleven|klass|klassen|klasser|lärare|läraren)([^\p{L}]|$)/iu;
  return text.split("\n").filter((line) => school.test(line));
}

async function start(page) {
  await page.addInitScript(() => { try { localStorage.setItem("gaussica.cookies-ok", "1"); } catch (e) { /* no storage */ } });
  await page.goto("/index.html#start");
}

async function registerCaregiver(page) {
  await page.getByRole("tab", { name: "Skapa konto" }).click();
  await page.getByRole("button", { name: "Jag är vårdnadshavare" }).click();
  await expect(page.locator('input[name="code"]')).toHaveCount(0);
  await page.locator('input[name="displayName"]').fill("Maria Andersson");
  await page.locator('input[name="username"]').fill("maria.a");
  await page.locator('input[name="password"]').fill("hemligt-losen-1");
  await page.locator('button[type="submit"]:visible').click();
  await expect(page.locator("#admin-top-link")).toBeVisible();
}

async function signInAs(page, username, password) {
  await page.getByRole("tab", { name: "Logga in" }).click();
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]:visible').click();
}

async function signOut(page) {
  await page.evaluate(() => window.GaussicaAuth.logout());
  await expect(page.getByRole("tab", { name: "Logga in" })).toBeVisible();
}

test("caregiver: signs up without a code, and has a family with a code", async ({ page }) => {
  const errors = watchErrors(page);
  await start(page);
  await registerCaregiver(page);
  // no teacher tools: a caregiver does not edit lessons
  await expect(page.locator("#btn-new-lesson")).toHaveCount(0);
  await expect(page.locator("#admin-top-link")).toContainText("Mina barn");
  await page.locator("#admin-top-link").click();
  await expect(page.locator("#admin-title")).toHaveText("Mina barn");
  await expect(page.locator(".admin-badge")).toHaveText("VÅRDNADSHAVARE");
  await expect(page.locator(".tv-family")).toContainText("Familjen Andersson");
  await expect(page.locator(".tv-family .tv-code")).toHaveText(/^[A-Z0-9]{6}$/);
  await expect(page.locator(".tv-family")).toContainText("0 barn av 10");
  // the words of a family on the whole page, and nothing about classes or students
  const text = await page.locator("#admin-page").innerText();
  expect(schoolWords(text)).toEqual([]);
  expect(await page.locator("#admin-page .tv-class-form").count()).toBe(0);
  expect(errors).toEqual([]);
});

test("caregiver: adds a child, who signs in and sees vårdnadshavare, and the week of the child shows what needs help", async ({ page }) => {
  const errors = watchErrors(page);
  await start(page);
  await registerCaregiver(page);
  await page.locator("#admin-top-link").click();

  await page.locator('input[name="childName"]').fill("Lo Andersson");
  await page.locator('input[name="childUser"]').fill("lo.a");
  await page.locator('input[name="childPass"]').fill("barnets-losen-1");
  await page.getByRole("button", { name: "+ Skapa barnets konto" }).click();
  await expect(page.locator(".tv-notice")).toContainText("Kontot för Lo Andersson skapades");
  await expect(page.locator(".tv-family")).toContainText("1 barn av 10");
  await expect(page.locator(".tv-week .tv-child")).toHaveCount(1);
  await expect(page.locator(".tv-week")).toContainText("Inget har gjorts de senaste sju dagarna");

  // the child signs in: the one to ask is a vårdnadshavare, and a wrong answer is sent
  await signOut(page);
  await signInAs(page, "lo.a", "barnets-losen-1");
  await expect(page.locator(".student-profile-btn")).toContainText("Familjen Andersson");
  await expect(page.locator("#chat-link")).toContainText("vårdnadshavaren");
  await expect(page.locator("#chat-link")).not.toContainText("läraren");
  const lessonId = await page.evaluate(() => window.course.lessons.find((l) => !l.isParentLesson).id);
  await page.evaluate((id) => window.GaussicaAPI.post("/api/attempts", {
    lessonId: id, lessonTitle: "Lektionen", taskId: "exercise", taskName: "Din tur", prompt: "Vad är 3 + 4?", answer: "8", correctAnswer: "7",
    feedbackType: "hint", feedback: "Nästan", seconds: 40
  }), lessonId);
  await page.evaluate((id) => window.GaussicaAPI.post("/api/attempts", {
    lessonId: id, lessonTitle: "Lektionen", taskId: "exercise", taskName: "Din tur", prompt: "Vad är 3 + 4?", answer: "8", correctAnswer: "7",
    feedbackType: "hint", feedback: "Nästan", seconds: 30
  }), lessonId);
  await signOut(page);

  // the caregiver sees the week
  await signInAs(page, "maria.a", "hemligt-losen-1");
  await page.locator("#admin-top-link").click();
  const week = page.locator(".tv-week .tv-child").first();
  await expect(week).toContainText("Lo Andersson");
  await expect(week).toContainText("Senast aktiv: idag");
  await expect(week).toContainText("dag med övning");
  await expect(week.locator(".tv-help")).toContainText("Att prata om");
  await expect(week.locator(".tv-help")).toContainText("Svarade: 8");
  await expect(week.locator(".tv-help")).toContainText("Rätt svar (för vuxna):");

  // a cheer
  await week.getByRole("button", { name: "⭐ Heja på" }).click();
  await expect(page.locator(".tv-notice")).toContainText("Hejaropet skickades till Lo Andersson");

  // the words are the ones of a family on the whole page
  const text = await page.locator("#admin-page").innerText();
  expect(schoolWords(text)).toEqual([]);
  expect(await page.locator("#admin-page").getByRole("button", { name: /Ta bort barn/ }).count()).toBe(1);
  expect(errors).toEqual([]);
});

test("caregiver: a teacher account is still made with the code, and a caregiver cannot be a teacher by asking", async ({ page }) => {
  await start(page);
  await page.getByRole("tab", { name: "Skapa konto" }).click();
  await page.getByRole("button", { name: "Jag är lärare" }).click();
  await expect(page.locator('input[name="code"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Jag är elev" }).click();
  await expect(page.locator('label[for="auth-code"]')).toContainText("Kod");
});

test("caregiver: the family page and the sign-up have no accessibility violations", async ({ page }) => {
  const AxeBuilder = require("@axe-core/playwright").default;
  const scan = async () => (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations
    .map((v) => v.id + ": " + v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | "));
  await start(page);
  await page.getByRole("tab", { name: "Skapa konto" }).click();
  await page.getByRole("button", { name: "Jag är vårdnadshavare" }).click();
  expect(await scan()).toEqual([]);
  await page.locator('input[name="displayName"]').fill("Maria Andersson");
  await page.locator('input[name="username"]').fill("maria.a");
  await page.locator('input[name="password"]').fill("hemligt-losen-1");
  await page.locator('button[type="submit"]:visible').click();
  await page.locator("#admin-top-link").click();
  await expect(page.locator(".tv-family")).toBeVisible();
  expect(await scan()).toEqual([]);
});
