import { expect, test, type Page } from "@playwright/test";
import { USER_AUTH, PRO_AUTH, gotoApp } from "./helpers";
import { findClientTask } from "./db";

const TEXT = "Тестово съобщение от автоматичен тест.";

/** Opens the first conversation the user can still write in (deleted tasks are read-only). */
async function openWritableConversation(page: Page) {
  await gotoApp(page, "/messages");
  const hrefs = await page
    .locator('a[href^="/messages/"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!));

  const input = page.locator('input[placeholder], textarea[placeholder]').last();
  for (const href of hrefs) {
    await page.goto(href);
    await page.waitForURL(/\/messages\//, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    const found = await input
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (found) return input;
  }
  return null;
}

test.describe("съобщения", () => {
  test("съобщенията са достъпни след отключване", async ({ browser }) => {
    const context = await browser.newContext({ storageState: PRO_AUTH });
    const page = await context.newPage();

    const input = await openWritableConversation(page);
    if (input) {
      await input.fill(TEXT);
      await page.keyboard.press("Enter");
      await expect(page.getByText(TEXT).last()).toBeVisible({ timeout: 10_000 });
      await context.close();
      return;
    }

    // No conversation yet (fresh test project): start one from the task the
    // credit tests just unlocked, through the real "send message" dialog.
    const taskId = await findClientTask();
    test.skip(!taskId, "няма задача на тестовия клиент");
    await gotoApp(page, `/task/${taskId}`);
    await page.getByRole("button", { name: "Изпрати съобщение" }).click();
    await page.getByPlaceholder("Напишете вашето съобщение тук...").fill(TEXT);
    await page.getByRole("button", { name: "Изпрати", exact: true }).click();
    await expect(page.getByText(/Съобщението е изпратено/)).toBeVisible({ timeout: 15_000 });
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