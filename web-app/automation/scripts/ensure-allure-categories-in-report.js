const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const configFile = path.join(root, "config", "allure", "categories.json");
const treeFile = path.join(root, "allure-report", "data", "categories.json");
const widgetFile = path.join(root, "allure-report", "widgets", "categories.json");
const definitions = JSON.parse(fs.readFileSync(configFile, "utf8"));
const tree = JSON.parse(fs.readFileSync(treeFile, "utf8"));
const widget = JSON.parse(fs.readFileSync(widgetFile, "utf8"));
const testCasesDir = path.join(root, "allure-report", "data", "test-cases");

const categoryUid = (name) => crypto.createHash("sha1").update("FlowNexa Allure category:" + name).digest("hex").slice(0, 32);
const existingTree = new Map((tree.children ?? []).map((item) => [item.name, item]));
const existingWidgets = new Map((widget.items ?? []).map((item) => [item.name, item]));

function regexMatches(pattern, text) {
  if (!pattern) return false;
  try { return new RegExp(pattern.replace(/^\(\?s\)/, ""), "is").test(text ?? ""); }
  catch (error) { console.warn(`Ignoring invalid Allure category regex: ${error.message}`); return false; }
}

function categoryFor(result) {
  if (["skipped", "unknown"].includes(result.status)) return "Skipped / Pending";
  if (!["failed", "broken"].includes(result.status)) return null;
  const message = [result.statusMessage, result.name, result.fullName].filter(Boolean).join("\n");
  const trace = result.statusTrace ?? "";
  const category = definitions.find((definition) => {
    if (!definition.matchedStatuses?.includes(result.status)) return false;
    const hasPattern = Boolean(definition.messageRegex || definition.traceRegex);
    return hasPattern && (regexMatches(definition.messageRegex, message) || regexMatches(definition.traceRegex, trace));
  });
  return category?.name ?? null;
}

const classified = new Map(definitions.map(({ name }) => [name, []]));
for (const file of fs.readdirSync(testCasesDir).filter((name) => name.endsWith(".json"))) {
  let result;
  try { result = JSON.parse(fs.readFileSync(path.join(testCasesDir, file), "utf8")); }
  catch { continue; }
  if (result.hidden) continue;
  const category = categoryFor(result);
  if (category) classified.get(category)?.push(result);
}

tree.children = definitions.map(({ name }) => {
  const node = existingTree.get(name) ?? { uid: categoryUid(name), name, children: [] };
  node.children = (classified.get(name) ?? []).map((result) => ({
    uid: result.uid,
    name: result.name ?? result.fullName ?? "Unnamed test",
    status: result.status,
    time: result.time,
    children: [],
  }));
  return node;
});

widget.items = definitions.map(({ name }) => {
  const item = existingWidgets.get(name) ?? { uid: categoryUid(name), name, statistic: {} };
  const results = classified.get(name) ?? [];
  const statistic = { failed: 0, broken: 0, skipped: 0, passed: 0, unknown: 0, total: results.length };
  for (const result of results) statistic[result.status]++;
  item.statistic = statistic;
  return item;
});
widget.total = widget.items.length;

fs.writeFileSync(treeFile, JSON.stringify(tree));
fs.writeFileSync(widgetFile, JSON.stringify(widget));
console.log("Added all " + definitions.length + " configured categories to the generated Allure data.");
