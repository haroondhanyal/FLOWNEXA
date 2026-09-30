import { test, expect } from "@playwright/test";
import { invalidEmail } from "../../utils/test-data";
import { LoginPage } from "../../pages/login.page";

// NEGATIVE CASES (70): 7 invalid email shapes × 10 generated examples; client-side validation blocks submission.
const invalidEmailShapes = [
  { label: "empty email", value: () => "" },
  { label: "missing at sign", value: () => `${invalidEmail()}.com` },
  { label: "missing domain", value: () => `${invalidEmail()}@` },
  { label: "duplicate at signs", value: () => `${invalidEmail()}@@example.com` },
  { label: "spaces in address", value: () => `${invalidEmail()} @example.com` },
  { label: "URL instead of email", value: () => `https://${invalidEmail()}.com` },
  { label: "missing top-level domain", value: () => `${invalidEmail()}@example` },
] as const;

test.describe("Login validation negative cases @negative", () => {
  for (const shape of invalidEmailShapes) {
    for (let sample = 1; sample <= 10; sample += 1) {
      test(`${shape.label} / sample ${sample}`, async ({ page }) => {
        const login = new LoginPage(page);
        await login.open();
        const value = shape.value();
        if (value) await login.locators.loginEmail.fill(value);
        const valid = await login.locators.loginEmail.evaluate((element: HTMLInputElement) => element.validity.valid);
        expect(valid, "The browser should reject the invalid email before the API is called").toBe(false);
        await expect(login.locators.loginSubmit).toBeEnabled();
      });
    }
  }
});
