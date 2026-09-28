import { BadRequestException, Body, Controller, Delete, Get, Patch, Post, Req, UseGuards, Param, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ArrayMaxSize, IsArray, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationsService } from "./organizations.service";
import { TeamsService } from "./teams.service";
type AuthRequest = Request & { user: { sub: string } };
type WorkspaceLogoFile = { buffer: Buffer };
class CreateOrganizationDto { @IsString() @MinLength(2) @MaxLength(100) name!: string; @IsString() @MinLength(2) @MaxLength(50) workspaceName!: string; }
class CreateTeamDto { @IsString() workspaceId!: string; @IsString() @MinLength(2) @MaxLength(80) name!: string; }
class CreateWorkspaceDto { @IsString() @MinLength(2) @MaxLength(80) name!: string; }
class UpdateWorkspaceDto extends CreateWorkspaceDto { @IsOptional() @IsString() clearLogo?: string; }
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
  @Post(":organizationId/workspaces") createWorkspace(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: CreateWorkspaceDto) { return this.service.createWorkspace(req.user.sub, orgId, body.name); }
  @Patch(":organizationId/workspaces/:workspaceId") @UseInterceptors(FileInterceptor("logo", { limits: { fileSize: 1024 * 1024 } })) updateWorkspace(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("workspaceId") workspaceId: string, @Body() body: UpdateWorkspaceDto, @UploadedFile() logo?: WorkspaceLogoFile) {
    let logoUrl: string | null | undefined;
    if (logo) {
      const png = logo.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpeg = logo.buffer[0] === 0xff && logo.buffer[1] === 0xd8 && logo.buffer[2] === 0xff;
      if (!png && !jpeg) throw new BadRequestException("Workspace logos must be PNG or JPEG images");
      logoUrl = `data:${png ? "image/png" : "image/jpeg"};base64,${logo.buffer.toString("base64")}`;
    } else if (body.clearLogo === "true") logoUrl = null;
    return this.service.updateWorkspace(req.user.sub, orgId, workspaceId, { name: body.name.trim(), ...(logoUrl !== undefined ? { logoUrl } : {}) });
  }
  @Get(":organizationId/teams") teamsList(@Req() req: AuthRequest, @Param("organizationId") orgId: string) { return this.teams.list(req.user.sub, orgId); }
  @Get(":organizationId/members") members(@Req() req: AuthRequest, @Param("organizationId") orgId: string) { return this.teams.listMembers(req.user.sub, orgId); }
  @Post(":organizationId/teams") createTeam(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: CreateTeamDto) { return this.teams.create(req.user.sub, orgId, body); }
  @Post(":organizationId/teams/:teamId/members") addTeamMember(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("teamId") teamId: string, @Body() body: TeamMemberDto) { return this.teams.addMember(req.user.sub, orgId, teamId, body.userId); }
  @Delete(":organizationId/teams/:teamId/members/:userId") removeTeamMember(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("teamId") teamId: string, @Param("userId") userId: string) { return this.teams.removeMember(req.user.sub, orgId, teamId, userId); }
  @Get(":organizationId/roles") roles(@Req() req: AuthRequest, @Param("organizationId") orgId: string) { return this.teams.listRoles(req.user.sub, orgId); }
  @Post(":organizationId/roles") saveRole(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: SaveRoleDto) { return this.teams.saveRole(req.user.sub, orgId, body); }
  @Patch(":organizationId/members/:userId/role") assignRole(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("userId") userId: string, @Body() body: AssignRoleDto) { return this.teams.assignRole(req.user.sub, orgId, userId, body.roleId ?? null); }
  @Post(":organizationId/invitations") invite(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: InviteDto) { return this.service.invite(req.user.sub, orgId, body); }
  @Get(":organizationId/invitations") invitations(@Req() req: AuthRequest, @Param("organizationId") orgId: string) { return this.service.listInvitations(req.user.sub, orgId); }
  @Delete(":organizationId/invitations/:invitationId") revokeInvitation(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("invitationId") invitationId: string) { return this.service.revokeInvitation(req.user.sub, orgId, invitationId); }
  @Post(":organizationId/invitations/:invitationId/resend") resendInvitation(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("invitationId") invitationId: string) { return this.service.resendInvitation(req.user.sub, orgId, invitationId); }
  @Post(":organizationId/invitations/accept") accept(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: AcceptInviteDto) { return this.service.acceptInvite(req.user.sub, orgId, body.token); }
}
