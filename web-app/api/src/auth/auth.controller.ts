import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { LoginDto, RegisterDto } from "./dto";
import { Throttle } from "@nestjs/throttler";
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  private setRefreshCookie(response: Response, token: string) { response.cookie("flownexa_refresh", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/v1/auth", maxAge: 30 * 24 * 60 * 60 * 1000 }); }
  @Post("register") @Throttle({ default: { limit: 5, ttl: 60000 } }) async register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: Response) { const result = await this.auth.register(body); this.setRefreshCookie(response, result.refreshToken); return { user: result.user, accessToken: result.accessToken }; }
  @Post("login") @Throttle({ default: { limit: 10, ttl: 60000 } }) async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) { const result = await this.auth.login(body); this.setRefreshCookie(response, result.refreshToken); return { user: result.user, accessToken: result.accessToken }; }
  @Post("refresh") async refresh(@Req() req: Request, @Res({ passthrough: true }) response: Response) { const result = await this.auth.refresh(req.cookies?.flownexa_refresh); this.setRefreshCookie(response, result.refreshToken); return { user: result.user, accessToken: result.accessToken }; }
  @Post("logout") async logout(@Req() req: Request, @Res({ passthrough: true }) response: Response) { await this.auth.logout(req.cookies?.flownexa_refresh); response.clearCookie("flownexa_refresh", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/v1/auth" }); return { ok: true }; }
  @Get("me") @UseGuards(JwtAuthGuard) me(@Req() req: { user: { sub: string } }) { return this.auth.me(req.user.sub); }
}
