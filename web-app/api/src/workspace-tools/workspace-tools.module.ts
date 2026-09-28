import { Module } from "@nestjs/common";
import { WorkspaceToolsController } from "./workspace-tools.controller";
import { WorkspaceToolsService } from "./workspace-tools.service";
import { EventsModule } from "../events/events.module";

@Module({ imports: [EventsModule], controllers: [WorkspaceToolsController], providers: [WorkspaceToolsService] })
export class WorkspaceToolsModule {}
