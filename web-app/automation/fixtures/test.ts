import fs from "node:fs/promises";
import path from "node:path";
import { test as base, request, type APIRequestContext, type Page } from "@playwright/test";
import { env } from "../config/env";
import { AppPage } from "../pages/app.page";

type Session = { accessToken: string; cookies: Awaited<ReturnType<APIRequestContext["storageState"]>>["cookies"]; organizationId: string; workspaceId: string };
type Fixtures = { app: AppPage; api: APIRequestContext; authedPage: Page; realAuthedPage: Page; session: Session };
const browserErrors = new WeakMap<Page, string[]>();
const actions: Record<string, string> = {
  click: "Click",
  dblclick: "Double-click",
  fill: "Fill",
  clear: "Clear",
  check: "Check",
  uncheck: "Uncheck",
  setChecked: "Set checked state",
  selectOption: "Select option in",
  setInputFiles: "Attach file to",
  press: "Press key in",
  focus: "Focus",
  hover: "Hover over",
  tap: "Tap",
  dragTo: "Drag",
};

function locatorName(method: string, args: unknown[]) {
  const first = args[0];
  const detail = typeof first === "string" ? ` “${first.slice(0, 80)}”` : first instanceof RegExp ? ` ${first}` : "";
  if (method === "getByRole") {
    const options = args[1] as { name?: unknown } | undefined;
    const name = options?.name instanceof RegExp ? options.name.toString() : options?.name;
    return `${String(first)}${name ? ` “${String(name).slice(0, 60)}”` : ""}`;
  }
  if (method === "getByPlaceholder" || method === "getByLabel") return `field${detail}`;
  if (method === "getByText") return `text${detail}`;
  return `locator${detail}`;
}

function instrumentLocator<T extends { click: (...args: never[]) => unknown; waitFor: (...args: never[]) => unknown }>(locator: T, label: string): T {
  return new Proxy(locator, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      if (typeof property === "string" && actions[property]) {
        return (...args: unknown[]) => base.step(`${actions[property]} ${label}`.slice(0, 120), () => Reflect.apply(value, target, args));
      }
      return (...args: unknown[]) => {
        const result: unknown = Reflect.apply(value, target, args);
        if (result && typeof result === "object" && "click" in result && "waitFor" in result) {
          const options = args[1] as { name?: unknown } | undefined;
          const filter = args[0] as { hasText?: unknown } | undefined;
          let childLabel = label;
          if (property === "locator") childLabel = `${label} ${String(args[0] ?? "child")}`;
          else if (property === "filter" && filter?.hasText) childLabel = `${label} matching “${String(filter.hasText)}”`;
          else if (property === "getByRole") childLabel = `${label} ${String(args[0])}${options?.name ? ` “${String(options.name)}”` : ""}`;
          return instrumentLocator(result as T, childLabel.slice(0, 100));
        }
        return result;
      };
    },
  });
}

function instrumentPage(page: Page) {
  const target = page as unknown as Record<string, (...args: unknown[]) => unknown>;
  const locatorFactories = ["locator", "getByRole", "getByText", "getByLabel", "getByPlaceholder", "getByAltText", "getByTitle", "getByTestId"];
  for (const method of locatorFactories) {
    const original = target[method].bind(page);
    Object.defineProperty(page, method, { configurable: true, value: (...args: unknown[]) => instrumentLocator(original(...args) as never, locatorName(method, args)) });
  }
  for (const method of ["goto", "setViewportSize", "route"] as const) {
    const original = target[method].bind(page);
    Object.defineProperty(page, method, {
      configurable: true,
      value: (...args: unknown[]) => {
        const title = method === "goto" ? `Navigate to ${String(args[0])}` : method === "setViewportSize" ? `Set viewport to ${JSON.stringify(args[0])}` : `Prepare browser route ${String(args[0]).slice(0, 80)}`;
        return base.step(title.slice(0, 120), () => Reflect.apply(original, page, args));
      },
    });
  }
  const keyboard = page.keyboard;
  Object.defineProperty(page, "keyboard", {
    configurable: true,
    value: new Proxy(keyboard, {
      get(target, property) {
        const value = Reflect.get(target, property, target);
        if (property === "press" && typeof value === "function") return (key: string, options?: unknown) => base.step(`Press ${key}`, () => Reflect.apply(value, target, [key, options]));
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  });
}

export const test = base.extend<Fixtures>({
  session: async ({}, use) => {
    const file = path.resolve(__dirname, "../.auth/session.json");
    let data: Session = { accessToken: "", cookies: [], organizationId: "", workspaceId: "" };
    try { data = JSON.parse(await fs.readFile(file, "utf8")) as Session; } catch { /* global setup normally writes this. */ }
    await use(data);
  },
  authedPage: async ({ page, session }, use) => {
    test.skip(!session.accessToken, "Set TEST_EMAIL and TEST_PASSWORD in automation/.env for workspace-screen coverage.");
    if (session.cookies.length) await page.context().addCookies(session.cookies);
    await page.addInitScript((token: string) => sessionStorage.setItem("flownexa-access-token", token), session.accessToken);
    instrumentPage(page);
    // UI cases use deterministic read fixtures; protected endpoint contracts continue to hit the live local API.
    // This keeps hundreds of parallel screen checks focused on the browser and avoids hammering the test database.
    await page.route("**/api/v1/**", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const url = new URL(route.request().url());
      const path = url.pathname;
      const projectId = "ui-test-project";
      const workspaceId = session.workspaceId || "ui-test-workspace";
      const organizationId = session.organizationId || "ui-test-organization";
      const project = { id: projectId, name: "QA Automation Project", status: "ACTIVE", targetDate: null, workspaceId, creator: { name: "Raja Haroon Jamal" }, _count: { tasks: 1 } };
      const task = { id: "ui-test-task", title: "Verify core workspace screens", status: "TODO", priority: "MEDIUM", dueAt: null, project: { id: projectId, name: project.name, workspaceId }, assignees: [{ user: { name: "Raja Haroon Jamal" } }] };
      let body: unknown = [];
      if (path.endsWith("/auth/me")) body = { id: "ui-test-user", name: "Raja Haroon Jamal", email: "qa@example.test", role: "OWNER", organizationName: "FlowNexa QA Automation" };
      else if (path.endsWith("/organizations")) body = [{ id: organizationId, name: "FlowNexa QA Automation", role: "OWNER", workspaces: [{ id: workspaceId, name: "Automation workspace" }] }];
      else if (path.endsWith("/projects")) body = [project];
      else if (path.endsWith("/tasks")) body = [task];
      else if (path.endsWith("/teams")) body = [{ id: "ui-test-team", name: "QA Automation", workspaceId, members: [{ user: { id: "ui-test-user", name: "Raja Haroon Jamal", email: "qa@example.test" } }] }];
      else if (path.endsWith("/members")) body = [{ id: "ui-test-user", name: "Raja Haroon Jamal", email: "qa@example.test", role: "OWNER", teams: ["QA Automation"] }];
      else if (path.endsWith("/roles")) body = { catalog: [], roles: [] };
      else if (path.endsWith("/reports/summary")) body = { total: 1, counts: { TODO: 1 }, overdue: 0, trackedMinutes: 0, completedThisWeek: 0, blocked: 0, awaitingReview: 0, upcoming: 0 };
      else if (path.endsWith("/search")) body = { tasks: [], projects: [], comments: [] };
      else if (path.endsWith("/time-entries/running")) body = null;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await use(page);
  },
  realAuthedPage: async ({ page, session }, use) => {
    test.skip(!session.accessToken, "Set TEST_EMAIL and TEST_PASSWORD for authenticated UI-to-database coverage.");
    if (session.cookies.length) await page.context().addCookies(session.cookies);
    await page.addInitScript((token: string) => sessionStorage.setItem("flownexa-access-token", token), session.accessToken);
    instrumentPage(page);
    await use(page);
  },
  app: async ({ authedPage }, use) => { await use(new AppPage(authedPage)); },
  api: async ({}, use) => {
    const context = await request.newContext({ baseURL: env.apiBaseUrl, extraHTTPHeaders: { Accept: "application/json" } });
    await use(context);
    await context.dispose();
  },
});

// BEFORE / AFTER HOOKS: collect browser errors per test and attach a failure snapshot to Allure.
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultTimeout(6_000);
  page.setDefaultNavigationTimeout(15_000);
});
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  if (!page.isClosed()) {
    const screenshot = await page.screenshot({ fullPage: true }).catch(() => undefined);
    if (screenshot) await testInfo.attach("failure-screen", { body: screenshot, contentType: "image/png" });
  }
  const errors = browserErrors.get(page) ?? [];
  if (errors.length) await testInfo.attach("browser-errors", { body: errors.join("\n"), contentType: "text/plain" });
});

export { expect } from "@playwright/test";
