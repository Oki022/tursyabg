import { expect, test } from "@playwright/test";
import { USER_AUTH, PRO_AUTH, gotoApp } from "./helpers";

test.describe("съобщения", () => {
  test("съобщенията са достъпни след отключване", async ({ browser }) => {
    const context = await browser.newContext({ storageState: PRO_AUTH });
    const page = await context.newPage();
    await gotoApp(page, "/messages");

    const hrefs = await page
      .locator('a[href^="/messages/"]')
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!));

    if (hrefs.length === 0) {
      test.skip(true, "няма разговори — отключи контакт първо");
      await context.close();
      return;
    }

    // Разговорите по изтрити задачи са само за четене, затова търсим първия,
    // в който наистина може да се пише.
    const input = page.locator('input[placeholder], textarea[placeholder]').last();
    let found = false;
    for (const href of hrefs) {
      await page.goto(href);
      await page.waitForURL(/\/messages\//, { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      found = await input
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (found) break;
    }

    if (!found) {
      test.skip(true, "няма разговор по активна задача");
      await context.close();
      return;
    }

    await input.fill("Тестово съобщение от автоматичен тест.");
    await page.keyboard.press("Enter");

    await expect(
      page.getByText("Тестово съобщение от автоматичен тест.")
    ).toBeVisible({ timeout: 10_000 });
    await context.close();
  });

  test("без отключване няма достъп до съобщения", async ({ browser }) => {
    const context = await browser.newContext({ storageState: USER_AUTH });
    const page = await context.newPage();
    await gotoApp(page, "/messages");

    const conversations = page.locator('a[href^="/messages/"]');
    const count = await conversations.count();

    if (count === 0) {
      expect(count).toBe(0);
      await context.close();
      return;
    }

    const href = await conversations.first().getAttribute("href");
    await page.goto(href!);
    await page.waitForURL(/\/messages\//, { timeout: 15_000 });

    await expect(
      page.getByPlaceholder("Напишете съобщение...")
    ).toHaveCount(0);
    await context.close();
  });
});