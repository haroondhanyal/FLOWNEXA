const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "config", "allure", "categories.json");
const results = path.join(root, "allure-results");
const destination = path.join(results, "categories.json");

JSON.parse(fs.readFileSync(source, "utf8"));
fs.mkdirSync(results, { recursive: true });
fs.copyFileSync(source, destination);
console.log(`Allure categories copied to ${path.relative(root, destination)}`);
