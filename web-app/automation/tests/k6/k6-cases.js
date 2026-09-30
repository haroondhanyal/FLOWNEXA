import http from "k6/http";
import { check, sleep } from "k6";
import exec from "k6/execution";
import { Trend } from "k6/metrics";

const apiBase = (__ENV.API_BASE_URL || "http://localhost:4000/api/v1").replace(/\/$/, "");
const orgId = __ENV.TEST_ORGANIZATION_ID;
const token = __ENV.K6_ACCESS_TOKEN;

const routeGroups = [
  ["Identity", "/auth/me"],
  ["Organizations", "/organizations"],
  ["Projects", `/organizations/${orgId}/projects`],
  ["Tasks", `/organizations/${orgId}/tasks`],
  ["Teams", `/organizations/${orgId}/teams`],
  ["Members", `/organizations/${orgId}/members`],
  ["Reviews", `/organizations/${orgId}/reviews`],
  ["Audit history", `/organizations/${orgId}/audit-history`],
  ["Report summary", `/organizations/${orgId}/reports/summary`],
  ["Notifications", `/organizations/${orgId}/notifications`],
  ["Work updates", `/organizations/${orgId}/work-updates`],
  ["Roles", `/organizations/${orgId}/roles`],
  ["Invitations", `/organizations/${orgId}/invitations`],
];

export const cases = Array.from({ length: 120 }, (_, index) => {
  const [suite, path] = routeGroups[index % routeGroups.length];
  const caseId = `K6-${String(index + 1).padStart(3, "0")}`;
  return { caseId, suite, name: `${suite} · read scenario ${String(Math.floor(index / routeGroups.length) + 1).padStart(2, "0")}`, path };
});

const caseMetrics = new Map(cases.map(({ caseId }) => {
  const metricId = caseId.replace(/-/g, "_");
  return [caseId, {
    duration: new Trend(`case_duration_${metricId}`, true),
    status: new Trend(`case_http_status_${metricId}`),
    responseBytes: new Trend(`case_response_bytes_${metricId}`, true),
    virtualUser: new Trend(`case_virtual_user_${metricId}`),
  }];
}));

export const options = {
  scenarios: { api_cases: { executor: "shared-iterations", vus: 120, iterations: 120, maxDuration: "3m" } },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500"],
    checks: ["rate>0.95"],
  },
};

export default function () {
  if (!token || !orgId) throw new Error("Set K6_ACCESS_TOKEN and TEST_ORGANIZATION_ID for the dedicated test account.");
  const testCase = cases[exec.scenario.iterationInTest % cases.length];
  const started = Date.now();
  const response = http.get(`${apiBase}${testCase.path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "X-K6-Case": testCase.caseId },
    tags: { case_id: testCase.caseId, suite: testCase.suite, name: testCase.path },
  });
  const metrics = caseMetrics.get(testCase.caseId);
  metrics.duration.add(Date.now() - started);
  metrics.status.add(response.status);
  metrics.responseBytes.add(response.body?.length ?? 0);
  metrics.virtualUser.add(__VU);
  check(response, {
    [`${testCase.caseId} ${testCase.name}: returns a successful response`]: (res) => res.status >= 200 && res.status < 300,
    [`${testCase.caseId} ${testCase.name}: responds within 1.5 seconds`]: (res) => res.timings.duration < 1500,
  }, { case_id: testCase.caseId, suite: testCase.suite });
  sleep(0.05);
}

const metric = (summary, name) => summary.metrics[name]?.values || {};
const write = (value) => JSON.stringify(value, null, 2);

export function handleSummary(summary) {
  const caseResults = cases.map((testCase) => {
    const metricId = testCase.caseId.replace(/-/g, "_");
    const values = metric(summary, `case_duration_${metricId}`);
    return {
      ...testCase,
      method: "GET",
      avg: values.avg ?? null,
      p95: values["p(95)"] ?? null,
      max: values.max ?? null,
      count: values.count ?? 1,
      status: metric(summary, `case_http_status_${metricId}`).avg ?? null,
      responseBytes: metric(summary, `case_response_bytes_${metricId}`).avg ?? null,
      virtualUser: metric(summary, `case_virtual_user_${metricId}`).avg ?? null,
      contentType: "application/json",
    };
  });
  const totals = {
    apiBaseUrl: apiBase,
    cases: cases.length,
    iterations: metric(summary, "iterations").count ?? 0,
    requests: metric(summary, "http_reqs").count ?? 0,
    // `http_req_failed` is a Rate whose truthy samples are failures, so its
    // `passes` counter is the number of failed HTTP requests.
    failed: metric(summary, "http_req_failed").passes ?? 0,
    passRate: metric(summary, "checks").rate ?? 0,
    avg: metric(summary, "http_req_duration").avg ?? 0,
    p95: metric(summary, "http_req_duration")["p(95)"] ?? 0,
    max: metric(summary, "http_req_duration").max ?? 0,
    startedAt: summary.state?.testRunDurationMs ? new Date(Date.now() - summary.state.testRunDurationMs).toISOString() : new Date().toISOString(),
  };
  const combined = { ...totals, caseResults };
  return {
    "artifacts/k6/k6-summary.json": write(combined),
    "artifacts/k6/k6-raw-summary.json": write(summary),
  };
}
