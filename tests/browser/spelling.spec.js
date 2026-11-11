const { test, expect } = require("@playwright/test");
const { signIn, openLesson } = require("./helpers");

// A question whose answer is a word: the word bank under the field, and a word that is almost right in the spelling counts as the right word.
// "Vad kallas svaret på en addition?" is the first question with a field in begrepp-rakna (right: summa).

const field = (page) => page.locator("#lesson-player input[name=answer]");
const hint = (page) => page.locator("#lesson-player .pl-foot-feedback .feedback-message");
const bank = (page) => page.locator("#lesson-player .answer-bank");
const words = (page) => page.locator("#lesson-player .answer-bank-word");

async function toQuestion(page, settings, points) {
  await page.addInitScript(([s, p]) => {
    try {
      if (s) localStorage.setItem("gaussica-reading", JSON.stringify(s));
      if (p !== null) localStorage.setItem("gaussica-wordbank", JSON.stringify({ points: p }));
    } catch (e) { /* no storage */ }
  }, [settings || null, points === undefined ? null : points]);
  await signIn(page);
  await openLesson(page, "begrepp-rakna", "input[name=answer]");
  await expect(page.locator("#lesson-player .pl-foot-q")).toContainText("Vad kallas svaret på en addition");
}

test("the word bank offers the right word among a few it is mixed up with, and a tap fills the field", async ({ page }) => {
  await toQuestion(page);
  await expect(bank(page)).toBeVisible();
  const list = await words(page).allInnerTexts();
  expect(list.length).toBeGreaterThanOrEqual(3);
  expect(list.length).toBeLessThanOrEqual(5);
  expect(list).toContain("summa");
  // a wrong word: it says what that word means
  await words(page).filter({ hasText: /^(produkt|differens|kvot)$/ }).first().click();
  await expect(field(page)).toHaveValue(/produkt|differens|kvot/);
  await field(page).press("Enter");
  await expect(hint(page)).toContainText("betyder ");
  // the right word
  await words(page).filter({ hasText: /^summa$/ }).click();
  await expect(field(page)).toHaveValue("summa");
  await field(page).press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
});

test("almost right in the spelling counts, and the right spelling is shown", async ({ page }) => {
  await toQuestion(page);
  await field(page).fill("sumna");
  await field(page).press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
  await expect(hint(page)).toContainText("Rätt!");
  await expect(hint(page).locator(".feedback-spelling")).toHaveText("Ordet stavas ”summa”.");
});

test("another term is not a slip: produkt is still wrong for summa, and so is a word that is not near", async ({ page }) => {
  await toQuestion(page);
  await field(page).fill("produkt");
  await field(page).press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-wrong/);
  await page.waitForTimeout(3100);
  await field(page).fill("banan");
  await field(page).press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-wrong/);
});

test("spelling set to exact: sumna is wrong", async ({ page }) => {
  await toQuestion(page, { spelling: "strict" });
  await field(page).fill("sumna");
  await field(page).press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-wrong/);
});

test("spelling set to quiet: it counts, without a note", async ({ page }) => {
  await toQuestion(page, { spelling: "quiet" });
  await field(page).fill("sumna");
  await field(page).press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
  await expect(hint(page).locator(".feedback-spelling")).toHaveCount(0);
});

test("the bank goes as the student gets on: after a wrong answer, then only when asked for", async ({ page }) => {
  await toQuestion(page, null, 10);   // ten points: it is only there after a wrong answer
  await expect(bank(page)).toBeVisible();   // the row with the button is always there
  await expect(words(page).first()).toBeHidden();
  await field(page).fill("produkt");
  await field(page).press("Enter");
  await expect(words(page).first()).toBeVisible();
});

test("the bank at the end: one tap away", async ({ page }) => {
  await toQuestion(page, null, 20);
  await expect(words(page).first()).toBeHidden();
  await page.getByRole("button", { name: "Visa ordbank" }).click();
  await expect(words(page).first()).toBeVisible();
  await page.getByRole("button", { name: "Skriv själv" }).click();
  await expect(words(page).first()).toBeHidden();
});

test("the bank set to never: it is not there", async ({ page }) => {
  await toQuestion(page, { bank: "off" });
  await expect(bank(page)).toHaveCount(0);
});

test("the settings for spelling and the bank are in Läsning", async ({ page }) => {
  await signIn(page);
  await page.locator("#reading-link").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radio", { name: "Bara exakt stavning" })).toBeVisible();
  await dialog.getByRole("radio", { name: "Bara exakt stavning" }).click();
  await dialog.getByRole("radio", { name: "Alltid" }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("gaussica-reading")));
  expect(saved.spelling).toBe("strict");
  expect(saved.bank).toBe("always");
});

test("a right answer by typing or tapping counts for the bank: two points typed, one tapped", async ({ page }) => {
  await toQuestion(page);
  await field(page).fill("summa");
  await field(page).press("Enter");
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-correct/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gaussica-wordbank")).points)).toBe(2);
});

test("the teacher overview shows spelling slips apart from the misunderstandings", async ({ page }) => {
  await signIn(page, { pet: null });
  const text = await page.evaluate(() => {
    const box = document.createElement("div");
    document.body.appendChild(box);
    const att = (extra) => Object.assign({ lessonId: "begrepp-rakna", lessonTitle: "Begrepp: räknesätt och svar", taskId: "exercise", taskName: "Din tur", prompt: "Vad kallas svaret på en addition?", answer: "sumna",
      completed: true, feedbackType: "correct", misconception: "Stavning: skrev ”sumna”, ska vara ”summa”", correctAnswer: "summa / summan", timestamp: new Date().toISOString(), attemptNo: 1 }, extra || {});
    const students = [{ id: 1, name: "Elev Ett", username: "e1", classId: 1, classIds: [1], lessonProgress: {}, attempts: [att(), att({ answer: "sumna", attemptNo: 2 }),
      att({ answer: "produkt", completed: false, feedbackType: "hint", misconception: "Ett annat räknesätt", attemptNo: 3 })] }];
    const nothing = () => Promise.resolve({});
    window.GaussicaTeacher.render(box, { caregiver: false, students, classes: [{ id: 1, name: "7A", code: "ABC" }], assignments: [], course: { lessons: [], areas: [] }, renderVisuals() {}, formatTimestamp: String,
      rerender() {}, refresh() {}, actions: new Proxy({}, { get: () => nothing }), setNotice() {} });
    return { spelling: box.querySelector(".tv-spelling").innerText, misc: box.querySelector(".misconception-list").innerText };
  });
  expect(text.spelling).toContain("skrev ”sumna”, ska vara ”summa” (2 gånger)");
  expect(text.misc).toContain("Ett annat räknesätt");
  expect(text.misc).not.toContain("Stavning");
});
