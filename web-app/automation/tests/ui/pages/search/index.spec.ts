import { faker } from "@faker-js/faker";
import { expect, test } from "../../../../fixtures/test";
test("Search / Faker query opens results and empty query does not issue a data operation", async ({ app }) => { await app.open(); await app.openScreen("Search"); await expect(app.page.getByRole("heading", { name: "Search results" })).toBeVisible(); await expect(app.page.getByText("No matching tasks, projects or comments.")).toBeVisible(); await app.page.getByPlaceholder("Search anything...").fill(faker.company.buzzPhrase()); await expect(app.page.getByText(/Matching “/)).toBeVisible(); });
