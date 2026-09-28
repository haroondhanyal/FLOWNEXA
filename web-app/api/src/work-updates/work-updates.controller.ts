import { Body, Controller, Get, Param, Patch, Post, Req, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsArray, IsDateString, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from "class-validator";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { WorkUpdatesService, type MemoryEvidenceFile } from "./work-updates.service";
type AuthRequest = Request & { user: { sub: string } };
class CreateUpdateDto { @IsInt() @Min(0) @Max(100) progress!: number; @IsString() @MinLength(1) @MaxLength(10000) completed!: string; @IsOptional() @IsString() @MaxLength(10000) nextAction?: string; @IsOptional() @IsString() @MaxLength(10000) blocker?: string; @IsOptional() @IsArray() @IsUrl({}, { each: true }) evidenceUrls?: string[]; }
class CreateCommentDto { @IsString() @MinLength(1) @MaxLength(10000) body!: string; @IsOptional() @IsString() parentId?: string; }
class CreateTimeEntryDto { @IsDateString() startedAt!: string; @IsOptional() @IsDateString() endedAt?: string; @IsOptional() @IsInt() @Min(1) @Max(1440) durationMinutes?: number; @IsOptional() @IsString() @MaxLength(1000) note?: string; }
@Controller("organizations/:organizationId") @UseGuards(JwtAuthGuard)
export class WorkUpdatesController {
  constructor(private readonly service: WorkUpdatesService) {}
  @Get("work-updates") organizationUpdates(@Req() req: AuthRequest, @Param("organizationId") orgId: string) { return this.service.organizationUpdates(req.user.sub, orgId); }
  @Get("time-entries/running") runningTimer(@Req() req: AuthRequest, @Param("organizationId") orgId: string) { return this.service.runningTimer(req.user.sub, orgId); }
  @Get("tasks/:taskId/work-updates") list(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("taskId") taskId: string) { return this.service.list(req.user.sub, orgId, taskId); }
  @Get("tasks/:taskId/evidence") listEvidence(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("taskId") taskId: string) { return this.service.listEvidence(req.user.sub, orgId, taskId); }
  @Post("tasks/:taskId/work-updates") create(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("taskId") taskId: string, @Body() body: CreateUpdateDto) { return this.service.create(req.user.sub, orgId, taskId, body); }
  @Post("tasks/:taskId/evidence") @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } })) uploadEvidence(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("taskId") taskId: string, @UploadedFile() file: MemoryEvidenceFile) { return this.service.uploadEvidence(req.user.sub, orgId, taskId, file); }
  @Get("tasks/:taskId/evidence/:evidenceId/download") async downloadEvidence(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("taskId") taskId: string, @Param("evidenceId") evidenceId: string) { const file = await this.service.evidenceDownload(req.user.sub, orgId, taskId, evidenceId); return new StreamableFile(file.stream, { type: file.mimeType, disposition: `attachment; filename="${file.fileName.replace(/["\\\r\n]/g, "_")}"` }); }
  @Get("tasks/:taskId/comments") comments(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("taskId") taskId: string) { return this.service.comments(req.user.sub, orgId, taskId); }
  @Post("tasks/:taskId/comments") comment(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("taskId") taskId: string, @Body() body: CreateCommentDto) { return this.service.comment(req.user.sub, orgId, taskId, body); }
  @Post("tasks/:taskId/time-entries") timeEntry(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("taskId") taskId: string, @Body() body: CreateTimeEntryDto) { return this.service.timeEntry(req.user.sub, orgId, taskId, body); }
  @Get("tasks/:taskId/time-entries") timeEntries(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("taskId") taskId: string) { return this.service.timeEntries(req.user.sub, orgId, taskId); }
  @Patch("tasks/:taskId/time-entries/:entryId/stop") stopTimer(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("taskId") taskId: string, @Param("entryId") entryId: string) { return this.service.stopTimer(req.user.sub, orgId, taskId, entryId); }
}
