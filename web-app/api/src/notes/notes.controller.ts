import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { IsString, MaxLength } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { NotesService } from "./notes.service";

class SaveNoteDto {
  @IsString() @MaxLength(180) title!: string;
  @IsString() @MaxLength(2000000) content!: string;
}
type AuthRequest = { user: { sub: string } };

// NOTES API: all routes check workspace membership, and edits are limited to the author or admins.
@Controller("organizations/:organizationId/workspaces/:workspaceId/notes")
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private readonly notes: NotesService) {}
  @Get() list(@Req() req: AuthRequest, @Param("organizationId") organizationId: string, @Param("workspaceId") workspaceId: string) { return this.notes.list(req.user.sub, organizationId, workspaceId); }
  @Post() create(@Req() req: AuthRequest, @Param("organizationId") organizationId: string, @Param("workspaceId") workspaceId: string, @Body() body: SaveNoteDto) { return this.notes.create(req.user.sub, organizationId, workspaceId, body.title, body.content); }
  @Put(":noteId") update(@Req() req: AuthRequest, @Param("organizationId") organizationId: string, @Param("workspaceId") workspaceId: string, @Param("noteId") noteId: string, @Body() body: SaveNoteDto) { return this.notes.update(req.user.sub, organizationId, workspaceId, noteId, body.title, body.content); }
  @Delete(":noteId") remove(@Req() req: AuthRequest, @Param("organizationId") organizationId: string, @Param("workspaceId") workspaceId: string, @Param("noteId") noteId: string) { return this.notes.remove(req.user.sub, organizationId, workspaceId, noteId); }
}
