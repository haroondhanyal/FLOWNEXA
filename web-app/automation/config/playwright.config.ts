import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { env } from "./env";

// REPORTING + MEDIA: capture a screenshot and video for every Playwright case; traces remain on failure.
export default defineConfig({
  testDir: "../tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: env.workers,
  timeout: 30_000,
  expect: { timeout: 6_000 },
  outputDir: "../test-results",
  globalSetup: "../fixtures/global-setup.ts",
  reporter: [
    ["list"],
    ["html", { outputFolder: "../playwright-report", open: "never" }],
    ["allure-playwright", {
      resultsDir: "allure-results",
      detail: true,
      suiteTitle: true,
      environmentInfo: { product: "FlowNexa", owner: "Raja Haroon Jamal", browser: env.browser, node: process.version, platform: `${os.platform()} ${os.release()}` },
      globalLabels: { product: "FlowNexa", owner: "Raja Haroon Jamal", team: "QA Department" },
      categories: JSON.parse(fs.readFileSync(path.resolve(__dirname, "allure/categories.json"), "utf8")),
    }],
  ],
  use: {
    baseURL: env.webBaseUrl,
    browserName: env.browser as "chromium" | "firefox" | "webkit",
    headless: env.headless,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: "on",
    video: "on",
    trace: "retain-on-failure",
    ignoreHTTPSErrors: false,
  },
  projects: [{ name: env.browser, use: { ...devices[env.browser === "firefox" ? "Desktop Firefox" : env.browser === "webkit" ? "Desktop Safari" : "Desktop Chrome"] } }],
  ...(env.startWebServer ? { webServer: { command: "npm run dev -- --hostname 127.0.0.1 --port 3100", cwd: path.resolve(__dirname, "../.."), url: env.webBaseUrl, reuseExistingServer: !process.env.CI, timeout: 120_000 } } : {}),
});
