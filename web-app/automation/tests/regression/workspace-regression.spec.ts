import { test, expect } from "../../fixtures/test";
import { coreScreens, regressionChecks } from "../../data/screens";

// REGRESSION CASES (100): each of the 10 primary modules runs ten stable shell/navigation invariants.
test.describe("Workspace regression suite @regression", () => {
  for (const screen of coreScreens) {
    for (let index = 0; index < regressionChecks.length; index += 1) {
      const check = regressionChecks[index];
      test(`${screen} / ${check}`, async ({ app }) => {
        await app.open(); await app.openScreen(screen);
        // ASSERTION: each regression row checks the invariant named in the Allure title.
        if (check === "screen title is stable") {
          if (screen === "Overview") await expect(app.locators.overviewContent.locator("h1")).toBeVisible();
          else await expect(app.locators.workspaceHeading).toHaveText(screen);
        } else if (check === "navigation stays in workspace") await expect(app.locators.breadcrumb).toHaveText(screen);
        else if (check === "screen content is visible") await expect(screen === "Overview" ? app.locators.overviewContent : app.locators.workspaceView).toBeVisible();
        else if (check === "topbar remains visible") await expect(app.page.locator(".topbar")).toBeVisible();
        else if (check === "no authentication redirect") await expect(app.page).not.toHaveURL(/\/login/);
        else if (check === "no page error state") await expect(app.page.getByText("Page not found", { exact: true })).toHaveCount(0);
        else if (check === "workspace shell remains mounted") await expect(app.page.locator("#home")).toBeVisible();
        else if (check === "screen route is selectable") await expect(app.page.locator(".sidebar nav .nav-item.selected")).toContainText(screen);
        else if (check === "navigation label remains available") await expect(app.page.locator(".sidebar nav .nav-item").filter({ hasText: screen })).toHaveCount(1);
        else await expect(app.page.getByRole("main")).toBeVisible();
      });
    }
  }
});
