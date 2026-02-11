import { expect, test } from "@playwright/test";

/**
 * E2E tests use the password-based fallback flow since Google OAuth
 * requires a real browser redirect to Google's servers.
 */

/** Helper: navigate to the password-based onboarding form. */
async function goToPasswordForm(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".onboarding-shell", { timeout: 10000 });
  // If Supabase is configured, the password form is behind a toggle
  const toggle = page.getByText("Use email + password instead");
  if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await toggle.click();
  }
}

/** Helper: create vault and add a demo bank account (with consent). */
async function createVaultAndAddBank(page: import("@playwright/test").Page) {
  await page.getByPlaceholder("Your name").fill("Martin");
  await page.getByPlaceholder("Email").fill("martin@example.com");
  await page.getByPlaceholder(/Vault password/).fill("super-secret-password");
  await page.getByRole("button", { name: "Create Vault" }).click();
  await expect(page.getByRole("heading", { name: /here's your spend view/i })).toBeVisible();
  // Add bank account (triggers consent dialog first)
  await page.getByRole("button", { name: /Add bank account/i }).click();
  await page.getByRole("button", { name: /I agree/i }).click();
  await expect(page.getByText("Demo Bank")).toBeVisible();
}

test.describe("Budget Vault core flow", () => {
  test.beforeEach(async ({ page }) => {
    await goToPasswordForm(page);
  });

  test("onboarding to dashboard and core interactions work", async ({ page }) => {
    await createVaultAndAddBank(page);

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
    await createVaultAndAddBank(page);
    await page.getByRole("button", { name: "Sync now" }).click();

    await page.getByPlaceholder("New category").fill("Pets");
    const categoryForm = page.locator("form").filter({
      has: page.getByPlaceholder("New category"),
    });
    await categoryForm.getByRole("button", { name: "Add", exact: true }).click();
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
    await createVaultAndAddBank(page);
    await page.getByRole("button", { name: "Sync now" }).click();

    await page.locator(".recharts-sector").first().click();
    await expect(page.getByRole("heading", { name: "Category drill-down" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Last 6 months trend" })).toBeVisible();
    await expect(page.locator(".selection-label")).toBeVisible();

    await page.locator(".selection-label button").click();
    await expect(page.getByRole("heading", { name: "Category drill-down" })).not.toBeVisible();
  });

  test("responsive layout on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await goToPasswordForm(page);
    await createVaultAndAddBank(page);
    await page.getByRole("button", { name: "Sync now" }).click();

    await expect(page.getByRole("heading", { name: /here's your spend view/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Expenses by category" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Budget vs actual" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Month", exact: true })).toBeVisible();
  });
});
