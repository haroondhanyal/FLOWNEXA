import { randomUUID } from "node:crypto";
import { test, expect } from "../../../fixtures/test";
import { env } from "../../../config/env";
import { AppPage } from "../../../pages/app.page";
import { assertNonProductionDatabase, prisma, safeError } from "../../../database/clients/dbClient";
import { removeGeneratedTask } from "../../../database/helpers/dbCleanup";
import { attachDatabaseEvidence } from "../../../database/helpers/evidence";

test("INT-DB-WEB-001 · workspace task form persists a task to PostgreSQL", async ({ realAuthedPage, session }, testInfo) => {
  test.skip(!env.enableDbMutations, "Set DB_MUTATION_TESTS=true to enable isolated web-to-database mutation checks.");
  test.skip(!env.databaseUrl || !session.organizationId, "Database URL and authenticated test organization are required.");
  assertNonProductionDatabase();
  const marker = `FNQA_DB_${randomUUID()}`;
  let taskId = "";
  const started = Date.now();
  const realApp = new AppPage(realAuthedPage);
  try {
    await realApp.open();
    const createdResponse = realAuthedPage.waitForResponse((response) => response.request().method() === "POST" && /\/api\/v1\/organizations\/[^/]+\/tasks(?:\?|$)/.test(response.url()));
    await realApp.createTask(marker);
    const response = await createdResponse;
    expect(response.ok(), `Task form API returned ${response.status()}`).toBeTruthy();
    const payload = await response.json() as { id: string };
    taskId = payload.id;
    const row = await prisma.task.findFirst({ where: { id: taskId, title: marker, organizationId: session.organizationId }, select: { id: true, title: true, status: true, priority: true, projectId: true } });
    expect(row).toMatchObject({ id: taskId, title: marker, status: "TODO" });
    await attachDatabaseEvidence(testInfo, { source: "web-to-database", check: "workspace-task-form-persistence", status: "passed", durationMs: Date.now() - started, expected: { title: marker, defaultStatus: "TODO" }, actual: row, entityId: taskId, database: "PostgreSQL · Prisma Task" });
  } catch (error) {
    await attachDatabaseEvidence(testInfo, { source: "web-to-database", check: "workspace-task-form-persistence", status: "failed", durationMs: Date.now() - started, error: safeError(error), entityId: taskId || undefined });
    throw error;
  } finally {
    if (taskId) await removeGeneratedTask(taskId, marker);
  }
});
