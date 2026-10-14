import { createServerFn } from "@tanstack/react-start";
import { absoluteUrl } from "@/lib/brand";
import { emailLayout, escapeHtml } from "@/lib/email-layout";

/**
 * Изпраща известие до поддръжката за ново съобщение от формата за контакт.
 *
 * Функцията никога не се доверява на данните от браузъра: приема само
 * идентификатор и чете самото съобщение от базата. Известие се праща
 * най-много веднъж на съобщение (`notified_at`).
 */

const SUPPORT_TO = "support@tursya.bg";
const SUPPORT_FROM = "ТърсяБГ <noreply@tursya.bg>";
/** Max confirmations per sender address per day, so the form can't be used to spam someone. */
const MAX_CONFIRMATIONS_PER_DAY = 3;

const LABEL = "padding:4px 12px 4px 0;color:#64748b;font-size:14px;white-space:nowrap;vertical-align:top";
const VALUE = "padding:4px 0;color:#0f172a;font-size:14px";

function supportEmail(row: { id: string; name: string; email: string; subject: string; body: string; created_at: string }): string {
  const sentAt = new Date(row.created_at).toLocaleString("bg-BG", { timeZone: "Europe/Sofia" });
  return emailLayout({
    preheader: `${row.name}: ${row.body.slice(0, 90)}`,
    title: "Ново съобщение от формата за контакт",
    introHtml: `
      <table role="presentation" cellspacing="0" cellpadding="0">
        <tr><td style="${LABEL}">Тема</td><td style="${VALUE}"><b>${escapeHtml(row.subject)}</b></td></tr>
        <tr><td style="${LABEL}">От</td><td style="${VALUE}">${escapeHtml(row.name)}</td></tr>
        <tr><td style="${LABEL}">Имейл</td><td style="${VALUE}"><a href="mailto:${escapeHtml(row.email)}" style="color:#EC305A">${escapeHtml(row.email)}</a></td></tr>
        <tr><td style="${LABEL}">Изпратено</td><td style="${VALUE}">${escapeHtml(sentAt)}</td></tr>
      </table>`,
    bodyHtml: `
      <div style="margin-top:8px;padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;color:#0f172a;font-size:15px;line-height:1.6;white-space:pre-wrap">${escapeHtml(row.body)}</div>`,
    cta: { label: "Отвори в админ панела", href: absoluteUrl(`/admin/contact#msg-${row.id}`) },
    footerHtml: "Можеш да отговориш директно на този имейл — отговорът отива до подателя.",
  });
}

/**
 * Sent to whoever filled in the form. Deliberately contains no text they typed
 * (name, subject, message), so nobody can use our form to mail arbitrary
 * content to someone else's address.
 */
function confirmationEmail(): string {
  return emailLayout({
    preheader: "Получихме съобщението ти и ще ти отговорим възможно най-скоро.",
    title: "Получихме съобщението ти",
    introHtml: `
      <p style="margin:0 0 10px">Здравей!</p>
      <p style="margin:0 0 10px">Благодарим ти, че ни писа. Съобщението ти е при нас и ще ти отговорим на този имейл възможно най-скоро.</p>
      <p style="margin:0">Ако искаш да добавиш нещо, просто отговори на този имейл.</p>`,
    cta: { label: "Виж честите въпроси", href: absoluteUrl("/faq") },
    footerHtml: "Ако не си писал(а) на ТърсяБГ, просто игнорирай този имейл.",
  });
}

async function sendEmail(apiKey: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Resend failed [${res.status}]: ${await res.text()}`);
}

export const notifyContactMessage = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => {
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

    try {
      await sendEmail(apiKey, {
        from: SUPPORT_FROM,
        to: [SUPPORT_TO],
        reply_to: row.email,
        subject: `[Контакт] ${row.subject} — ${row.name}`,
        html: supportEmail(row),
      });
    } catch (e) {
      reportServerIssue({ area: "server-fn", action: "notify support about contact message", error: e });
      return { ok: false as const };
    }

    // Confirmation to the sender. Best effort: a failure here never blocks the
    // support notification, and repeated messages from one address get at most
    // MAX_CONFIRMATIONS_PER_DAY confirmations a day.
    try {
      const { count } = await supabaseAdmin
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .ilike("email", row.email)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      if ((count ?? 0) <= MAX_CONFIRMATIONS_PER_DAY) {
        await sendEmail(apiKey, {
          from: SUPPORT_FROM,
          to: [row.email],
          reply_to: SUPPORT_TO,
          subject: "Получихме съобщението ти — ТърсяБГ",
          html: confirmationEmail(),
        });
      }
    } catch (e) {
      reportServerIssue({ area: "server-fn", action: "confirm contact message to sender", error: e });
    }

    await supabaseAdmin
      .from("contact_messages")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", row.id);

    return { ok: true as const };
  });
