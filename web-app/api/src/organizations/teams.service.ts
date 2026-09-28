import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { requireOrganizationPermission } from "./access-control";
const PERMISSION_CATALOG = [
  ["task.create", "Create tasks"], ["task.update", "Update tasks"], ["task.delete", "Delete tasks"], ["task.assign", "Assign tasks"], ["task.review", "Review submitted work"],
  ["project.create", "Create projects"], ["project.manage", "Manage projects"], ["team.manage", "Manage teams"], ["user.invite", "Invite organization members"], ["report.view", "View reports"], ["report.export", "Export reports"], ["evidence.view", "View task evidence"], ["evidence.manage", "Manage task evidence"], ["audit.view", "View audit history"],
];
@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}
  private async member(userId: string, organizationId: string) { const member = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } }); if (!member) throw new NotFoundException("Organization not found"); return member; }
  async list(userId: string, organizationId: string) { await this.member(userId, organizationId); return this.prisma.team.findMany({ where: { organizationId }, include: { members: { include: { user: { select: { id: true, email: true, name: true } } } }, _count: { select: { projects: true } } }, orderBy: { name: "asc" } }); }
  // DIRECTORY: return each organization member once, with their actual role and team names.
  async listMembers(userId: string, organizationId: string) {
    await this.member(userId, organizationId);
    const members = await this.prisma.organizationMember.findMany({ where: { organizationId }, include: { user: { select: { id: true, email: true, name: true } }, customRole: { select: { name: true } } }, orderBy: { user: { name: "asc" } } });
    const teams = await this.prisma.teamMember.findMany({ where: { team: { organizationId } }, include: { team: { select: { name: true } } } });
    return members.map((entry) => ({ id: entry.user.id, name: entry.user.name, email: entry.user.email, role: entry.customRole?.name ?? entry.role, customRoleId: entry.customRoleId, teams: teams.filter((item) => item.userId === entry.userId).map((item) => item.team.name) }));
  }
  // TEAM MEMBERSHIP: only organization members may join a team; org admins manage membership.
  async addMember(userId: string, organizationId: string, teamId: string, memberUserId: string) {
    await requireOrganizationPermission(this.prisma, userId, organizationId, "team.manage");
    const [team, target] = await Promise.all([this.prisma.team.findFirst({ where: { id: teamId, organizationId }, select: { id: true } }), this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: memberUserId } }, select: { userId: true } })]);
    if (!team || !target) throw new NotFoundException("Team or organization member not found");
    return this.prisma.teamMember.upsert({ where: { teamId_userId: { teamId, userId: memberUserId } }, create: { teamId, userId: memberUserId }, update: {} });
  }
  async removeMember(userId: string, organizationId: string, teamId: string, memberUserId: string) {
    await requireOrganizationPermission(this.prisma, userId, organizationId, "team.manage");
    const team = await this.prisma.team.findFirst({ where: { id: teamId, organizationId }, select: { id: true } }); if (!team) throw new NotFoundException("Team not found");
    const membership = await this.prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: memberUserId } } }); if (!membership) throw new NotFoundException("Team member not found");
    await this.prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId: memberUserId } } });
    return { removed: true };
  }
  // ACCESS ROLES: maintain organization-scoped custom role definitions and grant them to members.
  async listRoles(userId: string, organizationId: string) {
    const actor = await this.member(userId, organizationId); if (!["OWNER", "ADMIN"].includes(actor.role)) throw new ForbiddenException();
    const roles = await this.prisma.customRole.findMany({ where: { organizationId }, include: { permissions: { include: { permission: true } }, _count: { select: { members: true } } }, orderBy: { name: "asc" } });
    return { catalog: PERMISSION_CATALOG.map(([key, description]) => ({ key, description })), roles: roles.map((role) => ({ id: role.id, name: role.name, permissions: role.permissions.map((item) => item.permission.key), memberCount: role._count.members })) };
  }
  async saveRole(userId: string, organizationId: string, input: { id?: string; name: string; permissions: string[] }) {
    const actor = await this.member(userId, organizationId); if (!["OWNER", "ADMIN"].includes(actor.role)) throw new ForbiddenException();
    const allowed = new Set(PERMISSION_CATALOG.map(([key]) => key)); const permissionKeys = [...new Set(input.permissions)];
    if (permissionKeys.some((key) => !allowed.has(key))) throw new NotFoundException("Unknown permission");
    const role = await this.prisma.$transaction(async (tx) => {
      const saved = input.id ? await tx.customRole.updateMany({ where: { id: input.id, organizationId }, data: { name: input.name.trim() } }).then(async (result) => { if (!result.count) throw new NotFoundException("Role not found"); return tx.customRole.findUniqueOrThrow({ where: { id: input.id } }); }) : await tx.customRole.create({ data: { organizationId, name: input.name.trim() } });
      await tx.rolePermission.deleteMany({ where: { roleId: saved.id } });
      if (permissionKeys.length) {
        const definitions = await Promise.all(permissionKeys.map((key) => { const description = PERMISSION_CATALOG.find(([itemKey]) => itemKey === key)?.[1] ?? key; return tx.permission.upsert({ where: { key }, create: { key, description }, update: { description } }).then((item) => item.id); }));
        await tx.rolePermission.createMany({ data: definitions.map((permissionId) => ({ roleId: saved.id, permissionId })) });
      }
      await tx.auditLog.create({ data: { organizationId, userId, action: "CUSTOM_ROLE_SAVED", details: { roleId: saved.id, name: saved.name, permissions: permissionKeys } } });
      return saved;
    });
    return { id: role.id, name: role.name, permissions: permissionKeys };
  }
  async assignRole(userId: string, organizationId: string, memberUserId: string, roleId: string | null) {
    const actor = await this.member(userId, organizationId); if (!["OWNER", "ADMIN"].includes(actor.role)) throw new ForbiddenException();
    if (userId === memberUserId) throw new ForbiddenException("You cannot change your own organization role");
    const target = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: memberUserId } } }); if (!target) throw new NotFoundException("Organization member not found");
    if (roleId && !await this.prisma.customRole.findFirst({ where: { id: roleId, organizationId }, select: { id: true } })) throw new NotFoundException("Custom role not found");
    await this.prisma.organizationMember.update({ where: { organizationId_userId: { organizationId, userId: memberUserId } }, data: { customRoleId: roleId } });
    await this.prisma.auditLog.create({ data: { organizationId, userId, action: "MEMBER_CUSTOM_ROLE_CHANGED", details: { memberUserId, roleId } } });
    return { updated: true };
  }
  async create(userId: string, organizationId: string, input: { workspaceId: string; name: string }) {
    await requireOrganizationPermission(this.prisma, userId, organizationId, "team.manage");
    const workspace = await this.prisma.workspace.findFirst({ where: { id: input.workspaceId, organizationId }, select: { id: true } }); if (!workspace) throw new NotFoundException("Workspace not found");
    return this.prisma.team.create({ data: { organizationId, workspaceId: workspace.id, name: input.name.trim(), members: { create: { userId } } }, include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } } });
  }
}
