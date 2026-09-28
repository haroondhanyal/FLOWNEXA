import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
@Global()
@Module({ imports: [ConfigModule, JwtModule.registerAsync({ imports: [ConfigModule], inject: [ConfigService], useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>("JWT_SECRET"), signOptions: { expiresIn: "15m", issuer: "flownexa-api", audience: "flownexa-web" } }) })], controllers: [AuthController], providers: [AuthService, JwtAuthGuard], exports: [JwtModule, JwtAuthGuard] })
export class AuthModule {}
