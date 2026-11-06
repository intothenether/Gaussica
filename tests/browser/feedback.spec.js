const { test, expect } = require("@playwright/test");
const { signIn, openLesson } = require("./helpers");

// The feedback after a wrong answer: a careful hint that does not give the answer, and the signals that make it hard to miss
// (frame and shake, a buzz; and the tip in a box that has to be closed, see tip.spec.js).

const LESSON = "addition-uppstallning";   // "Räkna ut 38 + 47 med uppställning." (right: 85)
const field = (page) => page.locator("#lesson-player input[name=answer]");
const hint = (page) => page.locator("#lesson-player .pl-foot-feedback .feedback-message");

async function toExercise(page) {
  await openLesson(page, LESSON, "input[name=answer]");
  // the first question with an answer field is the one about 38 + 47
  await expect(page.locator("#lesson-player .pl-foot-q")).toContainText("38 + 47");
}

async function answer(page, text) {
  await field(page).fill(text);
  await field(page).press("Enter");
}

test("a wrong answer: a careful hint without the answer in it, a frame on the field and a buzz", async ({ page }) => {
  await page.addInitScript(() => { window.__buzz = []; navigator.vibrate = (p) => { window.__buzz.push(p); return true; }; });
  await signIn(page);
  await toExercise(page);
  await answer(page, "58");   // the digits of 85 the other way round
  await expect(hint(page)).toContainText("Tänk på ordningen i ditt svar.");
  await expect(hint(page)).not.toContainText("85");
  await expect(hint(page)).toHaveClass(/feedback-diagnosed/);
  await expect(field(page)).toHaveClass(/is-wrong/);
  await expect(page.locator("#lesson-player .pl-foot")).toHaveClass(/is-wrong/);
  expect(await page.evaluate(() => window.__buzz)).toEqual([[35, 50, 35]]);
  // the frame goes when the student changes the answer, but the hint stays: it is what to read while changing it
  await field(page).fill("8");
  await expect(field(page)).not.toHaveClass(/is-wrong/);
  await expect(hint(page)).toContainText("Tänk på ordningen i ditt svar.");
});

test("a wrong answer that is just too large is asked about, in other words each time", async ({ page }) => {
  await signIn(page);
  await toExercise(page);
  const said = [];
  for (const wrong of ["1000", "999"]) {
    await answer(page, wrong);
    await expect(hint(page)).toContainText(/för stort|större/);
    said.push(await hint(page).innerText());
    await page.waitForTimeout(7200);   // the time to read it: the next try is a considered one, not a fast guess
  }
  expect(new Set(said).size).toBe(2);
  said.forEach((t) => expect(t).not.toContain("85"));
});

test("the settings for a wrong answer are in Läsning, and the buzz can be turned off", async ({ page }) => {
  await page.addInitScript(() => { window.__buzz = []; navigator.vibrate = (p) => { window.__buzz.push(p); return true; }; });
  await signIn(page);
  await page.locator("#reading-link").click();
  const buzz = page.getByLabel("Vibrera lite när svaret blir fel");
  await expect(buzz).toBeChecked();
  await expect(page.getByLabel("Läs upp tipset av sig självt när svaret blir fel")).not.toBeChecked();
  await buzz.uncheck();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gaussica-reading")).buzz)).toBe(false);
  await page.getByRole("button", { name: "Klart" }).click();
  await toExercise(page);
  await answer(page, "1000");
  await expect(hint(page)).toContainText(/för stort|större/);
  expect(await page.evaluate(() => window.__buzz)).toEqual([]);
});

test("phone with the keyboard up: the hint is not cut to three lines, and a longer one says that it can be scrolled", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await signIn(page);
  await toExercise(page);
  await answer(page, "1000");
  await expect(hint(page)).toContainText(/för stort|större/);
  // the keyboard is up: the visible height is small
  await page.evaluate(() => {
    const r = document.documentElement;
    r.style.setProperty("--vv-h", "360px");
    r.classList.add("is-keyboard", "is-short");
    const h = document.querySelector("#lesson-player .pl-foot-feedback .feedback-message");
    h.textContent = "Det ser ut som att du har räknat en del av uppgiften. ".repeat(2) + "Läs frågan en gång till och tänk på vad den egentligen frågar efter, steg för steg. ".repeat(2);
    window.GaussicaSignals.clipped(h);
  });
  const box = await hint(page).evaluate((h) => ({ client: h.clientHeight, line: parseFloat(getComputedStyle(h).lineHeight) }));
  expect(box.client).toBeGreaterThan(box.line * 4.5);   // more than the old three and a half lines
  // a very long one is clipped, and says so until the end is reached
  await page.evaluate(() => {
    const h = document.querySelector("#lesson-player .pl-foot-feedback .feedback-message");
    h.textContent = "Ett långt tips som fortsätter. ".repeat(30);
    window.GaussicaSignals.clipped(h);
  });
  await expect(hint(page)).toHaveClass(/is-clipped/);
  await hint(page).evaluate((h) => { h.scrollTop = h.scrollHeight; h.dispatchEvent(new Event("scroll")); });
  await expect(hint(page)).not.toHaveClass(/is-clipped/);
});

test("the teacher overview lists the wrong answers that only got the general hint, without the names of the students", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await signIn(page, { pet: null });
  const text = await page.evaluate(() => {
    const box = document.createElement("div");
    box.id = "gap-test";
    document.body.appendChild(box);
    const att = (answer, extra) => Object.assign({ lessonId: "addition-uppstallning", lessonTitle: "Addition med uppställning", taskId: "exercise", taskName: "Din tur", prompt: "Räkna ut 38 + 47 med uppställning.",
      answer: answer, completed: false, feedbackType: "hint", misconception: "Generellt beräkningsfel", correctAnswer: "85", timestamp: new Date().toISOString(), attemptNo: 1 }, extra || {});
    const students = [
      { id: 1, name: "Elev Ett", username: "e1", classId: 1, classIds: [1], attempts: [att("1000"), att("1000"), att("90")], lessonProgress: {} },
      { id: 2, name: "Elev Två", username: "e2", classId: 1, classIds: [1], attempts: [att("1000"), att("58", { misconception: "Siffrorna i fel ordning" })], lessonProgress: {} }
    ];
    const nothing = () => Promise.resolve({});
    window.GaussicaTeacher.render(box, { caregiver: false, students, classes: [{ id: 1, name: "7A", code: "ABC" }], assignments: [], course: { lessons: [], areas: [] }, renderVisuals() {}, formatTimestamp: String,
      rerender() {}, refresh() {}, actions: new Proxy({}, { get: () => nothing }), setNotice() {} });
    return box.querySelector(".tv-gaps").innerText;
  });
  expect(text).toContain("Felsvar utan eget tips");
  expect(text).toContain("Addition med uppställning – Din tur");
  expect(text).toContain("4 svar från 2 elever");
  expect(text).toContain("1000 (3)");
  expect(text).toContain("Rätt svar: 85");
  expect(text).not.toContain("58");   // that one got a hint of its own
  expect(text).not.toContain("Elev");
  expect(errors).toEqual([]);
});
