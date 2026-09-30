import { randomUUID } from "node:crypto";
import { test, expect } from "../../../fixtures/db-test";
import { env } from "../../../config/env";
import { assertNonProductionDatabase, prisma, safeError } from "../../../database/clients/dbClient";
import { removeGeneratedTask } from "../../../database/helpers/dbCleanup";
import { attachDatabaseEvidence } from "../../../database/helpers/evidence";

test("INT-DB-API-001 · task create/update API writes task and audit rows", async ({ api, session }, testInfo) => {
  test.skip(!env.enableDbMutations, "Set DB_MUTATION_TESTS=true to enable isolated API-to-database mutation checks.");
  test.skip(!env.databaseUrl || !session.accessToken || !session.organizationId, "Database URL and authenticated test organization are required.");
  assertNonProductionDatabase();
  const project = await prisma.project.findFirst({ where: { organizationId: session.organizationId }, select: { id: true } });
  test.skip(!project, "The configured test organization needs one existing project for task API coverage.");

  const marker = `FNQA_DB_${randomUUID()}`;
  let taskId = "";
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const tasksUrl = `${env.apiBaseUrl.replace(/\/+$/, "")}/organizations/${session.organizationId}/tasks`;
  const started = Date.now();
  try {
    const created = await api.post(tasksUrl, { headers, data: { projectId: project!.id, title: marker, description: "Disposable database integration test record.", priority: "HIGH" } });
    expect(created.status(), `Task create endpoint returned ${created.status()}`).toBe(201);
    const response = await created.json() as { id: string; title: string; priority: string };
    taskId = response.id;
    expect(response.title).toBe(marker);
    const task = await prisma.task.findFirst({ where: { id: taskId, title: marker, organizationId: session.organizationId }, select: { id: true, title: true, status: true, priority: true, projectId: true } });
    expect(task).toMatchObject({ id: taskId, title: marker, status: "TODO", priority: "HIGH", projectId: project!.id });
    const creationAudit = await prisma.auditLog.findFirst({ where: { taskId, action: "TASK_CREATED" }, select: { id: true, action: true, details: true } });
    expect(creationAudit?.action).toBe("TASK_CREATED");

    const updated = await api.patch(`${tasksUrl}/${taskId}`, { headers, data: { status: "IN_PROGRESS", progress: 25 } });
    expect(updated.ok(), `Task update endpoint returned ${updated.status()}`).toBeTruthy();
    const updatedRow = await prisma.task.findUnique({ where: { id: taskId }, select: { status: true, progress: true } });
    expect(updatedRow).toEqual({ status: "IN_PROGRESS", progress: 25 });
    const updateAudit = await prisma.auditLog.findFirst({ where: { taskId, action: "TASK_UPDATED" }, select: { id: true, action: true } });
    expect(updateAudit?.action).toBe("TASK_UPDATED");
    await attachDatabaseEvidence(testInfo, { source: "api-to-database", check: "task-create-update-and-audit", status: "passed", durationMs: Date.now() - started, http: { createStatus: created.status(), updateStatus: updated.status() }, expected: { createdStatus: "TODO", priority: "HIGH", updatedStatus: "IN_PROGRESS", progress: 25, auditActions: ["TASK_CREATED", "TASK_UPDATED"] }, actual: { task, updated: updatedRow, auditActions: [creationAudit?.action, updateAudit?.action] }, database: "PostgreSQL · Prisma models" });
  } catch (error) {
    await attachDatabaseEvidence(testInfo, { source: "api-to-database", check: "task-create-update-and-audit", status: "failed", durationMs: Date.now() - started, error: safeError(error), entityId: taskId || undefined });
    throw error;
  } finally {
    if (taskId) await removeGeneratedTask(taskId, marker);
  }
});
