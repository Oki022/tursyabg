import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MailCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { toast } from "sonner";

type VerifySearch = { email?: string };

export const Route = createFileRoute("/auth/verify")({
  validateSearch: (s: Record<string, unknown>): VerifySearch => ({
    email: typeof s["email"] === "string" ? s["email"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Потвърди имейла си | ТърсяБГ" },
      { name: "description", content: "Изпратихме ти линк за потвърждение. Отвори имейла си, за да активираш профила." },
      { property: "og:title", content: "Потвърди имейла си | ТърсяБГ" },
      { property: "og:description", content: "Още една стъпка: потвърди имейла си, за да започнеш работа в ТърсяБГ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VerifyPage,
});

const COOLDOWN_SECONDS = 60;

function VerifyPage() {
  const { email } = useSearch({ from: "/auth/verify" });
  const navigate = useNavigate();
  const { user, resendConfirmation } = useAuth();
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);

  // Ако профилът вече е потвърден и има активна сесия, няма какво да чака тук.
  useEffect(() => {
    if (user) void navigate({ to: "/", replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    if (!email || cooldown > 0 || sending) return;
    setSending(true);
    try {
      await resendConfirmation(email);
      toast.success("Изпратихме ти нов имейл.");
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg items-center px-4 py-10">
      <div className="w-full rounded-2xl border border-border/60 bg-card p-6 text-center shadow-sm md:p-10">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-primary/10">
          <MailCheck className="h-10 w-10 text-primary" />
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Отвори имейла си, за да завършим
        </h1>

        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Изпратихме писмо на{" "}
          <span className="break-all font-semibold text-foreground">{email ?? "твоя имейл"}</span>. Отвори го и
          натисни големия бутон вътре, така потвърждаваме, че имейлът е твой. Отнема по-малко от минута.
        </p>

        <p className="mt-4 rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900">
          Веднага след потвърждението те чакат безплатни кредити за първите ти отключвания.
        </p>

        <div className="mt-6 rounded-xl border border-border/60 bg-background p-4 text-left text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Не виждаш писмото?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Провери папка „Спам“ или „Промоции“.</li>
            <li>Изчакай 1–2 минути, понякога закъснява.</li>
            <li>Увери се, че имейлът е изписан правилно.</li>
          </ul>
        </div>

        <div className="mt-6 grid gap-3">
          <Button onClick={resend} disabled={cooldown > 0 || sending || !email} className="h-11 gap-2">
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            {cooldown > 0 ? `Изпрати отново (${cooldown} сек.)` : "Изпрати отново"}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth" search={{ mode: "register" }}>
              Промени имейла
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
