import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config as loadEnv } from "dotenv";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  loadEnv({ path: ["../.env", ".env"] });
  Object.defineProperty(BigInt.prototype, "toJSON", { value: function (this: bigint) { return this.toString(); }, configurable: true });
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be set to a random value of at least 32 characters");
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) throw new Error("JWT_REFRESH_SECRET must be set to a random value of at least 32 characters");
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const swaggerConfig = new DocumentBuilder().setTitle("FlowNexa API").setDescription("Versioned work management API").setVersion("1.0").addBearerAuth().build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swaggerConfig), { useGlobalPrefix: true });
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
