import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { WorkUpdatesController } from "./work-updates.controller";
import { WorkUpdatesService } from "./work-updates.service";
import { EventsModule } from "../events/events.module";
@Module({ imports: [EventsModule], controllers: [WorkUpdatesController], providers: [WorkUpdatesService, JwtAuthGuard] })
export class WorkUpdatesModule {}
