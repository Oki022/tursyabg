import { expect, test } from "@playwright/test";
import { gotoApp } from "./helpers";

// Регресионен тест: преди hydration бутонът за вход трябва да е неактивен,
// иначе ранен клик изпраща обикновена HTML форма, страницата се презарежда
// и входът се губи тихо.
//
// Без JavaScript страницата никога не се хидратира, затова тестът е
// детерминиран, вместо да разчита на това колко бързо се зарежда React.
const LOGGED_OUT = { cookies: [], origins: [] };

test.describe("hydration", () => {
  test("бутонът за вход е неактивен преди hydration", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, storageState: LOGGED_OUT });
    const page = await context.newPage();
    await page.goto("/auth?mode=login");

    const submit = page.getByRole("button", { name: "Вход", exact: true });
    await expect(submit).toBeVisible();
    await expect(submit).toBeDisabled();
    await context.close();
  });

  test("бутонът за вход е активен след hydration", async ({ browser }) => {
    const context = await browser.newContext({ storageState: LOGGED_OUT });
    const page = await context.newPage();
    await gotoApp(page, "/auth?mode=login");

    await expect(page.getByRole("button", { name: "Вход", exact: true })).toBeEnabled();
    await context.close();
  });
});