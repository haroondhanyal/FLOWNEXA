import { Body, Controller, Delete, Get, Patch, Post, Req, UseGuards, Param } from "@nestjs/common";
import { ArrayMaxSize, IsArray, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationsService } from "./organizations.service";
import { TeamsService } from "./teams.service";
type AuthRequest = Request & { user: { sub: string } };
class CreateOrganizationDto { @IsString() @MinLength(2) @MaxLength(100) name!: string; @IsString() @MinLength(2) @MaxLength(50) workspaceName!: string; }
class CreateTeamDto { @IsString() workspaceId!: string; @IsString() @MinLength(2) @MaxLength(80) name!: string; }
class TeamMemberDto { @IsString() userId!: string; }
class SaveRoleDto { @IsOptional() @IsString() id?: string; @IsString() @MinLength(2) @MaxLength(80) name!: string; @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) permissions!: string[]; }
class AssignRoleDto { @IsOptional() @IsString() roleId?: string | null; }
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
  @Get(":organizationId/members") members(@Req() req: AuthRequest, @Param("organizationId") orgId: string) { return this.teams.listMembers(req.user.sub, orgId); }
  @Post(":organizationId/teams") createTeam(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: CreateTeamDto) { return this.teams.create(req.user.sub, orgId, body); }
  @Post(":organizationId/teams/:teamId/members") addTeamMember(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("teamId") teamId: string, @Body() body: TeamMemberDto) { return this.teams.addMember(req.user.sub, orgId, teamId, body.userId); }
  @Delete(":organizationId/teams/:teamId/members/:userId") removeTeamMember(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("teamId") teamId: string, @Param("userId") userId: string) { return this.teams.removeMember(req.user.sub, orgId, teamId, userId); }
  @Get(":organizationId/roles") roles(@Req() req: AuthRequest, @Param("organizationId") orgId: string) { return this.teams.listRoles(req.user.sub, orgId); }
  @Post(":organizationId/roles") saveRole(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: SaveRoleDto) { return this.teams.saveRole(req.user.sub, orgId, body); }
  @Patch(":organizationId/members/:userId/role") assignRole(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("userId") userId: string, @Body() body: AssignRoleDto) { return this.teams.assignRole(req.user.sub, orgId, userId, body.roleId ?? null); }
  @Post(":organizationId/invitations") invite(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: InviteDto) { return this.service.invite(req.user.sub, orgId, body); }
  @Post(":organizationId/invitations/accept") accept(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: AcceptInviteDto) { return this.service.acceptInvite(req.user.sub, orgId, body.token); }
}
