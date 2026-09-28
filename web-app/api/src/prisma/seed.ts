import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const permissions = [
  ["task.create", "Create tasks"], ["task.update", "Update tasks"], ["task.delete", "Delete tasks"],
  ["task.assign", "Assign tasks"], ["task.review", "Review submitted work"], ["project.create", "Create projects"],
  ["project.manage", "Manage projects"], ["user.invite", "Invite organization members"], ["report.view", "View reports"],
  ["evidence.view", "View task evidence"], ["evidence.manage", "Manage task evidence"], ["audit.view", "View audit history"],
];
async function main() {
  for (const [key, description] of permissions) await prisma.permission.upsert({ where: { key }, create: { key, description }, update: { description } });
  console.log(`Seeded ${permissions.length} permission definitions. No users or demo work data were created.`);
}
main().finally(async () => prisma.$disconnect());
