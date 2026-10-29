// Browser tests (npm run test:browser): the real site in a real browser, clicking through it. They run against a small static server
// (tests/browser/serve.js) that always uses the demo mode, so nothing here ever touches the shared database or the server on port 8000.
//   Locally: PW_CHANNEL=chrome npm run test:browser   (uses the Chrome or Edge that is installed: PW_CHANNEL=msedge)
//   In CI:   npx playwright install --with-deps chromium, then npm run test:browser
const { defineConfig } = require("@playwright/test");
const PORT = 8126;

module.exports = defineConfig({
  testDir: "tests/browser",
  timeout: 60000,
  expect: { timeout: 8000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:" + PORT,
    channel: process.env.PW_CHANNEL || undefined,
    serviceWorkers: "block",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node tests/browser/serve.js",
    url: "http://localhost:" + PORT + "/index.html",
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) }
  }
});
