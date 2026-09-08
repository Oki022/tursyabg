import { createServerFn } from "@tanstack/react-start";
import { createHash, randomInt } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function hashCode(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

/** Български номер в E.164 за доставчика на SMS. */
function toE164(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) return `+359${digits.slice(1)}`;
  return `+${digits}`;
}

/** Праща 6-цифрен код на телефона от профила. Всички ограничения са в базата. */
export const requestPhoneCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendVerificationCode } = await import("@/services/sms");

    const { data: contact } = await supabaseAdmin
      .from("profile_contacts")
      .select("phone")
      .eq("user_id", context.userId)
      .maybeSingle();

    const phone = contact?.phone ?? "";
    if (!phone) return { ok: false as const, error: "PHONE_REQUIRED" };

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const { data, error } = await supabaseAdmin.rpc("start_phone_verification", {
      _user_id: context.userId,
      _phone: phone,
      _code_hash: hashCode(phone, code),
    });
    if (error) return { ok: false as const, error: "SERVER_ERROR" };

    const res = (data ?? {}) as { ok?: boolean; error?: string; retry_after?: number };
    if (!res.ok) return { ok: false as const, error: res.error ?? "SERVER_ERROR", retryAfter: res.retry_after };

    const sent = await sendVerificationCode(toE164(phone), code);
    if (!sent.ok) return { ok: false as const, error: sent.error };

    return { ok: true as const, expiresIn: 300 };
  });

/** Проверява въведения код и отбелязва телефона като потвърден. */
export const confirmPhoneCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    const code = String(input?.code ?? "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) throw new Error("INVALID_INPUT");
    return { code };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: contact } = await supabaseAdmin
      .from("profile_contacts")
      .select("phone")
      .eq("user_id", context.userId)
      .maybeSingle();
    const phone = contact?.phone ?? "";
    if (!phone) return { ok: false as const, error: "PHONE_REQUIRED" };

    const { data: res, error } = await supabaseAdmin.rpc("confirm_phone_verification", {
      _user_id: context.userId,
      _code_hash: hashCode(phone, data.code),
    });
    if (error) return { ok: false as const, error: "SERVER_ERROR" };

    const out = (res ?? {}) as { ok?: boolean; error?: string; attempts_left?: number };
    if (!out.ok) return { ok: false as const, error: out.error ?? "SERVER_ERROR", attemptsLeft: out.attempts_left };
    return { ok: true as const };
  });

/** Български обяснения за отговорите на проверката. */
export function phoneVerificationMessage(code: string, attemptsLeft?: number): string {
  switch (code) {
    case "PHONE_REQUIRED":
      return "Първо запази телефонен номер в профила си.";
    case "PHONE_INVALID":
      return "Номерът в профила ти не е валиден български мобилен номер.";
    case "COOLDOWN":
      return "Изчакай една минута, преди да поискаш нов код.";
    case "HOURLY_LIMIT":
      return "Заявките за код са до 3 на час за един номер. Опитай по-късно.";
    case "DAILY_LIMIT":
      return "Заявките за код са до 5 на ден за един номер. Опитай утре.";
    case "LOCKED":
      return "Потвърждението за този номер е заключено за един час заради много грешни кодове.";
    case "NO_CODE":
      return "Няма активен код. Поискай нов.";
    case "EXPIRED":
      return "Кодът изтече. Поискай нов.";
    case "WRONG_CODE":
      return attemptsLeft && attemptsLeft > 0
        ? `Грешен код. Остават ти ${attemptsLeft} опита.`
        : "Грешен код.";
    case "SMS_NOT_CONFIGURED":
    case "SMS_PROVIDER_UNKNOWN":
      return "Изпращането на SMS още не е настроено.";
    case "SMS_SEND_FAILED":
      return "SMS-ът не можа да бъде изпратен. Опитай пак след малко.";
    default:
      return "Нещо се обърка. Опитай пак.";
  }
}
