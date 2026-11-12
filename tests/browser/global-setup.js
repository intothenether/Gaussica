// Runs once before the browser tests: signs a teacher up through the real sign-up (with the pet Kanin called Pixel, and without a pet) and keeps what the
// browser then holds (localStorage and sessionStorage) in .seed.json, so that each test can start from it (signIn in helpers.js). The web server of the tests is
// already running when this runs.
const fs = require("fs");
const { chromium } = require("@playwright/test");
const { signInViaUi, SEED_FILE } = require("./helpers");

module.exports = async function globalSetup(config) {
  const use = config.projects[0].use;
  const browser = await chromium.launch({ channel: use.channel || undefined });
  const out = {};
  try {
    for (const [name, opts] of [["pet", {}], ["nopet", { pet: null }]]) {
      const context = await browser.newContext({ baseURL: use.baseURL, viewport: use.viewport, serviceWorkers: "block" });
      const page = await context.newPage();
      await signInViaUi(page, opts);
      // the pet is kept a moment after it is chosen: wait until it is in the stored data, or the state would have no pet
      if (opts.pet !== null) await page.waitForFunction(() => (localStorage.getItem("gaussica.local.v1") || "").includes("Pixel"), null, { timeout: 15000 });
      out[name] = await page.evaluate(() => {
        const dump = (store) => { const o = {}; for (let i = 0; i < store.length; i++) o[store.key(i)] = store.getItem(store.key(i)); return o; };
        return { local: dump(localStorage), session: dump(sessionStorage) };
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(SEED_FILE, JSON.stringify(out));
};
