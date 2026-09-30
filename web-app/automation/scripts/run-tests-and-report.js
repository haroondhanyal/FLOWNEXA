const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const playwrightCli = require.resolve("@playwright/test/cli");
const testRun = spawnSync(process.execPath, [playwrightCli, "test", "-c", "config/playwright.config.ts"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (testRun.error) throw testRun.error;

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const reportRun = spawnSync(npm, ["run", "report:allure"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
if (reportRun.error) throw reportRun.error;

const testStatus = testRun.status ?? 1;
const reportStatus = reportRun.status ?? 1;
process.exit(testStatus || reportStatus);
