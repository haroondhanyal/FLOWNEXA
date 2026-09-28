import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}
  private async member(userId: string, organizationId: string) { const member = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } }); if (!member) throw new NotFoundException("Organization not found"); return member; }
  async list(userId: string, organizationId: string) { await this.member(userId, organizationId); return this.prisma.team.findMany({ where: { organizationId }, include: { members: { include: { user: { select: { id: true, email: true, name: true } } } }, _count: { select: { projects: true } } }, orderBy: { name: "asc" } }); }
  async create(userId: string, organizationId: string, input: { workspaceId: string; name: string }) {
    const member = await this.member(userId, organizationId); if (!["OWNER", "ADMIN"].includes(member.role)) throw new ForbiddenException();
    const workspace = await this.prisma.workspace.findFirst({ where: { id: input.workspaceId, organizationId }, select: { id: true } }); if (!workspace) throw new NotFoundException("Workspace not found");
    return this.prisma.team.create({ data: { organizationId, workspaceId: workspace.id, name: input.name.trim(), members: { create: { userId } } }, include: { members: true } });
  }
}
