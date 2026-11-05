import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { admin, CLIENT_EMAIL, PRO_EMAIL, userIdByEmail } from "./db";

/**
 * API tests for the Supabase REST API (PostgREST) and Auth, without a browser.
 *
 * What they prove:
 *  - Auth: a wrong password is refused.
 *  - Row Level Security (RLS): a signed-in user sees only their own private rows
 *    (profile, points history, phone), never another user's; staff (admin) can.
 *  - Protected data cannot be changed by the user (e.g. their own points balance).
 *  - Wrong or missing input gets the right error (status code + error code).
 *  - Task lifetime functions are closed to visitors and to normal users where they must be.
 *  - Every call answers within a time limit.
 *
 * Runs only against the test project (tests/load-env.ts stops it for the live one).
 * Test users: +e2e1 (client) and +e2e2 (professional), password E2E_PASSWORD;
 * admin: E2E_ADMIN_PASSWORD (admin tests are skipped without it).
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const ADMIN_EMAIL = "asimov599@gmail.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

/** Generous limit: the free test project is sometimes slow; we want to catch real hangs, not noise. */
const MAX_MS = 3000;

const REST = `${SUPABASE_URL}/rest/v1`;

/** Runs a request and measures how long the answer took. */
async function timed(call: () => Promise<APIResponse>): Promise<{ res: APIResponse; ms: number }> {
  const started = Date.now();
  const res = await call();
  return { res, ms: Date.now() - started };
}

/** Headers for a call as a signed-in user (or anonymous when token is undefined). */
function headers(token?: string): Record<string, string> {
  return {
    apikey: ANON_KEY,
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

/** Signs in through Supabase Auth and returns the access token (JWT). */
async function signIn(api: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON_KEY, "content-type": "application/json" },
    data: { email, password },
  });
  expect(res.status(), `sign-in ${email}`).toBe(200);
  const body = await res.json();
  expect(typeof body.access_token).toBe("string");
  return body.access_token as string;
}

test.describe("Supabase API", () => {
  test.skip(!ANON_KEY || !PASSWORD, "VITE_SUPABASE_PUBLISHABLE_KEY or E2E_PASSWORD missing");

  let api: APIRequestContext;
  let clientToken: string;
  let clientId: string;
  let proId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    clientToken = await signIn(api, CLIENT_EMAIL, PASSWORD);
    clientId = await userIdByEmail(CLIENT_EMAIL);
    proId = await userIdByEmail(PRO_EMAIL);
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  test.describe("auth", () => {
    test("wrong password is refused with 400", async () => {
      const { res, ms } = await timed(() =>
        api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          headers: { apikey: ANON_KEY, "content-type": "application/json" },
          data: { email: CLIENT_EMAIL, password: "definitely-wrong-password" },
        }),
      );
      expect(res.status()).toBe(400);
      expect(JSON.stringify(await res.json()).toLowerCase()).toContain("invalid");
      expect(ms).toBeLessThan(MAX_MS);
    });
  });

  test.describe("row level security", () => {
    test("user reads their own profile", async () => {
      const { res, ms } = await timed(() =>
        api.get(`${REST}/profiles?id=eq.${clientId}&select=id,credits`, { headers: headers(clientToken) }),
      );
      expect(res.status()).toBe(200);
      const rows = await res.json();
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(clientId);
      expect(typeof rows[0].credits).toBe("number");
      expect(ms).toBeLessThan(MAX_MS);
    });

    test("user cannot read another user's profile row", async () => {
      const { res, ms } = await timed(() =>
        api.get(`${REST}/profiles?id=eq.${proId}&select=id,credits`, { headers: headers(clientToken) }),
      );
      // RLS does not raise an error: it simply returns no rows.
      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual([]);
      expect(ms).toBeLessThan(MAX_MS);
    });

    test("user sees only their own points history", async () => {
      const own = await api.get(`${REST}/credit_transactions?select=user_id&limit=50`, {
        headers: headers(clientToken),
      });
      expect(own.status()).toBe(200);
      const rows: { user_id: string }[] = await own.json();
      for (const row of rows) expect(row.user_id).toBe(clientId);

      const other = await api.get(`${REST}/credit_transactions?user_id=eq.${proId}&select=id`, {
        headers: headers(clientToken),
      });
      expect(other.status()).toBe(200);
      expect(await other.json()).toEqual([]);
    });

    test("anonymous visitor gets no points history", async () => {
      const res = await api.get(`${REST}/credit_transactions?select=id&limit=5`, { headers: headers() });
      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    test("user cannot read another user's phone without unlocking", async () => {
      const res = await api.get(`${REST}/profile_contacts?user_id=eq.${proId}&select=phone`, {
        headers: headers(clientToken),
      });
      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    test("user cannot change their own points balance", async () => {
      const before = await admin.from("profiles").select("credits").eq("id", clientId).single();
      expect(before.error).toBeNull();

      const { res, ms } = await timed(() =>
        api.patch(`${REST}/profiles?id=eq.${clientId}`, {
          headers: { ...headers(clientToken), prefer: "return=minimal" },
          data: { credits: 999999 },
        }),
      );
      // The database trigger refuses with SQLSTATE 42501, which PostgREST turns into 403.
      expect(res.status()).toBe(403);
      expect(JSON.stringify(await res.json())).toContain("PROTECTED_COLUMN");
      expect(ms).toBeLessThan(MAX_MS);

      const after = await admin.from("profiles").select("credits").eq("id", clientId).single();
      expect(after.data?.credits).toBe(before.data?.credits);
    });
  });

  test.describe("roles", () => {
    test("normal user is refused by an admin-only function", async () => {
      const res = await api.post(`${REST}/rpc/admin_revenue_months`, {
        headers: headers(clientToken),
        data: { _months: 3 },
      });
      expect(res.status()).toBe(403);
      expect(JSON.stringify(await res.json())).toContain("FORBIDDEN");
    });

    test("admin can use the admin-only function and read other users' history", async () => {
      test.skip(!ADMIN_PASSWORD, "E2E_ADMIN_PASSWORD missing");
      const adminToken = await signIn(api, ADMIN_EMAIL, ADMIN_PASSWORD);

      const { res, ms } = await timed(() =>
        api.post(`${REST}/rpc/admin_revenue_months`, { headers: headers(adminToken), data: { _months: 3 } }),
      );
      expect(res.status()).toBe(200);
      expect(Array.isArray(await res.json())).toBe(true);
      expect(ms).toBeLessThan(MAX_MS);

      const history = await api.get(`${REST}/credit_transactions?user_id=eq.${proId}&select=user_id&limit=20`, {
        headers: headers(adminToken),
      });
      expect(history.status()).toBe(200);
      for (const row of (await history.json()) as { user_id: string }[]) expect(row.user_id).toBe(proId);
    });
  });

  test.describe("input validation", () => {
    test("invalid id format returns 400", async () => {
      const res = await api.post(`${REST}/rpc/unlock_task_contact`, {
        headers: headers(clientToken),
        data: { _task_id: "not-a-uuid" },
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).code).toBe("22P02"); // PostgreSQL: invalid text representation
    });

    test("missing parameter returns 404 (no such function signature)", async () => {
      const res = await api.post(`${REST}/rpc/unlock_task_contact`, {
        headers: headers(clientToken),
        data: {},
      });
      expect(res.status()).toBe(404);
      expect((await res.json()).code).toBe("PGRST202");
    });

    test("data export needs a signed-in user", async () => {
      const res = await api.post(`${REST}/rpc/export_my_data`, { headers: headers(), data: {} });
      expect(res.status()).toBe(401);
      expect((await res.json()).code).toBe("42501"); // permission denied
    });
  });

  test.describe("task lifetime", () => {
    test("anonymous visitor cannot keep a task live", async () => {
      const res = await api.post(`${REST}/rpc/confirm_task_active`, {
        headers: headers(),
        data: { _task_id: "00000000-0000-0000-0000-000000000000" },
      });
      expect(res.status()).toBe(401);
      expect((await res.json()).code).toBe("42501");
    });

    test("signed-in user cannot run the task expiry sweep", async () => {
      // Only the scheduler (service role) may deactivate expired tasks.
      const res = await api.post(`${REST}/rpc/sweep_expiry_notifications`, {
        headers: headers(clientToken),
        data: { _batch: 1 },
      });
      expect(res.status()).toBe(403);
      expect((await res.json()).code).toBe("42501");
    });
  });
});
