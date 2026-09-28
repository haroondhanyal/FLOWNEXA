import { Module } from "@nestjs/common";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { TeamsService } from "./teams.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
@Module({ controllers: [OrganizationsController], providers: [OrganizationsService, TeamsService, JwtAuthGuard] })
export class OrganizationsModule {}
