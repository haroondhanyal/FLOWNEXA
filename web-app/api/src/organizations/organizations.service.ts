import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}
  list(userId: string) { return this.prisma.organization.findMany({ where: { members: { some: { userId } } }, include: { workspaces: true, _count: { select: { members: true, projects: true } } }, orderBy: { createdAt: "asc" } }); }
  async create(userId: string, input: { name: string; workspaceName: string }) {
    const slugBase = input.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 42) || "organization";
    const slug = `${slugBase}-${randomUUID().slice(0, 6)}`;
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: input.name.trim(), slug } });
      const workspace = await tx.workspace.create({ data: { organizationId: org.id, name: input.workspaceName.trim() } });
      await tx.organizationMember.create({ data: { organizationId: org.id, userId, role: "OWNER" } });
      return { ...org, workspaces: [workspace] };
    });
  }
  async bootstrap(userId: string, input: { name: string; workspaceName: string; teamName: string; projectName: string; firstTask?: string; invitees?: { email: string }[] }) {
    const slugBase = input.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 42) || "organization";
    const slug = `${slugBase}-${randomUUID().slice(0, 6)}`;
    const invitees = [...new Map((input.invitees ?? []).map((invite) => [invite.email.trim().toLowerCase(), invite.email.trim().toLowerCase()])).values()];
    const invitationTokens = invitees.map((email) => ({ email, token: randomBytes(32).toString("base64url") }));
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { name: input.name.trim(), slug } });
      const workspace = await tx.workspace.create({ data: { organizationId: organization.id, name: input.workspaceName.trim() } });
      await tx.organizationMember.create({ data: { organizationId: organization.id, userId, role: "OWNER" } });
      const team = await tx.team.create({ data: { organizationId: organization.id, workspaceId: workspace.id, name: input.teamName.trim(), members: { create: { userId } } } });
      const project = await tx.project.create({ data: { organizationId: organization.id, workspaceId: workspace.id, teamId: team.id, creatorId: userId, name: input.projectName.trim() } });
      const task = input.firstTask?.trim() ? await tx.task.create({ data: { organizationId: organization.id, projectId: project.id, creatorId: userId, title: input.firstTask.trim() } }) : null;
      const invitations: { id: string; email: string; expiresAt: Date; token: string }[] = [];
      for (const invite of invitationTokens) {
        const tokenHash = await bcrypt.hash(invite.token, 12);
        const saved = await tx.organizationInvitation.create({ data: { organizationId: organization.id, inviterId: userId, email: invite.email, role: "MEMBER", tokenHash, expiresAt: new Date(Date.now() + 7 * 86400000) } });
        invitations.push({ id: saved.id, email: saved.email, expiresAt: saved.expiresAt, token: invite.token });
      }
      return { organization, workspace, team, project, task, invitations };
    });
  }
  async assertMember(userId: string, organizationId: string) {
    const membership = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
    if (!membership) throw new NotFoundException("Organization not found");
    return membership;
  }
  async invite(userId: string, organizationId: string, input: { email: string; role: "ADMIN"|"MEMBER"|"VIEWER" }) {
    const member = await this.assertMember(userId, organizationId);
    if (!["OWNER", "ADMIN"].includes(member.role)) throw new ForbiddenException();
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user && await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: user.id } } })) throw new NotFoundException("This person is already in the organization");
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = await bcrypt.hash(rawToken, 12);
    const invitation = await this.prisma.organizationInvitation.create({ data: { organizationId, inviterId: userId, email, role: input.role, tokenHash, expiresAt: new Date(Date.now() + 7 * 86400000) } });
    return { id: invitation.id, email, role: invitation.role, expiresAt: invitation.expiresAt, inviteToken: rawToken, delivery: "Share this one-time token through your approved email channel." };
  }
  async acceptInvite(userId: string, organizationId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!user) throw new NotFoundException("Invitation not found");
    const invitations = await this.prisma.organizationInvitation.findMany({ where: { organizationId, email: user.email, acceptedAt: null, expiresAt: { gt: new Date() } }, take: 20 });
    let invitation = null;
    for (const candidate of invitations) if (await bcrypt.compare(token, candidate.tokenHash)) { invitation = candidate; break; }
    if (!invitation) throw new NotFoundException("Invitation not found or expired");
    return this.prisma.$transaction(async (tx) => {
      if (await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } })) throw new ForbiddenException("This account is already a member");
      const claimed = await tx.organizationInvitation.updateMany({ where: { id: invitation!.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
      if (claimed.count !== 1) throw new NotFoundException("Invitation has already been used");
      return tx.organizationMember.create({ data: { organizationId, userId, role: invitation!.role } });
    });
  }
}
