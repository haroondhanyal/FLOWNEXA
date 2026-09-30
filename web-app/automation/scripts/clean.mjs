import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const name of ["allure-results", "allure-report", "playwright-report", "test-results", "artifacts/k6"]) await fs.rm(path.join(root, name), { recursive: true, force: true });
console.log("FlowNexa automation run artifacts cleared.");
