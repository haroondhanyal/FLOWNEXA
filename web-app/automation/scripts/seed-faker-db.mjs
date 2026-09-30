import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { faker } from "@faker-js/faker";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });
if (!process.env.DATABASE_URL) dotenv.config({ path: path.resolve(root, "../.env") });
const require = createRequire(import.meta.url);
const { PrismaClient } = require("../../api/node_modules/.prisma/client");
const prisma = new PrismaClient();
const count = 40;
const runId = faker.string.uuid().slice(0, 8).toUpperCase();
const markerPrefix = `FNQA_FAKER_40_${runId}_`;

function verifySafeTarget() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const url = new URL(process.env.DATABASE_URL);
  const environment = (process.env.DB_ENVIRONMENT ?? "").toLowerCase();
  if (/prod(uction)?/i.test(environment)) throw new Error("Refusing to seed a production environment.");
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname) && !["local", "dev", "development", "test", "qa"].includes(environment)) {
    throw new Error("Faker seed only supports a local or explicitly labeled non-production database.");
  }
}

try {
  verifySafeTarget();
  const session = JSON.parse(await fs.readFile(path.join(root, ".auth", "session.json"), "utf8"));
  if (!session.organizationId) throw new Error("Run Playwright global setup first so a test organization is available.");
  const user = process.env.TEST_EMAIL
    ? await prisma.user.findUnique({ where: { email: process.env.TEST_EMAIL }, select: { id: true } })
    : null;
  if (!user) throw new Error("A configured test user is required to own the Faker tasks.");
  const membership = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: session.organizationId, userId: user.id } }, select: { userId: true } });
  if (!membership) throw new Error("The configured test user is not a member of the test organization.");
  const project = await prisma.project.findFirst({ where: { organizationId: session.organizationId }, select: { id: true } });
  if (!project) throw new Error("The test organization needs an existing project for the generated task records.");

  faker.seed(Date.now());
  const statuses = ["BACKLOG", "TODO", "IN_PROGRESS", "READY_FOR_REVIEW", "COMPLETED"];
  const progressByStatus = { BACKLOG: 0, TODO: 0, IN_PROGRESS: 40, READY_FOR_REVIEW: 80, COMPLETED: 100 };
  const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
  const rows = Array.from({ length: count }, (_, index) => ({
    organizationId: session.organizationId,
    projectId: project.id,
    creatorId: user.id,
    title: `${markerPrefix}${String(index + 1).padStart(2, "0")} · ${faker.hacker.phrase().slice(0, 80)}`,
    description: `Generated QA fixture ${index + 1} of ${count}. ${faker.lorem.sentence()}`,
    status: statuses[index % statuses.length],
    priority: priorities[Math.floor(index / 5) % priorities.length],
    progress: progressByStatus[statuses[index % statuses.length]],
  }));
  const created = await prisma.task.createMany({ data: rows });
  const persisted = await prisma.task.count({ where: { organizationId: session.organizationId, title: { startsWith: markerPrefix } } });
  if (created.count !== count || persisted !== count) throw new Error(`Seed count mismatch: inserted ${created.count}, read back ${persisted}, expected ${count}.`);

  const statusCounts = Object.fromEntries(statuses.map((status) => [status, rows.filter((row) => row.status === status).length]));
  const priorityCounts = Object.fromEntries(priorities.map((priority) => [priority, rows.filter((row) => row.priority === priority).length]));
  const summary = { runId, markerPrefix, requestedCount: count, insertedCount: created.count, persistedCount: persisted, generatedAt: new Date().toISOString(), statusCounts, priorityCounts };
  const artifact = path.join(root, "artifacts", "db", "faker-seed.json");
  await fs.mkdir(path.dirname(artifact), { recursive: true });
  await fs.writeFile(artifact, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ result: "passed", ...summary }, null, 2));
} finally {
  await prisma.$disconnect();
}
