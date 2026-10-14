import { absoluteUrl } from "@/lib/brand";

/**
 * Shared HTML frame for every e-mail the site sends itself (Resend).
 * Table layout and inline styles only, so it renders the same in Gmail,
 * Outlook and Apple Mail. Keep it in sync with supabase/email-templates/*.html.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type EmailLayoutInput = {
  /** Short line shown next to the subject in the inbox list. */
  preheader: string;
  title: string;
  /** Trusted HTML (escape user data before passing it in). */
  introHtml: string;
  bodyHtml?: string;
  cta?: { label: string; href: string };
  /** Trusted HTML for the grey note at the bottom. */
  footerHtml: string;
};

export function emailLayout({ preheader, title, introHtml, bodyHtml = "", cta, footerHtml }: EmailLayoutInput): string {
  const logo = absoluteUrl("/brand/email-logo.png");
  const button = cta
    ? `
      <tr><td style="padding:8px 32px 8px">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td bgcolor="#F94144" style="border-radius:999px;background:#F94144;background-image:linear-gradient(90deg,#FB7C00,#EC305A)">
            <a href="${cta.href}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(cta.label)}</a>
          </td>
        </tr></table>
      </td></tr>`
    : "";

  return `<!doctype html>
<html lang="bg">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f1f5f9" style="background:#f1f5f9">
  <tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
      <tr><td bgcolor="#0b1120" style="background:#0b1120;padding:22px 32px">
        <a href="${absoluteUrl("/")}" style="text-decoration:none"><img src="${logo}" width="222" height="44" alt="ТърсяБГ" style="display:block;border:0"></a>
      </td></tr>
      <tr><td style="height:4px;line-height:4px;font-size:0;background:#F94144;background-image:linear-gradient(90deg,#FB7C00,#EC305A)">&nbsp;</td></tr>
      <tr><td style="padding:32px 32px 8px;font-family:Arial,Helvetica,sans-serif">
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#0f172a">${escapeHtml(title)}</h1>
        <div style="font-size:15px;line-height:1.6;color:#334155">${introHtml}</div>
      </td></tr>
      ${bodyHtml ? `<tr><td style="padding:8px 32px 8px;font-family:Arial,Helvetica,sans-serif">${bodyHtml}</td></tr>` : ""}
      ${button}
      <tr><td style="padding:24px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#94a3b8">
        ${footerHtml}
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8">
      ТърсяБГ · Борса за работа и услуги в България · <a href="${absoluteUrl("/")}" style="color:#94a3b8">tursya.bg</a>
    </p>
  </td></tr>
</table>
</body>
</html>`;
}
