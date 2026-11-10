const { test, expect } = require("@playwright/test");
const { signIn } = require("./helpers");

// The week of a child, for the adult who has not got time for the numbers: a few plain sentences first (teacher-view.js).
test("the week of a child is told in a few plain sentences, with what was finished", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await signIn(page, { pet: null });
  const text = await page.evaluate(() => {
    const box = document.createElement("div");
    document.body.appendChild(box);
    const at = (days) => new Date(Date.now() - days * 86400000).toISOString();
    const att = (n, ok, days) => ({ lessonId: "addition-uppstallning", lessonTitle: "Addition med uppställning", taskId: "exercise", taskName: "Din tur", prompt: "Räkna ut 38 + 47 med uppställning.",
      answer: ok ? "85" : "1000", completed: ok, feedbackType: ok ? "correct" : "hint", correctAnswer: "85", timestamp: at(days), attemptNo: n, seconds: 60 });
    const lessonProgress = { "addition-uppstallning": { started: true, answers: { exercise: { answer: "85", completed: true, feedbackType: "correct" } } } };
    const quiet = { id: 2, name: "Ville Tyst", username: "v1", classId: 1, classIds: [1], attempts: [], lessonProgress: {} };
    const students = [{ id: 1, name: "Maja Aktiv", username: "m1", classId: 1, classIds: [1], attempts: [att(1, false, 2), att(2, true, 2), att(1, true, 1)], lessonProgress }, quiet];
    const nothing = () => Promise.resolve({});
    window.GaussicaTeacher.render(box, { caregiver: true, students, classes: [{ id: 1, name: "Familjen", code: "ABC", owner: true, students: 2, guides: [] }], assignments: [], course: window.course, renderVisuals() {}, formatTimestamp: String,
      rerender() {}, refresh() {}, actions: new Proxy({}, { get: () => nothing }), setNotice() {} });
    return Array.from(box.querySelectorAll(".tv-week-summary")).map((e) => e.textContent);
  });
  expect(text[0]).toBe("Maja övade 2 dagar den här veckan, i ungefär 3 minuter. 2 av 3 svar var rätt. Klart den här veckan: Addition med uppställning.");
  expect(text[1]).toContain("Inget har gjorts de senaste sju dagarna");
  expect(errors).toEqual([]);
});
