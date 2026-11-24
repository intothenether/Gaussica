const { test, expect } = require("@playwright/test");
const { signIn, watchErrors } = require("./helpers");

// End to end: answers in degrees in the lessons about negative numbers (symbolic-math.js takes −3°C, -3 grader and the like as the number), and the
// chapter Matematisk modellering (åk 7–9): every lesson opens, and its exercise can be answered and is marked right.

const field = (page) => page.locator("#lesson-player input[name=answer]");
const foot = (page) => page.locator("#lesson-player .pl-foot");
const question = (page) => page.locator("#lesson-player .pl-foot-q");

// Opens a lesson and goes forward (Fortsätt, Börja med, Hoppa över) until the question with `prompt` is on the screen with a field to answer in.
async function toQuestion(page, lessonId, prompt) {
  await page.evaluate((lesson) => { location.hash = "#start"; setTimeout(() => { location.hash = "#play/" + lesson; }, 150); }, lessonId);
  await expect(page.locator("#lesson-player .pl-foot")).toBeVisible();
  for (let i = 0; i < 30; i++) {
    // the question is read without waiting: before the first question (the explanation) there is none
    const q = await page.evaluate(() => { const e = document.querySelector("#lesson-player .pl-foot-q"); return e ? e.textContent : ""; });
    if (q.includes(prompt) && await field(page).isVisible()) return;
    const next = foot(page).getByRole("button", { name: /Fortsätt|Börja med|Hoppa över/ }).first();
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
  }
  await expect(question(page)).toContainText(prompt);
  await expect(field(page)).toBeVisible();
}

async function answer(page, text) {
  await field(page).fill(text);
  await field(page).press("Enter");
}

const TEMP = "Temperaturen är 2 grader och sjunker 5 grader";   // negativa-tal-kapitel, the answer is −3

for (const written of ["−3°C", "-3 grader"]) {
  test("negative numbers: the answer " + written + " is right when the answer is −3", async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await toQuestion(page, "negativa-tal-kapitel", TEMP);
    await answer(page, written);
    await expect(foot(page)).toHaveClass(/is-correct/);
    expect(errors).toEqual([]);
  });
}

test("negative numbers: 3 grader is wrong when the answer is −3, and −3 grader then is right", async ({ page }) => {
  await signIn(page);
  await toQuestion(page, "negativa-tal-kapitel", TEMP);
  await answer(page, "3 grader");
  await expect(foot(page)).toHaveClass(/is-wrong/);
  await expect(foot(page)).not.toHaveClass(/is-correct/);
  await answer(page, "−3 grader");
  await expect(foot(page)).toHaveClass(/is-correct/);
});

// the chapter Matematisk modellering: the exercise of each lesson, and the answer it wants
const MODELLING = [
  ["matematisk-modellering", "duschar 5 minuter var per dag", "200 liter"],
  ["modell-antaganden", "En skola har 300 elever", "108000"],
  ["prova-modellen", "flaskan slut efter 2 timmar", "0,75 liter"],
  ["valj-modell", "Talen 4, 12, 36 och 108", "324"]
];
for (const [id, prompt, right] of MODELLING) {
  test("modelling: the lesson " + id + " opens and its exercise can be answered", async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await toQuestion(page, id, prompt);
    await answer(page, right);
    await expect(foot(page)).toHaveClass(/is-correct/);
    expect(errors).toEqual([]);
  });
}
