import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
// DB-backed checks can reuse the app's local connection setting. Automation-specific values win.
if (!process.env.DATABASE_URL) dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// One source of truth for test URLs, credentials, and run behavior.
export const env = {
  webBaseUrl: process.env.WEB_BASE_URL ?? "http://localhost:3100",
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:4000/api/v1",
  email: process.env.TEST_EMAIL ?? "",
  password: process.env.TEST_PASSWORD ?? "",
  organizationId: process.env.TEST_ORGANIZATION_ID ?? "test-organization-id",
  workspaceId: process.env.TEST_WORKSPACE_ID ?? "",
  browser: process.env.PW_BROWSER ?? "chromium",
  headless: process.env.PW_HEADLESS !== "false",
  workers: Number(process.env.PW_WORKERS ?? 2),
  startWebServer: process.env.PW_START_WEB_SERVER === "true",
  databaseUrl: process.env.DATABASE_URL ?? "",
  databaseEnvironment: process.env.DB_ENVIRONMENT ?? "",
  enableDbMutations: process.env.DB_MUTATION_TESTS === "true",
};
