import { test, expect } from "../../fixtures/db-test";
import { prisma } from "../../database/clients/dbClient";
import { attachDatabaseEvidence } from "../../database/helpers/evidence";

type Check = { id: string; name: string; sql: string; expected?: number };

const tableChecks: Check[] = [
  ["DB-004", "users"], ["DB-005", "sessions"], ["DB-006", "authentication tokens"],
  ["DB-007", "organizations"], ["DB-008", "organization memberships"], ["DB-009", "workspace notes"],
  ["DB-010", "organization invitations"], ["DB-011", "custom roles"], ["DB-012", "permissions"],
  ["DB-013", "role permissions"], ["DB-014", "workspaces"], ["DB-015", "teams"],
  ["DB-016", "team memberships"], ["DB-017", "projects"], ["DB-018", "tasks"],
  ["DB-019", "task assignees"], ["DB-020", "task dependencies"], ["DB-021", "work updates"],
  ["DB-022", "evidence records"], ["DB-023", "comments"], ["DB-024", "time entries"],
  ["DB-025", "reviews"], ["DB-026", "audit logs"], ["DB-027", "notifications"],
  ["DB-028", "device tokens"],
].map(([id, name]) => ({ id, name, sql: `SELECT count(*)::int AS count FROM "${String(name).replaceAll(" ", "")}"` }));

// Prisma model names differ from a few human-readable case labels above.
const tableNames = [
  "User", "Session", "AuthToken", "Organization", "OrganizationMember", "WorkspaceNote",
  "OrganizationInvitation", "CustomRole", "Permission", "RolePermission", "Workspace", "Team",
  "TeamMember", "Project", "Task", "TaskAssignee", "TaskDependency", "WorkUpdate", "Evidence",
  "Comment", "TimeEntry", "Review", "AuditLog", "Notification", "DeviceToken",
];
tableChecks.forEach((check, index) => { check.sql = `SELECT count(*)::int AS count FROM "${tableNames[index]}"`; });

const checks: Check[] = [
  ...tableChecks,
  {
    id: "DB-029", name: "primary key constraints exist for all 25 Prisma models",
    sql: `SELECT count(*)::int AS count FROM information_schema.table_constraints WHERE constraint_schema = current_schema() AND constraint_type = 'PRIMARY KEY' AND table_name IN (${tableNames.map((name) => `'${name}'`).join(",")})`, expected: 25,
  },
  {
    id: "DB-030", name: "core organization and task relationships contain no orphan rows",
    sql: `SELECT (
      (SELECT count(*) FROM "OrganizationMember" m LEFT JOIN "Organization" o ON o.id=m."organizationId" LEFT JOIN "User" u ON u.id=m."userId" WHERE o.id IS NULL OR u.id IS NULL) +
      (SELECT count(*) FROM "Workspace" w LEFT JOIN "Organization" o ON o.id=w."organizationId" WHERE o.id IS NULL) +
      (SELECT count(*) FROM "Project" p LEFT JOIN "Organization" o ON o.id=p."organizationId" LEFT JOIN "Workspace" w ON w.id=p."workspaceId" LEFT JOIN "User" u ON u.id=p."creatorId" WHERE o.id IS NULL OR w.id IS NULL OR u.id IS NULL) +
      (SELECT count(*) FROM "Task" t LEFT JOIN "Organization" o ON o.id=t."organizationId" LEFT JOIN "User" u ON u.id=t."creatorId" WHERE o.id IS NULL OR u.id IS NULL)
    )::int AS count`, expected: 0,
  },
];

test.describe("Database · model coverage and integrity", () => {
  for (const check of checks) {
    test(`${check.id} · ${check.name}`, async ({}, testInfo) => {
      const started = Date.now();
      const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(check.sql);
      const actual = Number(rows[0]?.count);
      expect(Number.isInteger(actual), `${check.id} returned a valid count`).toBeTruthy();
      if (check.expected !== undefined) expect(actual, check.name).toBe(check.expected);
      else expect(actual, `${check.name} query completed`).toBeGreaterThanOrEqual(0);
      await attachDatabaseEvidence(testInfo, {
        source: "database", check: check.id, status: "passed", durationMs: Date.now() - started,
        expected: check.expected ?? "table is queryable and row count is non-negative",
        actual, query: check.sql,
      });
    });
  }
});

test.afterAll(async () => { await prisma.$disconnect(); });
