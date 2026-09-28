import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}
  private async membership(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
    if (!member) throw new NotFoundException("Organization not found"); return member;
  }
  async list(userId: string, organizationId: string) { await this.membership(userId, organizationId); return this.prisma.project.findMany({ where: { organizationId }, include: { creator: { select: { id: true, name: true } }, _count: { select: { tasks: true } } }, orderBy: { updatedAt: "desc" } }); }
  async create(userId: string, organizationId: string, input: { workspaceId: string; name: string; description?: string; status?: "PLANNING"|"ACTIVE"|"ON_HOLD"|"AT_RISK"|"COMPLETED"|"ARCHIVED"; targetDate?: string }) {
    const member = await this.membership(userId, organizationId);
    if (member.role === "VIEWER") throw new ForbiddenException();
    const workspace = await this.prisma.workspace.findFirst({ where: { id: input.workspaceId, organizationId } });
    if (!workspace) throw new NotFoundException("Workspace not found");
    return this.prisma.project.create({ data: { organizationId, workspaceId: workspace.id, creatorId: userId, name: input.name.trim(), description: input.description, status: input.status, targetDate: input.targetDate ? new Date(input.targetDate) : undefined } });
  }
}
