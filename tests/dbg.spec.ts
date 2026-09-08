import { expect, test } from "@playwright/test";
import { gotoApp } from "/dev-server/tests/helpers";
test("dbg", async ({ page }) => {
  const errs: string[] = [];
  page.on("console", (m) => errs.push(`${m.type()}: ${m.text()}`));
  await gotoApp(page, "/auth?mode=login");
  await page.locator("#email").fill("asimov599+e2e1@gmail.com");
  await page.locator("#password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Вход", exact: true }).click();
  await page.waitForTimeout(8000);
  console.log("URL", page.url());
  console.log("HEADER", await page.locator("header").innerText());
  console.log("TOASTS", await page.locator("[data-sonner-toast]").allInnerTexts());
  console.log(errs.slice(-15).join("\n"));
});
