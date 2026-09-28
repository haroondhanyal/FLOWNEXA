import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Namespace, Socket } from "socket.io";
import { PrismaService } from "../prisma/prisma.service";

// The client must authenticate once and prove organization membership per room.
@Injectable()
@WebSocketGateway({ namespace: "/events", cors: { origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true } })
export class EventsGateway {
  private readonly logger = new Logger(EventsGateway.name);
  @WebSocketServer() private server!: Namespace;
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (typeof token !== "string") { client.emit("auth-expired"); client.disconnect(true); return; }
    try {
      const user = await this.jwt.verifyAsync<{ sub: string }>(token, { issuer: "flownexa-api", audience: "flownexa-web" });
      client.data.userId = user.sub;
    } catch { client.emit("auth-expired"); client.disconnect(true); }
  }

  @SubscribeMessage("join-organization")
  async joinOrganization(@MessageBody() organizationId: unknown, @ConnectedSocket() client: Socket) {
    if (typeof client.data.userId !== "string" || typeof organizationId !== "string" || organizationId.length > 100) return { ok: false };
    const membership = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: client.data.userId } }, select: { id: true } });
    if (!membership) return { ok: false };
    await client.join(`organization:${organizationId}`);
    return { ok: true };
  }

  publish(organizationId: string, event: string, payload: Record<string, unknown>) {
    if (this.server) this.server.to(`organization:${organizationId}`).emit(event, payload);
    else this.logger.warn("Realtime event skipped before gateway initialization");
  }
}
