import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { requireOrganizationPermission } from "../organizations/access-control";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
export type MemoryEvidenceFile = { buffer: Buffer; size: number; originalname: string };
@Injectable()
export class WorkUpdatesService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsGateway) {}
  private async notifyAssignees(organizationId: string, taskId: string, actorId: string, title: string, body: string) {
    const recipients = await this.prisma.taskAssignee.findMany({ where: { taskId, userId: { not: actorId } }, select: { userId: true } });
    if (recipients.length) await this.prisma.notification.createMany({ data: recipients.map(({ userId }) => ({ organizationId, userId, title, body })) });
    this.events.publish(organizationId, "notification.created", { taskId });
  }
  private async task(userId: string, organizationId: string, taskId: string, write = false) {
    if (write) await requireOrganizationPermission(this.prisma, userId, organizationId, "task.update");
    else if (!await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } }, select: { id: true } })) throw new NotFoundException("Task not found");
    const task = await this.prisma.task.findFirst({ where: { id: taskId, organizationId, deletedAt: null }, select: { id: true } });
    if (!task) throw new NotFoundException("Task not found");
    return task;
  }
  // PRIVATE EVIDENCE: allow only inspected file signatures, random storage keys and authenticated downloads.
  async uploadEvidence(userId: string, organizationId: string, taskId: string, file: MemoryEvidenceFile) {
    await requireOrganizationPermission(this.prisma, userId, organizationId, "evidence.manage");
    const task = await this.prisma.task.findFirst({ where: { id: taskId, organizationId, deletedAt: null }, select: { id: true } });
    if (!task) throw new NotFoundException("Task not found");
    if (!file?.buffer?.length || file.size > 10 * 1024 * 1024) throw new BadRequestException("Select a file up to 10 MB");
    const signature = this.inspectEvidence(file.buffer);
    if (!signature) throw new BadRequestException("Only PNG, JPEG, PDF, and UTF-8 text files are allowed");
    const fileName = basename(file.originalname).replace(/[\\/\p{Cc}]/gu, "_").slice(0, 180) || `evidence${signature.extension}`;
    const storageKey = `${randomUUID()}${signature.extension}`;
    const storageRoot = resolve(process.env.EVIDENCE_STORAGE_DIR ?? resolve(process.cwd(), "storage", "private-evidence"));
    const filePath = resolve(storageRoot, storageKey);
    if (!filePath.startsWith(`${storageRoot}${sep}`)) throw new BadRequestException("Invalid storage key");
    await mkdir(storageRoot, { recursive: true, mode: 0o700 });
    await writeFile(filePath, file.buffer, { flag: "wx", mode: 0o600 });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const evidence = await tx.evidence.create({ data: { taskId, uploaderId: userId, fileName, storageKey, mimeType: signature.mimeType, sizeBytes: BigInt(file.size) } });
        await tx.auditLog.create({ data: { organizationId, taskId, userId, action: "EVIDENCE_UPLOADED", details: { evidenceId: evidence.id, fileName, mimeType: signature.mimeType, sizeBytes: file.size } } });
        this.events.publish(organizationId, "evidence.created", { taskId, evidenceId: evidence.id });
        return evidence;
      });
    } catch (error) { await unlink(filePath).catch(() => undefined); throw error; }
  }
  private inspectEvidence(buffer: Buffer): { mimeType: string; extension: string } | null {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mimeType: "image/png", extension: ".png" };
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mimeType: "image/jpeg", extension: ".jpg" };
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") return { mimeType: "application/pdf", extension: ".pdf" };
    if (!buffer.includes(0)) { try { new TextDecoder("utf-8", { fatal: true }).decode(buffer); return { mimeType: "text/plain", extension: ".txt" }; } catch { /* Not valid UTF-8 text; reject below. */ } }
    return null;
  }
  async evidenceDownload(userId: string, organizationId: string, taskId: string, evidenceId: string) {
    await requireOrganizationPermission(this.prisma, userId, organizationId, "evidence.view");
    const evidence = await this.prisma.evidence.findFirst({ where: { id: evidenceId, taskId, task: { organizationId, deletedAt: null } } });
    if (!evidence) throw new NotFoundException("Evidence not found");
    if (/^https?:\/\//i.test(evidence.storageKey)) throw new BadRequestException("External URL evidence does not use the file download route");
    const storageRoot = resolve(process.env.EVIDENCE_STORAGE_DIR ?? resolve(process.cwd(), "storage", "private-evidence"));
    const filePath = resolve(storageRoot, evidence.storageKey);
    if (!filePath.startsWith(`${storageRoot}${sep}`)) throw new NotFoundException("Evidence file not found");
    try { await stat(filePath); } catch { throw new NotFoundException("Evidence file not found"); }
    return { stream: createReadStream(filePath), fileName: evidence.fileName, mimeType: evidence.mimeType };
  }
  async listEvidence(userId: string, organizationId: string, taskId: string) {
    await requireOrganizationPermission(this.prisma, userId, organizationId, "evidence.view");
    const task = await this.prisma.task.findFirst({ where: { id: taskId, organizationId, deletedAt: null }, select: { id: true } });
    if (!task) throw new NotFoundException("Task not found");
    return this.prisma.evidence.findMany({ where: { taskId }, include: { uploader: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } });
  }
  async organizationUpdates(userId: string, organizationId: string) {
    await requireOrganizationPermission(this.prisma, userId, organizationId, "evidence.view");
    return this.prisma.workUpdate.findMany({ where: { task: { organizationId, deletedAt: null } }, include: { user: { select: { id: true, name: true } }, task: { select: { id: true, title: true } }, evidence: true }, orderBy: { submittedAt: "desc" }, take: 100 });
  }
  async list(userId: string, organizationId: string, taskId: string) { await this.task(userId, organizationId, taskId); await requireOrganizationPermission(this.prisma, userId, organizationId, "evidence.view"); return this.prisma.workUpdate.findMany({ where: { taskId }, include: { user: { select: { id: true, name: true } }, evidence: true }, orderBy: { submittedAt: "desc" }, take: 100 }); }
  async create(userId: string, organizationId: string, taskId: string, input: { progress: number; completed: string; nextAction?: string; blocker?: string; evidenceUrls?: string[] }) {
    await this.task(userId, organizationId, taskId, true);
    if (input.evidenceUrls?.length) await requireOrganizationPermission(this.prisma, userId, organizationId, "evidence.manage");
    const update = await this.prisma.$transaction(async (tx) => {
      const update = await tx.workUpdate.create({ data: { taskId, userId, progress: input.progress, completed: input.completed.trim(), nextAction: input.nextAction?.trim(), blocker: input.blocker?.trim() } });
      await tx.task.update({ where: { id: taskId }, data: { progress: input.progress } });
      const urls = [...new Set(input.evidenceUrls ?? [])];
      if (urls.length) await tx.evidence.createMany({ data: urls.map((url) => ({ taskId, workUpdateId: update.id, uploaderId: userId, fileName: new URL(url).hostname, storageKey: url, mimeType: "text/uri-list", sizeBytes: 0n })) });
      await tx.auditLog.create({ data: { organizationId, taskId, userId, action: "WORK_UPDATE_POSTED", details: { updateId: update.id, progress: input.progress, evidenceCount: urls.length } } });
      return tx.workUpdate.findUnique({ where: { id: update.id }, include: { evidence: true, user: { select: { id: true, name: true } } } });
    });
    this.events.publish(organizationId, "work-update.created", { taskId, updateId: update?.id, progress: input.progress });
    await this.notifyAssignees(organizationId, taskId, userId, "Task progress updated", input.completed.trim().slice(0, 180));
    return update;
  }
  async comments(userId: string, organizationId: string, taskId: string) { await this.task(userId, organizationId, taskId); return this.prisma.comment.findMany({ where: { taskId }, include: { author: { select: { id: true, name: true } }, replies: { include: { author: { select: { id: true, name: true } } } } }, orderBy: { createdAt: "asc" }, take: 200 }); }
  async comment(userId: string, organizationId: string, taskId: string, input: { body: string; parentId?: string }) { await this.task(userId, organizationId, taskId, true); if (input.parentId) { const parent = await this.prisma.comment.findFirst({ where: { id: input.parentId, taskId, parentId: null }, select: { id: true } }); if (!parent) throw new NotFoundException("Comment not found"); } const comment = await this.prisma.$transaction(async (tx) => { const created = await tx.comment.create({ data: { taskId, authorId: userId, body: input.body.trim(), parentId: input.parentId }, include: { author: { select: { id: true, name: true } } } }); await tx.auditLog.create({ data: { organizationId, taskId, userId, action: "COMMENT_POSTED", details: { commentId: created.id, reply: Boolean(input.parentId) } } }); return created; }); this.events.publish(organizationId, "comment.created", { taskId, commentId: comment.id }); await this.notifyAssignees(organizationId, taskId, userId, "New task comment", input.body.trim().slice(0, 180)); return comment; }
  async timeEntry(userId: string, organizationId: string, taskId: string, input: { startedAt: string; endedAt?: string; durationMinutes?: number; note?: string }) {
    await this.task(userId, organizationId, taskId, true);
    const start = new Date(input.startedAt); let end = input.endedAt ? new Date(input.endedAt) : undefined;
    if (!Number.isFinite(start.getTime()) || (end && (!Number.isFinite(end.getTime()) || end <= start))) throw new BadRequestException("Invalid time interval");
    if (!end && input.durationMinutes === undefined) {
      const running = await this.prisma.timeEntry.findFirst({ where: { userId, endedAt: null }, select: { id: true } });
      if (running) throw new BadRequestException("Stop your running timer before starting another");
    }
    const minutes = input.durationMinutes ?? (end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)) : undefined);
    // Manual duration entries are completed records, never active timers.
    if (!end && minutes !== undefined) end = new Date(start.getTime() + minutes * 60000);
    let entry;
    try { entry = await this.prisma.timeEntry.create({ data: { taskId, userId, startedAt: start, endedAt: end, durationMinutes: minutes, note: input.note?.trim() } }); }
    catch (error) { if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") throw new BadRequestException("Stop your running timer before starting another"); throw error; }
    await this.prisma.auditLog.create({ data: { organizationId, taskId, userId, action: input.durationMinutes === undefined && !end ? "TIMER_STARTED" : "TIME_RECORDED", details: { timeEntryId: entry.id, durationMinutes: minutes ?? null } } });
    this.events.publish(organizationId, "time-entry.created", { taskId, timeEntryId: entry.id });
    return entry;
  }
  async timeEntries(userId: string, organizationId: string, taskId: string) {
    await this.task(userId, organizationId, taskId);
    return this.prisma.timeEntry.findMany({ where: { taskId }, include: { user: { select: { id: true, name: true } } }, orderBy: { startedAt: "desc" }, take: 200 });
  }
  async runningTimer(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } }, select: { id: true } });
    if (!member) throw new NotFoundException("Organization not found");
    return this.prisma.timeEntry.findFirst({ where: { userId, endedAt: null, task: { organizationId, deletedAt: null } }, include: { task: { select: { id: true, title: true } } } });
  }
  async stopTimer(userId: string, organizationId: string, taskId: string, entryId: string) {
    await this.task(userId, organizationId, taskId, true);
    const entry = await this.prisma.timeEntry.findFirst({ where: { id: entryId, taskId, userId }, select: { id: true, startedAt: true, endedAt: true } });
    if (!entry) throw new NotFoundException("Running timer not found");
    if (entry.endedAt) throw new BadRequestException("This timer has already stopped");
    const endedAt = new Date();
    const durationMinutes = Math.max(1, Math.round((endedAt.getTime() - entry.startedAt.getTime()) / 60000));
    const stopped = await this.prisma.timeEntry.update({ where: { id: entry.id }, data: { endedAt, durationMinutes } });
    await this.prisma.auditLog.create({ data: { organizationId, taskId, userId, action: "TIMER_STOPPED", details: { timeEntryId: entry.id, durationMinutes } } });
    this.events.publish(organizationId, "time-entry.stopped", { taskId, timeEntryId: entry.id });
    return stopped;
  }
}
