import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
type AuthRequest = Request & { user?: { sub: string; email: string } };
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException();
    try { request.user = await this.jwt.verifyAsync<{ sub: string; email: string }>(token, { issuer: "flownexa-api", audience: "flownexa-web" }); return true; }
    catch { throw new UnauthorizedException(); }
  }
}
