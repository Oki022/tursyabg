import { useEffect, useMemo, useState } from "react";
import { ArrowUpCircle, Crown, Loader2, Siren } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { StoreBuyButton } from "@/components/payments/store-buy-button";
import { useHydrated } from "@/hooks/use-hydrated";
import { applyStorePromotion, storePurchasesEnabled } from "@/lib/store-purchases";

const ICONS: Record<PromoType, typeof Crown> = {
  bump: ArrowUpCircle,
  urgent: Siren,
  top: Crown,
};

/** Кратка полза на български за всяка промоция. */
export const PROMO_BENEFITS: Record<PromoType, string> = {
  bump: "Обявата ти се показва най-отгоре в списъка и получава нова вълна прегледания.",
  urgent: "Червеният етикет „Спешно“ носи до 3 пъти повече запитвания от изпълнители.",
  top: "Обявата ти стои в промотираните места най-отгоре и получава до 5 пъти повече прегледания.",
};

export function PromoPicker({
  taskId,
  provider = "stripe",
  active: activeState,
  onSelectedChange,
}: {
  taskId: string;
  provider?: PaymentProvider;
  /** Управлява се отвън, ако компонентът е в модал (за да се нулира при затваряне). */
  active?: boolean;
  onSelectedChange?: (product: PromoProduct | null) => void;
}) {
  const [selected, setSelected] = useState<PromoProduct | null>(null);
  const products = usePromoProducts();
  const promotions = useTaskPromotions(taskId);
  const canBump = useCanBump(taskId);
  const adapter = getProvider(provider);
  const CheckoutSurface = adapter?.CheckoutSurface;
  // In the mobile app the promotion is paid through Google Play / App Store.
  const hydrated = useHydrated();
  const useStore = hydrated && storePurchasesEnabled();
  const [applying, setApplying] = useState(false);

  const onStorePurchased = async (transactionId: string) => {
    setApplying(true);
    // The realtime listener below shows "Промоцията е активирана!" when it lands.
    const ok = await applyStorePromotion(transactionId, taskId);
    setApplying(false);
    if (!ok) {
      toast.info("Плащането мина. Промоцията ще се активира до минута.", {
        description: "Ако не стане, пиши ни от страницата за контакти.",
      });
    }
    setSelected(null);
  };

  const activeByType = useMemo(() => {
    const map: Partial<Record<PromoType, string>> = {};
    for (const p of promotions.data ?? []) {
      if (!map[p.type] || new Date(p.expiresAt) > new Date(map[p.type]!)) map[p.type] = p.expiresAt;
    }
    return map;
  }, [promotions.data]);

  useEffect(() => {
    onSelectedChange?.(selected);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeState === false) setSelected(null);
  }, [activeState]);

  // Отразява новоактивирана промоция веднага, без презареждане.
  useEffect(() => {
    if (activeState === false) return;
    const channel = supabase
      .channel(`task-promotions-${taskId}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "task_promotions", filter: `task_id=eq.${taskId}` },
        () => {
          toast.success("Промоцията е активирана!");
          void promotions.refetch();
          void canBump.refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeState, taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`
      : undefined;

  if (selected) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-border/60 bg-background p-1">
          {useStore && selected.storeProductId ? (
            applying ? (
              <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Активираме промоцията…
              </div>
            ) : (
              <StoreBuyButton
                productId={selected.storeProductId}
                fallbackPrice={formatEur(selected.priceEur)}
                onPurchased={(tx) => void onStorePurchased(tx)}
              />
            )
          ) : useStore ? (
            <p className="p-4 text-sm text-muted-foreground">Този метод на плащане още не е наличен.</p>
          ) : CheckoutSurface ? (
            <CheckoutSurface
              target={{ kind: "promotion", promoProductId: selected.id, taskId }}
              {...(returnUrl ? { returnUrl } : {})}
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Този метод на плащане още не е наличен.</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
          Избери друга промоция
        </Button>
      </div>
    );
  }

  return (
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
              <span className="mt-0.5 block text-xs text-muted-foreground">{PROMO_BENEFITS[p.type]}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground/80">
                {PROMO_DESCRIPTIONS[p.type]}
              </span>
              {activeUntil && (
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    Активна
                  </span>
                  <span className="text-xs font-medium text-emerald-600">
                    {PROMO_LABELS[p.type]}, {remainingLabel(activeUntil)}
                  </span>
                </span>
              )}
              {bumpBlocked && (
                <span className="mt-1 block text-xs font-medium text-amber-600">Може веднъж на 24 часа.</span>
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
  );
}
