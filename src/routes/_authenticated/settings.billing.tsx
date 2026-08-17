import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Coins, Package, FileText, History, KeyRound } from "lucide-react";
import { SettingsPageShell } from "@/components/settings-page-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCreditBalance, useCreditPackages, useCreditTransactions } from "@/lib/credits-api";
import { creditsLabel, formatEur } from "@/services/credits";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/billing")({
  head: () => ({
    meta: [
      { title: "Баланс и плащания — ЗадачаНет" },
      { name: "description", content: "Виж баланса си, зареди сметката, купи пакет и попълни данни за фактура." },
      { property: "og:title", content: "Баланс и плащания — ЗадачаНет" },
      { property: "og:description", content: "Управлявай баланса, пакетите и фактурите си в ЗадачаНет." },
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

  const buy = () =>
    toast("Плащанията се настройват", {
      description: "Скоро ще можеш да купуваш кредити с карта.",
    });

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
              {balanceQuery.isLoading ? "—" : creditsLabel(balance)}
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
            <div key={p.id} className="rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">{p.name}</p>
              <p className="mt-1 text-xl font-bold text-foreground">{formatEur(p.priceEur)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{creditsLabel(p.credits)}</p>
              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={buy}>
                Купи пакет
              </Button>
            </div>
          ))}
          {packagesQuery.isLoading &&
            [0, 1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">История на движенията</h2>
        </div>
        <div className="mt-4 divide-y divide-border/60">
          {(txQuery.data?.items ?? []).map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-3">
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
          ))}
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

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Данни за фактура</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Попълни фирмени данни, за да получаваш фактури автоматично след всяко плащане.
        </p>
        <Button variant="outline" className="mt-4">
          Добави данни за фактура
        </Button>
      </div>
    </SettingsPageShell>
  );
}
