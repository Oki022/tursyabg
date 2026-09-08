import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { Mail, Lock, User as UserIcon, Eye, EyeOff, Loader2, PhoneCall, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { authErrorMessage, emailError, nameError, passwordError } from "@/lib/auth-errors";
import { normalizeBgPhone, phoneError } from "@/lib/phone";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Checkbox } from "@/components/ui/checkbox";
import { seo } from "@/lib/seo";

type AuthSearch = { mode?: "login" | "register"; redirect?: string };

export const Route = createFileRoute("/auth/")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    mode: s.mode === "register" ? "register" : "login",
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : undefined,
  }),
  head: () => ({
    ...seo({
      title: "Вход и регистрация",
      description: "Влез в профила си или създай безплатен акаунт за минути и започни да възлагаш задачи или да намираш работа.",
      path: "/auth",
      noindex: true,
    }),
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode, redirect } = useSearch({ from: "/auth/" });
  const navigate = useNavigate();
  const { login, loginSocial, register, resetPassword, resendConfirmation } = useAuth();
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<{ name?: boolean; email?: boolean; password?: boolean; phone?: boolean }>({});

  const nameMsg = useMemo(() => (touched.name ? nameError(name) : null), [touched.name, name]);
  const emailMsg = useMemo(() => (touched.email ? emailError(email) : null), [touched.email, email]);
  const passwordMsg = useMemo(() => (touched.password ? passwordError(password) : null), [touched.password, password]);
  const phoneMsg = useMemo(() => (touched.phone ? phoneError(phone) : null), [touched.phone, phone]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, phone: true });
    if (!email || !password || (isRegister && (!name || !phone))) {
      toast.error("Моля, попълнете всички полета.");
      return;
    }
    if (
      emailError(email) ||
      passwordError(password) ||
      (isRegister && (nameError(name) || phoneError(phone)))
    ) {
      toast.error("Провери маркираните полета.");
      return;
    }
    if (isRegister && !acceptedTerms) {
      toast.error("Трябва да приемеш Общите условия и Политиката за поверителност.");
      return;
    }
    setBusy(true);
    try {
      if (isRegister) {
        // При включено потвърждение на имейл signUp не връща сесия, затова
        // пращаме потребителя на /auth/verify вместо на формата за вход.
        const normalizedPhone = normalizeBgPhone(phone);
        const { data: available } = await supabase.rpc("is_phone_available", { _phone: normalizedPhone });
        if (available === false) {
          toast.error("Този телефонен номер вече се използва от друг профил.", {
            description: "Един номер може да е свързан само с един профил.",
          });
          return;
        }
        const { needsConfirmation } = await register({
          name,
          email,
          password,
          phone: normalizedPhone,
        });
        if (needsConfirmation) {
          navigate({ to: "/auth/verify", search: { email } });
          return;
        }
        toast.success(`Добре дошъл, ${name.split(" ")[0]}!`, {
          description: "Профилът ти е готов. Публикуването на задачи е безплатно.",
        });
        navigate({ to: redirect ?? "/" });
        return;
      } else {
        await login(email, password);
        toast.success("Добре дошли отново!");
      }
      navigate({ to: redirect ?? "/" });
    } catch (err) {
      const raw = String((err as { message?: string })?.message ?? err).toLowerCase();
      if (raw.includes("email not confirmed") || raw.includes("not confirmed")) {
        toast.error("Имейлът ти още не е потвърден.", {
          description: "Отвори писмото, което ти изпратихме, или поискай ново.",
          action: {
            label: "Изпрати отново потвърждението",
            onClick: () => {
              void (async () => {
                try {
                  await resendConfirmation(email);
                  toast.success("Изпратихме ти нов имейл за потвърждение.");
                  navigate({ to: "/auth/verify", search: { email } });
                } catch (e) {
                  toast.error(authErrorMessage(e));
                }
              })();
            },
          },
        });
      } else {
        toast.error(authErrorMessage(err));
      }
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
      toast.error(authErrorMessage(err));
    }
  };

  const handleSocial = async () => {
    try {
      await loginSocial("google");
    } catch (err) {
      toast.error(authErrorMessage(err));
    }
  };

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10">
      <div className="w-full rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
        <div className="text-center">
          <Logo size="lg" showText={false} className="mx-auto mb-4 justify-center" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isRegister ? "Създай профил" : "Добре дошли отново"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isRegister
              ? "Присъедини се към ТърсяБГ за минути."
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

        {isRegister && welcomeBonus > 0 && (
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900">
            <Gift className="mt-0.5 h-4 w-4 shrink-0" />
            Получи {welcomeBonus} безплатни кредита при регистрация и отключи първите контакти, без да плащаш.
          </p>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4">
          {isRegister && (
            <div className="grid gap-1.5">
              <Label htmlFor="name">Име</Label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setTouched((t) => ({ ...t, name: true }));
                  }}
                  placeholder="Иван Петров"
                  aria-invalid={Boolean(nameMsg)}
                  className={`h-10 pl-9 ${nameMsg ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
              </div>
              {nameMsg && <p className="text-xs text-destructive">{nameMsg}</p>}
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  setTouched((t) => ({ ...t, email: true }));
                }}
                placeholder="ivan@example.bg"
                aria-invalid={Boolean(emailMsg)}
                className={`h-10 pl-9 ${emailMsg ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
            </div>
            {emailMsg && <p className="text-xs text-destructive">{emailMsg}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Парола</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setTouched((t) => ({ ...t, password: true }));
                }}
                placeholder="••••••••"
                aria-invalid={Boolean(passwordMsg)}
                className={`h-10 pl-9 pr-10 ${passwordMsg ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Скрий паролата" : "Покажи паролата"}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordMsg ? (
              <p className="text-xs text-destructive">{passwordMsg}</p>
            ) : (
              isRegister && <p className="text-xs text-muted-foreground">Поне 6 символа.</p>
            )}
          </div>

          {isRegister && (
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Телефон</Label>
              <div className="relative">
                <PhoneCall className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setTouched((t) => ({ ...t, phone: true }));
                  }}
                  placeholder="0888123456"
                  aria-invalid={Boolean(phoneMsg)}
                  className={`h-10 pl-9 ${phoneMsg ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
              </div>
              {phoneMsg ? (
                <p className="text-xs text-destructive">{phoneMsg}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Скрит е за всички, вижда се само след отключване с кредити.
                </p>
              )}
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

          {isRegister && (
            <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
              <Checkbox
                checked={acceptedTerms}
                onCheckedChange={(v) => setAcceptedTerms(v === true)}
                className="mt-0.5"
                aria-label="Приемам Общите условия и Политиката за поверителност"
              />
              <span>
                Приемам{" "}
                <Link to="/terms" className="font-medium text-primary hover:underline">
                  Общите условия
                </Link>{" "}
                и{" "}
                <Link to="/privacy" className="font-medium text-primary hover:underline">
                  Политиката за поверителност
                </Link>
                .
              </span>
            </label>
          )}

          <Button type="submit" className="h-11 gap-2" disabled={busy || (isRegister && !acceptedTerms)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Моля изчакай..." : isRegister ? "Създай профил" : "Вход"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {isRegister ? "Вече имаш профил? " : "Нямаш профил? "}
          <Link
            to="/auth"
            search={{ mode: isRegister ? "login" : "register", redirect }}
            className="font-medium text-primary hover:underline"
          >
            {isRegister ? "Вход" : "Регистрирай се"}
          </Link>
        </p>
      </div>
    </div>
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
