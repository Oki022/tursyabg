/**
 * Единствената точка, през която приложението праща SMS.
 *
 * Целта е доставчикът (Twilio, Vonage, български агрегатор) да се сменя само
 * тук, без промени никъде другаде. Този модул се изпълнява само на сървъра.
 *
 * Променливи на средата:
 *  - `SMS_PROVIDER`       — "twilio" | "log". При "log" кодът само се записва
 *                           в дневника на сървъра и не се праща реален SMS.
 *  - `SMS_SENDER_ID`      — номер на подателя (E.164) или буквено име.
 *  - `TWILIO_ACCOUNT_SID` — само за Twilio.
 *  - `TWILIO_AUTH_TOKEN`  — само за Twilio.
 */

export type SmsResult = { ok: true } | { ok: false; error: string };

function verificationText(code: string): string {
  return `ТърсяБГ: кодът ти за потвърждение е ${code}. Валиден е 5 минути. Не го споделяй с никого.`;
}

/** Изпраща 6-цифрен код за потвърждение на телефонен номер в E.164 формат. */
export async function sendVerificationCode(phoneE164: string, code: string): Promise<SmsResult> {
  const provider = (process.env['SMS_PROVIDER'] ?? "log").toLowerCase();
  const body = verificationText(code);

  if (provider === "log") {
    console.info(`[sms:log] ${phoneE164} -> ${body}`);
    return { ok: true };
  }

  if (provider === "twilio") {
    const sid = process.env['TWILIO_ACCOUNT_SID'];
    const token = process.env['TWILIO_AUTH_TOKEN'];
    const from = process.env['SMS_SENDER_ID'];
    if (!sid || !token || !from) return { ok: false, error: "SMS_NOT_CONFIGURED" };

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phoneE164, From: from, Body: body }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[sms:twilio] failed [${res.status}]: ${text}`);
      return { ok: false, error: "SMS_SEND_FAILED" };
    }
    return { ok: true };
  }

  return { ok: false, error: "SMS_PROVIDER_UNKNOWN" };
}
