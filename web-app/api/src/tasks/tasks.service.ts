import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsGateway) {}
  private async membership(userId: string, organizationId: string) { const member = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } }); if (!member) throw new NotFoundException("Organization not found"); return member; }
  async list(userId: string, organizationId: string, projectId?: string, mine = false) { await this.membership(userId, organizationId); return this.prisma.task.findMany({ where: { organizationId, deletedAt: null, ...(projectId ? { projectId } : {}), ...(mine ? { assignees: { some: { userId } } } : {}) }, include: { project: { select: { id: true, name: true } }, assignees: { include: { user: { select: { id: true, name: true, email: true } } } }, _count: { select: { comments: true, workUpdates: true, subtasks: true } } }, orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }], take: 100 }); }
  async create(userId: string, organizationId: string, input: { projectId: string; title: string; description?: string; dueAt?: string; priority?: "LOW"|"MEDIUM"|"HIGH"|"URGENT"|"CRITICAL"; parentId?: string; assigneeIds?: string[] }) {
    const member = await this.membership(userId, organizationId); if (member.role === "VIEWER") throw new ForbiddenException();
    const project = await this.prisma.project.findFirst({ where: { id: input.projectId, organizationId }, select: { id: true } }); if (!project) throw new NotFoundException("Project not found");
    if (input.parentId && !await this.prisma.task.findFirst({ where: { id: input.parentId, organizationId, deletedAt: null }, select: { id: true } })) throw new NotFoundException("Parent task not found");
    if (input.assigneeIds?.length) { const count = await this.prisma.organizationMember.count({ where: { organizationId, userId: { in: input.assigneeIds } } }); if (count !== new Set(input.assigneeIds).size) throw new NotFoundException("One or more assignees are not workspace members"); }
    const created = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({ data: { organizationId, projectId: project.id, parentId: input.parentId, creatorId: userId, title: input.title.trim(), description: input.description, dueAt: input.dueAt ? new Date(input.dueAt) : undefined, priority: input.priority, assignees: { create: [...new Set(input.assigneeIds ?? [])].map((id) => ({ userId: id })) } }, include: { assignees: true, project: { select: { id: true, name: true } } } });
      await tx.auditLog.create({ data: { organizationId, taskId: task.id, userId, action: "TASK_CREATED", details: { title: task.title, priority: task.priority } } });
      return task;
    });
    this.events.publish(organizationId, "task.created", { taskId: created.id });
    const recipients = [...new Set(input.assigneeIds ?? [])].filter((id) => id !== userId);
    if (recipients.length) await this.prisma.notification.createMany({ data: recipients.map((id) => ({ organizationId, userId: id, title: "Task assigned", body: created.title })) });
    if (recipients.length) this.events.publish(organizationId, "notification.created", { taskId: created.id });
    return created;
  }
  async update(userId: string, organizationId: string, taskId: string, input: { title?: string; description?: string; status?: "BACKLOG"|"TODO"|"IN_PROGRESS"|"BLOCKED"|"READY_FOR_REVIEW"|"CHANGES_REQUESTED"|"COMPLETED"|"REOPENED"|"CANCELLED"; priority?: "LOW"|"MEDIUM"|"HIGH"|"URGENT"|"CRITICAL"; progress?: number }) {
    const member = await this.membership(userId, organizationId); if (member.role === "VIEWER") throw new ForbiddenException();
    const task = await this.prisma.task.findFirst({ where: { id: taskId, organizationId, deletedAt: null }, select: { id: true } }); if (!task) throw new NotFoundException("Task not found");
    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({ where: { id: task.id }, data: input });
      await tx.auditLog.create({ data: { organizationId, taskId, userId, action: "TASK_UPDATED", details: input } });
      return updated;
    });
    this.events.publish(organizationId, "task.updated", { taskId, status: updated.status, updatedAt: updated.updatedAt });
    const assignees = await this.prisma.taskAssignee.findMany({ where: { taskId, userId: { not: userId } }, select: { userId: true } });
    if (assignees.length) await this.prisma.notification.createMany({ data: assignees.map(({ userId: recipient }) => ({ organizationId, userId: recipient, title: "Task updated", body: updated.title })) });
    if (assignees.length) this.events.publish(organizationId, "notification.created", { taskId });
    return updated;
  }
  async addDependency(userId: string, organizationId: string, taskId: string, input: { targetTaskId: string; type: "BLOCKS"|"BLOCKED_BY"|"RELATED_TO"|"DUPLICATE_OF" }) {
    const member = await this.membership(userId, organizationId); if (member.role === "VIEWER") throw new ForbiddenException();
    if (taskId === input.targetTaskId) throw new BadRequestException("A task cannot depend on itself");
    const ids = await this.prisma.task.findMany({ where: { organizationId, id: { in: [taskId, input.targetTaskId] }, deletedAt: null }, select: { id: true } });
    if (ids.length !== 2) throw new NotFoundException("Task not found");
    const sourceTaskId = input.type === "BLOCKED_BY" ? input.targetTaskId : taskId;
    const targetTaskId = input.type === "BLOCKED_BY" ? taskId : input.targetTaskId;
    if (input.type === "BLOCKS" || input.type === "BLOCKED_BY") {
      const reachable = new Set<string>([targetTaskId]);
      let frontier = [targetTaskId];
      while (frontier.length) {
        const edges = await this.prisma.taskDependency.findMany({ where: { sourceTaskId: { in: frontier }, type: "BLOCKS" }, select: { targetTaskId: true } });
        frontier = edges.map((edge) => edge.targetTaskId).filter((id) => !reachable.has(id));
        frontier.forEach((id) => reachable.add(id));
      }
      if (reachable.has(sourceTaskId)) throw new BadRequestException("This dependency would create a cycle");
    }
    const storedType = input.type === "BLOCKED_BY" ? "BLOCKS" : input.type;
    return this.prisma.taskDependency.create({ data: { sourceTaskId, targetTaskId, type: storedType } });
  }
}
