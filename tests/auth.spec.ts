import { expect, test } from "@playwright/test";
import { USER_AUTH, gotoApp } from "./helpers";

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

  test("login with email and password succeeds", async ({ browser }) => {
    const context = await browser.newContext({ storageState: USER_AUTH });
    const page = await context.newPage();
    await gotoApp(page, "/");
    await expect(page.getByRole("button", { name: "Меню на профила" })).toBeVisible();
    await context.close();
  });
});