import fs from "node:fs/promises";
import path from "node:path";
import { request } from "@playwright/test";
import { env } from "../config/env";

// AUTH SETUP: log in once and keep the short-lived token out of Git.
export default async function globalSetup() {
  const authDir = path.resolve(__dirname, "../.auth");
  const sessionFile = path.join(authDir, "session.json");
  const resultsDir = path.resolve(__dirname, "../allure-results");
  const oldHistory = path.resolve(__dirname, "../allure-report/history");
  const preserveResults = process.env.PW_PRESERVE_ALLURE_RESULTS === "true";
  await fs.mkdir(authDir, { recursive: true });
  // TREND HISTORY: clear stale result files but carry the last report's Allure history into this run.
  if (!preserveResults) await fs.rm(resultsDir, { recursive: true, force: true });
  await fs.mkdir(resultsDir, { recursive: true });
  if (!preserveResults) try { await fs.cp(oldHistory, path.join(resultsDir, "history"), { recursive: true }); } catch { /* First report starts a new trend. */ }
  await fs.writeFile(sessionFile, JSON.stringify({ accessToken: "", cookies: [], organizationId: env.organizationId, workspaceId: env.workspaceId }), { mode: 0o600 });
  await fs.chmod(sessionFile, 0o600);
  if (!env.email || !env.password) {
    console.warn("FlowNexa: TEST_EMAIL/TEST_PASSWORD missing. Authenticated UI tests will be skipped; public login and API security tests can still run.");
    return;
  }
  const api = await request.newContext({ baseURL: `${env.apiBaseUrl.replace(/\/+$/, "")}/` });
  try {
    let response = await api.post("auth/login", { data: { email: env.email, password: env.password } });
    let session = response.ok() ? await response.json() as { accessToken?: string } : undefined;
    // LOCAL TEST STACK ONLY: when its disposable database is empty, provision the configured test identity.
    // Never attempt account creation against a remote API or when login failed for a reason other than 401.
    const localApi = ["localhost", "127.0.0.1", "::1"].includes(new URL(env.apiBaseUrl).hostname);
    if (response.status() === 401 && localApi) {
      const registration = await api.post("auth/register", { data: { name: "Raja Haroon Jamal", email: env.email, password: env.password } });
      if (!registration.ok()) throw new Error(`Local test account is missing and could not be provisioned (${registration.status()}). Check the dedicated test credentials.`);
      session = await registration.json() as { accessToken?: string };
      if (!session.accessToken) {
        response = await api.post("auth/login", { data: { email: env.email, password: env.password } });
        if (response.ok()) session = await response.json() as { accessToken?: string };
      }
    }
    if (!response.ok() && !session?.accessToken) throw new Error(`Test login failed (${response.status()}). Check the dedicated test account in automation/.env.`);
    const accessToken = session?.accessToken;
    if (!accessToken) throw new Error("Test login returned no access token.");
    let organizationId = env.organizationId;
    let workspaceId = env.workspaceId;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const organizations = await api.get("organizations", { headers });
    if (!organizations.ok()) throw new Error(`Could not load test organizations (${organizations.status()}).`);
    let list = await organizations.json() as { id: string; workspaces?: { id: string }[] }[];
    if (!list.length) {
      if (!localApi) throw new Error("The configured test account has no organization. Set TEST_ORGANIZATION_ID for an existing test workspace.");
      const bootstrap = await api.post("organizations/bootstrap", { headers, data: { name: "FlowNexa QA Automation", workspaceName: "Automation workspace", teamName: "QA Automation", projectName: "UI and API coverage", firstTask: "Review the automation run" } });
      if (!bootstrap.ok()) throw new Error(`Could not initialize the local automation workspace (${bootstrap.status()}).`);
      const created = await bootstrap.json() as { organization: { id: string }; workspace: { id: string } };
      list = [{ id: created.organization.id, workspaces: [{ id: created.workspace.id }] }];
    }
    const organization = list.find((item) => item.id === organizationId) ?? list[0];
    organizationId = organization.id;
    workspaceId = organization.workspaces?.some((item) => item.id === workspaceId)
      ? workspaceId
      : organization.workspaces?.[0]?.id ?? "";
    if (!workspaceId) throw new Error(`No workspace is available in test organization ${organizationId}.`);
    const state = await api.storageState();
    await fs.writeFile(sessionFile, JSON.stringify({ accessToken, cookies: state.cookies, organizationId, workspaceId }), { mode: 0o600 });
    await fs.chmod(sessionFile, 0o600);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|EPERM/i.test(message)) {
      console.warn("FlowNexa: API is unreachable; authenticated tests will skip or report their own connection failures.");
      return;
    }
    throw error;
  } finally { await api.dispose(); }
}
