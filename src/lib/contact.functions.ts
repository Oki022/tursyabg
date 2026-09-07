import { createServerFn } from "@tanstack/react-start";
import { absoluteUrl } from "@/lib/brand";

/**
 * Изпраща известие до поддръжката за ново съобщение от формата за контакт.
 *
 * Функцията никога не се доверява на данните от браузъра: приема само
 * идентификатор и чете самото съобщение от базата. Известие се праща
 * най-много веднъж на съобщение (`notified_at`).
 */

const SUPPORT_TO = "support@tursya.bg";
const SUPPORT_FROM = "ТърсяБГ <noreply@tursya.bg>";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const notifyContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => {
    const id = String(input?.id ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("INVALID_INPUT");
    return { id };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { reportServerIssue } = await import("@/lib/monitoring/sentry.server");

    const { data: row, error } = await supabaseAdmin
      .from("contact_messages")
      .select("id, name, email, subject, body, created_at, notified_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row || row.notified_at) return { ok: false as const };

    // Само за току-що създадени съобщения — не може да се преизползва по-късно.
    if (Date.now() - new Date(row.created_at).getTime() > 10 * 60 * 1000) {
      return { ok: false as const };
    }

    const link = absoluteUrl(`/admin/contact#msg-${row.id}`);
    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">
        <h2 style="margin:0 0 12px">Ново съобщение от формата за контакт</h2>
        <p style="margin:0 0 4px"><strong>Тема:</strong> ${escapeHtml(row.subject)}</p>
        <p style="margin:0 0 4px"><strong>От:</strong> ${escapeHtml(row.name)} &lt;${escapeHtml(row.email)}&gt;</p>
        <p style="margin:16px 0;white-space:pre-wrap">${escapeHtml(row.body)}</p>
        <p style="margin:16px 0"><a href="${link}">Отвори в админ панела</a></p>
      </div>`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from: SUPPORT_FROM,
          to: [SUPPORT_TO],
          reply_to: row.email,
          subject: `[Контакт] ${row.subject} — ${row.name}`,
          html,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        reportServerIssue({
          area: "server",
          error: new Error(`Resend failed [${res.status}]: ${text}`),
        });
        return { ok: false as const };
      }
    } catch (e) {
      reportServerIssue({ area: "server", error: e });
      return { ok: false as const };
    }

    await supabaseAdmin
      .from("contact_messages")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", row.id);

    return { ok: true as const };
  });
