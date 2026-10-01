import { chromium, type Browser } from "@playwright/test";
import fs from "node:fs";

// Env comes from tests/load-env.ts (imported by playwright.config.ts): test project only.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8081";
const EMAIL = process.env.E2E_EMAIL || "asimov599+e2e1@gmail.com";
const PASSWORD = process.env.E2E_PASSWORD || "";
const PRO_EMAIL = "asimov599+e2e2@gmail.com";
const ADMIN_EMAIL = "asimov599@gmail.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

export async function saveSession(browser: Browser, email: string, password: string, path: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/auth?mode=login`);
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  // The button stays disabled until hydration; click() waits for it to become enabled.
  await page.getByRole("button", { name: "Вход", exact: true }).click();
  await page.waitForTimeout(4000);
  console.log(`${email}: ${page.url()}`);
  await context.storageState({ path });
  await context.close();
}

export default async function globalSetup() {
  const browser = await chromium.launch({ headless: true });

  if (!fs.existsSync("tests/.auth")) {
    fs.mkdirSync("tests/.auth", { recursive: true });
  }

  await saveSession(browser, EMAIL, PASSWORD, "tests/.auth/user.json");
  await saveSession(browser, PRO_EMAIL, PASSWORD, "tests/.auth/pro.json");
  if (ADMIN_PASSWORD) {
    await saveSession(browser, ADMIN_EMAIL, ADMIN_PASSWORD, "tests/.auth/admin.json");
  }
  await browser.close();
}