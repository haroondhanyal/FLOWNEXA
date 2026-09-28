import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { EventsModule } from "../events/events.module";
@Module({ imports: [EventsModule], controllers: [TasksController], providers: [TasksService, JwtAuthGuard] })
export class TasksModule {}
