import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  History,
  KeyRound,
  Receipt,
  CreditCard,
  Rocket,
  Gift,
  RotateCcw,
  Coins,
} from "lucide-react";

import { SettingsPageShell } from "@/components/settings-page-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCreditBalance, useCreditPackages, useCreditTransactions } from "@/lib/credits-api";
import { creditsLabel, formatEur } from "@/services/credits";
import { getMyPayments, type Payment } from "@/services/payments";
import { BuyCreditsDialog } from "@/components/credits/buy-credits-dialog";
import { durationLabel, getPromoProductsByIds, type PromoProduct } from "@/services/promotions";

export const Route = createFileRoute("/_authenticated/settings/billing")({
  head: () => ({
    meta: [
      { title: "Баланс и плащания | ТърсяБГ" },
      { name: "description", content: "Виж баланса си, зареди сметката, купи пакет и попълни данни за фактура." },
      { property: "og:title", content: "Баланс и плащания | ТърсяБГ" },
      { property: "og:description", content: "Управлявай баланса, пакетите и фактурите си в ТърсяБГ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsBillingPage,
});

function SettingsBillingPage() {
  const { user } = useAuth();
  const balanceQuery = useCreditBalance(user?.id);
  const packagesQuery = useCreditPackages();
  const [page, setPage] = useState(0);
  const txQuery = useCreditTransactions(page);
  const balance = balanceQuery.data ?? user?.credits ?? 0;
  const paymentsQuery = useQuery({ queryKey: ["payments", "mine"], queryFn: getMyPayments });
  const promoIds = Array.from(
    new Set((paymentsQuery.data ?? []).map((p) => p.promoProductId).filter((id): id is string => Boolean(id))),
  );
  const promoQuery = useQuery({
    queryKey: ["promo-products", "by-id", promoIds.join(",")],
    enabled: promoIds.length > 0,
    queryFn: () => getPromoProductsByIds(promoIds),
  });
  const promoProducts = promoQuery.data ?? {};
  const [buying, setBuying] = useState<{ id: string; name: string; credits: number; priceEur: number } | null>(
    null,
  );

  return (
    <SettingsPageShell
      title="Баланс и плащания"
      description="Виж кредитите си, купувай пакети и следи всички движения по сметката."
    >
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Наличност кредити</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              {balanceQuery.isLoading ? "няма" : creditsLabel(balance)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Публикуването на задачи е безплатно. Кредитите се използват за отключване на контакти.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/unlocked">
              <KeyRound className="h-4 w-4" />
              Отключени задачи
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Пакети кредити</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(packagesQuery.data ?? []).map((p) => (
            <div key={p.id} className="relative rounded-xl border border-border bg-background p-4">
              {p.credits === 150 && (
                <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Най-изгодно
                </span>
              )}
              <p className="text-sm font-semibold text-foreground">{p.name}</p>
              <p className="mt-1 text-xl font-bold text-foreground">{formatEur(p.priceEur)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{creditsLabel(p.credits)}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setBuying({ id: p.id, name: p.name, credits: p.credits, priceEur: p.priceEur })}
              >
                Купи пакет
              </Button>
            </div>
          ))}
          {packagesQuery.isLoading &&
            [0, 1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Плащане с карта. С покупката приемаш{" "}
          <Link to="/terms" className="underline hover:text-foreground">
            Общите условия
          </Link>{" "}
          и{" "}
          <Link to="/refund-policy" className="underline hover:text-foreground">
            Политиката за връщане на кредити
          </Link>
          .
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Плащания и фактури</h2>
        </div>
        <div className="mt-4 divide-y divide-border/60">
          {(paymentsQuery.data ?? []).map((p) => (
            <PaymentRow key={p.id} payment={p} promo={p.promoProductId ? promoProducts[p.promoProductId] : undefined} />
          ))}
          {!paymentsQuery.isLoading && (paymentsQuery.data?.length ?? 0) === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Още нямаш плащания.</p>
          )}
          {paymentsQuery.isLoading && <div className="h-16 animate-pulse rounded-xl bg-muted" />}
        </div>
      </div>

      <div id="history" className="scroll-mt-24 rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">История на движенията</h2>
        </div>
        <div className="mt-4 divide-y divide-border/60">
          {(txQuery.data?.items ?? []).map((t) => {
            const meta = TX_META[t.type] ?? { Icon: Coins, className: "text-muted-foreground" };
            return (
            <div key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted">
                  <meta.Icon className={`h-4 w-4 ${meta.className}`} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{t.description || "Движение"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString("bg-BG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p
                  className={`text-sm font-semibold ${t.amount < 0 ? "text-rose-600" : "text-emerald-600"}`}
                >
                  {t.amount > 0 ? "+" : ""}
                  {t.amount}
                </p>
                <p className="text-xs text-muted-foreground">баланс: {t.balanceAfter}</p>
              </div>
            </div>
            );
          })}

          {!txQuery.isLoading && (txQuery.data?.items.length ?? 0) === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Все още няма движения по сметката.</p>
          )}
          {txQuery.isLoading && <div className="h-24 animate-pulse rounded-xl bg-muted" />}
        </div>
        {(page > 0 || txQuery.data?.hasMore) && (
          <div className="mt-4 flex items-center justify-between">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Назад
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!txQuery.data?.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Напред
            </Button>
          </div>
        )}
      </div>




      <BuyCreditsDialog pkg={buying} onOpenChange={(open) => !open && setBuying(null)} />
    </SettingsPageShell>
  );
}

/** Всеки тип движение има свой разпознаваем знак. */
const TX_META: Record<string, { Icon: typeof Package; className: string }> = {
  purchase: { Icon: Package, className: "text-primary" },
  promo_spend: { Icon: Rocket, className: "text-primary" },
  unlock: { Icon: KeyRound, className: "text-amber-600" },
  refund: { Icon: RotateCcw, className: "text-emerald-600" },
  bonus: { Icon: Gift, className: "text-emerald-600" },
};

const statusLabels: Record<string, string> = {

  pending: "Изчаква потвърждение",
  completed: "Платено",
  refunded: "Възстановено",
  disputed: "Оспорено",
  failed: "Неуспешно",
};

function PaymentRow({ payment, promo }: { payment: Payment; promo?: PromoProduct }) {
  const isPromo = payment.kind === "promotion";
  const promoName = promo ? `${promo.name}, ${durationLabel(promo.durationDays)}` : "Промоция на задача";
  const label = isPromo
    ? promoName
    : payment.credits > 0
      ? creditsLabel(payment.credits)
      : "Плащане";
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
          {isPromo ? (
            <Rocket className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">
            {label} · {formatEur(payment.amountEur)}
          </span>
        </p>
        {isPromo && payment.taskId && (
          <Link
            to="/task/$id"
            params={{ id: payment.taskId }}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            Виж задачата
          </Link>
        )}
        <p className="text-xs text-muted-foreground">
          {new Date(payment.createdAt).toLocaleDateString("bg-BG", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}{" "}
          · {statusLabels[payment.status] ?? payment.status}
        </p>
      </div>
      {payment.receiptUrl ? (
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">
            <Receipt className="h-4 w-4" />
            Изтегли фактура
          </a>
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">няма</span>
      )}
    </div>
  );
}
