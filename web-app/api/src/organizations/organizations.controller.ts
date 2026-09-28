import { Body, Controller, Get, Post, Req, UseGuards, Param } from "@nestjs/common";
import { ArrayMaxSize, IsArray, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationsService } from "./organizations.service";
import { TeamsService } from "./teams.service";
type AuthRequest = Request & { user: { sub: string } };
class CreateOrganizationDto { @IsString() @MinLength(2) @MaxLength(100) name!: string; @IsString() @MinLength(2) @MaxLength(50) workspaceName!: string; }
class CreateTeamDto { @IsString() workspaceId!: string; @IsString() @MinLength(2) @MaxLength(80) name!: string; }
class InviteDto { @IsEmail() email!: string; @IsEnum(["ADMIN", "MEMBER", "VIEWER"]) role!: "ADMIN"|"MEMBER"|"VIEWER"; }
class AcceptInviteDto { @IsString() @MinLength(32) @MaxLength(128) token!: string; }
class InviteeDto { @IsEmail() email!: string; }
class BootstrapDto extends CreateOrganizationDto {
  @IsString() @MinLength(2) @MaxLength(80) teamName!: string;
  @IsString() @MinLength(2) @MaxLength(120) projectName!: string;
  @IsOptional() @IsString() @MaxLength(200) firstTask?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => InviteeDto) invitees?: InviteeDto[];
}
@Controller("organizations") @UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService, private readonly teams: TeamsService) {}
  @Get() list(@Req() req: AuthRequest) { return this.service.list(req.user.sub); }
  @Post() create(@Req() req: AuthRequest, @Body() body: CreateOrganizationDto) { return this.service.create(req.user.sub, body); }
  @Post("bootstrap") bootstrap(@Req() req: AuthRequest, @Body() body: BootstrapDto) { return this.service.bootstrap(req.user.sub, body); }
  @Get(":organizationId/teams") teamsList(@Req() req: AuthRequest, @Param("organizationId") orgId: string) { return this.teams.list(req.user.sub, orgId); }
  @Post(":organizationId/teams") createTeam(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: CreateTeamDto) { return this.teams.create(req.user.sub, orgId, body); }
  @Post(":organizationId/invitations") invite(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: InviteDto) { return this.service.invite(req.user.sub, orgId, body); }
  @Post(":organizationId/invitations/accept") accept(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: AcceptInviteDto) { return this.service.acceptInvite(req.user.sub, orgId, body.token); }
}
