import { createFileRoute } from "@tanstack/react-router";
import { Wallet, Package, FileText, Info } from "lucide-react";
import { SettingsPageShell } from "@/components/settings-page-shell";
import { Button } from "@/components/ui/button";

const PACKAGES = [
  { name: "Старт", price: "9,90 €", perk: "5 промотирани задачи" },
  { name: "Про", price: "24,90 €", perk: "20 промотирани задачи + приоритет" },
  { name: "Бизнес", price: "49,90 €", perk: "Неограничени задачи + значка" },
];

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
  const balance = 0;

  return (
    <SettingsPageShell
      title="Баланс и плащания"
      description="Зареждай баланс, купувай пакети и управлявай данните си за фактура на едно място."
    >
      {/* Текущ баланс */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Текущ баланс</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              {balance.toFixed(2)} €
            </p>
          </div>
          <Button className="gap-2">
            <Wallet className="h-4 w-4" />
            Зареди баланс
          </Button>
        </div>
      </div>

      {/* Пакети */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Пакети</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PACKAGES.map((p) => (
            <div key={p.name} className="rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">{p.name}</p>
              <p className="mt-1 text-xl font-bold text-foreground">{p.price}</p>
              <p className="mt-1 text-xs text-muted-foreground">{p.perk}</p>
              <Button variant="outline" size="sm" className="mt-3 w-full">
                Купи пакет
              </Button>
            </div>
          ))}
        </div>
        <a
          href="#"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <Info className="h-4 w-4" />
          Научи повече за пакетите
        </a>
      </div>

      {/* Данни за фактура */}
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
