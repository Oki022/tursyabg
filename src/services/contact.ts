import { supabase } from "@/integrations/supabase/client";

export type ContactStatus = "new" | "in_progress" | "closed";

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  status: ContactStatus;
  adminNote: string;
  createdAt: string;
  userId: string | null;
};

export async function sendContactMessage(input: {
  name: string;
  email: string;
  subject: string;
  body: string;
}): Promise<string> {
  // Записва се през защитена функция: анонимните посетители нямат право да
  // четат таблицата, затова insert + select би върнал грешка за права.
  const { data, error } = await supabase.rpc("submit_contact_message", {
    _name: input.name.trim(),
    _email: input.email.trim(),
    _subject: input.subject.trim(),
    _body: input.body.trim(),
  });
  if (error) throw new Error(error.message);
  return data as string;
}


export async function listContactMessages(status?: ContactStatus): Promise<ContactMessage[]> {
  let query = supabase
    .from("contact_messages")
    .select("id, name, email, subject, body, status, admin_note, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    subject: r.subject,
    body: r.body,
    status: r.status as ContactStatus,
    adminNote: r.admin_note ?? "",
    createdAt: r.created_at,
    userId: r.user_id,
  }));
}

export async function setContactStatus(input: { id: string; status: ContactStatus; note?: string }) {
  const { data, error } = await supabase.rpc("admin_set_contact_status", {
    _id: input.id,
    _status: input.status,
    _note: input.note ?? "",
  });
  if (error) throw error;
  const r = (data ?? {}) as Record<string, unknown>;
  if (!r["ok"]) throw new Error(String(r["error"] ?? "UNKNOWN"));
}

export type ContactSender = {
  found: boolean;
  id?: string;
  fullName?: string | null;
  createdAt?: string | null;
  credits?: number;
  ratingAsPro?: number | null;
  reviewCountAsPro?: number;
  ratingAsClient?: number | null;
  reviewCountAsClient?: number;
  completedJobs?: number;
  taskCount?: number;
  violationCount?: number;
  bannedAt?: string | null;
  suspendedUntil?: string | null;
};

/** Данни за подателя (само за екипа): по номер на профил или по имейл. */
export async function fetchContactSender(input: {
  userId: string | null;
  email: string;
}): Promise<ContactSender> {
  const { data, error } = await supabase.rpc("admin_contact_sender" as never, {
    _user_id: input.userId,
    _email: input.email,
  } as never);
  if (error) throw error;
  const r = (data ?? {}) as Record<string, unknown>;
  if (!r["found"]) return { found: false };
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    found: true,
    id: String(r["id"]),
    fullName: (r["full_name"] as string | null) ?? null,
    createdAt: (r["created_at"] as string | null) ?? null,
    credits: Number(r["credits"] ?? 0),
    ratingAsPro: num(r["rating_as_pro"]),
    reviewCountAsPro: Number(r["review_count_as_pro"] ?? 0),
    ratingAsClient: num(r["rating_as_client"]),
    reviewCountAsClient: Number(r["review_count_as_client"] ?? 0),
    completedJobs: Number(r["completed_jobs"] ?? 0),
    taskCount: Number(r["task_count"] ?? 0),
    violationCount: Number(r["violation_count"] ?? 0),
    bannedAt: (r["banned_at"] as string | null) ?? null,
    suspendedUntil: (r["suspended_until"] as string | null) ?? null,
  };
}
