import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { WorkspaceToolsService } from "./workspace-tools.service";

type AuthRequest = Request & { user: { sub: string } };
class ReviewDto { @IsIn(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]) status!: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED"; @IsOptional() @IsString() @MaxLength(4000) comment?: string; }
class DeviceTokenDto { @IsString() @MaxLength(512) token!: string; }

// Small workspace endpoints for reviews, reports, notifications, and search.
@Controller("organizations/:organizationId") @UseGuards(JwtAuthGuard)
export class WorkspaceToolsController {
  constructor(private readonly service: WorkspaceToolsService) {}
  @Get("reviews") reviews(@Req() req: AuthRequest, @Param("organizationId") orgId: string) { return this.service.reviews(req.user.sub, orgId); }
  @Post("tasks/:taskId/reviews") requestReview(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("taskId") taskId: string) { return this.service.requestReview(req.user.sub, orgId, taskId); }
  @Patch("reviews/:reviewId") decideReview(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("reviewId") reviewId: string, @Body() body: ReviewDto) { return this.service.decideReview(req.user.sub, orgId, reviewId, body); }
  @Get("audit-history") audit(@Req() req: AuthRequest, @Param("organizationId") orgId: string) { return this.service.audit(req.user.sub, orgId); }
  @Get("reports/summary") report(@Req() req: AuthRequest, @Param("organizationId") orgId: string) { return this.service.report(req.user.sub, orgId); }
  @Get("search") search(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Query("q") q = "") { return this.service.search(req.user.sub, orgId, typeof q === "string" ? q : ""); }
  @Get("notifications") notifications(@Req() req: AuthRequest, @Param("organizationId") orgId: string) { return this.service.notifications(req.user.sub, orgId); }
  @Patch("notifications/:notificationId/read") markRead(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("notificationId") id: string) { return this.service.markRead(req.user.sub, orgId, id); }
  @Patch("notifications/:notificationId/archive") archive(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Param("notificationId") id: string) { return this.service.archiveNotification(req.user.sub, orgId, id); }
  @Post("device-tokens") registerDevice(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: DeviceTokenDto) { return this.service.registerDevice(req.user.sub, orgId, body.token); }
  @Patch("device-tokens") removeDevice(@Req() req: AuthRequest, @Param("organizationId") orgId: string, @Body() body: DeviceTokenDto) { return this.service.removeDevice(req.user.sub, orgId, body.token); }
}
