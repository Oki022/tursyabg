import { expect, test } from "@playwright/test";
import { USER_AUTH } from "./helpers";
import { createClient } from "@supabase/supabase-js";

const BASE = "http://localhost:8080";
const TITLE = `Помощ с мебели ${Date.now()}`;
const DESCRIPTION =
  "Трябват ми двама души за пренасяне на мебели, два големи шкафа и един диван.";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USER_ID = "215c05a5-b052-4b04-ade4-ae9bf0b94444";

test.afterAll(async () => {
  await supabase
    .from("tasks")
    .delete()
    .eq("user_id", USER_ID)
    .like("title", "Помощ с мебели%");
  await supabase
    .from("profiles")
    .update({ free_tasks_used_this_month: 0 })
    .eq("id", USER_ID);
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
    await page.getByRole("textbox", { name: "Подробности за задачата" }).fill(DESCRIPTION);
    await page.getByRole("spinbutton", { name: "Бюджет (€)" }).fill("700");

    await page.getByRole("combobox", { name: "Град и квартал" }).click();
    await page.getByPlaceholder("Търси на кирилица или латиница").fill("Шумен");
    await page.getByRole("listbox", { name: "Suggestions" }).waitFor();
    await page.getByPlaceholder("Търси на кирилица или латиница").press("ArrowDown");
    await page.getByPlaceholder("Търси на кирилица или латиница").press("Enter");

    await page.getByRole("button", { name: "Публикувай работата" }).click();

    await expect(page.getByRole("button", { name: /Спешно/ })).toBeVisible({ timeout: 30_000 });
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