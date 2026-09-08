import { test } from "@playwright/test";
import { gotoApp } from "./helpers";
test("dbg", async ({ page }) => {
  const reqs: string[] = [];
  page.on("response", async (r) => { const u=r.url(); if(!u.includes('/@')&&!u.includes('node_modules')&&!u.match(/\.(tsx?|css|js|svg|png)(\?|$)/)) reqs.push(`${r.status()} ${r.request().method()} ${u}`); });
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) reqs.push(`NAV ${f.url()}`); });
  await gotoApp(page, "/auth?mode=login");
  await page.locator("#email").fill("asimov599+e2e1@gmail.com");
  await page.locator("#password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Вход", exact: true }).click();
  await page.waitForTimeout(8000);
  console.log(reqs.join("\n"));
});
