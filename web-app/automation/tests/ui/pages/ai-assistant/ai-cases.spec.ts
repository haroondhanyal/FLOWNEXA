import { faker } from "@faker-js/faker";
import { expect, test } from "../../../../fixtures/test";

async function openAi(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/ai/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ answer: `Mocked ${path.split("/").pop()} insight` }) });
  });
  const { AppPage } = await import("../../../../pages/app.page");
  const app = new AppPage(page);
  await app.open();
  await app.openScreen("AI assistant");
  return app;
}

test.describe("AI assistant positive and negative cases @ai", () => {
  test("positive / Faker prompt returns a workspace answer", async ({ app }) => {
    await openAi(app.page);
    const prompt = `${faker.company.catchPhrase()} ${faker.lorem.sentence()}`;
    await app.page.getByRole("textbox", { name: "Your question" }).fill(prompt);
    await app.page.getByRole("button", { name: "Send question" }).click();
    await expect(app.page.getByText("Mocked ask insight")).toBeVisible();
    await expect(app.page.getByText(prompt, { exact: true })).toBeVisible();
  });

  test("positive / weekly summary action uses its own endpoint", async ({ app }) => {
    const page = app.page;
    await openAi(page);
    await page.getByRole("button", { name: "Weekly summary" }).click();
    await expect(page.getByText("Mocked weekly-summary insight")).toBeVisible();
  });

  test("positive / task breakdown action uses Faker task wording", async ({ app }) => {
    const page = app.page;
    await openAi(page);
    await page.getByRole("textbox", { name: "Your question" }).fill(faker.hacker.phrase());
    await page.getByRole("button", { name: "Break down task" }).click();
    await expect(page.getByText("Mocked task-breakdown insight")).toBeVisible();
  });

  test("negative / blank prompt cannot be submitted", async ({ app }) => {
    await openAi(app.page);
    await expect(app.page.getByRole("button", { name: "Send question" })).toBeDisabled();
  });

  test("negative / unsupported attachment is rejected before submit", async ({ app }) => {
    await openAi(app.page);
    await app.page.locator('input[type="file"]').setInputFiles({ name: "payload.exe", mimeType: "application/octet-stream", buffer: Buffer.from("not supported") });
    await expect(app.page.locator(".ai-response.ai-error")).toContainText("files supported");
    await expect(app.page.getByRole("button", { name: "Send question" })).toBeDisabled();
  });

  test("negative / a file larger than 2 MB is rejected", async ({ app }) => {
    await openAi(app.page);
    await app.page.locator('input[type="file"]').setInputFiles({ name: `${faker.string.alphanumeric(6)}.txt`, mimeType: "text/plain", buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 97) });
    await expect(app.page.locator(".ai-response.ai-error")).toContainText("2 MB");
  });

  test("negative / the fourth attachment exceeds the three-file limit", async ({ app }) => {
    await openAi(app.page);
    const input = app.page.locator('input[type="file"]');
    for (let index = 0; index < 3; index++) {
      await input.setInputFiles({ name: `${faker.string.alphanumeric(6)}-${index}.txt`, mimeType: "text/plain", buffer: Buffer.from(`fixture ${index}`) });
      await expect(app.page.locator(".ai-attachment-chip")).toHaveCount(index + 1);
    }
    await input.setInputFiles({ name: `${faker.string.alphanumeric(6)}-fourth.txt`, mimeType: "text/plain", buffer: Buffer.from("fixture") });
    await expect(app.page.locator(".ai-response.ai-error")).toContainText("3 files");
    await expect(app.page.locator(".ai-attachment-chip")).toHaveCount(3);
  });
});
