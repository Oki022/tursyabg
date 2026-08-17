import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mail, Lock, User as UserIcon, HandHeart, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, type UserRole } from "@/lib/auth";
import { toast } from "sonner";

type AuthSearch = { mode?: "login" | "register"; redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    mode: s.mode === "register" ? "register" : "login",
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Вход и регистрация — ЗадачаНет" },
      { name: "description", content: "Влез в профила си или създай безплатен акаунт в ЗадачаНет за минути." },
      { property: "og:title", content: "Вход и регистрация — ЗадачаНет" },
      { property: "og:description", content: "Влез или се регистрирай безплатно в ЗадачаНет." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode, redirect } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const { login, loginSocial, register, resetPassword } = useAuth();
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("customer");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isRegister && !name)) {
      toast.error("Моля, попълнете всички полета.");
      return;
    }
    setBusy(true);
    try {
      if (isRegister) {
        const { needsConfirmation } = await register({ name, email, password, role });
        if (needsConfirmation) {
          toast.success("Провери имейла си", {
            description: "Изпратихме ти линк за потвърждение на регистрацията.",
          });
          return;
        }
        toast.success("Регистрацията е успешна!");
      } else {
        await login(email, password);
        toast.success("Добре дошли!");
      }
      navigate({ to: redirect ?? "/profile" });
    } catch (err) {
      toast.error("Неуспешен опит", {
        description: err instanceof Error ? err.message : "Провери данните и опитай отново.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    if (!email) {
      toast.error("Въведи имейла си, за да получиш линк за нова парола.");
      return;
    }
    try {
      await resetPassword(email);
      toast.success("Изпратихме ти имейл за смяна на паролата.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Опитай отново.");
    }
  };

  const handleSocial = async () => {
    try {
      await loginSocial("google");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешен вход с Google.");
    }
  };

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10">
      <div className="w-full rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isRegister ? "Създай профил" : "Добре дошли отново"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isRegister
              ? "Присъедини се към ЗадачаНет за минути."
              : "Влез в своя профил, за да продължиш."}
          </p>
        </div>

        <div className="mt-6 grid gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 justify-center gap-2.5"
            onClick={handleSocial}
          >
            <GoogleIcon className="h-4 w-4" />
            Вход с Google
          </Button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-semibold tracking-widest text-muted-foreground">ИЛИ</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          {isRegister && (
            <div className="grid gap-1.5">
              <Label htmlFor="name">Име</Label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Иван Петров"
                  className="h-10 pl-9"
                />
              </div>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="email">Имейл</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ivan@example.bg"
                className="h-10 pl-9"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Парола</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 pl-9"
              />
            </div>
          </div>

          {isRegister && (
            <div className="grid gap-2">
              <Label>Каква е твоята роля?</Label>
              <div className="grid grid-cols-2 gap-2">
                <RoleCard
                  active={role === "customer"}
                  onClick={() => setRole("customer")}
                  icon={<HandHeart className="h-5 w-5" />}
                  title="Търся помощ"
                  desc="Възлагам задачи"
                />
                <RoleCard
                  active={role === "worker"}
                  onClick={() => setRole("worker")}
                  icon={<Wrench className="h-5 w-5" />}
                  title="Предлагам услуги"
                  desc="Изпълнявам задачи"
                />
              </div>
            </div>
          )}

          {!isRegister && (
            <button
              type="button"
              onClick={handleForgot}
              className="justify-self-start text-xs font-medium text-primary hover:underline"
            >
              Забравена парола?
            </button>
          )}

          <Button type="submit" className="h-11" disabled={busy}>
            {busy ? "Моля изчакай..." : isRegister ? "Създай профил" : "Вход"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {isRegister ? "Вече имаш профил? " : "Нямаш профил? "}
          <Link
            to="/auth"
            search={{ mode: isRegister ? "login" : "register" }}
            className="font-medium text-primary hover:underline"
          >
            {isRegister ? "Вход" : "Регистрирай се"}
          </Link>
        </p>
      </div>
    </div>
  );
}

function RoleCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all ${
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/50 hover:bg-accent/40"
      }`}
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-md ${
          active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold text-foreground">{title}</span>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </button>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
