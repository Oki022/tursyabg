import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeCheckout } from "@/lib/payments.server";
import { getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { packageId: string; environment: StripeEnv; returnUrl: string }) => {
    if (typeof data.packageId !== "string" || data.packageId.length < 10) {
      throw new Error("Невалиден пакет.");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const { userId, supabase } = context;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return await createStripeCheckout({
        packageId: data.packageId,
        environment: data.environment,
        returnUrl: data.returnUrl,
        userId,
        email: user?.email ?? undefined,
      });
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });