import { test, expect, request, type APIRequestContext } from "@playwright/test";
import { authProbes, protectedRoutes } from "../../data/api-routes";
import { env } from "../../config/env";

// API CONTRACT CASES (150): 15 protected endpoints × 10 invalid credential shapes.
test.describe("API authentication contracts @api", () => {
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await request.newContext({ baseURL: env.apiBaseUrl, extraHTTPHeaders: { Accept: "application/json" } }); });
  test.afterAll(async () => { await api.dispose(); });
  for (const route of protectedRoutes) {
    for (const probe of authProbes) {
      test(`${route.method} ${route.path} rejects ${probe.name}`, async ({}, testInfo) => {
        const path = route.path.replace(":org", env.organizationId) + ("query" in probe ? probe.query : "");
        // Resolve against an explicit trailing-slash base so /api/v1 is preserved for both custom URLs and defaults.
        const url = `${env.apiBaseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
        const response = await api.fetch(url, { method: route.method, headers: probe.headers, ...(route.method === "POST" || route.method === "PATCH" ? { data: route.body ?? {} } : {}) });
        const responseBody = await response.text().catch(() => "<response body unavailable>");
        const requestHeaders = Object.fromEntries(Object.entries(probe.headers).map(([name, value]) => [
          name,
          name.toLowerCase() === "authorization" ? `${value.split(" ")[0]} [redacted]` : name.toLowerCase() === "cookie" ? "[redacted]" : value,
        ]));
        const safeUrl = url.replace(/([?&]access_token=)[^&]*/i, "$1[redacted]");
        const safeResponseHeaders = response.headers();
        for (const name of Object.keys(safeResponseHeaders)) {
          if (name.toLowerCase() === "set-cookie" || name.toLowerCase() === "authorization") delete safeResponseHeaders[name];
        }
        await testInfo.attach("HTTP request and response", {
          contentType: "application/json",
          body: Buffer.from(JSON.stringify({
            request: {
              method: route.method,
              url: safeUrl,
              headers: { Accept: "application/json", ...requestHeaders },
              body: route.method === "POST" || route.method === "PATCH" ? route.body ?? {} : null,
            },
            response: {
              status: response.status(),
              statusText: response.statusText(),
              headers: safeResponseHeaders,
              body: responseBody.slice(0, 32_000),
              bodyTruncated: responseBody.length > 32_000,
            },
          }, null, 2)),
        });
        // A protected endpoint returns 401; 429 remains an explicit gateway throttling contract.
        expect([401, 429]).toContain(response.status());
      });
    }
  }
});
