import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "customer" | "worker";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  credits?: number;
  role: UserRole;
  avatarUrl?: string;
  skills?: string[];
  verified?: boolean;
  banned?: boolean;
  banReason?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginSocial: (provider: "google") => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone: string; role: UserRole }) => Promise<{ needsConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
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
    .select("id, full_name, avatar_url, credits, banned_at, ban_reason")
    .eq("id", session.user.id)
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
    role: meta.role === "worker" ? "worker" : "customer",
    avatarUrl: profile?.avatar_url ?? undefined,
    skills: Array.isArray(meta.skills) ? (meta.skills as string[]) : [],
    verified: meta.verified === true,
    banned: Boolean(profile?.banned_at),
    banReason: profile?.ban_reason ?? null,
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
    if (error) throw error;
  };

  const loginSocial: AuthContextValue["loginSocial"] = async () => {
    const { lovable } = await import("@/integrations/lovable/index");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) throw new Error(result.error.message ?? "Неуспешен вход с Google");
  };

  const register: AuthContextValue["register"] = async ({ name, email, password, phone, role }) => {
    // PRE-LAUNCH TODO: потвърждението на имейл е ИЗКЛЮЧЕНО (auto-confirm) за периода на разработка,
    // затова signUp връща активна сесия и потребителят влиза веднага.
    // Преди пускане на живо: включи отново "Confirm email" с истински SMTP доставчик
    // (Resend/Postmark) — публичен маркетплейс се нуждае от верифицирани имейли срещу спам профили.
    // Когато го включиш, register ще върне needsConfirmation: true и потребителят
    // трябва да се насочи към /auth/verify?email=... (страницата вече е готова).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: name, role, phone },
      },
    });
    if (error) throw error;
    // Телефонът е задължителен контакт — записва се в профила веднага след регистрация.
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
    if (error) throw error;
  };

  const updatePassword: AuthContextValue["updatePassword"] = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const updateUser: AuthContextValue["updateUser"] = async (patch) => {
    if (!user) return;
    const next = { ...user, ...patch };
    setUser(next);

    if (patch.name !== undefined || patch.avatarUrl !== undefined) {
      await supabase
        .from("profiles")
        .update({
          full_name: next.name,
          avatar_url: next.avatarUrl ?? null,
        })
        .eq("id", user.id);
    }
    if (patch.phone !== undefined) {
      await supabase
        .from("profile_contacts")
        .upsert({ user_id: user.id, phone: next.phone ?? null }, { onConflict: "user_id" });
    }
    if (patch.skills !== undefined || patch.verified !== undefined || patch.role !== undefined || patch.name !== undefined) {
      await supabase.auth.updateUser({
        data: { full_name: next.name, role: next.role, skills: next.skills ?? [], verified: next.verified === true },
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, loginSocial, register, resetPassword, updatePassword, logout, updateUser }}
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
