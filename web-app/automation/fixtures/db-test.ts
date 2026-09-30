import fs from "node:fs/promises";
import path from "node:path";
import { test as base, expect, request, type APIRequestContext } from "@playwright/test";
import { env } from "../config/env";

type DbSession = { accessToken: string; organizationId: string; workspaceId: string };
type DbFixtures = { session: DbSession; api: APIRequestContext };

/** Backend-only tests share Allure/Playwright but avoid starting a browser process. */
export const test = base.extend<DbFixtures>({
  session: async ({}, use) => {
    let session: DbSession = { accessToken: "", organizationId: "", workspaceId: "" };
    try { session = JSON.parse(await fs.readFile(path.resolve(__dirname, "../.auth/session.json"), "utf8")) as DbSession; } catch { /* Auth may be unavailable when only testing DB health. */ }
    await use(session);
  },
  api: async ({}, use) => {
    const context = await request.newContext({ baseURL: env.apiBaseUrl, extraHTTPHeaders: { Accept: "application/json" } });
    await use(context);
    await context.dispose();
  },
});
export { expect };
