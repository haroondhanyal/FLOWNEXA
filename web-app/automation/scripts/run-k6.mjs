import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let session = {};
try {
  session = JSON.parse(await fs.readFile(path.join(root, ".auth", "session.json"), "utf8"));
} catch {
  // Explicit environment values can be used without a saved Playwright session.
}
const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000/api/v1";
const organizationId = process.env.TEST_ORGANIZATION_ID || session.organizationId;
const accessToken = process.env.K6_ACCESS_TOKEN || session.accessToken;
if (!organizationId || !accessToken) {
  throw new Error("Run the Playwright global setup first or set TEST_ORGANIZATION_ID and K6_ACCESS_TOKEN.");
}

const env = { ...process.env, API_BASE_URL: apiBaseUrl, TEST_ORGANIZATION_ID: organizationId, K6_ACCESS_TOKEN: accessToken };
const installed = spawnSync("k6", ["version"], { stdio: "ignore" });
let result;
if (!installed.error && installed.status === 0) {
  result = spawnSync("k6", ["run", "tests/k6/k6-cases.js"], { cwd: root, env, stdio: "inherit" });
} else {
  const dockerApi = apiBaseUrl.replace(/^http:\/\/(localhost|127\.0\.0\.1)(?=[:/])/, "http://host.docker.internal");
  const args = [
    "run", "--rm", "-v", `${root}:/work`, "-w", "/work",
    "-e", `API_BASE_URL=${dockerApi}`,
    "-e", `TEST_ORGANIZATION_ID=${organizationId}`,
    "-e", `K6_ACCESS_TOKEN=${accessToken}`,
    "grafana/k6", "run", "tests/k6/k6-cases.js",
  ];
  result = spawnSync("docker", args, { cwd: root, stdio: "inherit" });
}
if (result.error) throw result.error;
process.exit(result.status ?? 1);
