import { useCallback, useMemo } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Link, useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getStripe } from "@/lib/stripe";
import { createCheckout } from "@/services/payments";
import { creditsLabel, formatEur } from "@/services/credits";
import { toast } from "sonner";

type Pkg = { id: string; name: string; credits: number; priceEur: number };

export function BuyCreditsDialog({
  pkg,
  onOpenChange,
}: {
  pkg: Pkg | null;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const packageId = pkg?.id ?? null;

  const fetchClientSecret = useCallback(async () => {
    if (!packageId) throw new Error("Няма избран пакет.");
    const start = await createCheckout(packageId, "stripe");
    if (start.kind !== "embedded") throw new Error("Неподдържан метод на плащане.");
    return start.clientSecret;
  }, [packageId]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <Dialog open={Boolean(pkg)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Купи {pkg?.name}</DialogTitle>
          <DialogDescription>
            {pkg ? `${creditsLabel(pkg.credits)} за ${formatEur(pkg.priceEur)}` : ""} · Плащането е защитено.
          </DialogDescription>
        </DialogHeader>

        {pkg && (
          <div className="rounded-xl border border-border/60 bg-background p-1">
            <EmbeddedCheckoutProvider key={pkg.id} stripe={getStripe()} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
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
            Политиката за връщане на кредити
          </Link>
          .
        </p>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onOpenChange(false);
            toast.info("Плащането е прекратено.");
            void navigate({ to: "/billing/cancel" });
          }}
        >
          Откажи плащането
        </Button>
      </DialogContent>
    </Dialog>
  );
}