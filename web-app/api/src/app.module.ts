import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { ProjectsModule } from "./projects/projects.module";
import { TasksModule } from "./tasks/tasks.module";
import { WorkUpdatesModule } from "./work-updates/work-updates.module";
import { HealthController } from "./health.controller";
import { WorkspaceToolsModule } from "./workspace-tools/workspace-tools.module";
import { AiModule } from "./ai/ai.module";
import { EventsModule } from "./events/events.module";

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../.env", ".env"] }), ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]), PrismaModule, AuthModule, OrganizationsModule, ProjectsModule, TasksModule, WorkUpdatesModule, WorkspaceToolsModule, AiModule, EventsModule], controllers: [HealthController], providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }] })
export class AppModule {}
