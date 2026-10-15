import { expect, test } from "@playwright/test";
import { admin } from "./db";

// API tests with Playwright's `request` context: no browser, plain HTTP calls
// against the test server (8081) and the test Supabase project. They check
// that the public endpoints refuse anyone without the right key or signature.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

test.describe("cron адреси", () => {
  for (const path of ["/api/public/cron/task-alerts", "/api/public/cron/unconfirmed-reminders"]) {
    test(`${path} отказва без правилен ключ`, async ({ request }) => {
      const noKey = await request.post(path);
      expect(noKey.status()).toBe(401);

      const wrongKey = await request.post(path, { headers: { "x-cron-key": "wrong-key-e2e" } });
      expect(wrongKey.status()).toBe(401);
    });
  }
});

test.describe("Stripe webhook", () => {
  const WEBHOOK = "/api/public/payments/webhook";
  const now = () => Math.floor(Date.now() / 1000);

  function fakeEvent(id: string) {
    return JSON.stringify({
      id,
      type: "checkout.session.completed",
      data: { object: { id: `cs_${id}`, payment_status: "paid" } },
    });
  }

  async function eventWasStored(id: string): Promise<boolean> {
    const { data, error } = await admin.from("payment_events").select("event_id").eq("event_id", id);
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  test("заявка без подпис е отказана", async ({ request }) => {
    const id = `evt_e2e_nosig_${Date.now()}`;
    const res = await request.post(WEBHOOK, {
      headers: { "content-type": "application/json" },
      data: fakeEvent(id),
    });
    expect(res.status()).toBe(400);
    expect(await eventWasStored(id)).toBe(false);
  });

  test("заявка с фалшив подпис е отказана", async ({ request }) => {
    const id = `evt_e2e_fake_${Date.now()}`;
    const res = await request.post(WEBHOOK, {
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${now()},v1=${"0".repeat(64)}`,
      },
      data: fakeEvent(id),
    });
    expect(res.status()).toBe(400);
    expect(await eventWasStored(id)).toBe(false);
  });

  test("заявка със стар timestamp е отказана", async ({ request }) => {
    const id = `evt_e2e_old_${Date.now()}`;
    const res = await request.post(WEBHOOK, {
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${now() - 3600},v1=${"0".repeat(64)}`,
      },
      data: fakeEvent(id),
    });
    expect(res.status()).toBe(400);
    expect(await eventWasStored(id)).toBe(false);
  });
});

test.describe("контактна форма (база)", () => {
  const EMAIL_PREFIX = "e2e-api-";
  const EMAIL_DOMAIN = "@example.com";

  async function cleanup() {
    await admin
      .from("contact_messages")
      .delete()
      .like("email", `${EMAIL_PREFIX}%${EMAIL_DOMAIN}`);
  }

  test.beforeAll(cleanup);
  test.afterAll(cleanup);

  function submit(request: import("@playwright/test").APIRequestContext, email: string) {
    return request.post(`${SUPABASE_URL}/rest/v1/rpc/submit_contact_message`, {
      headers: { apikey: ANON_KEY, "content-type": "application/json" },
      data: {
        _name: "E2E API тест",
        _email: email,
        _subject: "Тест",
        _body: "Автоматичен тест на лимита на формата.",
      },
    });
  }

  test("6-то съобщение от един адрес за час е отказано", async ({ request }) => {
    test.skip(!ANON_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY липсва в .env.test");
    const email = `${EMAIL_PREFIX}${Date.now()}${EMAIL_DOMAIN}`;

    for (let i = 1; i <= 5; i++) {
      const ok = await submit(request, email);
      expect(ok.status(), `съобщение ${i}`).toBe(200);
    }

    const sixth = await submit(request, email);
    expect(sixth.status()).toBe(400);
    expect(JSON.stringify(await sixth.json())).toContain("CONTACT_RATE_LIMIT");
  });

  test("невалиден имейл е отказан", async ({ request }) => {
    test.skip(!ANON_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY липсва в .env.test");
    const res = await submit(request, "не-е-имейл");
    expect(res.status()).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("CONTACT_INVALID_EMAIL");
  });
});
