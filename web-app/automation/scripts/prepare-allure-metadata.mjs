import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = path.join(root, "allure-results");
await fs.mkdir(results, { recursive: true });
const featureGroups = [
  { match: /(^|\.)api\//, epic: "API Automation", feature: "API Contracts" },
  { match: /(^|\.)db\//, epic: "Database Automation", feature: "Database Health" },
  { match: /(^|\.)integration\//, epic: "Integration Automation", feature: "Cross-layer Persistence" },
  { match: /(^|\.)ui\//, epic: "UI Automation", feature: "Workspace UI" },
  { match: /(^|\.)bdd\//, epic: "Behavior Driven Testing", feature: "User Journeys" },
  { match: /(^|\.)smoke\//, epic: "Release Readiness", feature: "Smoke Coverage" },
  { match: /(^|\.)regression\//, epic: "Regression Testing", feature: "Workspace Regression" },
  { match: /(^|\.)negative\//, epic: "Resilience Testing", feature: "Validation and Negative Cases" },
];
const resultFiles = (await fs.readdir(results)).filter((name) => name.endsWith("-result.json"));
await Promise.all(resultFiles.map(async (name) => {
  const file = path.join(results, name);
  const result = JSON.parse(await fs.readFile(file, "utf8"));
  const labels = result.labels ?? (result.labels = []);
  const setLabel = (labelName, value) => {
    const label = labels.find((entry) => entry.name === labelName);
    if (label) label.value = value;
    else labels.push({ name: labelName, value });
  };
  setLabel("owner", "Raja Haroon Jamal");
  setLabel("team", "QA Department");
  const suitePath = labels.find((entry) => entry.name === "suite")?.value ?? "";
  const featureGroup = featureGroups.find((group) => group.match.test(suitePath));
  if (featureGroup) {
    setLabel("epic", featureGroup.epic);
    setLabel("feature", featureGroup.feature);
    setLabel("story", labels.find((entry) => entry.name === "subSuite")?.value ?? featureGroup.feature);
  }
  await fs.writeFile(file, JSON.stringify(result));
}));
const environment = [
  ["Project", "FlowNexa"],
  ["ProjectDescription", "Full stack collaborative workspace for projects, tasks, teams, reviews, notifications, and reporting."],
  ["Owner", "Raja Haroon Jamal"],
  ["Department", "QA Department"],
  ["Role", "Full Stack QA Automation"],
  ["Environment", process.env.GITHUB_ACTIONS === "true" ? "GitHub Actions · disposable PostgreSQL" : "Dedicated QA test environment"],
  ["Coverage", "Web UI, API contracts, user journeys, smoke, regression, negative cases, and database integration"],
];
await fs.writeFile(path.join(results, "environment.properties"), `${environment.map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
const timestamp = new Date();
const inGitHubActions = process.env.GITHUB_ACTIONS === "true";
const workflowUrl = process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : undefined;
await fs.writeFile(path.join(results, "executor.json"), JSON.stringify({
  name: inGitHubActions ? "GitHub Actions" : "FlowNexa Playwright",
  type: inGitHubActions ? "github" : "local",
  buildName: inGitHubActions && process.env.GITHUB_WORKFLOW
    ? `${process.env.GITHUB_WORKFLOW} #${process.env.GITHUB_RUN_NUMBER ?? process.env.GITHUB_RUN_ID}`
    : `FlowNexa QA · ${timestamp.toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`,
  buildOrder: Number(process.env.GITHUB_RUN_NUMBER) || Math.floor(timestamp.getTime() / 1000),
  buildUrl: workflowUrl,
  reportName: "FlowNexa Allure Report",
  reportUrl: "report-home.html",
}, null, 2));
