import type { TestInfo } from "@playwright/test";
import { attachment, ContentType } from "allure-js-commons";

const sensitiveKey = /(password|hash|token|secret|authorization|cookie|email|phone|body|content)/i;
export function mask(value: unknown, key = ""): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => mask(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, mask(child, childKey)]));
  if (typeof value === "string") return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]").slice(0, 1000);
  return value;
}

export async function attachDatabaseEvidence(testInfo: TestInfo, evidence: Record<string, unknown>) {
  const content = JSON.stringify(mask({ recordedAt: new Date().toISOString(), ...evidence }), null, 2);
  await attachment("database-validation.json", content, { contentType: ContentType.JSON, fileExtension: "json" });
  await testInfo.attach("database-validation.json", {
    body: content,
    contentType: "application/json",
  });
}
