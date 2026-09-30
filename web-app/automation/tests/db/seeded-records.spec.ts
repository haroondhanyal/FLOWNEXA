import fs from "node:fs/promises";
import path from "node:path";
import { test, expect } from "../../fixtures/db-test";
import { prisma } from "../../database/clients/dbClient";
import { attachDatabaseEvidence } from "../../database/helpers/evidence";

test("DB-003 · 40 Faker-generated test records persisted", async ({}, testInfo) => {
  let seed: { markerPrefix: string; requestedCount: number; insertedCount: number } | undefined;
  try { seed = JSON.parse(await fs.readFile(path.resolve(__dirname, "../../artifacts/db/faker-seed.json"), "utf8")); } catch { /* Full general suite may run before optional DB seeding. */ }
  test.skip(!seed, "Run npm run seed:db:40 before the final DB verification.");
  expect(seed!.requestedCount).toBe(40);
  const actual = await prisma.task.count({ where: { title: { startsWith: seed!.markerPrefix } } });
  expect(actual).toBe(40);
  await attachDatabaseEvidence(testInfo, { source: "database", check: "faker-seed-record-count", status: "passed", expectedCount: 40, insertedCount: seed!.insertedCount, persistedCount: actual, markerPrefix: seed!.markerPrefix });
});
