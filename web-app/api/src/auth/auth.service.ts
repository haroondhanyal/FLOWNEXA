import { ConflictException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto, RegisterDto } from "./dto";
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  async register(input: RegisterDto) {
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException("An account with this email already exists");
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({ data: { email, name: input.name.trim(), passwordHash } });
    await this.sendVerification(user.id, user.email);
    if (process.env.REQUIRE_EMAIL_VERIFICATION === "true") return { user: { id: user.id, email: user.email, name: user.name }, verificationRequired: true as const };
    return { user: { id: user.id, email: user.email, name: user.name }, ...(await this.tokens(user.id, user.email)) };
  }
  async login(input: LoginDto) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw new UnauthorizedException("Email or password is incorrect");
    if (process.env.REQUIRE_EMAIL_VERIFICATION === "true" && !user.emailVerifiedAt) throw new UnauthorizedException("Verify your email before signing in");
    return { user: { id: user.id, email: user.email, name: user.name }, ...(await this.tokens(user.id, user.email)) };
  }
  private async tokens(sub: string, email: string) {
    const accessToken = await this.jwt.signAsync({ sub, email });
    const sessionId = randomUUID();
    const refreshToken = await this.jwt.signAsync({ sub, sid: sessionId, type: "refresh" }, { secret: process.env.JWT_REFRESH_SECRET!, expiresIn: "30d", issuer: "flownexa-api", audience: "flownexa-refresh" });
    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    await this.prisma.session.create({ data: { id: sessionId, userId: sub, refreshTokenHash, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
    return { accessToken, refreshToken, sessionId };
  }
  async refresh(token?: string) {
    if (!token) throw new UnauthorizedException();
    let payload: { sub: string; sid: string; type: string };
    try { payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_REFRESH_SECRET!, issuer: "flownexa-api", audience: "flownexa-refresh" }); }
    catch { throw new UnauthorizedException(); }
    if (payload.type !== "refresh" || !payload.sid || !payload.sub) throw new UnauthorizedException();
    const session = await this.prisma.session.findFirst({ where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!session || !(await bcrypt.compare(token, session.refreshTokenHash))) throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, name: true } });
    if (!user) throw new UnauthorizedException();
    const tokens = await this.tokens(user.id, user.email);
    const rotated = await this.prisma.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (rotated.count !== 1) { await this.prisma.session.updateMany({ where: { id: tokens.sessionId, revokedAt: null }, data: { revokedAt: new Date() } }); throw new UnauthorizedException(); }
    return { user, ...tokens };
  }
  async logout(token?: string) {
    if (!token) return;
    try { const payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_REFRESH_SECRET!, issuer: "flownexa-api", audience: "flownexa-refresh" }); if (payload.sid) await this.prisma.session.updateMany({ where: { id: payload.sid, revokedAt: null }, data: { revokedAt: new Date() } }); } catch { /* Expired and invalid tokens are already unusable. */ }
  }
  async me(id: string) { const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, avatarUrl: true } }); if (!user) throw new UnauthorizedException(); return user; }

  // ACCOUNT RECOVERY: store only hashed one-time tokens and revoke active sessions after a password reset.
  private tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
  private async issueAuthToken(userId: string, type: "PASSWORD_RESET" | "EMAIL_VERIFICATION", expiresInMs: number) {
    const token = randomBytes(32).toString("base64url");
    await this.prisma.$transaction([
      this.prisma.authToken.updateMany({ where: { userId, type, consumedAt: null }, data: { consumedAt: new Date() } }),
      this.prisma.authToken.create({ data: { userId, type, tokenHash: this.tokenHash(token), expiresAt: new Date(Date.now() + expiresInMs) } }),
    ]);
    return token;
  }
  private async sendEmailLink(email: string, subject: string, path: string, token: string) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) { if (process.env.NODE_ENV === "production") this.logger.error("Email delivery is not configured; account security email was not sent"); return; } // Never expose a token in API output.
    const origin = (process.env.WEB_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    try {
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [email], subject, html: `<p>Use this secure one-time link to continue:</p><p><a href="${origin}${path}?token=${encodeURIComponent(token)}">Continue to FlowNexa</a></p><p>If you did not request this, you can ignore this email.</p>` }) });
      if (!response.ok) this.logger.error(`Email provider returned HTTP ${response.status}`);
    } catch { this.logger.error("Email provider request failed"); }
  }
  private async sendVerification(userId: string, email: string) { const token = await this.issueAuthToken(userId, "EMAIL_VERIFICATION", 24 * 60 * 60 * 1000); await this.sendEmailLink(email, "Verify your FlowNexa email", "/verify-email", token); }
  async requestEmailVerification(userId: string) { const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, emailVerifiedAt: true } }); if (!user) throw new UnauthorizedException(); if (!user.emailVerifiedAt) await this.sendVerification(user.id, user.email); return { ok: true }; }
  async verifyEmail(token: string) {
    const item = await this.prisma.authToken.findFirst({ where: { tokenHash: this.tokenHash(token), type: "EMAIL_VERIFICATION", consumedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, userId: true } });
    if (!item) throw new UnauthorizedException("This verification link is invalid or expired");
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => { const consumed = await tx.authToken.updateMany({ where: { id: item.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } }); if (consumed.count !== 1) throw new UnauthorizedException("This verification link is invalid or expired"); return tx.user.update({ where: { id: item.userId }, data: { emailVerifiedAt: now }, select: { id: true, email: true } }); });
    return { ok: true, user: result };
  }
  async forgotPassword(emailInput: string) {
    const email = emailInput.trim().toLowerCase(); const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (user) { const token = await this.issueAuthToken(user.id, "PASSWORD_RESET", 60 * 60 * 1000); await this.sendEmailLink(user.email, "Reset your FlowNexa password", "/reset-password", token); }
    return { ok: true, message: "If an account exists for this email, password reset instructions will arrive shortly." };
  }
  async resetPassword(token: string, password: string) {
    const item = await this.prisma.authToken.findFirst({ where: { tokenHash: this.tokenHash(token), type: "PASSWORD_RESET", consumedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, userId: true } });
    if (!item) throw new UnauthorizedException("This reset link is invalid or expired");
    const now = new Date(); const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async (tx) => { const consumed = await tx.authToken.updateMany({ where: { id: item.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } }); if (consumed.count !== 1) throw new UnauthorizedException("This reset link is invalid or expired"); await tx.user.update({ where: { id: item.userId }, data: { passwordHash } }); await tx.session.updateMany({ where: { userId: item.userId, revokedAt: null }, data: { revokedAt: now } }); });
    return { ok: true };
  }
}
