import { supabase } from "@/integrations/supabase/client";

export type AccountState = {
  deactivatedAt: string | null;
  deletion: { requestedAt: string; scheduledFor: string } | null;
};

export type DeletionRequestRow = {
  id: string;
  user_id: string;
  full_name: string;
  requested_at: string;
  scheduled_for: string;
  status: string;
  completed_at: string | null;
};

/** Актуалното състояние на профила: деактивиран ли е и има ли заявка за изтриване. */
export async function getAccountState(): Promise<AccountState> {
  const { data, error } = await supabase.rpc("my_account_state");
  if (error) throw error;
  const raw = (data ?? {}) as {
    deactivated_at?: string | null;
    deletion?: { requested_at: string; scheduled_for: string } | null;
  };
  return {
    deactivatedAt: raw.deactivated_at ?? null,
    deletion: raw.deletion
      ? { requestedAt: raw.deletion.requested_at, scheduledFor: raw.deletion.scheduled_for }
      : null,
  };
}

export async function deactivateAccount(): Promise<void> {
  const { error } = await supabase.rpc("deactivate_own_account");
  if (error) throw error;
}

export async function reactivateAccount(): Promise<void> {
  const { error } = await supabase.rpc("reactivate_own_account");
  if (error) throw error;
}

/** Заявява изтриване след 14 дни и деактивира профила веднага. */
export async function requestAccountDeletion(): Promise<string> {
  const { data, error } = await supabase.rpc("request_account_deletion");
  if (error) throw error;
  return data as unknown as string;
}

export async function cancelAccountDeletion(): Promise<void> {
  const { error } = await supabase.rpc("cancel_account_deletion");
  if (error) throw error;
}

/** Пълен експорт на личните данни (право на преносимост по GDPR). */
export async function exportMyData(): Promise<unknown> {
  const { data, error } = await supabase.rpc("export_my_data");
  if (error) throw error;
  return data;
}

export async function listDeletionRequests(status?: string): Promise<DeletionRequestRow[]> {
  const { data, error } = await supabase.rpc("admin_list_deletion_requests", {
    _status: status ?? undefined,
  });
  if (error) throw error;
  return (data ?? []) as DeletionRequestRow[];
}
