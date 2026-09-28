import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AiService } from "./ai.service";

type AuthRequest = Request & { user: { sub: string } };
class AskDto { @IsString() @MinLength(2) @MaxLength(4000) message!: string; @IsString() @MinLength(1) organizationId!: string; }
class WeeklySummaryDto { @IsString() @MinLength(1) organizationId!: string; }
class DailyPlanDto { @IsString() @MinLength(1) organizationId!: string; }
class BreakdownDto { @IsString() @MinLength(1) organizationId!: string; @IsString() @MinLength(2) @MaxLength(200) title!: string; @IsOptional() @IsString() @MaxLength(4000) description?: string; }

// All model requests stay behind JWT auth and use the caller's organization.
@Controller("ai") @UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly service: AiService) {}
  @Post("ask") ask(@Req() req: AuthRequest, @Body() body: AskDto) { return this.service.ask(req.user.sub, body.organizationId, body.message); }
  @Post("weekly-summary") summary(@Req() req: AuthRequest, @Body() body: WeeklySummaryDto) { return this.service.weeklySummary(req.user.sub, body.organizationId); }
  @Post("daily-plan") dailyPlan(@Req() req: AuthRequest, @Body() body: DailyPlanDto) { return this.service.dailyPlan(req.user.sub, body.organizationId); }
  @Post("task-breakdown") breakdown(@Req() req: AuthRequest, @Body() body: BreakdownDto) { return this.service.breakdown(req.user.sub, body.organizationId, body.title, body.description); }
}
