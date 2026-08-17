/** Български мобилни номера: 08XXXXXXXX или +359XXXXXXXXX. */
export function normalizeBgPhone(input: string): string {
  const raw = input.replace(/[^0-9+]/g, "");
  if (raw.startsWith("00359")) return `+359${raw.slice(5)}`;
  if (raw.startsWith("+359")) return raw;
  if (raw.startsWith("359")) return `+${raw}`;
  return raw;
}

export function isValidBgPhone(input: string): boolean {
  const p = normalizeBgPhone(input);
  return /^\+3598[7-9][0-9]{7}$/.test(p) || /^08[7-9][0-9]{7}$/.test(p);
}

/** Връща грешка на български или null. */
export function phoneError(value: string): string | null {
  if (!value.trim()) return "Телефонният номер е задължителен.";
  return isValidBgPhone(value)
    ? null
    : "Въведи валиден български мобилен номер, например 0888123456 или +359888123456.";
}

/** Груба клиентска проверка дали текстът съдържа контакти (за предупреждение преди изпращане). */
export function containsContactInfo(text: string): boolean {
  const t = text.toLowerCase();
  if (/[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) return true;
  if (/(viber|whatsapp|whats app|telegram|skype|messenger|вайбър|вибер|уатсап|телеграм|скайп)/.test(t)) return true;
  if (/(\+|00)?\s*359[\s.()\/-]*[0-9][\s.()\/-]*[0-9]/.test(text) && (text.match(/[0-9]/g)?.length ?? 0) >= 9) return true;
  if (/0[\s.()\/-]*(?:[0-9][\s.()\/-]*){8,}/.test(text)) return true;
  if (/((нула|едно|един|две|три|четири|пет|шест|седем|осем|девет)[\s,.-]+){5,}/.test(t)) return true;
  return false;
}

export const CONTACT_MASK_WARNING =
  "Телефони, имейли и контакти във Viber/WhatsApp/Telegram се скриват автоматично. Контактите се разменят само през платформата — след отключване с кредити.";
