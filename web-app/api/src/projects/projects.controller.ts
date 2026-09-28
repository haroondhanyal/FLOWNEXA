import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ProjectsService } from "./projects.service";
type AuthRequest = Request & { user: { sub: string } };
class CreateProjectDto { @IsString() organizationId!: string; @IsString() workspaceId!: string; @IsString() @MinLength(2) @MaxLength(120) name!: string; @IsOptional() @IsString() @MaxLength(5000) description?: string; @IsOptional() @IsEnum(["PLANNING","ACTIVE","ON_HOLD","AT_RISK","COMPLETED","ARCHIVED"]) status?: "PLANNING"|"ACTIVE"|"ON_HOLD"|"AT_RISK"|"COMPLETED"|"ARCHIVED"; @IsOptional() @IsDateString() targetDate?: string; }
@Controller("organizations/:organizationId/projects") @UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}
  @Get() list(@Req() req: AuthRequest, @Param("organizationId") orgId: string) { return this.service.list(req.user.sub, orgId); }
  @Post() create(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: CreateProjectDto) { return this.service.create(req.user.sub, orgId, body); }
}
