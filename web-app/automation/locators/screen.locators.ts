import type { Page } from "@playwright/test";

// SCREEN LOCATORS: one selector map for all workspace modules; selectors favor labels and stable app classes.
export class ScreenLocators {
  constructor(private readonly page: Page) {}
  get main() { return this.page.locator("#home"); }
  get topbar() { return this.page.locator(".topbar"); }
  get activeNavigation() { return this.page.locator(".sidebar nav .nav-item.selected"); }
  get overview() { return this.page.locator(".welcome-row"); }
  get tasks() { return this.page.locator(".workspace-view .data-table"); }
  get calendar() { return this.page.getByRole("heading", { name: "Task calendar" }); }
  get inbox() { return this.page.locator(".workspace-view .updates-list"); }
  get reviews() { return this.page.locator(".workspace-view .updates-list"); }
  get reports() { return this.page.getByRole("heading", { name: "Workspace report" }); }
  get notes() { return this.page.locator(".notes-layout"); }
  get teams() { return this.page.locator(".workspace-view .data-table"); }
  get projects() { return this.page.locator(".workspace-view .project-view-grid, .workspace-view .empty-state").first(); }
  get auditHistory() { return this.page.locator(".workspace-view .updates-list"); }
  get profile() { return this.page.locator(".settings-layout"); }
  get aiAssistant() { return this.page.getByRole("heading", { name: "Your workspace, understood." }); }
}
