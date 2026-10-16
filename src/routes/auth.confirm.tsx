import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, MailWarning } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Landing page for the links in our auth e-mails (Supabase templates).
 * The links point here (tursya.bg/auth/confirm?token_hash=...&type=...)
 * instead of the Supabase project URL, and we verify the token ourselves.
 * Password recovery links go to /reset-password, which already does this.
 */

type ConfirmSearch = { token_hash?: string; type?: string };

const TYPES: EmailOtpType[] = ["email", "signup", "magiclink", "email_change", "invite"];

export const Route = createFileRoute("/auth/confirm")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): ConfirmSearch => ({
    token_hash: typeof s["token_hash"] === "string" ? s["token_hash"] : undefined,
    type: typeof s["type"] === "string" ? s["type"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Потвърждаване | ТърсяБГ" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ConfirmPage,
});

function ConfirmPage() {
  const navigate = useNavigate();
  const { token_hash: tokenHash, type } = Route.useSearch();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Runs once: a token can be used only one time.
    if (started.current) return;
    started.current = true;

    const otpType = TYPES.find((t) => t === type);
    if (!tokenHash || !otpType) {
      setFailed(true);
      return;
    }

    void supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType }).then(({ error }) => {
      if (error) {
        setFailed(true);
        return;
      }
      if (otpType === "email_change") {
        toast.success("Новият имейл е потвърден.");
        void navigate({ to: "/settings/security", replace: true });
      } else if (otpType === "magiclink") {
        void navigate({ to: "/", replace: true });
      } else {
        toast.success("Имейлът е потвърден. Добре дошъл в ТърсяБГ!", {
          description: "Влязохме те автоматично, вече можеш да публикуваш задачи.",
        });
        void navigate({ to: "/", replace: true });
      }
    });
  }, [tokenHash, type, navigate]);

  if (!failed) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg items-center justify-center px-4 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-base text-muted-foreground">Проверяваме линка, само момент.</p>
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
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Линкът е изтекъл или вече е използван. Тези линкове важат кратко време и само веднъж.
          Влез в профила си или поискай нов линк.
        </p>
        <div className="mt-6 grid gap-3">
          <Button asChild className="h-11">
            <Link to="/auth" search={{ mode: "login" }}>
              Към вход
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
