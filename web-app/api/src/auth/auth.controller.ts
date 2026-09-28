import { BadRequestException, Body, Controller, Get, Patch, Post, Req, Res, UploadedFile, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { UseInterceptors } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, UpdateProfileDto, VerifyEmailDto } from "./dto";
import { Throttle } from "@nestjs/throttler";
type AvatarFile = { buffer: Buffer };
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
  @Patch("me") @UseGuards(JwtAuthGuard) @UseInterceptors(FileInterceptor("avatar", { limits: { fileSize: 2 * 1024 * 1024 } })) async updateMe(@Req() req: { user: { sub: string } }, @Body() body: UpdateProfileDto, @UploadedFile() avatar?: AvatarFile) {
    let avatarUrl: string | null | undefined;
    if (avatar) {
      const png = avatar.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpeg = avatar.buffer[0] === 0xff && avatar.buffer[1] === 0xd8 && avatar.buffer[2] === 0xff;
      if (!png && !jpeg) throw new BadRequestException("Profile photos must be PNG or JPEG images");
      avatarUrl = `data:${png ? "image/png" : "image/jpeg"};base64,${avatar.buffer.toString("base64")}`;
    } else if (body.clearAvatar === "true") avatarUrl = null;
    return this.auth.updateProfile(req.user.sub, { name: body.name.trim(), phoneNumber: body.phoneNumber.trim(), ...(avatarUrl !== undefined ? { avatarUrl } : {}) });
  }
  @Patch("password") @UseGuards(JwtAuthGuard) changePassword(@Req() req: { user: { sub: string } }, @Body() body: ChangePasswordDto) { return this.auth.changePassword(req.user.sub, body.currentPassword, body.newPassword); }
}
