import { test, expect } from "../../fixtures/db-test";
import { prisma, safeError } from "../../database/clients/dbClient";
import { attachDatabaseEvidence } from "../../database/helpers/evidence";

test.describe("Database · read-only health", () => {
  test("DB-001 · connects to configured PostgreSQL database", async ({}, testInfo) => {
    test.skip(!process.env.DATABASE_URL, "Configure DATABASE_URL in automation/.env or web-app/.env.");
    const started = Date.now();
    try {
      const rows = await prisma.$queryRaw<Array<{ database: string; schema: string }>>`SELECT current_database() AS database, current_schema() AS schema`;
      expect(rows.length).toBe(1);
      expect(rows[0].database).toBeTruthy();
      await attachDatabaseEvidence(testInfo, { source: "database", check: "postgres-connectivity", status: "passed", durationMs: Date.now() - started, database: rows[0].database, schema: rows[0].schema, query: "SELECT current_database(), current_schema()" });
    } catch (error) {
      await attachDatabaseEvidence(testInfo, { source: "database", check: "postgres-connectivity", status: "failed", durationMs: Date.now() - started, error: safeError(error) });
      throw new Error(`PostgreSQL connectivity check failed: ${safeError(error)}`);
    }
  });

  test("DB-002 · application core tables and relations are queryable", async ({}, testInfo) => {
    test.skip(!process.env.DATABASE_URL, "Configure DATABASE_URL in automation/.env or web-app/.env.");
    const started = Date.now();
    try {
      const [users, organizations, workspaces, projects, tasks, comments, notifications, auditLogs] = await Promise.all([
        prisma.user.count(), prisma.organization.count(), prisma.workspace.count(), prisma.project.count(),
        prisma.task.count(), prisma.comment.count(), prisma.notification.count(), prisma.auditLog.count(),
      ]);
      const counts = { users, organizations, workspaces, projects, tasks, comments, notifications, auditLogs };
      expect(Object.keys(counts)).toHaveLength(8);
      await attachDatabaseEvidence(testInfo, { source: "database", check: "core-model-queryability", status: "passed", durationMs: Date.now() - started, counts, models: Object.keys(counts) });
    } catch (error) {
      await attachDatabaseEvidence(testInfo, { source: "database", check: "core-model-queryability", status: "failed", durationMs: Date.now() - started, error: safeError(error) });
      throw new Error(`Core database model check failed: ${safeError(error)}`);
    }
  });
});

test.afterAll(async () => { await prisma.$disconnect(); });
