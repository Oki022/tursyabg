import { expect, test, type Page } from "@playwright/test";
import { PRO_AUTH, gotoApp } from "./helpers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PRO_ID = "32d544ca-d4ab-47c9-91ec-59d2d81d2587";
// Тестовете отключват само задачи на тестовия клиент (+e2e1), никога на реални потребители.
const CLIENT_ID = "215c05a5-b052-4b04-ade4-ae9bf0b94444";

let taskId: string | null = null;

test.beforeAll(async () => {
  await supabase.from("task_unlocks").delete().eq("user_id", PRO_ID);

  const { data, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("user_id", CLIENT_ID)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  taskId = data?.[0]?.id ?? null;

  if (taskId) {
    // Изтриването на отключването не намалява брояча на задачата; нулираме го,
    // иначе след няколко пускания лимитът от 5 изпълнители се запълва.
    const { error: resetError } = await supabase
      .from("tasks")
      .update({ unlock_count: 0 })
      .eq("id", taskId);
    if (resetError) console.warn("unlock_count reset failed:", resetError.message);
  }
});

async function openClientTask(page: Page) {
  await gotoApp(page, `/task/${taskId}`);
  await page.waitForURL(/\/task\//, { timeout: 15_000 });
}

test.describe("кредити и отключване", () => {
  test("картата за контакт показва състоянието си", async ({ browser }) => {
    test.skip(!taskId, "няма активна задача на тестовия клиент (+e2e1)");
    const context = await browser.newContext({ storageState: PRO_AUTH });
    const page = await context.newPage();
    await openClientTask(page);

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
    test.skip(!taskId, "няма активна задача на тестовия клиент (+e2e1)");
    const context = await browser.newContext({ storageState: PRO_AUTH });
    const page = await context.newPage();
    await openClientTask(page);
    await page.waitForLoadState("networkidle");

    const unlockButton = page.getByRole("button", { name: /Отключи контакта/ });

    if (!(await unlockButton.isVisible().catch(() => false))) {
      test.skip(true, "кредитите не стигат или лимитът е запълнен");
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