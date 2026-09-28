import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { sanitizeNoteHtml } from "./sanitize-note-html";

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  private async membership(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
    if (!member) throw new NotFoundException("Organization not found");
    return member;
  }

  async list(userId: string, organizationId: string) {
    await this.membership(userId, organizationId);
    return this.prisma.workspaceNote.findMany({ where: { organizationId }, include: { author: { select: { id: true, name: true } } }, orderBy: { updatedAt: "desc" } });
  }

  async create(userId: string, organizationId: string, title: string, content: string) {
    await this.membership(userId, organizationId);
    return this.prisma.workspaceNote.create({ data: { organizationId, authorId: userId, title: title.trim() || "Untitled note", content: sanitizeNoteHtml(content) }, include: { author: { select: { id: true, name: true } } } });
  }

  async update(userId: string, organizationId: string, noteId: string, title: string, content: string) {
    const note = await this.prisma.workspaceNote.findFirst({ where: { id: noteId, organizationId }, include: { organization: { include: { members: { where: { userId }, select: { role: true } } } } } });
    if (!note) throw new NotFoundException("Note not found");
    const role = note.organization.members[0]?.role;
    if (note.authorId !== userId && role !== "OWNER" && role !== "ADMIN") throw new ForbiddenException("Only the author or a workspace admin can edit this note");
    return this.prisma.workspaceNote.update({ where: { id: note.id }, data: { title: title.trim() || "Untitled note", content: sanitizeNoteHtml(content) }, include: { author: { select: { id: true, name: true } } } });
  }

  async remove(userId: string, organizationId: string, noteId: string) {
    const note = await this.prisma.workspaceNote.findFirst({ where: { id: noteId, organizationId }, include: { organization: { include: { members: { where: { userId }, select: { role: true } } } } } });
    if (!note) throw new NotFoundException("Note not found");
    const role = note.organization.members[0]?.role;
    if (note.authorId !== userId && role !== "OWNER" && role !== "ADMIN") throw new ForbiddenException("Only the author or a workspace admin can delete this note");
    await this.prisma.workspaceNote.delete({ where: { id: note.id } });
    return { ok: true };
  }
}
