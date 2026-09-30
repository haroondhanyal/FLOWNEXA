import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactsRoot = path.join(root, ".ci-artifacts");
const jobs = [
  ["UI / BDD / smoke / regression / negative", "flownexa-ui-results", process.env.FLOWNEXA_UI_STATUS],
  ["API", "flownexa-api-results", process.env.FLOWNEXA_API_STATUS],
  ["Database / persistence", "flownexa-db-results", process.env.FLOWNEXA_DB_STATUS],
];
const countsFor = (results) => ({ total: results.length, passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0, duration: 0 });
const resultsByJob = new Map();
const allResults = [];

async function readResults(directory) {
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch { return []; }
  const result = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await readResults(fullPath));
    else if (entry.isFile() && entry.name.endsWith("-result.json")) {
      try { result.push(JSON.parse(await fs.readFile(fullPath, "utf8"))); }
      catch { console.warn(`Ignoring malformed Allure result: ${fullPath}`); }
    }
  }
  return result;
}

for (const [label, artifact, workflowStatus] of jobs) {
  const directory = path.join(artifactsRoot, artifact);
  const results = await readResults(directory);
  resultsByJob.set(label, { workflowStatus: workflowStatus || "unknown", results, counts: countsFor(results) });
  allResults.push(...results);
}

const counts = countsFor(allResults);
for (const result of allResults) {
  const state = String(result.status ?? "unknown").toLowerCase();
  counts[counts[state] === undefined ? "unknown" : state] += 1;
  const start = Number(result.start);
  const stop = Number(result.stop);
  if (Number.isFinite(start) && Number.isFinite(stop) && stop >= start) counts.duration += stop - start;
}

for (const entry of resultsByJob.values()) {
  for (const result of entry.results) {
    const state = String(result.status ?? "unknown").toLowerCase();
    entry.counts[entry.counts[state] === undefined ? "unknown" : state] += 1;
    const start = Number(result.start);
    const stop = Number(result.stop);
    if (Number.isFinite(start) && Number.isFinite(stop) && stop >= start) entry.counts.duration += stop - start;
  }
}

const passRate = counts.total ? `${((counts.passed / counts.total) * 100).toFixed(1)}%` : "N/A";
const durationLabel = `${Math.floor(counts.duration / 60000)}m ${Math.floor((counts.duration % 60000) / 1000)}s summed test duration`;
const md = [
  "# FlowNexa Automation Summary",
  "",
  `- **Run:** [${process.env.FLOWNEXA_RUN_URL ?? "GitHub Actions run"}](${process.env.FLOWNEXA_RUN_URL ?? "#"})`,
  `- **Branch / commit:** \`${process.env.FLOWNEXA_BRANCH ?? "unknown"}\` / \`${String(process.env.FLOWNEXA_SHA ?? "").slice(0, 12) || "unknown"}\``,
  `- **Trigger / environment:** ${process.env.FLOWNEXA_EVENT ?? "unknown"} / GitHub Actions with disposable PostgreSQL and Redis`,
  `- **Setup check:** ${process.env.FLOWNEXA_SETUP_STATUS ?? "unknown"}`,
  `- **Results:** ${counts.total} · ${counts.passed} passed · ${counts.failed} failed · ${counts.broken} broken · ${counts.skipped} skipped · ${counts.unknown} unknown`,
  `- **Pass rate:** ${passRate} · **Duration:** ${durationLabel}`,
  "",
  "## Suite jobs",
  "",
  "| Suite | Workflow status | Result files | Passed | Failed | Broken | Skipped | Unknown |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
];
for (const [label, entry] of resultsByJob) {
  const c = entry.counts;
  md.push(`| ${label} | ${entry.workflowStatus} | ${c.total} | ${c.passed} | ${c.failed} | ${c.broken} | ${c.skipped} | ${c.unknown} |`);
}

const failed = allResults.filter((result) => ["failed", "broken", "unknown"].includes(String(result.status ?? "unknown").toLowerCase()));
md.push("", "## Failed, broken, or unknown cases", "");
if (!failed.length) md.push("No failed, broken, or unknown test result files were produced.");
else {
  md.push("| Status | Test | Details |", "| --- | --- | --- |");
  for (const result of failed.slice(0, 30)) {
    const name = String(result.fullName ?? result.name ?? "Unnamed test").replaceAll("|", "\\|").replaceAll("\n", " ");
    md.push(`| ${result.status ?? "unknown"} | ${name} | Open Allure for stack trace, hooks, and captured evidence. |`);
  }
  if (failed.length > 30) md.push("", `Showing 30 of ${failed.length} cases. Open the Allure report for the complete list and evidence.`);
}

md.push("", "## Artifacts", "", "Download **flownexa-allure-report** for the consolidated report, or the UI/API/DB result artifacts for raw Playwright traces, screenshots, videos, and job logs. Artifacts are retained for 14 days.");
const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) await fs.appendFile(summaryFile, `${md.join("\n")}\n`);
else console.log(md.join("\n"));
