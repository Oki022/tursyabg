import { expect, test } from "@playwright/test";
import { TEST_PASSWORD, gotoApp, login, logout } from "./helpers";

test.describe("auth", () => {
  test("homepage loads", async ({ page }) => {
    await gotoApp(page, "/");
    await expect(page).toHaveTitle(/./);
    await expect(page.getByRole("link", { name: "Вход" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Регистрация" })).toBeVisible();
  });

  test("protected route redirects when logged out", async ({ page }) => {
    await gotoApp(page, "/profile");
    await expect(page).toHaveURL(/\/auth\?.*mode=login/);
    await expect(page.getByRole("heading", { name: "Добре дошли отново" })).toBeVisible();
  });

  test("login with email and password succeeds", async ({ page }) => {
    test.skip(!TEST_PASSWORD, "E2E_PASSWORD is not set");
    await login(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "Меню на профила" })).toBeVisible();
  });

  test("logout works", async ({ page }) => {
    test.skip(!TEST_PASSWORD, "E2E_PASSWORD is not set");
    await login(page);
    await logout(page);

    await expect(page.getByRole("link", { name: "Вход" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Меню на профила" })).toHaveCount(0);

    // And the protected route is gated again.
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/auth\?.*mode=login/);
  });
});
