import { expect, test, type Browser, type Page } from "@playwright/test";
import { PRO_AUTH, USER_AUTH, gotoApp } from "./helpers";
import { admin, CLIENT_EMAIL, CLIENT_TASK_TITLE, PRO_EMAIL, findClientTask, userIdByEmail } from "./db";

const TASK_DESCRIPTION =
  "Трябва ми помощ за монтаж на три горни и два долни кухненски шкафа. Материалите и инструментите са налични.";

let taskId: string | null = null;

/** Creates the client's permanent task through the real posting form (only when it is missing). */
async function createClientTask(browser: Browser) {
  const context = await browser.newContext({ storageState: USER_AUTH });
  const page = await context.newPage();
  await gotoApp(page, "/post");

  await page.getByRole("textbox", { name: "Какво трябва да се направи?" }).fill(CLIENT_TASK_TITLE);
  await page.getByRole("combobox", { name: "Категория" }).click();
  await page.getByRole("option", { name: "Ремонти" }).click();
  await page.getByRole("textbox", { name: "Подробности за задачата" }).fill(TASK_DESCRIPTION);
  // Budget up to 100 € keeps the unlock cost at the lowest tier (5 credits).
  await page.getByRole("spinbutton", { name: "Бюджет (€)" }).fill("80");

  await page.getByRole("combobox", { name: "Град и квартал" }).click();
  await page.getByPlaceholder("Търси на кирилица или латиница").fill("Шумен");
  await page.getByRole("listbox", { name: "Suggestions" }).waitFor();
  await page.getByPlaceholder("Търси на кирилица или латиница").press("ArrowDown");
  await page.getByPlaceholder("Търси на кирилица или латиница").press("Enter");

  await page.getByRole("button", { name: "Публикувай работата" }).click();
  await expect(page.getByRole("button", { name: /Спешно/ })).toBeVisible({ timeout: 30_000 });
  await context.close();
}

test.beforeAll(async ({ browser }) => {
  const clientId = await userIdByEmail(CLIENT_EMAIL);
  const proId = await userIdByEmail(PRO_EMAIL);

  await admin.from("task_unlocks").delete().eq("user_id", proId);

  taskId = await findClientTask();
  if (!taskId) {
    await createClientTask(browser);
    taskId = await findClientTask();
    await admin.from("profiles").update({ free_tasks_used_this_month: 0 }).eq("id", clientId);
  }
  if (!taskId) throw new Error("Could not create the test client's task.");

  // Keep the task usable on every run: active, not expiring, free unlock slots.
  const { error: taskError } = await admin
    .from("tasks")
    .update({
      status: "active",
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      unlock_count: 0,
    })
    .eq("id", taskId);
  if (taskError) throw taskError;

  // Top up the professional when low, with a ledger row so balances stay reconciled.
  const { data: pro, error: proError } = await admin.from("profiles").select("credits").eq("id", proId).single();
  if (proError) throw proError;
  if ((pro?.credits ?? 0) < 20) {
    const target = 50;
    const amount = target - (pro?.credits ?? 0);
    const { error: upError } = await admin.from("profiles").update({ credits: target }).eq("id", proId);
    if (upError) throw upError;
    const { error: ledgerError } = await admin.from("credit_transactions").insert({
      user_id: proId,
      amount,
      type: "bonus",
      balance_after: target,
      description: "E2E top-up",
    });
    if (ledgerError) throw ledgerError;
  }
});

async function openClientTask(page: Page) {
  await gotoApp(page, `/task/${taskId}`);
  await page.waitForURL(/\/task\//, { timeout: 15_000 });
}

test.describe("кредити и отключване", () => {
  test("картата за контакт показва състоянието си", async ({ browser }) => {
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
    const context = await browser.newContext({ storageState: PRO_AUTH });
    const page = await context.newPage();
    await openClientTask(page);
    await page.waitForLoadState("networkidle");

    const unlockButton = page.getByRole("button", { name: /Отключи контакта/ });
    await expect(unlockButton).toBeVisible({ timeout: 15_000 });
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