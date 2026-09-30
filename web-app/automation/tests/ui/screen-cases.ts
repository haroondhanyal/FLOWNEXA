import { expect, test } from "../../fixtures/test";
import { viewportCases } from "../../data/screens";

export function registerScreenCases(screen: string) {
  test.describe(`${screen} page @ui`, () => {
    for (const viewport of viewportCases) {
      for (const check of ["breadcrumb", "screen-content", "selected-navigation", "page-title"] as const) {
        test(`${viewport.name} / ${check}`, async ({ app }) => {
          await app.page.setViewportSize({ width: viewport.width, height: viewport.height });
          await app.open();
          await app.openScreen(screen);
          if (check === "breadcrumb") await expect(app.locators.breadcrumb).toHaveText(screen);
          if (check === "screen-content") await expect(screen === "Overview" ? app.locators.overviewContent : app.locators.workspaceView).toBeVisible();
      if (check === "selected-navigation") {
        if (screen === "Search") await expect(app.locators.breadcrumb).toHaveText("Search");
        else await expect(app.page.locator(".sidebar nav .nav-item.selected")).toContainText(screen);
      }
          if (check === "page-title") await expect(screen === "Overview" ? app.locators.overviewContent.locator("h1") : app.locators.workspaceHeading).toBeVisible();
        });
      }
    }

    test("positive / workspace shell and XPath page landmark are available", async ({ app }) => {
      await app.open();
      await app.openScreen(screen);
      await expect(app.locators.mainByXPath).toBeVisible();
      if (screen === "Overview") await expect(app.locators.overviewContent).toBeVisible();
      else await expect(app.locators.workspaceHeadingByXPath).toHaveText(screen);
    });

    test("negative / screen does not fall through to the missing-page state", async ({ app }) => {
      await app.open();
      await app.openScreen(screen);
      await expect(app.page.getByText("Page not found", { exact: true })).toHaveCount(0);
      if (screen !== "Search") await expect(app.locators.activeNavigationByXPath).toBeVisible();
    });
  });
}
