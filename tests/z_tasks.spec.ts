import { expect, test } from "@playwright/test";
import { USER_AUTH } from "./helpers";
import { admin, CLIENT_EMAIL, userIdByEmail } from "./db";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8081";
const TITLE = `Помощ с мебели ${Date.now()}`;
const DESCRIPTION =
  "Трябват ми двама души за пренасяне на мебели, два големи шкафа и един диван.";

test.afterAll(async () => {
  const userId = await userIdByEmail(CLIENT_EMAIL);
  await admin
    .from("tasks")
    .delete()
    .eq("user_id", userId)
    .like("title", "Помощ с мебели%");
  await admin
    .from("profiles")
    .update({ free_tasks_used_this_month: 0 })
    .eq("id", userId);
});

test.describe("публикуване на работа", () => {
  test("публикуване на нова работа", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: USER_AUTH,
      baseURL: BASE,
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/post`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("textbox", { name: "Какво трябва да се направи?" }).fill(TITLE);
    await page.getByRole("combobox", { name: "Категория" }).click();
    await page.getByRole("option", { name: "Превоз и хамали" }).click();
    await page.getByRole("radio", { name: "Преместване" }).click();
    await page.getByRole("textbox", { name: "Подробности за задачата" }).fill(DESCRIPTION);
    await page.getByRole("spinbutton", { name: "Бюджет (€)" }).fill("700");

    await page.getByRole("combobox", { name: "Град и квартал" }).click();
    await page.getByPlaceholder("Търси на кирилица или латиница").fill("Шумен");
    await page.getByRole("listbox", { name: "Suggestions" }).waitFor();
    await page.getByPlaceholder("Търси на кирилица или латиница").press("ArrowDown");
    await page.getByPlaceholder("Търси на кирилица или латиница").press("Enter");

    await page.getByRole("button", { name: "Публикувай работата" }).click();

    await expect(page.getByRole("button", { name: /Спешно/ })).toBeVisible({ timeout: 30_000 });

    // The chosen subcategory is stored with the task.
    // (The title's long number is masked as contact info, so look the task up by owner.)
    const userId = await userIdByEmail(CLIENT_EMAIL);
    const { data: saved, error: savedError } = await admin
      .from("tasks")
      .select("subcategory")
      .eq("user_id", userId)
      .like("title", "Помощ с мебели%")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(savedError).toBeNull();
    expect(saved?.subcategory).toBe("premestvane");
    await context.close();
  });

  test("филтърът отхвърля безсмислен текст", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: USER_AUTH,
      baseURL: BASE,
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/post`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("textbox", { name: "Какво трябва да се направи?" }).fill("asdfasdfasdf");
    await page.getByRole("combobox", { name: "Категория" }).click();
    await page.getByRole("option", { name: "Ремонти" }).click();
    await page.getByRole("radio", { name: "ВиК" }).click();
    await page.getByRole("textbox", { name: "Подробности за задачата" }).fill("asdfasdf asdfasdf asdfasdf");
    await page.getByRole("spinbutton", { name: "Бюджет (€)" }).fill("100");

    await page.getByRole("combobox", { name: "Град и квартал" }).click();
    await page.getByPlaceholder("Търси на кирилица или латиница").fill("Шумен");
    await page.getByRole("listbox", { name: "Suggestions" }).waitFor();
    await page.getByPlaceholder("Търси на кирилица или латиница").press("ArrowDown");
    await page.getByPlaceholder("Търси на кирилица или латиница").press("Enter");

    await page.getByRole("button", { name: "Публикувай работата" }).click();

    await expect(page.getByRole("button", { name: /Спешно/ })).toHaveCount(0);
    await context.close();
  });
});