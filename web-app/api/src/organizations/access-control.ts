import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const MEMBER_DEFAULTS = new Set(["task.create", "task.update", "task.assign", "project.create", "report.view", "evidence.view"]);

// PERMISSION CHECK: owners/admins keep administration access; custom member roles use their explicit grants.
export async function requireOrganizationPermission(prisma: Pick<PrismaService, "organizationMember">, userId: string, organizationId: string, permission: string) {
  const member = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } }, include: { customRole: { include: { permissions: { include: { permission: true } } } } } });
  if (!member) throw new NotFoundException("Organization not found");
  if (member.role === "OWNER" || member.role === "ADMIN") return member;
  const allowed = member.customRole ? member.customRole.permissions.some((item: { permission: { key: string } }) => item.permission.key === permission) : member.role === "MEMBER" && MEMBER_DEFAULTS.has(permission);
  if (!allowed) throw new ForbiddenException("You do not have permission to perform this action");
  return member;
}
