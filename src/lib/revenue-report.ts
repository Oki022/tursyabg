import type { RevenuePayment } from "@/services/admin";

/** "2026-10-01" -> "октомври 2026". */
export function monthLabelBg(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("bg-BG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).replace(/\s*г\.$/, "");
}

/** Date and time in Bulgarian time, e.g. "2026-10-05 13:00". */
export function sofiaDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}`;
}

/** True when the ISO time falls inside the given month in Bulgarian time. */
export function inSofiaMonth(iso: string | null, month: string): boolean {
  return !!iso && sofiaDateTime(iso).slice(0, 7) === month.slice(0, 7);
}

export const KIND_BG: Record<string, string> = {
  credits: "Пакет точки",
  promotion: "Промотиране на задача",
};

export const CHANNEL_BG: Record<string, string> = {
  stripe: "Сайт (карта)",
  google_play: "Google Play",
  app_store: "App Store",
};

export const REVENUE_STATUS_BG: Record<string, string> = {
  completed: "Платено",
  refunded: "Възстановено",
  disputed: "Оспорено",
};

/** Excel in Bulgarian reads ";" as the column separator and "," as the decimal mark. */
function amount(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/** Text cell. Numbers are written as they are (a refund is a negative amount). */
function cell(value: string): string {
  const v = value.replace(/\r?\n/g, " ");
  // Leading = + - @ in text would be read as a formula by Excel.
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[";]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * One row per payment paid or refunded in the month. "Сума за месеца" is the
 * signed amount for this month: + for a sale, - for a refund, both for a
 * payment paid and refunded in the same month (that row nets to 0).
 */
export function revenueCsv(rows: RevenuePayment[], month: string): string {
  const header = [
    "Дата на плащане",
    "Дата на възстановяване",
    "Статус",
    "Вид",
    "Канал",
    "Продукт",
    "Точки",
    "Сума",
    "Сума за месеца",
    "Валута",
    "Комисиона на магазина %",
    "Потребител",
    "ID на потребител",
    "Номер на плащането",
    "Разписка",
  ];
  const lines = rows.map((r) => {
    const paidHere = inSofiaMonth(r.paidAt, month);
    const refundedHere = inSofiaMonth(r.refundedAt, month);
    const signed = (paidHere ? r.amountEur : 0) - (refundedHere ? r.amountEur : 0);
    return [
      cell(sofiaDateTime(r.paidAt)),
      cell(r.refundedAt ? sofiaDateTime(r.refundedAt) : ""),
      cell(REVENUE_STATUS_BG[r.status] ?? r.status),
      cell(KIND_BG[r.kind] ?? r.kind),
      cell(CHANNEL_BG[r.provider] ?? r.provider),
      cell(r.item),
      String(r.credits),
      amount(r.amountEur),
      amount(signed),
      cell(r.currency),
      r.storeCommissionPct == null ? "" : amount(r.storeCommissionPct * 100),
      cell(r.userName),
      cell(r.userId),
      cell(r.paymentIntentId ?? r.storeTransactionId ?? ""),
      cell(r.receiptUrl ?? ""),
    ].join(";");
  });
  // BOM so Excel opens the file as UTF-8 (Cyrillic).
  return "﻿" + [header.join(";"), ...lines].join("\r\n") + "\r\n";
}

export function downloadCsv(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
