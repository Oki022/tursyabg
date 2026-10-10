import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Потвърждаване на профила | ТърсяБГ" },
      { name: "description", content: "Проверяваме линка за потвърждение и те вписваме в профила ти." },
      { property: "og:title", content: "Потвърждаване на профила | ТърсяБГ" },
      { property: "og:description", content: "Проверяваме линка за потвърждение и те вписваме в профила ти." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CallbackPage,
});

/** Чете грешките, които Supabase връща в адреса (в hash или в query). */
function readUrlError(): string | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const code = hash.get("error_code") || query.get("error_code");
  const desc = hash.get("error_description") || query.get("error_description");
  const err = hash.get("error") || query.get("error");
  if (!code && !desc && !err) return null;
  if ((code ?? "").includes("expired") || (desc ?? "").toLowerCase().includes("expired")) {
    return "Линкът за потвърждение е изтекъл. Тези линкове важат кратко време, но можеш да поискаш нов.";
  }
  return "Линкът вече е използван или не е валиден. Поискай нов и опитай пак.";
}

function CallbackPage() {
  const navigate = useNavigate();
  const { user, resendConfirmation } = useAuth();
  const [problem, setProblem] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const urlError = readUrlError();
    if (urlError) {
      setProblem(urlError);
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      toast.success("Имейлът е потвърден. Добре дошъл в ТърсяБГ!", {
        description: "Влязохме те автоматично, вече можеш да публикуваш задачи.",
      });
      void navigate({ to: "/", replace: true });
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) finish();
    });
    const timeout = setTimeout(() => {
      if (!done) setProblem("Линкът вече е използван или не е валиден. Поискай нов и опитай пак.");
    }, 8000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  useEffect(() => {
    if (user && problem) void navigate({ to: "/", replace: true });
  }, [user, problem, navigate]);

  const resend = async () => {
    if (!email || sending) return;
    setSending(true);
    try {
      await resendConfirmation(email);
      toast.success("Изпратихме нов линк за потвърждение.");
      void navigate({ to: "/auth/verify", search: { email } });
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (!problem) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg items-center justify-center px-4 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-base text-muted-foreground">Потвърждаваме профила ти, само момент.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg items-center px-4 py-10">
      <div className="w-full rounded-2xl border border-border/60 bg-card p-6 text-center shadow-sm md:p-10">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-primary/10">
          <MailWarning className="h-10 w-10 text-primary" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Линкът вече не работи
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{problem}</p>

        <div className="mt-6 grid gap-3 text-left">
          <Label htmlFor="resend-email">Имейлът, с който се регистрира</Label>
          <Input
            id="resend-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Твоят имейл"
            className="h-11"
          />
          <Button onClick={resend} disabled={!email || sending} className="h-11 gap-2">
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            Изпрати нов линк
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth" search={{ mode: "login" }}>
              Обратно към вход
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
