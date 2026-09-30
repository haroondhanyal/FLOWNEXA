import type { Page } from "@playwright/test";
import { WebLocators } from "../locators/web.locators";

// APP PAGE OBJECT: navigation and common workspace actions used by screen suites.
export class AppPage {
  readonly locators: WebLocators;
  constructor(readonly page: Page) { this.locators = new WebLocators(page); }
  async open() {
    await this.page.goto("/", { waitUntil: "domcontentloaded" });
    await this.locators.overviewContent.waitFor({ state: "visible", timeout: 15_000 });
  }
  async openScreen(screen: string) {
    if (screen === "Search") {
      await this.page.getByPlaceholder("Search anything...").focus();
      await this.locators.breadcrumb.filter({ hasText: "Search" }).waitFor({ state: "visible" });
      return;
    }
    if (screen === "Overview") {
      const overview = this.page.locator(".sidebar nav .nav-item").filter({ hasText: "Overview" });
      await overview.click();
      return;
    }
    await this.locators.workspaceNav.filter({ hasText: screen }).click();
    await this.locators.breadcrumb.filter({ hasText: screen }).waitFor({ state: "visible" });
  }
  async createTask(title: string, projectIndex = 0, dueDate = "") {
    await this.locators.createTaskButton.click();
    await this.locators.taskDialog.waitFor({ state: "visible" });
    await this.locators.taskTitleInput.fill(title);
    const project = this.locators.taskProjectSelect;
    const options = await project.locator("option").count();
    if (options <= 1) throw new Error("Create a project in the test workspace before running task-creation workflows.");
    await project.selectOption({ index: Math.min(projectIndex + 1, options - 1) });
    if (dueDate) await this.locators.taskDueDate.fill(dueDate);
    await this.page.getByRole("button", { name: "Create task", exact: false }).last().click();
  }
}
