import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
  login: (email: string, _password: string) => void;
  loginSocial: (provider: "google" | "facebook") => void;
  register: (data: { name: string; email: string; password: string; role: UserRole }) => void;
  logout: () => void;
  updateUser: (patch: Partial<AuthUser>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "zadacha-net-auth-user";

function loadUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function saveUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(STORAGE_KEY);
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(loadUser());
  }, []);

  const login: AuthContextValue["login"] = (email) => {
    const u: AuthUser = {
      id: "u_" + Date.now(),
      name: email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Потребител",
      email,
      phone: "+359 88 123 4567",
      role: "customer",
      skills: [],
      verified: false,
    };
    saveUser(u);
    setUser(u);
  };

  const loginSocial: AuthContextValue["loginSocial"] = (provider) => {
    const u: AuthUser = {
      id: "u_" + Date.now(),
      name: provider === "google" ? "Георги Иванов" : "Иван Петров",
      email: provider === "google" ? "georgi@gmail.com" : "ivan@facebook.com",
      phone: "+359 88 765 4321",
      role: "worker",
      skills: ["remonti", "pochistvane"],
      verified: true,
    };
    saveUser(u);
    setUser(u);
  };

  const register: AuthContextValue["register"] = ({ name, email, role }) => {
    const u: AuthUser = {
      id: "u_" + Date.now(),
      name: name || "Нов потребител",
      email,
      phone: "",
      role,
      skills: role === "worker" ? [] : undefined,
      verified: false,
    };
    saveUser(u);
    setUser(u);
  };

  const logout = () => {
    saveUser(null);
    setUser(null);
  };

  const updateUser: AuthContextValue["updateUser"] = (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveUser(next);
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, loginSocial, register, logout, updateUser }}>
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