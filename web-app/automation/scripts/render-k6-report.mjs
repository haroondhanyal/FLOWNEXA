import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = path.join(root, "artifacts", "k6");
const summary = JSON.parse(await fs.readFile(path.join(artifactDir, "k6-summary.json"), "utf8"));
const logo = await fs.readFile(path.resolve(root, "../public/flownexa-logo.svg"));
const logoUrl = `data:image/svg+xml;base64,${logo.toString("base64")}`;
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const ms = (value) => Number.isFinite(value) ? `${value.toFixed(1)} ms` : "—";
const cases = summary.caseResults ?? [];
const maxLatency = Math.max(1, ...cases.map((item) => item.p95 ?? 0));
const suites = [...new Set(cases.map((item) => item.suite))].map((suite) => {
  const items = cases.filter((item) => item.suite === suite);
  return { suite, count: items.length, avg: items.reduce((total, item) => total + (item.avg ?? 0), 0) / items.length };
});
const suiteBars = suites.map((item) => `<div class="suite-row"><span>${esc(item.suite)}</span><i><b style="width:${Math.max(1, (item.avg / maxLatency) * 100)}%"></b></i><strong>${ms(item.avg)}</strong></div>`).join("");
const latencyBars = cases.map((item) => `<div class="case-bar"><span>${esc(item.caseId)} · ${esc(item.suite)}</span><i><b class="${item.status >= 200 && item.status < 300 ? "pass" : "fail"}" style="width:${Math.max(1, ((item.p95 ?? 0) / maxLatency) * 100)}%"></b></i><strong>${ms(item.p95)}</strong></div>`).join("");
const rows = cases.map((item) => {
  const base = (summary.apiBaseUrl ?? "") + (item.path ?? "");
  const status = Number.isFinite(item.status) ? Math.round(item.status) : "—";
  const details = {
    case: item.caseId,
    suite: item.suite,
    scenario: item.name,
    virtualUser: item.virtualUser ?? "—",
    request: { method: item.method ?? "GET", url: base, headers: { Accept: "application/json", "X-K6-Case": item.caseId, Authorization: "Bearer [redacted]" }, body: null },
    response: { status, contentType: item.contentType ?? "unknown", bodyBytes: item.responseBytes ?? 0, duration: ms(item.avg), p95: ms(item.p95), max: ms(item.max) },
    checks: { httpSuccess: Number(status) >= 200 && Number(status) < 300, responseUnder1500ms: (item.max ?? Infinity) < 1500 },
    responseBody: "Response payload is not stored in k6 summary artifacts. Open the matching API case in Allure for its captured response body.",
  };
  return `<tr><td>${esc(item.caseId)}</td><td>${esc(item.suite)}</td><td>${esc(item.name)}</td><td>${status}</td><td>${ms(item.avg)}</td><td>${ms(item.p95)}</td><td><details><summary>Request / response</summary><pre>${esc(JSON.stringify(details, null, 2))}</pre></details></td></tr>`;
}).join("");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FlowNexa · Native k6 report</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e8efff;background:#091321}*{box-sizing:border-box}body{margin:0}a{color:#75e2c7}.top{display:flex;align-items:center;gap:28px;padding:18px 3%;min-height:112px;background:#172635;border-bottom:1px solid #314659}.brand{display:flex;align-items:center;gap:20px;margin:auto}.brand img{width:196px;height:72px;object-fit:contain}.brand h1{margin:0 0 4px;font-size:25px}.brand p{margin:4px 0;color:#9aacc1}.links{display:flex;gap:8px;white-space:nowrap}.links a{display:inline-block;padding:9px 12px;border:1px solid #435b74;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700}main{max-width:1540px;margin:auto;padding:26px 3%}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:13px;margin-bottom:20px}.card,.panel{background:#14253d;border:1px solid #2e4968;border-radius:14px;padding:20px}.card small{display:block;color:#acbdd3;font-size:11px;text-transform:uppercase;letter-spacing:.6px}.card strong{display:block;margin-top:10px;color:#31c8a8;font-size:28px}.panel{margin-bottom:20px}.panel h2{margin:0 0 5px;font-size:19px}.muted{color:#a9bad2;font-size:13px}.graph-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:18px}.suite-row,.case-bar{display:grid;grid-template-columns:150px minmax(100px,1fr) 90px;align-items:center;gap:12px;margin:8px 0;font-size:12px}.case-bar{grid-template-columns:190px minmax(120px,1fr) 82px}.suite-row>i,.case-bar>i{height:12px;background:#253a59;border-radius:8px;overflow:hidden}.suite-row>i>b,.case-bar>i>b{display:block;height:100%;border-radius:8px;background:linear-gradient(90deg,#1eb89d,#6395ed)}.case-bar>i>b.fail{background:#fb7185}table{width:100%;border-collapse:collapse;min-width:1000px}th,td{text-align:left;vertical-align:top;padding:11px;border-bottom:1px solid #2c4058}th{position:sticky;top:0;background:#14253d;color:#b8c9dd;font-size:11px;text-transform:uppercase;letter-spacing:.6px}td{font-size:12px}.table-wrap{overflow:auto}details summary{cursor:pointer;color:#7ce0c6;font-weight:700}pre{max-width:650px;max-height:480px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;color:#d4e0f0;background:#0b1728;border:1px solid #304865;border-radius:8px;padding:12px;font-size:11px}.foot{color:#95a9c0;font-size:12px}@media(max-width:800px){.top{align-items:flex-start;flex-wrap:wrap}.brand{order:-1;margin:0;width:100%}.brand img{width:150px;height:60px}.links{flex-wrap:wrap}.graph-grid{grid-template-columns:1fr}.suite-row{grid-template-columns:115px 1fr 75px}.case-bar{grid-template-columns:130px 1fr 70px}}
</style></head><body>
<header class="top"><nav class="links"><a href="report-home.html">← Report home</a><a href="performance-report.html">Performance report</a><a href="index.html">Combined Allure ↗</a></nav><div class="brand"><img src="${logoUrl}" alt="FlowNexa logo"><div><h1>FlowNexa · Native k6 performance</h1><p>120 read-only workloads · ${esc(summary.startedAt ?? "")}</p></div></div></header>
<main><section class="cards"><article class="card"><small>Workload cases</small><strong>${summary.cases}</strong></article><article class="card"><small>Requests</small><strong>${summary.requests}</strong></article><article class="card"><small>Failed requests</small><strong>${summary.failed}</strong></article><article class="card"><small>Check pass rate</small><strong>${((summary.passRate ?? 0) * 100).toFixed(1)}%</strong></article><article class="card"><small>Average latency</small><strong>${ms(summary.avg)}</strong></article><article class="card"><small>Overall P95</small><strong>${ms(summary.p95)}</strong></article><article class="card"><small>Max latency</small><strong>${ms(summary.max)}</strong></article></section>
<section class="panel"><h2>Latency by endpoint group</h2><p class="muted">Mean response time per API group; bars are scaled to the slowest individual case.</p>${suiteBars}</section>
<section class="panel"><h2>Latency by workload · all ${cases.length} cases</h2><p class="muted">Each bar opens to a named workload row in the detail table below. Green bars passed HTTP status checks.</p><div class="graph-grid">${latencyBars}</div></section>
<section class="panel table-wrap"><h2>Case-by-case request and response detail</h2><p class="muted">Expand any row to inspect method, URL, safe request headers, virtual user, response status, content type, response size, latency and check results.</p><table><thead><tr><th>Case</th><th>Suite</th><th>Scenario</th><th>Status</th><th>Average</th><th>P95</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table></section><p class="foot">Authentication values are redacted in the report. k6 summary files do not retain response payloads; captured API response bodies are available on the matching Allure API test case.</p></main></body></html>`;
await fs.writeFile(path.join(artifactDir, "native-k6-report.html"), html);
