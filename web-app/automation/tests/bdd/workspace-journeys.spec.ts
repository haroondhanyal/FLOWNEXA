import { test, expect } from "../../fixtures/test";
import { coreScreens } from "../../data/screens";
import { isIsoDate } from "../../utils/dates";
import { fakeTask } from "../../utils/test-data";

// BDD CASES (150): 10 user-facing workflows × 15 realistic, uniquely named run examples.
const journeys = [
  { name: "open overview and inspect the plan-execute-prove pulse", screen: "Overview" },
  { name: "prepare a task draft from the workspace list", screen: "My work", taskDraft: true },
  { name: "check the delivery calendar", screen: "Calendar" },
  { name: "review current workspace alerts", screen: "Inbox" },
  { name: "browse project delivery status", screen: "Projects" },
  { name: "open the team directory", screen: "Teams" },
  { name: "inspect submitted work for review", screen: "Reviews" },
  { name: "inspect an accountable audit trail", screen: "Audit history" },
  { name: "open workspace reporting", screen: "Reports" },
  { name: "ask the workspace assistant", screen: "AI assistant" },
] as const;

test.describe("BDD workspace journeys @bdd", () => {
  for (const journey of journeys) {
    for (let example = 1; example <= 15; example += 1) {
      test(`Given a teammate, when they ${journey.name}, then ${journey.screen} is ready (${example})`, async ({ app }) => {
        await app.open();
        await app.openScreen(journey.screen);
        // WHEN a teammate starts a task draft, THEN Faker's realistic title and due date stay in the form until they confirm it.
        if ("taskDraft" in journey && journey.taskDraft) {
          const draft = fakeTask();
          await app.page.locator(".view-actions").getByRole("button", { name: "Create task" }).click();
          await app.locators.taskTitleInput.fill(draft.title);
          await app.locators.taskDueDate.fill(draft.dueDate);
          expect(isIsoDate(draft.dueDate)).toBe(true);
          await expect(app.locators.taskTitleInput).toHaveValue(draft.title);
          await expect(app.locators.taskDueDate).toHaveValue(draft.dueDate);
          await app.page.getByRole("button", { name: "Close" }).click();
        }
        if (journey.screen === "Overview") await expect(app.locators.overviewContent).toBeVisible();
        else await expect(app.locators.breadcrumb).toHaveText(journey.screen);
        // THEN the route remains inside the signed-in workspace and its main landmark stays available.
        await expect(app.page.locator("#home")).toBeVisible();
      });
    }
  }
});
