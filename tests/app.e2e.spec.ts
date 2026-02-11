import { expect, test } from "@playwright/test";

test.describe("Budget Vault core flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("onboarding to dashboard and core interactions work", async ({ page }) => {
    await page.getByPlaceholder("Your name").fill("Martin");
    await page.getByPlaceholder("Email").fill("martin@example.com");
    await page.getByPlaceholder("Vault password").fill("super-secret-password");
    await page.getByRole("button", { name: "Create Vault" }).click();

    await expect(
      page.getByRole("heading", { name: /here's your spend view/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Add bank account/i }).click();
    await expect(page.getByText("Demo Bank")).toBeVisible();

    await page.getByRole("button", { name: "Sync now" }).click();
    await expect(page.getByRole("heading", { name: "AI categorization" })).toBeVisible();

    await page.getByRole("button", { name: "Year", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Year", exact: true }),
    ).toHaveClass(/selected/);
    await page.getByRole("button", { name: "Prev year", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Prev year", exact: true }),
    ).toHaveClass(/selected/);
  });

  test("supports category/family management and budget editing", async ({ page }) => {
    await page.getByPlaceholder("Your name").fill("Martin");
    await page.getByPlaceholder("Email").fill("martin@example.com");
    await page.getByPlaceholder("Vault password").fill("super-secret-password");
    await page.getByRole("button", { name: "Create Vault" }).click();
    await page.getByRole("button", { name: /Add bank account/i }).click();
    await page.getByRole("button", { name: "Sync now" }).click();

    await page.getByPlaceholder("New category").fill("Pets");
    const categoryForm = page.locator("form").filter({
      has: page.getByPlaceholder("New category"),
    });
    await categoryForm.getByRole("button", {
      name: "Add",
      exact: true,
    }).click();
    await expect(page.getByText("Pets").first()).toBeVisible();

    await page.getByPlaceholder("Invite by email").fill("family@example.com");
    await page.getByRole("button", { name: "Link" }).click();
    await expect(page.getByText("family@example.com")).toBeVisible();

    await page.locator(".edit-budget").first().click();
    await page.locator(".budget-row input").first().fill("200");
    await page.locator(".budget-row button", { hasText: "Save" }).first().click();
    await expect(page.getByText("$200")).toBeVisible();
  });

  test("supports chart drill-down and dismissal", async ({ page }) => {
    await page.getByPlaceholder("Your name").fill("Martin");
    await page.getByPlaceholder("Email").fill("martin@example.com");
    await page.getByPlaceholder("Vault password").fill("super-secret-password");
    await page.getByRole("button", { name: "Create Vault" }).click();
    await page.getByRole("button", { name: /Add bank account/i }).click();
    await page.getByRole("button", { name: "Sync now" }).click();

    await page.locator(".recharts-sector").first().click();
    await expect(page.getByRole("heading", { name: "Category drill-down" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Last 6 months trend" })).toBeVisible();
    await expect(page.locator(".selection-label")).toBeVisible();

    // Dismiss the drill-down
    await page.locator(".selection-label button").click();
    await expect(page.getByRole("heading", { name: "Category drill-down" })).not.toBeVisible();
  });

  test("responsive layout on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.getByPlaceholder("Your name").fill("Martin");
    await page.getByPlaceholder("Email").fill("martin@example.com");
    await page.getByPlaceholder("Vault password").fill("super-secret-password");
    await page.getByRole("button", { name: "Create Vault" }).click();
    await page.getByRole("button", { name: /Add bank account/i }).click();
    await page.getByRole("button", { name: "Sync now" }).click();

    await expect(
      page.getByRole("heading", { name: /here's your spend view/i }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Expenses by category" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Budget vs actual" })).toBeVisible();

    const periodControls = page.getByRole("button", { name: "Month", exact: true });
    await expect(periodControls).toBeVisible();
  });
});
