import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Lock, MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Нова парола | ТърсяБГ" },
      { name: "description", content: "Задай нова парола за своя профил в ТърсяБГ." },
      { property: "og:title", content: "Нова парола | ТърсяБГ" },
      { property: "og:description", content: "Задай нова парола за своя профил." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

type Phase = "checking" | "ready" | "invalid";

/** Обработва всички варианти на връзката за възстановяване. */
async function establishRecoverySession(): Promise<boolean> {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (!error) return true;
  }

  const tokenHash = query.get("token_hash") ?? hash.get("token_hash");
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) return true;
  }

  const code = query.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return true;
  }

  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

function ResetPasswordPage() {
  const { updatePassword, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const ok = await establishRecoverySession();
      if (!active) return;
      setPhase(ok ? "ready" : "invalid");
      if (ok && window.location.hash) {
        window.history.replaceState(null, "", "/reset-password");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Паролата трябва да е поне 6 символа.");
      return;
    }
    if (password !== confirm) {
      toast.error("Паролите не съвпадат.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      toast.success("Паролата е сменена успешно.");
      navigate({ to: "/profile" });
    } catch (err) {
      toastError(err, { title: "Неуспешна смяна на паролата" });
    } finally {
      setBusy(false);
    }
  };

  const requestNew = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Въведи имейла си.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email.trim());
      toast.success("Изпратихме ти нова връзка за смяна на паролата.");
    } catch (err) {
      toastError(err, { title: "Неуспешно изпращане" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10">
      <div className="w-full rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
        {phase === "checking" ? (
          <p className="text-sm text-muted-foreground">Проверяваме връзката…</p>
        ) : phase === "invalid" ? (
          <>
            <div className="flex items-center gap-2 text-foreground">
              <MailWarning className="h-5 w-5 text-amber-600" />
              <h1 className="text-2xl font-bold tracking-tight">Връзката вече не е валидна</h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Връзката за смяна на парола е с ограничен срок и може да се използва само веднъж.
              Въведи имейла си и ще ти изпратим нова.
            </p>
            <form onSubmit={requestNew} className="mt-6 grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Имейл</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Твоят имейл"
                  className="h-10"
                />
              </div>
              <Button type="submit" className="h-11" disabled={busy}>
                {busy ? "Изпращане..." : "Изпрати нова връзка"}
              </Button>
              <Link to="/auth" search={{ mode: "login" }} className="text-center text-sm text-muted-foreground underline">
                Обратно към вход
              </Link>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Нова парола</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Въведи новата си парола, за да влезеш отново в профила си.
            </p>
            <form onSubmit={onSubmit} className="mt-6 grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="password">Нова парола</Label>
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
              <div className="grid gap-1.5">
                <Label htmlFor="confirm">Повтори паролата</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 pl-9"
                  />
                </div>
              </div>
              <Button type="submit" className="h-11" disabled={busy}>
                {busy ? "Запазване..." : "Запази новата парола"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
