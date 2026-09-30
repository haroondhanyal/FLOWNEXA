import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resultsDir = path.join(root, "allure-results");
const outputDir = path.join(root, "db-report");
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const safeText = (v) => String(v ?? "")
  .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[DATABASE_URL]")
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
  .replace(/(password|token|secret|authorization)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
  .slice(0, 4000);
let resultFiles = [];
try { resultFiles = (await fs.readdir(resultsDir)).filter((name) => name.endsWith("-result.json")); } catch { /* No run has written Allure results yet. */ }
const records = [];
for (const name of resultFiles) {
  let result;
  try { result = JSON.parse(await fs.readFile(path.join(resultsDir, name), "utf8")); } catch { continue; }
  const title = result.name ?? result.fullName ?? name;
  const labels = result.labels ?? [];
  const grouping = labels.filter((label) => ["suite", "subSuite", "epic", "feature"].includes(label.name)).map((label) => label.value).join(" ");
  if (!/\b(DB-|INT-DB-|Database Automation|Integration Automation|Database ·)/i.test(`${title} ${grouping}`)) continue;
  const evidence = [];
  const attachments = [...(result.attachments ?? [])];
  const collectStepAttachments = (steps = []) => steps.forEach((step) => { attachments.push(...(step.attachments ?? [])); collectStepAttachments(step.steps); });
  collectStepAttachments(result.steps);
  const seenAttachments = new Set();
  for (const attachment of attachments) {
    if (!/database-validation/i.test(attachment.name ?? "")) continue;
    if (seenAttachments.has(attachment.source)) continue;
    seenAttachments.add(attachment.source);
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(resultsDir, attachment.source), "utf8"));
      if (!evidence.some((entry) => entry.check === parsed.check && entry.source === parsed.source)) evidence.push(parsed);
    } catch { evidence.push({ error: "Evidence attachment unavailable." }); }
  }
  records.push({ title: safeText(title), status: result.status ?? "unknown", duration: Math.max(0, (result.stop ?? 0) - (result.start ?? 0)), grouping: safeText(grouping), evidence, error: safeText(result.statusDetails?.message ?? "") });
}
let seed = null;
try { seed = JSON.parse(await fs.readFile(path.join(root, "artifacts", "db", "faker-seed.json"), "utf8")); } catch { /* Faker seed is optional until the explicit seed command is run. */ }
const counts = Object.fromEntries(["passed", "failed", "broken", "skipped", "unknown"].map((status) => [status, records.filter((record) => record.status === status).length]));
const total = records.length;
const passed = counts.passed;
const passRate = total ? Math.round((passed / total) * 100) : 0;
const sources = ["database", "api-to-database", "web-to-database"].map((source) => ({ source, count: records.reduce((sum, item) => sum + item.evidence.filter((entry) => entry.source === source).length, 0) }));
const rows = records.map((record, index) => {
  const evidence = record.evidence.length ? JSON.stringify(record.evidence, null, 2) : record.error || "No structured evidence was attached.";
  return `<tr><td>${index + 1}</td><td><button class="case" data-detail="detail-${index}">${esc(record.title)}</button><small>${esc(record.grouping)}</small></td><td><span class="badge ${esc(record.status)}">${esc(record.status)}</span></td><td>${(record.duration / 1000).toFixed(2)} s</td><td><button class="view" data-detail="detail-${index}">View details</button></td></tr><tr class="detail-row" id="detail-${index}" hidden><td colspan="5"><pre>${esc(evidence)}</pre></td></tr>`;
}).join("");
const generated = new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FlowNexa · Database Automation Report</title><style>
:root{color-scheme:light;--ink:#15283c;--muted:#62778b;--line:#dbe5ec;--panel:#fff;--bg:#f2f6f8;--brand:#087f65}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}.top{background:#fff;border-bottom:1px solid var(--line);padding:26px max(24px,calc((100vw - 1440px)/2));display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:14px}.logo{width:48px;height:48px;border-radius:15px;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:800;font-size:21px}.top h1{font-size:22px;line-height:1.1;margin:0}.top p{margin:5px 0 0;color:var(--muted)}main{max-width:1440px;margin:28px auto;padding:0 24px}.intro{margin-bottom:20px}.intro h2{font-size:28px;margin:0 0 5px}.intro p{margin:0;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;margin:20px 0}.card,.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 5px 18px #15324b0a}.card{padding:18px}.card span{display:block;color:var(--muted);font-size:13px}.card strong{font-size:30px}.panel{overflow:hidden;margin:18px 0}.panel h3{margin:0;padding:17px 20px;border-bottom:1px solid var(--line);font-size:18px}.sources{display:flex;gap:12px;padding:14px 20px;flex-wrap:wrap}.source{padding:8px 12px;background:#f2f7f8;border-radius:8px;color:var(--muted)}.source b{color:var(--ink);margin-left:7px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);background:#f8fafb}.case,.view{font:inherit;color:#086fbb;border:0;background:none;padding:0;cursor:pointer;text-align:left}.case{font-weight:650}.case:hover,.view:hover{text-decoration:underline}td small{display:block;color:var(--muted);margin-top:3px}.badge{display:inline-block;padding:3px 10px;border-radius:30px;text-transform:capitalize;font-size:12px;background:#eaf0f4;color:#526477}.badge.passed{background:#d9f4e8;color:#147548}.badge.failed,.badge.broken{background:#fee3e3;color:#b72c35}.badge.skipped{background:#fff1cd;color:#8d6800}.detail-row td{background:#f8fafb}.detail-row pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 ui-monospace,SFMono-Regular,monospace;color:#25394d}.empty{padding:24px;color:var(--muted)}footer{padding:22px;color:var(--muted);text-align:center;font-size:13px}@media(max-width:850px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.top{padding:18px 20px}}@media(max-width:560px){main{padding:0 12px}.grid{grid-template-columns:1fr 1fr;gap:8px}.card{padding:12px}.top h1{font-size:18px}th,td{padding:9px 8px;font-size:12px}}
${seed ? `.seed{border:1px solid #9edbc2;background:#edfbf4;border-radius:12px;padding:16px 20px;margin:18px 0}.seed strong{font-size:20px}.seed span{color:var(--muted)}` : ""}
</style></head><body><header class="top"><div class="brand"><div class="logo">F</div><div><h1>FlowNexa Database Automation</h1><p>Web, API and PostgreSQL persistence validation</p></div></div><div>Generated ${esc(generated)}</div></header><main><section class="intro"><h2>Database test report</h2><p>Run statistics and expandable per-case evidence for the configured non-production environment.</p></section><div class="grid"><div class="card"><span>Total database checks</span><strong>${total}</strong></div><div class="card"><span>Passed</span><strong>${passed}</strong></div><div class="card"><span>Failed / broken</span><strong>${counts.failed + counts.broken}</strong></div><div class="card"><span>Pass rate</span><strong>${passRate}%</strong></div></div>${seed ? `<section class="seed"><span>Faker seed · ${esc(seed.runId)}</span><br><strong>${Number(seed.persistedCount) || 0} / ${Number(seed.requestedCount) || 0} records persisted</strong></section>` : ""}<section class="panel"><h3>Coverage sources</h3><div class="sources">${sources.map((item) => `<div class="source">${esc(item.source.replaceAll("-", " → "))}<b>${item.count}</b></div>`).join("")}<div class="source">Skipped<b>${counts.skipped}</b></div></div></section><section class="panel"><h3>Database, API and web integration cases</h3>${records.length ? `<table><thead><tr><th>#</th><th>Test case</th><th>Status</th><th>Duration</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty">No DB or cross-layer test results yet. Run <code>npm run test:db</code> or <code>npm run test:integration</code> to populate this report.</div>`}</section></main><footer>FlowNexa · QA Department · Raja Haroon Jamal</footer><script>document.querySelectorAll('[data-detail]').forEach(button=>button.addEventListener('click',()=>{const row=document.getElementById(button.dataset.detail);row.hidden=!row.hidden}));</script></body></html>`;
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "index.html"), html);
await fs.writeFile(path.join(outputDir, "db-results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), counts, passRate, sources, seed, records }, null, 2));
console.log(`Database report: ${path.join(outputDir, "index.html")} (${records.length} DB/integration cases)`);
