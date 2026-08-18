import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatEur } from "@/services/credits";
import type { PromoProduct } from "@/services/promotions";
import type { PaymentProvider } from "@/services/payments";
import { PromoPicker } from "@/components/promotions/promo-picker";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{selected ? `Плащане, ${selected.name}` : "Промотирай задачата"}</DialogTitle>
          <DialogDescription>
            {selected
              ? `${formatEur(selected.priceEur)} · Плащането е защитено.`
              : "Повече показвания означават повече оферти от майстори."}
          </DialogDescription>
        </DialogHeader>

        <PromoPicker taskId={taskId} provider={provider} active={open} onSelectedChange={setSelected} />

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
      </DialogContent>
    </Dialog>
  );
}
