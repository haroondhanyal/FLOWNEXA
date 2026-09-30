import type { Page } from "@playwright/test";

// CENTRAL LOCATORS: keep selectors in one place so UI updates are easy for the team to maintain.
export class WebLocators {
  constructor(private readonly page: Page) {}
  get loginEmail() { return this.page.locator('input[name="email"]'); }
  get loginPassword() { return this.page.locator('input[name="password"]'); }
  get loginSubmit() { return this.page.getByRole("button", { name: "Sign in", exact: true }); }
  get workspaceNav() { return this.page.locator(".sidebar nav .nav-item"); }
  get breadcrumb() { return this.page.locator(".breadcrumbs b"); }
  get overviewContent() { return this.page.locator(".welcome-row"); }
  get workspaceView() { return this.page.locator(".workspace-view"); }
  get workspaceHeading() { return this.workspaceView.locator(".view-heading h1"); }
  get createTaskButton() { return this.page.getByRole("button", { name: "Create new" }); }
  get taskDialog() { return this.page.getByRole("heading", { name: "Create a task" }); }
  get taskTitleInput() { return this.page.locator('.create-modal input[name="title"]'); }
  get taskProjectSelect() { return this.page.locator('.create-modal select[name="project"]'); }
  get taskDueDate() { return this.page.locator('.create-modal input[name="due"]'); }
  get toast() { return this.page.locator(".toast"); }
  // XPath references are kept alongside semantic locators for legacy UI surfaces.
  get mainByXPath() { return this.page.locator('xpath=//main[contains(@class,"app-shell")]'); }
  get activeNavigationByXPath() { return this.page.locator('xpath=//nav//button[contains(@class,"nav-item") and contains(@class,"selected")]'); }
  get workspaceHeadingByXPath() { return this.page.locator('xpath=//section[contains(@class,"workspace-view")]//h1'); }
}
