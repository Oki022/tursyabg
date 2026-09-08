import { expect, type Page } from "@playwright/test";

export const TEST_EMAIL = process.env.E2E_EMAIL ?? "asimov599+e2e1@gmail.com";
export const TEST_PASSWORD = process.env.E2E_PASSWORD ?? "";

/**
 * The cookie banner (src/components/cookie-consent.tsx) is fixed to the bottom
 * of the viewport and intercepts clicks. It renders only while no consent
 * cookie exists, so we pre-seed the same cookie the app writes
 * (src/lib/cookie-consent.tsx) and additionally dismiss the banner if it is
 * already on screen.
 */
export async function dismissCookieBanner(page: Page) {
  const base = page.url().startsWith("http")
    ? page.url()
    : process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080";
  const { hostname } = new URL(base);
  await page.context().addCookies([
    {
      name: "tursya_consent",
      value: encodeURIComponent(
        JSON.stringify({
          necessary: true,
          analytics: false,
          marketing: false,
          decidedAt: new Date().toISOString(),
          version: 1,
        }),
      ),
      url: origin,
    },
  ]);

  const banner = page.getByRole("region", { name: "Съгласие за бисквитки" });
  if (await banner.isVisible().catch(() => false)) {
    await banner.getByRole("button", { name: "Само необходимите" }).click();
    await expect(banner).toBeHidden();
  }
}

/** Navigate and make sure nothing is covering the page. */
export async function gotoApp(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await dismissCookieBanner(page);
}

/** Sign in through the real form on /auth?mode=login. */
export async function login(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await gotoApp(page, "/auth?mode=login");
  await expect(page.getByRole("heading", { name: "Добре дошли отново" })).toBeVisible();

  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Вход", exact: true }).click();

  // Successful sign-in lands on the homepage with the signed-in header.
  await expect(page.getByRole("link", { name: "Възложи работа" })).toBeVisible({ timeout: 30_000 });
}

/** Sign out through the header profile menu. */
export async function logout(page: Page) {
  await page.getByRole("button", { name: "Меню на профила" }).click();
  await page.getByRole("menuitem", { name: "Изход" }).click();
}
