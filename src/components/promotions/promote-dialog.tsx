import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpCircle, Crown, Loader2, Siren } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getProvider, type PaymentProvider } from "@/services/payments";
import { formatEur } from "@/services/credits";
import {
  PROMO_DESCRIPTIONS,
  PROMO_LABELS,
  durationLabel,
  remainingLabel,
  type PromoProduct,
  type PromoType,
} from "@/services/promotions";
import { useCanBump, usePromoProducts, useTaskPromotions } from "@/lib/promotions-api";
import { supabase } from "@/integrations/supabase/client";

const ICONS: Record<PromoType, typeof Crown> = {
  bump: ArrowUpCircle,
  urgent: Siren,
  top: Crown,
};

export function PromoteDialog({
  taskId,
  open,
  onOpenChange,
  provider = "stripe",
}: {
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: PaymentProvider;
}) {
  const [selected, setSelected] = useState<PromoProduct | null>(null);
  const products = usePromoProducts();
  const active = useTaskPromotions(open ? taskId : undefined);
  const canBump = useCanBump(open ? taskId : undefined);
  const adapter = getProvider(provider);
  const CheckoutSurface = adapter?.CheckoutSurface;

  const activeByType = useMemo(() => {
    const map: Partial<Record<PromoType, string>> = {};
    for (const p of active.data ?? []) {
      if (!map[p.type] || new Date(p.expiresAt) > new Date(map[p.type]!)) map[p.type] = p.expiresAt;
    }
    return map;
  }, [active.data]);

  // Reflect a newly applied promotion immediately, without a page refresh.
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`task-promotions-${taskId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "task_promotions", filter: `task_id=eq.${taskId}` },
        () => {
          toast.success("Промоцията е активирана!");
          void active.refetch();
          void canBump.refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, taskId, active, canBump]);

  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{selected ? `Плащане — ${selected.name}` : "Промотирай задачата"}</DialogTitle>
          <DialogDescription>
            {selected
              ? `${formatEur(selected.priceEur)} · Плащането е защитено.`
              : "Повече показвания означават повече оферти от майстори."}
          </DialogDescription>
        </DialogHeader>

        {!selected && (
          <div className="grid gap-2">
            {products.isLoading && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {(products.data ?? []).map((p) => {
              const Icon = ICONS[p.type];
              const activeUntil = activeByType[p.type];
              const bumpBlocked = p.type === "bump" && canBump.data === false;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={bumpBlocked}
                  onClick={() => setSelected(p)}
                  className="flex w-full items-start gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{p.name}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {durationLabel(p.durationDays)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {PROMO_DESCRIPTIONS[p.type]}
                    </span>
                    {activeUntil && (
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          Активна
                        </span>
                        <span className="text-xs font-medium text-emerald-600">
                          {PROMO_LABELS[p.type]} — {remainingLabel(activeUntil)}
                        </span>
                      </span>
                    )}
                    {bumpBlocked && (
                      <span className="mt-1 block text-xs font-medium text-amber-600">
                        Може веднъж на 24 часа.
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="text-sm font-bold text-primary">{formatEur(p.priceEur)}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {activeUntil ? "Удължи" : "Купи"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {selected && CheckoutSurface && (
          <div className="rounded-xl border border-border/60 bg-background p-1">
            <CheckoutSurface
              target={{ kind: "promotion", promoProductId: selected.id, taskId }}
              {...(returnUrl ? { returnUrl } : {})}
            />
          </div>
        )}

        {selected && !CheckoutSurface && (
          <p className="rounded-xl border border-border/60 bg-background p-4 text-sm text-muted-foreground">
            Този метод на плащане още не е наличен.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          С плащането приемаш{" "}
          <Link to="/terms" className="underline hover:text-foreground">
            Общите условия
          </Link>{" "}
          и{" "}
          <Link to="/privacy" className="underline hover:text-foreground">
            Политиката за поверителност
          </Link>
          .
        </p>

        {selected && (
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            Избери друга промоция
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
