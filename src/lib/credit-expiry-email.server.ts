/**
 * Warning e-mail 7 days before points expire. Used by
 * /api/public/cron/credit-expiry-emails.
 */
import { absoluteUrl } from "@/lib/brand";
import { emailLayout, escapeHtml } from "@/lib/email-layout";

export type Notice = {
  notice_id: string;
  email: string;
  full_name: string | null;
  kind: "bonus" | "inactivity";
  amount: number;
  expires_at: string;
};

function sofiaDate(iso: string): string {
  return new Date(iso).toLocaleDateString("bg-BG", {
    timeZone: "Europe/Sofia",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Builds the e-mail (exported for tests). */
export function creditExpiryEmail(n: Notice): { subject: string; html: string } {
  const date = sofiaDate(n.expires_at);
  const hello = `<p style="margin:0 0 10px">Здравей${n.full_name ? `, ${escapeHtml(n.full_name)}` : ""}!</p>`;

  if (n.kind === "bonus") {
    return {
      subject: `Бонус точките ти изтичат на ${date}`,
      html: emailLayout({
        preheader: `${n.amount} бонус точки изтичат на ${date}.`,
        title: "Бонус точките ти изтичат",
        introHtml: `${hello}<p style="margin:0"><strong>${n.amount} бонус точки</strong> в профила ти изтичат на
          <strong>${escapeHtml(date)}</strong>. Използвай ги, за да отключиш контакт по задача, която те интересува.</p>`,
        cta: { label: "Виж задачите", href: absoluteUrl("/tasks") },
        footerHtml: `Бонус точките са подарък и са валидни ограничено време. Купените точки не изтичат,
          докато използваш профила си.`,
      }),
    };
  }

  return {
    subject: `Точките ти изтичат на ${date}`,
    html: emailLayout({
      preheader: `${n.amount} точки изтичат на ${date}, ако не влезеш в профила си.`,
      title: "Точките ти изтичат",
      introHtml: `${hello}<p style="margin:0">Профилът ти в ТърсяБГ няма активност от почти 12 месеца.
        <strong>${n.amount} точки</strong> ще изтекат на <strong>${escapeHtml(date)}</strong>.
        Достатъчно е да влезеш в профила си, за да ги запазиш.</p>`,
      cta: { label: "Влез в ТърсяБГ", href: absoluteUrl("/settings/billing") },
      footerHtml: `Точките изтичат само след 12 месеца без никаква активност в профила.`,
    }),
  };
}
