import { test, expect } from "../../fixtures/test";
import { coreScreens } from "../../data/screens";

// SMOKE CASES (100): every primary module gets ten fast checks after deploy/startup.
test.describe("Workspace smoke checks @smoke", () => {
  for (const screen of coreScreens) {
    for (let check = 1; check <= 10; check += 1) {
      test(`${screen} opens in smoke pass ${check}`, async ({ app }) => {
        await app.open(); await app.openScreen(screen);
        await expect(app.page.locator(".topbar")).toBeVisible();
        await expect(app.page.locator("#home")).toBeVisible();
        if (screen === "Overview") await expect(app.locators.overviewContent).toBeVisible();
        else await expect(app.locators.breadcrumb).toHaveText(screen);
      });
    }
  }
});
