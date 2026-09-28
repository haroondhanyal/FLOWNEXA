import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
@Module({ controllers: [ProjectsController], providers: [ProjectsService, JwtAuthGuard] })
export class ProjectsModule {}
