import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Receipt, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getPaymentBySession } from "@/services/payments";
import { creditsLabel, formatEur } from "@/services/credits";

type SuccessSearch = { session_id?: string };

export const Route = createFileRoute("/_authenticated/billing/success")({
  validateSearch: (s: Record<string, unknown>): SuccessSearch => ({
    session_id: typeof s["session_id"] === "string" ? s["session_id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Потвърждение на плащане — ЗадачаНет" },
      { name: "description", content: "Потвърждаваме плащането ти и зареждаме кредитите по баланса." },
      { property: "og:title", content: "Потвърждение на плащане — ЗадачаНет" },
      { property: "og:description", content: "Проверяваме плащането и добавяме кредитите по баланса ти." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingSuccessPage,
});

const MAX_WAIT_MS = 90_000;

function BillingSuccessPage() {
  const { session_id: sessionId } = Route.useSearch();
  const qc = useQueryClient();
  const [timedOut, setTimedOut] = useState(false);

  const paymentQuery = useQuery({
    queryKey: ["payment", sessionId],
    enabled: Boolean(sessionId) && !timedOut,
    queryFn: () => getPaymentBySession(sessionId!),
    refetchInterval: (q) => (q.state.data?.status === "completed" ? false : 2000),
  });

  const payment = paymentQuery.data ?? null;
  const confirmed = payment?.status === "completed";

  // Realtime: react the moment the webhook writes the row.
  useEffect(() => {
    if (!sessionId || confirmed) return;
    const channel = supabase
      .channel(`payment-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "payments", filter: `stripe_session_id=eq.${sessionId}` },
        () => {
          void paymentQuery.refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, confirmed, paymentQuery]);

  useEffect(() => {
    if (confirmed) {
      void qc.invalidateQueries({ queryKey: ["credits"] });
      void qc.invalidateQueries({ queryKey: ["payments"] });
    }
  }, [confirmed, qc]);

  useEffect(() => {
    if (confirmed) return;
    const t = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, [confirmed]);

  if (!sessionId) {
    return (
      <Shell icon={<TriangleAlert className="h-12 w-12 text-amber-500" />} title="Липсва информация за плащането">
        <p className="text-sm text-muted-foreground">
          Не открихме данни за тази поръчка. Провери историята в „Баланс и плащания“.
        </p>
        <Actions />
      </Shell>
    );
  }

  if (confirmed && payment) {
    return (
      <Shell icon={<CheckCircle2 className="h-12 w-12 text-emerald-600" />} title="Плащането е успешно!">
        <p className="text-sm text-muted-foreground">
          Добавихме {creditsLabel(payment.credits)} по баланса ти. Платена сума: {formatEur(payment.amountEur)}.
        </p>
        {payment.receiptUrl && (
          <Button asChild variant="outline" className="mt-2 gap-2">
            <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">
              <Receipt className="h-4 w-4" />
              Изтегли фактура
            </a>
          </Button>
        )}
        <Actions />
      </Shell>
    );
  }

  if (timedOut) {
    return (
      <Shell icon={<TriangleAlert className="h-12 w-12 text-amber-500" />} title="Потвърждението се забави">
        <p className="text-sm text-muted-foreground">
          Плащането ти може вече да е прието, но потвърждението още не е пристигнало. Кредитите се добавят
          автоматично — провери баланса си след няколко минути или ни пиши, ако нещо не е наред.
        </p>
        <Actions />
      </Shell>
    );
  }

  return (
    <Shell icon={<Loader2 className="h-12 w-12 animate-spin text-primary" />} title="Потвърждаваме плащането…">
      <p className="text-sm text-muted-foreground">
        Изчакваме потвърждение от платежния оператор. Не затваряй страницата — обикновено отнема няколко
        секунди.
      </p>
    </Shell>
  );
}

function Shell({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      {icon}
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      <div className="mt-2 flex flex-col items-center gap-3">{children}</div>
    </div>
  );
}

function Actions() {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      <Button asChild>
        <Link to="/settings/billing">Баланс и плащания</Link>
      </Button>
      <Button asChild variant="outline">
        <Link to="/tasks">Разгледай задачите</Link>
      </Button>
    </div>
  );
}