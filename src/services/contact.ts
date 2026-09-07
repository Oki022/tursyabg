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
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("contact_messages").insert({
    name: input.name.trim(),
    email: input.email.trim(),
    subject: input.subject.trim(),
    body: input.body.trim(),
    user_id: auth.user?.id ?? null,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
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
