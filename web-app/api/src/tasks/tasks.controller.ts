import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TasksService } from "./tasks.service";
type AuthRequest = Request & { user: { sub: string } };
class CreateTaskDto { @IsString() projectId!: string; @IsString() @MinLength(2) @MaxLength(200) title!: string; @IsOptional() @IsString() @MaxLength(10000) description?: string; @IsOptional() @IsDateString() dueAt?: string; @IsOptional() @IsEnum(["LOW","MEDIUM","HIGH","URGENT","CRITICAL"]) priority?: "LOW"|"MEDIUM"|"HIGH"|"URGENT"|"CRITICAL"; @IsOptional() @IsString() parentId?: string; @IsOptional() @IsString({ each: true }) assigneeIds?: string[]; }
class DependencyDto { @IsString() targetTaskId!: string; @IsEnum(["BLOCKS","BLOCKED_BY","RELATED_TO","DUPLICATE_OF"]) type!: "BLOCKS"|"BLOCKED_BY"|"RELATED_TO"|"DUPLICATE_OF"; }
class UpdateTaskDto { @IsOptional() @IsString() @MinLength(2) @MaxLength(200) title?: string; @IsOptional() @IsString() @MaxLength(10000) description?: string; @IsOptional() @IsEnum(["BACKLOG","TODO","IN_PROGRESS","BLOCKED","READY_FOR_REVIEW","CHANGES_REQUESTED","COMPLETED","REOPENED","CANCELLED"]) status?: "BACKLOG"|"TODO"|"IN_PROGRESS"|"BLOCKED"|"READY_FOR_REVIEW"|"CHANGES_REQUESTED"|"COMPLETED"|"REOPENED"|"CANCELLED"; @IsOptional() @IsEnum(["LOW","MEDIUM","HIGH","URGENT","CRITICAL"]) priority?: "LOW"|"MEDIUM"|"HIGH"|"URGENT"|"CRITICAL"; @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number; }
@Controller("organizations/:organizationId/tasks") @UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly service: TasksService) {}
  @Get() list(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Query("projectId") projectId?: string, @Query("mine") mine?: string) { return this.service.list(req.user.sub, orgId, projectId, mine === "true"); }
  @Post() create(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: CreateTaskDto) { return this.service.create(req.user.sub, orgId, body); }
  @Patch(":taskId") update(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("taskId") taskId: string, @Body() body: UpdateTaskDto) { return this.service.update(req.user.sub, orgId, taskId, body); }
  @Post(":taskId/dependencies") dependency(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("taskId") taskId: string, @Body() body: DependencyDto) { return this.service.addDependency(req.user.sub, orgId, taskId, body); }
}
