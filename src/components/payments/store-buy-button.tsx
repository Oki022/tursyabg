import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { captureIssue } from "@/lib/monitoring/client";
import { nativePlatform } from "@/lib/mobile-app";
import { buyStoreProduct, getStorePrices } from "@/lib/store-purchases";

/**
 * Pay button for the mobile app: opens the Google Play / App Store payment
 * sheet. The price label comes from the store (same price as on the site).
 */
export function StoreBuyButton({
  productId,
  fallbackPrice,
  onPurchased,
}: {
  productId: string;
  fallbackPrice: string;
  onPurchased: (transactionId: string) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const price = useQuery({
    queryKey: ["store-price", productId, user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => (await getStorePrices(user!.id, [productId]))[productId] ?? null,
  });
  const storeName = nativePlatform() === "ios" ? "App Store" : "Google Play";

  const buy = async () => {
    if (!user?.id || busy) return;
    setBusy(true);
    try {
      const result = await buyStoreProduct(user.id, productId);
      if (result.status === "purchased") onPurchased(result.transactionId);
    } catch (error) {
      captureIssue({ area: "payments.checkout", action: "store purchase", error });
      toast.error("Плащането не мина. Опитай отново.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 p-3">
      <Button className="w-full" size="lg" onClick={buy} disabled={busy || !user?.id}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Плати {price.data ?? fallbackPrice}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Плащането става през {storeName}.</p>
    </div>
  );
}
