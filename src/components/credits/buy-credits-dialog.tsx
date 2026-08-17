import { Link, useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getProvider, type PaymentProvider } from "@/services/payments";
import { creditsLabel, formatEur } from "@/services/credits";
import { toast } from "sonner";

type Pkg = { id: string; name: string; credits: number; priceEur: number };

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
  const adapter = getProvider(provider);
  const CheckoutSurface = adapter?.CheckoutSurface;

  return (
    <Dialog open={Boolean(pkg)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Купи {pkg?.name}</DialogTitle>
          <DialogDescription>
            {pkg ? `${creditsLabel(pkg.credits)} за ${formatEur(pkg.priceEur)}` : ""} · Плащането е защитено.
          </DialogDescription>
        </DialogHeader>

        {pkg && CheckoutSurface && (
          <div className="rounded-xl border border-border/60 bg-background p-1">
            <CheckoutSurface packageId={pkg.id} />
          </div>
        )}

        {pkg && !CheckoutSurface && (
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