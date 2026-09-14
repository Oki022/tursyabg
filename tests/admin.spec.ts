import { expect, test } from "@playwright/test";
import { USER_AUTH, ADMIN_AUTH, gotoApp } from "./helpers";

test.describe("админ панел", () => {
  test("нeадмин се пренасочва от /admin", async ({ browser }) => {
    const context = await browser.newContext({ storageState: USER_AUTH });
    const page = await context.newPage();
    await page.goto("/admin");
    await page.waitForURL(/\/(tasks|$|\?)/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/admin/);
    await context.close();
  });

  test("админ влиза в панела", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_AUTH });
    const page = await context.newPage();
    await gotoApp(page, "/admin");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    await expect(page.getByText("Табло").first()).toBeVisible({ timeout: 10_000 });
    await context.close();
  });
});