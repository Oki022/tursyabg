import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "customer" | "worker";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatarUrl?: string;
  skills?: string[];
  verified?: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginSocial: (provider: "google") => Promise<void>;
  register: (data: { name: string; email: string; password: string; role: UserRole }) => Promise<{ needsConfirmation: boolean }>;
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
    .select("id, full_name, avatar_url, phone")
    .eq("id", session.user.id)
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
    phone: profile?.phone ?? undefined,
    role: meta.role === "worker" ? "worker" : "customer",
    avatarUrl: profile?.avatar_url ?? undefined,
    skills: Array.isArray(meta.skills) ? (meta.skills as string[]) : [],
    verified: meta.verified === true,
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

  const register: AuthContextValue["register"] = async ({ name, email, password, role }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: name, role },
      },
    });
    if (error) throw error;
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

    if (patch.name !== undefined || patch.phone !== undefined || patch.avatarUrl !== undefined) {
      await supabase
        .from("profiles")
        .update({
          full_name: next.name,
          phone: next.phone ?? null,
          avatar_url: next.avatarUrl ?? null,
        })
        .eq("id", user.id);
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
