import type { Page } from "@playwright/test";
import { WebLocators } from "../locators/web.locators";

// LOGIN PAGE OBJECT: small actions for the public sign-in screen.
export class LoginPage {
  readonly locators: WebLocators;
  constructor(private readonly page: Page) { this.locators = new WebLocators(page); }
  async open() { await this.page.goto("/login"); }
  async signIn(email: string, password: string) {
    await this.locators.loginEmail.fill(email);
    await this.locators.loginPassword.fill(password);
    await this.locators.loginSubmit.click();
  }
}
