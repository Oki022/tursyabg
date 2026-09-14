import { expect, test, type Page } from "@playwright/test";
import { PRO_AUTH, gotoApp } from "./helpers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PRO_ID = "32d544ca-d4ab-47c9-91ec-59d2d81d2587";

test.beforeAll(async () => {
  await supabase.from("task_unlocks").delete().eq("user_id", PRO_ID);
});

async function openFirstTask(page: Page) {
  await gotoApp(page, "/tasks");
  await page.locator('a[href^="/task/"]').first().click();
  await page.waitForURL(/\/task\//, { timeout: 15_000 });
}

test.describe("кредити и отключване", () => {
  test("картата за контакт показва състоянието си", async ({ browser }) => {
    const context = await browser.newContext({ storageState: PRO_AUTH });
    const page = await context.newPage();
    await openFirstTask(page);

    const ownerAction = page.getByRole("button", { name: "Затвори" });
    const unlockButton = page.getByRole("button", { name: /Отключи контакта/ });
    const buyCredits = page.getByRole("link", { name: "Купи кредити" });
    const callButton = page.getByRole("link", { name: /Обади се/ });

    await expect(
      ownerAction.or(unlockButton).or(buyCredits).or(callButton).first()
    ).toBeVisible({ timeout: 15_000 });
    await context.close();
  });

  test("отключване разкрива телефона", async ({ browser }) => {
    const context = await browser.newContext({ storageState: PRO_AUTH });
    const page = await context.newPage();
    await gotoApp(page, "/tasks");

    const links = page.locator('a[href^="/task/"]');
    const count = await links.count();

    if (count === 0) {
      test.skip(true, "няма обяви в списъка");
      await context.close();
      return;
    }

    let foundExternal = false;
    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute("href");
      await page.goto(href!);
      await page.waitForURL(/\/task\//, { timeout: 15_000 });

      const isOwn = await page
        .getByRole("button", { name: "Затвори" })
        .isVisible()
        .catch(() => false);

      if (!isOwn) {
        foundExternal = true;
        await page.waitForLoadState("networkidle");
        break;
      }

      await gotoApp(page, "/tasks");
    }

    if (!foundExternal) {
      test.skip(true, "всички обяви са собствени");
      await context.close();
      return;
    }

    const unlockButton = page.getByRole("button", { name: /Отключи контакта/ });

    if (!(await unlockButton.isVisible().catch(() => false))) {
      test.skip(true, "контактът вече е отключен или кредитите не стигат");
      await context.close();
      return;
    }

    await expect(unlockButton).toContainText(/кредита/);
    await unlockButton.click();

    await expect(
      page.getByText("Контактът е отключен")
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("link", { name: /Обади се/ })
    ).toBeVisible();
    await context.close();
  });
});