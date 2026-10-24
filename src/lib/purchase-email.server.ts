/**
 * Purchase confirmation e-mail, sent once after a payment is completed
 * (card on the site, Google Play or App Store). Called by the payment
 * webhooks only when the payment was just completed (not on a retry).
 * It is a confirmation, not an invoice; the store purchases also get the
 * store's own receipt from Google / Apple.
 */
import { absoluteUrl } from "@/lib/brand";
import { emailLayout, escapeHtml } from "@/lib/email-layout";

const FROM = "ТърсяБГ <noreply@tursya.bg>";

const CHANNEL: Record<string, string> = {
  stripe: "Карта (сайт)",
  google_play: "Google Play",
  app_store: "App Store",
};

function eur(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`;
}

function sofiaDate(iso: string): string {
  return new Date(iso).toLocaleString("bg-BG", {
    timeZone: "Europe/Sofia",
    dateStyle: "long",
    timeStyle: "short",
  });
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:#64748b;font-size:14px;white-space:nowrap">${escapeHtml(label)}</td>
    <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:bold">${escapeHtml(value)}</td>
  </tr>`;
}

export type PurchaseEmailParts = {
  subject: string;
  html: string;
};

/** Builds the e-mail (exported for tests). */
export function purchaseEmail(input: {
  name: string;
  kind: string;
  item: string;
  credits: number;
  amountEur: number;
  provider: string;
  paidAt: string;
  reference: string;
  balance: number | null;
  receiptUrl: string | null;
}): PurchaseEmailParts {
  const isPoints = input.kind !== "promotion";
  const what = isPoints ? `${input.item} – ${input.credits} точки` : input.item;
  const rows = [
    row("Покупка", what),
    row("Сума", eur(input.amountEur)),
    row("Плащане", CHANNEL[input.provider] ?? input.provider),
    row("Дата", sofiaDate(input.paidAt)),
    ...(input.reference ? [row("Номер на плащането", input.reference)] : []),
    ...(isPoints && input.balance != null ? [row("Наличност сега", `${input.balance} точки`)] : []),
  ].join("");

  const storeNote =
    input.provider === "google_play" || input.provider === "app_store"
      ? `Разписката за това плащане ти изпраща ${escapeHtml(CHANNEL[input.provider] ?? "")}.<br>`
      : input.receiptUrl
        ? `<a href="${escapeHtml(input.receiptUrl)}" style="color:#64748b">Разписка за плащането</a><br>`
        : "";

  const html = emailLayout({
    preheader: isPoints ? `Точките са добавени: +${input.credits}` : "Плащането за промоцията е получено",
    title: isPoints ? "Точките са добавени" : "Плащането е получено",
    introHtml: `<p style="margin:0 0 10px">Здравей${input.name ? `, ${escapeHtml(input.name)}` : ""}!</p>
      <p style="margin:0">${
        isPoints
          ? "Благодарим за покупката. Точките вече са в профила ти и можеш да ги използваш веднага."
          : "Благодарим за покупката. Промоцията се активира за обявата ти."
      }</p>`,
    bodyHtml: `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:8px 0">${rows}</table>`,
    cta: { label: isPoints ? "Към баланса" : "Към плащанията", href: absoluteUrl("/settings/billing") },
    footerHtml: `${storeNote}Това е потвърждение за плащане. Ако имаш въпрос, пиши ни от
      <a href="${absoluteUrl("/contact")}" style="color:#64748b">страницата за контакти</a>.`,
  });

  return {
    subject: isPoints ? `Точките са добавени: +${input.credits}` : `Плащането е получено: ${input.item}`,
    html,
  };
}

/** Loads the payment and sends the e-mail. Never throws: a mail problem must not undo a payment. */
export async function sendPurchaseEmail(paymentId: string): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { reportServerIssue } = await import("@/lib/monitoring/sentry.server");

  try {
    const { data: p } = await supabaseAdmin
      .from("payments")
      .select(
        "id, user_id, kind, credits, amount_eur, provider, package_id, promo_product_id, completed_at, store_transaction_id, stripe_payment_intent_id, receipt_url",
      )
      .eq("id", paymentId)
      .maybeSingle();
    if (!p || !p.completed_at) return;

    const [{ data: authUser }, { data: profile }, pkg, promo] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(p.user_id),
      supabaseAdmin.from("profiles").select("full_name, credits").eq("id", p.user_id).maybeSingle(),
      p.package_id
        ? supabaseAdmin.from("credit_packages").select("name").eq("id", p.package_id).maybeSingle()
        : Promise.resolve({ data: null }),
      p.promo_product_id
        ? supabaseAdmin.from("promo_products").select("name_bg").eq("id", p.promo_product_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const email = authUser?.user?.email;
    if (!email) return;

    const { subject, html } = purchaseEmail({
      name: profile?.full_name ?? "",
      kind: p.kind,
      item: (pkg.data as { name?: string } | null)?.name ?? (promo.data as { name_bg?: string } | null)?.name_bg ?? "Покупка",
      credits: p.credits ?? 0,
      amountEur: Number(p.amount_eur),
      provider: p.provider,
      paidAt: p.completed_at,
      reference: p.store_transaction_id ?? p.stripe_payment_intent_id ?? "",
      balance: profile?.credits ?? null,
      receiptUrl: p.receipt_url,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: FROM, to: [email], subject, html }),
    });
    if (!res.ok) throw new Error(`Resend failed [${res.status}]`);
  } catch (error) {
    reportServerIssue({
      area: "payments.webhook",
      action: "send purchase e-mail",
      error,
      route: "purchase-email",
    });
  }
}
