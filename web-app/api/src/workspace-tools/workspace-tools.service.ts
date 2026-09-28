import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { requireOrganizationPermission } from "../organizations/access-control";

@Injectable()
export class WorkspaceToolsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsGateway) {}
  // Every read/write begins with membership validation to keep org data private.
  private async member(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
    if (!member) throw new NotFoundException("Organization not found");
    return member;
  }
  private async scopedWorkspace(organizationId: string, workspaceId?: string) {
    if (!workspaceId) return undefined;
    const workspace = await this.prisma.workspace.findFirst({ where: { id: workspaceId, organizationId }, select: { id: true } });
    if (!workspace) throw new NotFoundException("Workspace not found");
    return workspace.id;
  }
  async requestReview(userId: string, organizationId: string, taskId: string) {
    await requireOrganizationPermission(this.prisma, userId, organizationId, "task.update");
    const task = await this.prisma.task.findFirst({ where: { id: taskId, organizationId, deletedAt: null }, include: { assignees: true } });
    if (!task) throw new NotFoundException("Task not found");
    if (task.status === "COMPLETED" || task.status === "CANCELLED") throw new BadRequestException("This task cannot be submitted for review");
    const recipients = task.assignees.map((item) => item.userId).filter((id) => id !== userId);
    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({ data: { taskId, reviewerId: userId } });
      await tx.task.update({ where: { id: taskId }, data: { status: "READY_FOR_REVIEW" } });
      await tx.auditLog.create({ data: { organizationId, taskId, userId, action: "REVIEW_REQUESTED", details: { reviewId: created.id } } });
      if (recipients.length) await tx.notification.createMany({ data: recipients.map((id) => ({ organizationId, userId: id, title: "Work submitted for review", body: task.title })) });
      return created;
    });
    this.events.publish(organizationId, "review.requested", { taskId, reviewId: review.id });
    await this.sendPush(recipients, "Work submitted for review", task.title);
    return review;
  }
  async reviews(userId: string, organizationId: string, workspaceId?: string) {
    await requireOrganizationPermission(this.prisma, userId, organizationId, "task.review");
    const selectedWorkspace = await this.scopedWorkspace(organizationId, workspaceId);
    return this.prisma.review.findMany({ where: { task: { organizationId, ...(selectedWorkspace ? { project: { workspaceId: selectedWorkspace } } : {}) } }, include: { task: { select: { id: true, title: true, status: true, project: { select: { name: true } } } }, reviewer: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  }
  async decideReview(userId: string, organizationId: string, reviewId: string, input: { status: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED"; comment?: string }) {
    await requireOrganizationPermission(this.prisma, userId, organizationId, "task.review");
    if (input.status !== "APPROVED" && !input.comment?.trim()) throw new BadRequestException("Add a comment explaining the requested changes");
    const review = await this.prisma.review.findFirst({ where: { id: reviewId, task: { organizationId } }, include: { task: { include: { assignees: true } } } });
    if (!review) throw new NotFoundException("Review not found");
    if (review.status !== "PENDING") throw new BadRequestException("This review has already been decided");
    if (review.reviewerId === userId) throw new ForbiddenException("Reviewers cannot approve their own submission");
    const recipients = review.task.assignees.map((item) => item.userId).filter((id) => id !== userId);
    const result = await this.prisma.$transaction(async (tx) => {
      const result = await tx.review.update({ where: { id: reviewId }, data: { status: input.status, comment: input.comment?.trim(), decidedAt: new Date() } });
      const nextStatus = input.status === "APPROVED" ? "COMPLETED" : input.status === "CHANGES_REQUESTED" ? "CHANGES_REQUESTED" : "REOPENED";
      await tx.task.update({ where: { id: review.taskId }, data: { status: nextStatus } });
      await tx.auditLog.create({ data: { organizationId, taskId: review.taskId, userId, action: `REVIEW_${input.status}`, details: { comment: input.comment?.trim() ?? null } } });
      if (recipients.length) await tx.notification.createMany({ data: recipients.map((id) => ({ organizationId, userId: id, title: `Review ${input.status.toLowerCase().replaceAll("_", " ")}`, body: review.task.title })) });
      return result;
    });
    this.events.publish(organizationId, "review.decided", { taskId: review.taskId, reviewId, status: input.status });
    await this.sendPush(recipients, `Review ${input.status.toLowerCase().replaceAll("_", " ")}`, review.task.title);
    return result;
  }
  async audit(userId: string, organizationId: string, workspaceId?: string) { await requireOrganizationPermission(this.prisma, userId, organizationId, "audit.view"); const selectedWorkspace = await this.scopedWorkspace(organizationId, workspaceId); return this.prisma.auditLog.findMany({ where: { organizationId, ...(selectedWorkspace ? { OR: [{ task: { project: { workspaceId: selectedWorkspace } } }, { taskId: null }] } : {}) }, include: { user: { select: { name: true } }, task: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 100 }); }
  async report(userId: string, organizationId: string, workspaceId?: string) {
    await requireOrganizationPermission(this.prisma, userId, organizationId, "report.view");
    const selectedWorkspace = await this.scopedWorkspace(organizationId, workspaceId);
    const tasks = await this.prisma.task.findMany({ where: { organizationId, deletedAt: null, ...(selectedWorkspace ? { project: { workspaceId: selectedWorkspace } } : {}) }, select: { status: true, dueAt: true, updatedAt: true } });
    const time = await this.prisma.timeEntry.aggregate({ where: { task: { organizationId, ...(selectedWorkspace ? { project: { workspaceId: selectedWorkspace } } : {}) } }, _sum: { durationMinutes: true } });
    const counts: Record<string, number> = {};
    for (const task of tasks) counts[task.status] = (counts[task.status] ?? 0) + 1;
    const now = new Date();
    const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { total: tasks.length, counts, overdue: tasks.filter((task) => task.dueAt && task.dueAt < now && task.status !== "COMPLETED" && task.status !== "CANCELLED").length, blocked: counts.BLOCKED ?? 0, awaitingReview: counts.READY_FOR_REVIEW ?? 0, upcoming: tasks.filter((task) => task.dueAt && task.dueAt >= now && task.dueAt <= endOfWeek && task.status !== "COMPLETED" && task.status !== "CANCELLED").length, completedThisWeek: tasks.filter((task) => task.status === "COMPLETED" && task.updatedAt >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).length, trackedMinutes: time._sum.durationMinutes ?? 0 };
  }
  async search(userId: string, organizationId: string, query: string, workspaceId?: string) {
    await this.member(userId, organizationId);
    const selectedWorkspace = await this.scopedWorkspace(organizationId, workspaceId);
    const term = query.trim().slice(0, 100);
    if (term.length < 2) return { tasks: [], projects: [], comments: [] };
    const [tasks, projects, comments] = await Promise.all([
      this.prisma.task.findMany({ where: { organizationId, deletedAt: null, title: { contains: term, mode: "insensitive" }, ...(selectedWorkspace ? { project: { workspaceId: selectedWorkspace } } : {}) }, select: { id: true, title: true, status: true }, take: 20 }),
      this.prisma.project.findMany({ where: { organizationId, name: { contains: term, mode: "insensitive" }, ...(selectedWorkspace ? { workspaceId: selectedWorkspace } : {}) }, select: { id: true, name: true, status: true }, take: 20 }),
      this.prisma.comment.findMany({ where: { body: { contains: term, mode: "insensitive" }, task: { organizationId, deletedAt: null, ...(selectedWorkspace ? { project: { workspaceId: selectedWorkspace } } : {}) } }, select: { id: true, body: true, task: { select: { id: true, title: true } }, author: { select: { name: true } } }, take: 20, orderBy: { createdAt: "desc" } }),
    ]);
    return { tasks, projects, comments };
  }
  async notifications(userId: string, organizationId: string) { await this.member(userId, organizationId); return this.prisma.notification.findMany({ where: { organizationId, userId, archivedAt: null }, orderBy: { createdAt: "desc" }, take: 100 }); }
  async markRead(userId: string, organizationId: string, id: string) {
    await this.member(userId, organizationId);
    const result = await this.prisma.notification.updateMany({ where: { id, organizationId, userId }, data: { readAt: new Date() } });
    if (!result.count) throw new NotFoundException("Notification not found");
    return { ok: true };
  }
  async archiveNotification(userId: string, organizationId: string, id: string) {
    await this.member(userId, organizationId);
    const result = await this.prisma.notification.updateMany({ where: { id, organizationId, userId }, data: { archivedAt: new Date(), readAt: new Date() } });
    if (!result.count) throw new NotFoundException("Notification not found");
    return { ok: true };
  }
  async registerDevice(userId: string, organizationId: string, token: string) {
    await this.member(userId, organizationId);
    if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) throw new BadRequestException("Invalid Expo push token");
    await this.prisma.deviceToken.upsert({ where: { token }, create: { userId, token }, update: { userId, updatedAt: new Date() } });
    return { ok: true };
  }
  async removeDevice(userId: string, organizationId: string, token: string) {
    await this.member(userId, organizationId);
    await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
    return { ok: true };
  }
  // Expo's push gateway is called after the database transaction; delivery failure never rolls back review work.
  private async sendPush(userIds: string[], title: string, body: string) {
    if (!userIds.length) return;
    try {
      const devices = await this.prisma.deviceToken.findMany({ where: { userId: { in: userIds } }, select: { token: true } });
      if (!devices.length) return;
      await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", signal: AbortSignal.timeout(5000), headers: { "Content-Type": "application/json" }, body: JSON.stringify(devices.map(({ token }) => ({ to: token, title, body, sound: "default" }))) });
    } catch { /* Stored inbox messages remain available when external push delivery is unavailable. */ }
  }
}
