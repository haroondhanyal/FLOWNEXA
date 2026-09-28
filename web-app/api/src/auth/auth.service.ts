import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto, RegisterDto } from "./dto";
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  async register(input: RegisterDto) {
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException("An account with this email already exists");
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({ data: { email, name: input.name.trim(), passwordHash } });
    return { user: { id: user.id, email: user.email, name: user.name }, ...(await this.tokens(user.id, user.email)) };
  }
  async login(input: LoginDto) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw new UnauthorizedException("Email or password is incorrect");
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
}
