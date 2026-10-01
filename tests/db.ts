import { createClient } from "@supabase/supabase-js";

/** Service-role client for test setup and cleanup. Only ever points at the test project (see load-env.ts). */
export const admin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export const CLIENT_EMAIL = "asimov599+e2e1@gmail.com";
export const PRO_EMAIL = "asimov599+e2e2@gmail.com";

/** Permanent task of the test client (+e2e1) that the credit and message tests use. */
export const CLIENT_TASK_TITLE = "Монтаж на кухненски шкафове";

const ids = new Map<string, string>();

/** User IDs differ between projects, so tests look them up by e-mail instead of hard-coding them. */
export async function userIdByEmail(email: string): Promise<string> {
  const cached = ids.get(email);
  if (cached) return cached;
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`Test user not found in the test project: ${email}`);
  ids.set(email, user.id);
  return user.id;
}

/** Latest non-deleted copy of the client's permanent task, or null. */
export async function findClientTask(): Promise<string | null> {
  const clientId = await userIdByEmail(CLIENT_EMAIL);
  const { data, error } = await admin
    .from("tasks")
    .select("id")
    .eq("user_id", clientId)
    .eq("title", CLIENT_TASK_TITLE)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.id ?? null;
}