const { test, expect } = require("@playwright/test");
const { signIn, watchErrors } = require("./helpers");

// The pet's year (things for sale only in a season), its tricks, what it remembers, and "Hjälp djuret".

// Finish lessons for the student: every task of the lesson done, with answers in the log at the given times (ms before the fixed time of the page)
async function finishLessons(page, ids, agoMs) {
  await page.evaluate(async ({ ids, agoMs }) => {
    const st = JSON.parse(localStorage.getItem("gaussica.local.v1"));
    const uid = st.session;
    st.progress[uid] = st.progress[uid] || {};
    for (const id of ids) {
      const lesson = await (await fetch("/lessons/" + id + ".json")).json();
      const answers = {};
      window.GaussicaLesson.tasks(lesson).forEach((t) => { answers[t.id] = { answer: "1", scratchpad: "", feedback: "Rätt!", feedbackType: "correct", completed: true }; });
      st.progress[uid][id] = Object.assign({}, st.progress[uid][id], { started: true, answers: answers, interactive: {} });
      st.attempts.push({ id: st.next.attempt++, userId: uid, lessonId: id, taskId: "exercise", completed: true, createdAt: new Date(Date.now() - agoMs).toISOString(),
        data: { lessonId: id, taskId: "exercise", answer: "1", feedbackType: "correct", feedback: "Rätt!", attemptNo: 1, correctAnswer: "1" } });
    }
    localStorage.setItem("gaussica.local.v1", JSON.stringify(st));
  }, { ids, agoMs });
  await page.reload();
  await expect(page.locator(".hp-stage")).toBeVisible({ timeout: 25000 });
}

const TAL = ["addition", "subtraktion", "multiplikation", "division", "upp-och-ner", "tom-behallare"];
const openRoom = async (page, tab) => {
  await page.locator(".hp-shop").click();
  await expect(page.locator("#pet-overlay")).toBeVisible();
  if (tab) await page.locator("#pet-overlay").getByRole("tab", { name: tab }).click();
};

test("the pet's year: in December there are things for Lucia and Jul", async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.setFixedTime(new Date(2026, 11, 10, 10));
  await signIn(page);
  await openRoom(page);
  await expect(page.locator("#pet-overlay .pet-season")).toContainText(/jul och Lucia|Lucia och jul/);
  await expect(page.locator("#pet-overlay .pet-item", { hasText: "Luciakrona" })).toBeVisible();
  await expect(page.locator("#pet-overlay .pet-item", { hasText: "Renhorn" })).toBeVisible();
  // the welcome present of 20 coins buys the reindeer antlers
  await page.locator("#pet-overlay .pet-item", { hasText: "Renhorn" }).click();
  await page.locator("#pet-overlay").getByRole("button", { name: /Köp för 20 mynt/ }).click();
  await expect(page.locator("#pet-overlay .pet-msg")).toContainText(/Renhorn är köpt/);
  // the treats of Lucia are in "Mat och lek" now
  await page.locator("#pet-overlay").getByRole("tab", { name: "Mat och lek" }).click();
  await expect(page.locator("#pet-overlay .pet-care-item", { hasText: "Lussekatt" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the pet's year: in May the shop has none of it, but what was bought in December is still there", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 4, 10, 10));
  await signIn(page);
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("gaussica.local.v1"));
    st.progress[st.session].pet.owned["hatt-lucia"] = 25;
    localStorage.setItem("gaussica.local.v1", JSON.stringify(st));
  });
  await page.reload();
  await expect(page.locator(".hp-stage")).toBeVisible({ timeout: 25000 });
  await openRoom(page);
  await expect(page.locator("#pet-overlay .pet-season")).toHaveCount(0);
  await expect(page.locator("#pet-overlay .pet-item", { hasText: "Pumpahatt" })).toHaveCount(0);
  await expect(page.locator("#pet-overlay .pet-item", { hasText: "Luciakrona" })).toContainText("Ägs");
  await page.locator("#pet-overlay").getByRole("tab", { name: "Mat och lek" }).click();
  await expect(page.locator("#pet-overlay .pet-care-item", { hasText: "Lussekatt" })).toHaveCount(0);
  await expect(page.locator("#pet-overlay .pet-care-item", { hasText: "Äpple" })).toBeVisible();
});

test("a new student: the tricks are all locked and the help waits for a few lessons", async ({ page }) => {
  const errors = watchErrors(page);
  await signIn(page);
  await expect(page.getByRole("button", { name: "Hjälp Pixel" })).toHaveCount(0);
  await openRoom(page, "Tricks");
  await expect(page.locator("#pet-overlay .pet-trick")).toHaveCount(15);
  await expect(page.locator("#pet-overlay .pet-trick.is-locked")).toHaveCount(15);
  await expect(page.locator("#pet-overlay .pet-trick").first()).toContainText("Klara 2 lektioner");
  await page.locator("#pet-overlay").getByRole("tab", { name: "Hjälp djuret" }).click();
  await expect(page.locator("#pet-overlay .pet-help-bubble")).toContainText("klarat några lektioner");
  expect(errors).toEqual([]);
});

test("after six lessons the pet has two tricks in Tal, shows them, and says something about what the student did", async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.setFixedTime(new Date(2026, 10, 13, 10));
  await signIn(page);
  await finishLessons(page, TAL, 20 * 3600 * 1000);
  await page.reload();   // the coins of the lessons were announced the first time: now the pet says something else
  await expect(page.locator(".hp-stage")).toBeVisible({ timeout: 25000 });
  // it says one of the lines that refer to what was done, not one of the six general ones
  await expect(page.locator(".hp-bubble")).toContainText(/I går klarade du|klarat|Jag har märkt|Har du provat|Jag har lärt mig ett nytt trick|nytt i butiken|bästisar/, { timeout: 10000 });
  await openRoom(page, "Tricks");
  await expect(page.locator("#pet-overlay .pet-trick:not(.is-locked)")).toHaveCount(2);
  await expect(page.locator("#pet-overlay .pet-trick:not(.is-locked)").first()).toContainText("Blank och fin");
  await page.locator("#pet-overlay .pet-trick", { hasText: "Räkna högt" }).getByRole("button", { name: "Visa" }).click();
  await expect(page.locator("#pet-overlay .pet-trick-props .pet-trick-prop").first()).toBeAttached();
  await expect(page.locator("#pet-overlay .pet-msg")).toContainText("Ett, två, tre");
  await expect(page.locator("#pet-overlay .pet-trick-props")).toHaveCount(0, { timeout: 8000 });
  expect(errors).toEqual([]);
});

test("a trick is rusty when the area has been left for a month: the pet still does it, with a stumble first", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 13, 10));
  await signIn(page);
  await finishLessons(page, TAL, 30 * 24 * 3600 * 1000);
  await openRoom(page, "Tricks");
  const card = page.locator("#pet-overlay .pet-trick", { hasText: "Räkna högt" });
  await expect(card).toHaveClass(/is-rusty/);
  await expect(card).toContainText("Lite rostigt");
  await card.getByRole("button", { name: "Visa" }).click();
  await expect(page.locator("#pet-overlay .pet-msg")).toContainText("lite rostigt");
});

test("Hjälp djuret: the pet asks about a problem three times, a heart for each, and the explanation comes after", async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.setFixedTime(new Date(2026, 10, 13, 10));
  await signIn(page);
  await finishLessons(page, TAL, 20 * 3600 * 1000);
  await page.getByRole("button", { name: "Hjälp Pixel" }).click();
  const help = page.locator("#pet-overlay .pet-help");
  await expect(help.locator(".pet-help-card")).toBeVisible();
  for (let round = 1; round <= 3; round++) {
    await expect(help.locator(".pet-help-card")).toContainText("Runda " + round + " av 3");
    await expect(help.locator(".pet-help-said")).toContainText("Pixel svarade:");
    await help.getByRole("button", { name: "Det stämmer inte" }).click();
    for (let i = 0; i < 2; i++) {
      await help.locator("input").fill("999999");
      await help.getByRole("button", { name: "Kolla" }).click();
    }
    await expect(help.locator(".pet-help-heart")).toContainText("bättre vänner");
    await help.getByRole("button", { name: round < 3 ? "Nästa uppgift" : "Klar" }).click();
  }
  await expect(help.locator(".pet-help-bubble")).toContainText("Tack för hjälpen");
  expect(errors).toEqual([]);
  // three hearts: the friendship under Mat och lek says so
  await page.locator("#pet-overlay").getByRole("tab", { name: "Mat och lek" }).click();
  await expect(page.locator("#pet-overlay .pet-friend-sub")).toContainText("3 hjärtan");
});
