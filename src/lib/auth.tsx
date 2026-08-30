import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { captureIssue } from "@/lib/monitoring/client";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  credits?: number;
  avatarUrl?: string;
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
  login: (email: string, password: string) => Promise<void>;
  loginSocial: (provider: "google") => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone: string }) => Promise<{ needsConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
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

  return {
    id: session.user.id,
    name,
    email: session.user.email ?? "",
    phone: contact?.phone ?? undefined,
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const sync = async (session: Session | null) => {
      if (!session) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const next = await buildUser(session);
      if (next.banned) {
        toast.error(
          next.banReason
            ? `Профилът ти е блокиран: ${next.banReason}`
            : "Профилът ти е блокиран. Свържи се с поддръжката.",
        );
        await supabase.auth.signOut();
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      if (active) {
        setUser(next);
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data }) => sync(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void sync(session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login: AuthContextValue["login"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      captureIssue({ area: "auth", action: "sign in with password", error });
      throw error;
    }
  };

  const loginSocial: AuthContextValue["loginSocial"] = async () => {
    const { lovable } = await import("@/integrations/lovable/index");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      const err = new Error(result.error.message ?? "Неуспешен вход с Google");
      captureIssue({ area: "auth", action: "sign in with google", error: err });
      throw err;
    }
  };

  const register: AuthContextValue["register"] = async ({ name, email, password, phone }) => {
    // PRE-LAUNCH TODO: потвърждението на имейл е ИЗКЛЮЧЕНО (auto-confirm) за периода на разработка,
    // затова signUp връща активна сесия и потребителят влиза веднага.
    // Преди пускане на живо: включи отново "Confirm email" с истински SMTP доставчик
    // (Resend/Postmark), публичен маркетплейс се нуждае от верифицирани имейли срещу спам профили.
    // Когато го включиш, register ще върне needsConfirmation: true и потребителят
    // трябва да се насочи към /auth/verify?email=... (страницата вече е готова).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
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
      await supabase
        .from("profile_contacts")
        .upsert({ user_id: data.session.user.id, phone }, { onConflict: "user_id" });
    }
    return { needsConfirmation: !data.session };
  };

  const resetPassword: AuthContextValue["resetPassword"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
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
    await supabase.auth.signOut();
    setUser(null);
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
    if (patch.phone !== undefined) {
      await supabase
        .from("profile_contacts")
        .upsert({ user_id: user.id, phone: next.phone ?? null }, { onConflict: "user_id" });
    }
    if (patch.skills !== undefined || patch.name !== undefined) {
      await supabase.auth.updateUser({
        data: { full_name: next.name, skills: next.skills ?? [] },
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, loginSocial, register, resetPassword, updatePassword, changePassword, refreshUser, logout, updateUser }}
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
