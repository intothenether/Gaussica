const { test, expect } = require("@playwright/test");
const { watchErrors } = require("./helpers");

// The adult's account (demo mode: no mail and no payments here, so these are the screens and the rules of the form): the e-mail address and the terms
// when a caregiver makes an account, "Glömt lösenord?", the pages that the links in the e-mails open, and "Mitt konto".
async function start(page, hash) {
  await page.addInitScript(() => { try { localStorage.setItem("gaussica.cookies-ok", "1"); } catch (e) { /* no storage */ } });
  await page.goto("/index.html" + (hash || "#start"));
}

test("a caregiver gives an e-mail address and accepts the terms, which have a page of their own", async ({ page }) => {
  const errors = watchErrors(page);
  await start(page);
  await page.getByRole("tab", { name: "Skapa konto" }).click();
  await page.getByRole("button", { name: "Jag är vårdnadshavare" }).click();
  const email = page.locator('input[name="email"]');
  const terms = page.locator(".auth-terms input");
  await expect(email).toBeVisible();
  await expect(email).toHaveAttribute("required", "");
  await expect(terms).toHaveAttribute("required", "");
  await expect(page.locator(".auth-terms a")).toHaveText(["villkoren", "integritetstexten"]);
  await expect(page.locator(".auth-terms a").first()).toHaveAttribute("href", "./villkor.html");
  // a child and a teacher do not get the e-mail field
  await page.getByRole("button", { name: "Jag är elev" }).click();
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Jag är lärare" }).click();
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Glömt lösenord? asks for an address and says the same whatever the answer", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Glömt lösenord?" }).click();
  await expect(page.getByText("Barn ber sin vårdnadshavare eller lärare om ett nytt lösenord")).toBeVisible();
  await page.locator('input[name="email"]').fill("ingen@example.se");
  await page.getByRole("button", { name: "Skicka länk" }).click();
  await expect(page.locator(".auth-note[role=status]")).toContainText("Om adressen hör till ett konto har vi skickat en länk");
  await page.getByRole("button", { name: "Tillbaka till inloggningen" }).click();
  await expect(page.locator('input[name="username"]')).toBeVisible();
});

test("the link to choose a new password opens a page for it, and a link that does not work is told so", async ({ page }) => {
  await start(page, "#aterstall/abcdefghijklmnopqrstuvwxyz");
  await expect(page.getByRole("heading", { name: "Välj nytt lösenord" })).toBeVisible();
  expect(await page.evaluate(() => window.location.hash)).toBe("");   // the token does not stay in the address
  await page.locator('input[name="password"]').fill("ett-nytt-hemligt-1");
  await page.getByRole("button", { name: "Spara nytt lösenord" }).click();
  await expect(page.locator(".auth-error")).toBeVisible();   // the demo has no such link: it says so
});

test("the link to verify an address says if it does not work, and goes on to the sign-in", async ({ page }) => {
  await start(page, "#verifiera/abcdefghijklmnopqrstuvwxyz");
  await expect(page.getByRole("heading", { name: "Länken fungerar inte" })).toBeVisible();
  await page.getByRole("button", { name: "Fortsätt" }).click();
  await expect(page.getByRole("tab", { name: "Logga in" })).toBeVisible();
});

test("Mitt konto has the address and the subscription of an adult", async ({ page }) => {
  const errors = watchErrors(page);
  await start(page);
  await page.getByRole("tab", { name: "Skapa konto" }).click();
  await page.getByRole("button", { name: "Jag är vårdnadshavare" }).click();
  await page.locator('input[name="displayName"]').fill("Maria Andersson");
  await page.locator('input[name="username"]').fill("maria.konto");
  await page.locator('input[name="password"]').fill("hemligt-losen-1");
  await page.locator('input[name="email"]').fill("maria.konto@example.se");
  await page.locator(".auth-terms input").check();
  await page.locator('button[type="submit"]:visible').click();
  await expect(page.locator("#admin-top-link")).toBeVisible();
  await page.locator(".student-profile-btn").click();
  const card = page.locator("#student-modal-card");
  await expect(card.getByRole("heading", { name: "E-post" })).toBeVisible();
  await expect(card.getByRole("heading", { name: "Prenumeration" })).toBeVisible();
  await expect(card).toContainText("Tjänsten är gratis just nu");
  expect(errors).toEqual([]);
});
