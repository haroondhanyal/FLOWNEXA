import { PrismaClient } from "../../../api/node_modules/.prisma/client";
import { env } from "../../config/env";

export const prisma = new PrismaClient({ datasources: { db: { url: env.databaseUrl || undefined } } });

export function assertNonProductionDatabase() {
  if (!env.databaseUrl) throw new Error("DATABASE_URL is missing. Set it in automation/.env or web-app/.env.");
  let url: URL;
  try { url = new URL(env.databaseUrl); } catch { throw new Error("DATABASE_URL is not a valid database URL."); }
  const host = url.hostname.toLowerCase();
  const safeHost = ["localhost", "127.0.0.1", "::1", "postgres", "db"].includes(host);
  const safeEnvironment = ["local", "development", "dev", "test", "qa"].includes(env.databaseEnvironment.toLowerCase());
  if (!safeHost && !safeEnvironment) throw new Error("Refusing database mutation: set DB_ENVIRONMENT=qa (or another non-production label) for an approved test database.");
  if (/prod(uction)?/i.test(env.databaseEnvironment)) throw new Error("Refusing database mutation against a production environment.");
}

export function safeError(error: unknown) {
  const source = error instanceof Error ? error.message : String(error);
  return source
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[DATABASE_URL]")
    .replace(/(password|token|secret|authorization)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, 700);
}
