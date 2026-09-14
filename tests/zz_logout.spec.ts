import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";

test("logout works", async ({ page }) => {
  await login(page);
  await logout(page);

  await expect(page.getByRole("link", { name: "Вход" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Меню на профила" })).toHaveCount(0);

  await page.goto("/profile", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/auth\?.*mode=login/);
});