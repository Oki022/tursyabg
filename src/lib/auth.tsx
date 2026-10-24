import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { guardAuthAttempt, type AuthGuardAction } from "@/lib/auth-guard.functions";
import { captureIssue } from "@/lib/monitoring/client";
import { APP_AUTH_CALLBACK, isNativeApp } from "@/lib/mobile-app";
import { unregisterPushDevice } from "@/lib/push-device";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  credits?: number;
  avatarUrl?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  skills?: string[];
  banned?: boolean;
  banReason?: string | null;
  deactivated?: boolean;
  deletionScheduledFor?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  /** null = още не знаем (сървър/първо рисуване), true/false = има ли запазена сесия */
  hasStoredSession: boolean | null;
  login: (email: string, password: string) => Promise<void>;
  loginSocial: (provider: "google") => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone: string }) => Promise<{ needsConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Базовият адрес, на който Supabase връща потребителя след имейл линк. */
export function authRedirectBase(): string {
  const siteUrl = (import.meta.env['VITE_SITE_URL'] as string | undefined)?.replace(/\/$/, "");
  if (siteUrl) return siteUrl;
  return typeof window === "undefined" ? "" : window.location.origin;
}

/** Превежда кодовете от set_my_phone на български. */
export function phoneRpcMessage(code: string): string {
  switch (code) {
    case "PHONE_TAKEN":
      return "Този телефонен номер вече се използва от друг профил. Един номер може да е свързан само с един профил.";
    case "PHONE_INVALID":
      return "Въведи валиден български мобилен номер, например 0888123456 или +359888123456.";
    case "PHONE_REQUIRED":
      return "Телефонният номер е задължителен.";
    default:
      return "Телефонният номер не беше запазен. Опитай пак.";
  }
}

/** Записва телефона през защитената функция, която пази номера уникален. */
async function saveMyPhone(phone: string): Promise<void> {
  const { data, error } = await supabase.rpc("set_my_phone", { _phone: phone });
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(phoneRpcMessage(res.error ?? ""));
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Сървърна проверка срещу твърде много опити за вход, регистрация или имейли
 * за потвърждение (по имейл адрес и по IP). При проблем с проверката не
 * блокираме потребителя.
 */
async function throttleAuth(action: AuthGuardAction, email: string, phone?: string) {
  try {
    await guardAuthAttempt({ data: { action, email, phone } });
  } catch (error) {
    if (error instanceof Error && /RATE_LIMITED|PHONE_TAKEN/.test(error.message)) throw error;
  }
}

async function buildUser(session: Session): Promise<AuthUser> {
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, credits, banned_at, ban_reason, deactivated_at, city, neighborhood")
    .eq("id", session.user.id)
    .maybeSingle();
  const { data: deletion } = await supabase
    .from("account_deletion_requests")
    .select("scheduled_for")
    .eq("user_id", session.user.id)
    .eq("status", "pending")
    .maybeSingle();
  const { data: contact } = await supabase
    .from("profile_contacts")
    .select("phone")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const name =
    profile?.full_name ||
    (typeof meta.full_name === "string" ? meta.full_name : "") ||
    session.user.email?.split("@")[0] ||
    "Потребител";

  if (!profile) {
    await supabase.from("profiles").insert({ id: session.user.id, full_name: name });
  }

  // Телефонът, въведен при регистрацията, се пази в метаданните на профила,
  // защото при включено потвърждение по имейл още няма сесия, с която да го
  // запишем. Пренасяме го при първото влизане.
  let phone = contact?.phone ?? undefined;
  if (!phone && typeof meta.phone === "string" && meta.phone.trim()) {
    try {
      await saveMyPhone(meta.phone.trim());
      phone = meta.phone.trim();
    } catch {
      // Заетият или невалиден номер не бива да блокира влизането.
    }
  }

  return {
    id: session.user.id,
    name,
    email: session.user.email ?? "",
    phone,
    credits: profile?.credits ?? 0,
    avatarUrl: profile?.avatar_url ?? undefined,
    city: profile?.city ?? null,
    neighborhood: profile?.neighborhood ?? null,
    skills: Array.isArray(meta.skills) ? (meta.skills as string[]) : [],
    banned: Boolean(profile?.banned_at),
    banReason: profile?.ban_reason ?? null,
    deactivated: Boolean(profile?.deactivated_at),
    deletionScheduledFor: deletion?.scheduled_for ?? null,
  };
}

/**
 * Бърза проверка дали в браузъра има запазена сесия, преди Supabase да я
 * потвърди. Използва се само за да покажем правилния навигационен вид още при
 * първото рисуване (без мигане на бутоните за вход).
 */
function readStoredSessionHint(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const raw = window.localStorage.getItem(key);
        if (raw && raw !== "null") return true;
      }
    }
    return false;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasStoredSession, setHasStoredSession] = useState<boolean | null>(null);

  useEffect(() => {
    setHasStoredSession(readStoredSessionHint());
  }, []);

  useEffect(() => {
    let active = true;
    let syncVersion = 0;

    const sync = async (session: Session | null) => {
      if (!active) return;
      const version = ++syncVersion;
      setHasStoredSession(Boolean(session));
      if (!session) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const next = await buildUser(session);
        if (!active || version !== syncVersion) return;
        if (next.banned) {
          toast.error(
            next.banReason
              ? `Профилът ти е блокиран: ${next.banReason}`
              : "Профилът ти е блокиран. Свържи се с поддръжката.",
          );
          setUser(null);
          setLoading(false);
          setHasStoredSession(false);
          // Run sign-out after this auth-state task returns. Calling another
          // auth method from inside an onAuthStateChange callback can deadlock.
          window.setTimeout(() => void supabase.auth.signOut(), 0);
          return;
        }
        setUser(next);
        setLoading(false);
      } catch (error) {
        if (active && version === syncVersion) {
          captureIssue({ area: "auth", action: "load signed-in user", error });
          setUser(null);
          setLoading(false);
        }
      }
    };

    void supabase.auth
      .getSession()
      .then(({ data }) => sync(data.session))
      .catch((error) => {
        if (!active) return;
        captureIssue({ area: "auth", action: "restore session", error });
        setUser(null);
        setLoading(false);
        setHasStoredSession(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Supabase awaits auth callbacks while holding its auth lock. Profile
      // reads also need that lock for their bearer token, so starting them in
      // this callback stalls sign-in/sign-out forever. Defer all async work.
      window.setTimeout(() => void sync(session), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login: AuthContextValue["login"] = async (email, password) => {
    await throttleAuth("login", email);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      captureIssue({ area: "auth", action: "sign in with password", error });
      throw error;
    }
  };

  const loginSocial: AuthContextValue["loginSocial"] = async () => {
    // In the mobile app Google blocks sign-in inside the app's web view, so it
    // opens in an in-app browser sheet and comes back through a deep link
    // (handled in components/native-app-bridge.tsx).
    if (isNativeApp()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: APP_AUTH_CALLBACK, skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        const failure = error ?? new Error("No Google sign-in URL");
        captureIssue({ area: "auth", action: "sign in with google in app", error: failure });
        throw failure;
      }
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: data.url });
      return;
    }

    const base = authRedirectBase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${base}/` },
    });
    if (error) {
      captureIssue({ area: "auth", action: "sign in with google", error });
      throw error;
    }
  };

  const register: AuthContextValue["register"] = async ({ name, email, password, phone }) => {
    // PRE-LAUNCH TODO: потвърждението на имейл е ИЗКЛЮЧЕНО (auto-confirm) за периода на разработка,
    // затова signUp връща активна сесия и потребителят влиза веднага.
    // Преди пускане на живо: включи отново "Confirm email" с истински SMTP доставчик
    // (Resend/Postmark), публичен маркетплейс се нуждае от верифицирани имейли срещу спам профили.
    // Когато го включиш, register ще върне needsConfirmation: true и потребителят
    // трябва да се насочи към /auth/verify?email=... (страницата вече е готова).
    await throttleAuth("signup", email, phone);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${authRedirectBase()}/auth/callback`,
        data: { full_name: name, phone },
      },
    });
    if (error) {
      captureIssue({ area: "auth", action: "register account", error });
      throw error;
    }
    // Телефонът е задължителен контакт, записва се в профила веднага след регистрация.
    if (data.session?.user?.id) {
      await supabase.from("profiles").upsert({ id: data.session.user.id, full_name: name }, { onConflict: "id" });
      try {
        await saveMyPhone(phone);
      } catch (phoneError) {
        captureIssue({ area: "auth", action: "save phone after signup", error: phoneError });
      }
    }
    return { needsConfirmation: !data.session };
  };

  const resendConfirmation: AuthContextValue["resendConfirmation"] = async (email) => {
    await throttleAuth("resend", email);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${authRedirectBase()}/auth/callback` },
    });
    if (error) {
      captureIssue({ area: "auth", action: "resend confirmation", error });
      throw error;
    }
  };

  const resetPassword: AuthContextValue["resetPassword"] = async (email) => {
    await throttleAuth("reset", email);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${authRedirectBase()}/reset-password`,
    });
    if (error) {
      captureIssue({ area: "auth", action: "request password reset", error });
      throw error;
    }
  };

  const updatePassword: AuthContextValue["updatePassword"] = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      captureIssue({ area: "auth", action: "update password", error });
      throw error;
    }
  };

  /** Смяна на паролата с потвърждение на текущата (повторна автентикация). */
  const changePassword: AuthContextValue["changePassword"] = async (currentPassword, newPassword) => {
    const email = user?.email;
    if (!email) throw new Error("Няма активна сесия.");
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (reauthError) throw new Error("Текущата парола е грешна.");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      captureIssue({ area: "auth", action: "change password", error });
      throw error;
    }
  };

  const refreshUser = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) setUser(await buildUser(data.session));
  };

  const logout = async () => {
    // In the app: this phone stops getting this user's push notifications.
    await unregisterPushDevice();
    try {
      await supabase.auth.signOut();
    } catch {
      // Дори при мрежов проблем изчистваме състоянието локално.
    }
    setUser(null);
    setLoading(false);
    // Без това навигацията остава в състояние „още не знаем“ и защитените
    // страници висят на „Зареждане...“ след излизане.
    setHasStoredSession(false);
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
  };

  const updateUser: AuthContextValue["updateUser"] = async (patch) => {
    if (!user) return;
    const next = { ...user, ...patch };
    setUser(next);

    if (
      patch.name !== undefined ||
      patch.avatarUrl !== undefined ||
      patch.city !== undefined ||
      patch.neighborhood !== undefined
    ) {
      await supabase
        .from("profiles")
        .update({
          full_name: next.name,
          avatar_url: next.avatarUrl ?? null,
          city: next.city ?? null,
          neighborhood: next.neighborhood ?? null,
        })
        .eq("id", user.id);
    }
    if (patch.phone !== undefined && next.phone) {
      try {
        await saveMyPhone(next.phone);
      } catch (error) {
        setUser(user); // връщаме предишното състояние, номерът не е запазен
        throw error;
      }
    }
    if (patch.skills !== undefined || patch.name !== undefined) {
      await supabase.auth.updateUser({
        data: { full_name: next.name, skills: next.skills ?? [] },
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, hasStoredSession, login, loginSocial, register, resetPassword, resendConfirmation, updatePassword, changePassword, refreshUser, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getInitials(name: string) {
  return initials(name);
}
