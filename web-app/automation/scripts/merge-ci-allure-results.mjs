import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactsRoot = path.join(root, ".ci-artifacts");
const resultsRoot = path.join(root, "allure-results");
const skippedNames = new Set(["categories.json", "environment.properties", "executor.json"]);
const copied = new Set();

await fs.rm(resultsRoot, { recursive: true, force: true });
await fs.mkdir(resultsRoot, { recursive: true });

async function findAllureResultFolders(current) {
  let entries;
  try { entries = await fs.readdir(current, { withFileTypes: true }); }
  catch { return []; }
  const found = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(current, entry.name);
    if (entry.name === "allure-results") found.push(fullPath);
    else found.push(...await findAllureResultFolders(fullPath));
  }
  return found;
}

async function findNamedFile(current, wanted) {
  let entries;
  try { entries = await fs.readdir(current, { withFileTypes: true }); }
  catch { return undefined; }
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isFile() && entry.name === wanted) return fullPath;
    if (entry.isDirectory()) {
      const match = await findNamedFile(fullPath, wanted);
      if (match) return match;
    }
  }
  return undefined;
}

async function copyResultFiles(source, relative = "") {
  const directory = path.join(source, relative);
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name === "history" && !relative) continue;
    const child = path.join(relative, entry.name);
    const sourcePath = path.join(source, child);
    const targetPath = path.join(resultsRoot, child);
    if (entry.isDirectory()) {
      await fs.mkdir(targetPath, { recursive: true });
      await copyResultFiles(source, child);
      continue;
    }
    if (!entry.isFile() || skippedNames.has(entry.name)) continue;
    if (copied.has(child)) throw new Error(`Duplicate Allure result file while merging artifacts: ${child}`);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
    copied.add(child);
  }
}

const resultFolders = await findAllureResultFolders(artifactsRoot);
for (const folder of resultFolders) await copyResultFiles(folder);

const categorySource = path.join(root, "config", "allure", "categories.json");
await fs.copyFile(categorySource, path.join(resultsRoot, "categories.json"));

const fakerSeedFile = await findNamedFile(artifactsRoot, "faker-seed.json");
if (fakerSeedFile) {
  const seedTarget = path.join(root, "artifacts", "db", "faker-seed.json");
  await fs.mkdir(path.dirname(seedTarget), { recursive: true });
  await fs.copyFile(fakerSeedFile, seedTarget);
}

const historySource = path.join(root, "ci-history");
try {
  await fs.cp(historySource, path.join(resultsRoot, "history"), { recursive: true, force: true });
  console.log("Restored Allure trend history from the GitHub Actions cache.");
} catch {
  console.log("No cached Allure history found; this run starts a new trend baseline.");
}

console.log(`Merged ${copied.size} Allure files from ${resultFolders.length} suite artifacts.`);
