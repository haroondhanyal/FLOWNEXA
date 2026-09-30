import { expect, test } from "../../../../fixtures/test";

test("Help and support / support information is available", async ({ app }) => {
  await app.open();
  const helpButton = app.page.getByRole("button", { name: "Help & support" });
  await helpButton.focus();
  await helpButton.press("Enter");
  await expect(app.locators.breadcrumb).toHaveText("Help & support");
  await expect(app.page.getByRole("heading", { name: "FlowNexa help" })).toBeVisible();
  await expect(app.page.getByRole("link", { name: /Open support issues/ })).toBeVisible();
});
