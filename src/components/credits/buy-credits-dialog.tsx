import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getProvider, type PaymentProvider } from "@/services/payments";
import { creditsLabel, formatEur } from "@/services/credits";
import { toast } from "sonner";
import { StoreBuyButton } from "@/components/payments/store-buy-button";
import { useHydrated } from "@/hooks/use-hydrated";
import { storePurchasesEnabled } from "@/lib/store-purchases";

type Pkg = { id: string; name: string; credits: number; priceEur: number; storeProductId?: string | null };

export function BuyCreditsDialog({
  pkg,
  onOpenChange,
  provider = "stripe",
}: {
  pkg: Pkg | null;
  onOpenChange: (open: boolean) => void;
  provider?: PaymentProvider;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const adapter = getProvider(provider);
  const CheckoutSurface = adapter?.CheckoutSurface;
  // In the mobile app the points are paid through Google Play / App Store.
  const hydrated = useHydrated();
  const storeProductId = hydrated && storePurchasesEnabled() ? (pkg?.storeProductId ?? null) : null;

  const onStorePurchased = () => {
    onOpenChange(false);
    toast.success("Плащането мина!", { description: "Точките ще се появят след няколко секунди." });
    // The store confirmation reaches our server shortly after: refresh a few times.
    for (const ms of [2000, 5000, 10000, 20000]) {
      window.setTimeout(() => void qc.invalidateQueries({ queryKey: ["credits"] }), ms);
    }
  };

  return (
    <Dialog open={Boolean(pkg)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Купи {pkg?.name}</DialogTitle>
          <DialogDescription>
            {pkg ? `${creditsLabel(pkg.credits)} за ${formatEur(pkg.priceEur)}` : ""} · Плащането е защитено.
          </DialogDescription>
        </DialogHeader>

        {pkg && storeProductId && (
          <div className="rounded-xl border border-border/60 bg-background">
            <StoreBuyButton
              productId={storeProductId}
              fallbackPrice={formatEur(pkg.priceEur)}
              onPurchased={onStorePurchased}
            />
          </div>
        )}

        {pkg && !storeProductId && CheckoutSurface && (
          <div className="rounded-xl border border-border/60 bg-background p-1">
            <CheckoutSurface target={{ kind: "credits", packageId: pkg.id }} />
          </div>
        )}

        {pkg && !storeProductId && !CheckoutSurface && (
          <p className="rounded-xl border border-border/60 bg-background p-4 text-sm text-muted-foreground">
            Този метод на плащане още не е наличен.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          С плащането приемаш{" "}
          <Link to="/terms" className="underline hover:text-foreground">
            Общите условия
          </Link>
          ,{" "}
          <Link to="/privacy" className="underline hover:text-foreground">
            Политиката за поверителност
          </Link>{" "}
          и{" "}
          <Link to="/refund-policy" className="underline hover:text-foreground">
            Политиката за връщане на точки
          </Link>
          .
        </p>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onOpenChange(false);
            if (storeProductId) return;
            toast.info("Плащането е прекратено.");
            void navigate({ to: "/billing/cancel" });
          }}
        >
          {storeProductId ? "Затвори" : "Откажи плащането"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}