import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, VerifyEmailDto } from "./dto";
import { Throttle } from "@nestjs/throttler";
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  // A session cookie keeps "Remember me" off across browser restarts; opted-in users get 30 days.
  private setRefreshCookie(response: Response, token: string, rememberMe = false) { response.cookie("flownexa_refresh", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/v1/auth", ...(rememberMe ? { maxAge: 30 * 24 * 60 * 60 * 1000 } : {}) }); }
  @Post("register") @Throttle({ default: { limit: 5, ttl: 60000 } }) async register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: Response) { const result = await this.auth.register(body); if (!("refreshToken" in result)) return { user: result.user, verificationRequired: true }; this.setRefreshCookie(response, result.refreshToken); return { user: result.user, accessToken: result.accessToken }; }
  @Post("login") @Throttle({ default: { limit: 10, ttl: 60000 } }) async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) { const result = await this.auth.login(body); this.setRefreshCookie(response, result.refreshToken, result.rememberMe); return { user: result.user, accessToken: result.accessToken }; }
  @Post("refresh") async refresh(@Req() req: Request, @Res({ passthrough: true }) response: Response) { const result = await this.auth.refresh(req.cookies?.flownexa_refresh); this.setRefreshCookie(response, result.refreshToken, result.rememberMe); return { user: result.user, accessToken: result.accessToken }; }
  @Post("logout") async logout(@Req() req: Request, @Res({ passthrough: true }) response: Response) { await this.auth.logout(req.cookies?.flownexa_refresh); response.clearCookie("flownexa_refresh", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/v1/auth" }); return { ok: true }; }
  @Post("forgot-password") @Throttle({ default: { limit: 5, ttl: 60000 } }) forgotPassword(@Body() body: ForgotPasswordDto) { return this.auth.forgotPassword(body.email); }
  @Post("reset-password") @Throttle({ default: { limit: 5, ttl: 60000 } }) resetPassword(@Body() body: ResetPasswordDto) { return this.auth.resetPassword(body.token, body.password); }
  @Post("verify-email") @Throttle({ default: { limit: 8, ttl: 60000 } }) verifyEmail(@Body() body: VerifyEmailDto) { return this.auth.verifyEmail(body.token); }
  @Post("verification-email") @UseGuards(JwtAuthGuard) @Throttle({ default: { limit: 3, ttl: 60000 } }) requestVerification(@Req() req: { user: { sub: string } }) { return this.auth.requestEmailVerification(req.user.sub); }
  @Get("me") @UseGuards(JwtAuthGuard) me(@Req() req: { user: { sub: string } }) { return this.auth.me(req.user.sub); }
}
