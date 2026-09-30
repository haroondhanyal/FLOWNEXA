import type { Page } from "@playwright/test";
import { ScreenLocators } from "../locators/screen.locators";

// SCREEN PAGE OBJECTS: named routes keep each module easy for developers to find and extend.
export class WorkspaceScreenPage {
  readonly locators: ScreenLocators;
  constructor(readonly page: Page, readonly name: string) { this.locators = new ScreenLocators(page); }
  async open() {
    if (this.name === "Search") {
      await this.page.getByPlaceholder("Search anything...").focus();
      return;
    }
    const navItem = this.page.locator(".sidebar nav .nav-item").filter({ has: this.page.getByText(this.name, { exact: true }) });
    if (await navItem.count()) await navItem.click();
    else if (this.name === "Search") {
      await this.page.getByPlaceholder("Search anything...").focus();
      await this.page.keyboard.press("Enter");
    } else throw new Error(`No navigation entry for ${this.name}`);
  }
  async expectVisible() {
    if (this.name === "Overview") await this.locators.overview.waitFor({ state: "visible" });
    else await this.page.locator(".workspace-view").waitFor({ state: "visible" });
  }
}
export const screenPage = (page: Page, name: string) => new WorkspaceScreenPage(page, name);
