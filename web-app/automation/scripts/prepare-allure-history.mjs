import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "allure-report", "history");
const target = path.join(root, "allure-results", "history");
try { await fs.cp(source, target, { recursive: true, force: true }); console.log("Previous Allure history copied for trend charts."); }
catch { console.log("No previous Allure history found; the first report will establish the trend baseline."); }
