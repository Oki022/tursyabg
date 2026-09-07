/**
 * Преводи на грешките от Supabase Auth на български.
 *
 * Supabase връща английски текст и машинни кодове (`same_password`,
 * `over_email_send_rate_limit`). Никой от тях не трябва да стига до
 * потребителя, затова тук ги превеждаме на едно място и го ползваме както в
 * `authErrorMessage`, така и в общия форматер `errorBg`.
 */

export type BgMessage = { title: string; description: string };

type Rule = { match: RegExp; msg: BgMessage };

const RULES: Rule[] = [
  {
    match: /same_password|new password should be different/i,
    msg: {
      title: "Новата парола съвпада със старата",
      description: "Избери различна парола от досегашната.",
    },
  },
  {
    match: /invalid login credentials|invalid_credentials|invalid credentials/i,
    msg: {
      title: "Грешен имейл или парола",
      description: "Провери данните и опитай отново.",
    },
  },
  {
    match: /user_already_exists|already registered|already been registered|user already/i,
    msg: {
      title: "Вече има профил с този имейл",
      description: "Влез с него или използвай „Забравена парола“.",
    },
  },
  {
    match: /weak_password|password.*(too short|at least|should be at least|6 characters)/i,
    msg: {
      title: "Паролата е твърде къса",
      description: "Използвай поне 8 знака с букви и цифри.",
    },
  },
  {
    match: /pwned|compromised|password.*(weak|easy)/i,
    msg: {
      title: "Паролата е твърде лесна за отгатване",
      description: "Избери по-дълга и по-сложна парола.",
    },
  },
  {
    match: /email_address_invalid|invalid email|email.*invalid/i,
    msg: {
      title: "Имейлът изглежда неправилен",
      description: "Провери дали е изписан вярно, например ivan@example.bg.",
    },
  },
  {
    match: /email_not_confirmed|email not confirmed/i,
    msg: {
      title: "Имейлът още не е потвърден",
      description: "Провери пощата си и отвори линка за потвърждение.",
    },
  },
  {
    match: /email_exists|identity_already_exists/i,
    msg: {
      title: "Този имейл вече се използва",
      description: "Използвай друг имейл или влез в съществуващия профил.",
    },
  },
  {
    match: /over_email_send_rate_limit|email rate limit exceeded/i,
    msg: {
      title: "Изпратихме твърде много имейли",
      description: "Изчакай няколко минути, преди да поискаш нов имейл.",
    },
  },
  {
    match: /over_request_rate_limit|for security purposes.*after \d+ seconds|rate limit|too many requests|rate_limited/i,
    msg: {
      title: "Твърде много опити",
      description: "Изчакай малко и опитай отново.",
    },
  },
  {
    match: /otp_expired|token has expired|expired.*(link|token)|flow_state_expired/i,
    msg: {
      title: "Линкът е изтекъл",
      description: "Поискай нов линк и го отвори до един час.",
    },
  },
  {
    match: /invalid_token|token_not_found|invalid.*(token|otp)|bad_jwt/i,
    msg: {
      title: "Линкът вече не е валиден",
      description: "Възможно е да е използван веднъж. Поискай нов.",
    },
  },
  {
    match: /session_not_found|auth session missing|session_expired|refresh_token/i,
    msg: {
      title: "Сесията е изтекла",
      description: "Влез отново в профила си и опитай пак.",
    },
  },
  {
    match: /reauthentication|user_needs_reauthentication/i,
    msg: {
      title: "Нужно е повторно потвърждение",
      description: "Влез отново с паролата си и повтори действието.",
    },
  },
  {
    match: /signup_disabled|signups not allowed|signup is disabled/i,
    msg: {
      title: "Регистрациите са спрени",
      description: "Опитай отново по-късно.",
    },
  },
  {
    match: /user_banned/i,
    msg: {
      title: "Профилът е блокиран",
      description: "Свържи се с екипа от страница Контакти.",
    },
  },
  {
    match: /user_not_found/i,
    msg: {
      title: "Няма профил с този имейл",
      description: "Провери имейла или се регистрирай.",
    },
  },
  {
    match: /captcha/i,
    msg: {
      title: "Проверката за робот не мина",
      description: "Опресни страницата и опитай отново.",
    },
  },
  {
    match: /provider is not enabled|unsupported provider|validation_failed.*provider/i,
    msg: {
      title: "Този начин за вход не е наличен",
      description: "Влез с имейл и парола.",
    },
  },
  {
    match: /phone_required/i,
    msg: {
      title: "Липсва телефон в профила ти",
      description: "Добави телефон от Настройки → Влизане и сигурност.",
    },
  },
  {
    match: /profile_contacts_phone_valid/i,
    msg: {
      title: "Невалиден телефонен номер",
      description: "Въведи български мобилен номер, например 0888123456.",
    },
  },
];

/** Връща превод, ако текстът на грешката е позната грешка от Supabase Auth. */
export function supabaseAuthErrorBg(raw: string): BgMessage | null {
  if (!raw) return null;
  for (const rule of RULES) if (rule.match.test(raw)) return rule.msg;
  return null;
}

/** true, ако текстът е технически (латиница или машинен код) и не бива да се показва. */
export function looksTechnical(text: string): boolean {
  if (!text) return true;
  if (/[a-zA-Z]{4,}/.test(text)) return true;
  if (/[a-z]+_[a-z_]+/.test(text)) return true;
  return false;
}
