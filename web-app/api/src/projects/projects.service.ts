import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { requireOrganizationPermission } from "../organizations/access-control";
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}
  private async membership(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
    if (!member) throw new NotFoundException("Organization not found"); return member;
  }
  async list(userId: string, organizationId: string) { await this.membership(userId, organizationId); return this.prisma.project.findMany({ where: { organizationId }, include: { creator: { select: { id: true, name: true } }, _count: { select: { tasks: true } } }, orderBy: { updatedAt: "desc" } }); }
  async create(userId: string, organizationId: string, input: { workspaceId: string; name: string; description?: string; status?: "PLANNING"|"ACTIVE"|"ON_HOLD"|"AT_RISK"|"COMPLETED"|"ARCHIVED"; targetDate?: string }) {
    await requireOrganizationPermission(this.prisma, userId, organizationId, "project.create");
    const workspace = await this.prisma.workspace.findFirst({ where: { id: input.workspaceId, organizationId } });
    if (!workspace) throw new NotFoundException("Workspace not found");
    return this.prisma.project.create({ data: { organizationId, workspaceId: workspace.id, creatorId: userId, name: input.name.trim(), description: input.description, status: input.status, targetDate: input.targetDate ? new Date(input.targetDate) : undefined } });
  }
  // PROJECT LIFECYCLE: edits are scoped to the organization and leave an audit trail.
  async update(userId: string, organizationId: string, projectId: string, input: { name?: string; description?: string | null; status?: "PLANNING"|"ACTIVE"|"ON_HOLD"|"AT_RISK"|"COMPLETED"|"ARCHIVED"; targetDate?: string | null }) {
    await requireOrganizationPermission(this.prisma, userId, organizationId, "project.manage");
    const project = await this.prisma.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true } }); if (!project) throw new NotFoundException("Project not found");
    const data = { ...input, ...(input.name ? { name: input.name.trim() } : {}), ...(input.targetDate !== undefined ? { targetDate: input.targetDate ? new Date(input.targetDate) : null } : {}) };
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.project.update({ where: { id: projectId }, data });
      await tx.auditLog.create({ data: { organizationId, userId, action: "PROJECT_UPDATED", details: { projectId, changes: input } } });
      return saved;
    });
    return updated;
  }
}
