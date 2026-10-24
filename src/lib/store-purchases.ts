/**
 * In-app purchases in the mobile app (Google Play; App Store later) through
 * RevenueCat. Google and Apple require their own payment for points and
 * promotions bought inside the app, so the app does not show the card payment.
 * Prices are the same as on the site.
 *
 * Switched on by VITE_REVENUECAT_ANDROID_KEY (RevenueCat public SDK key for
 * Android; not a secret). Without it the app keeps the card payment, which is
 * only acceptable before the app is published.
 *
 * The purchase is confirmed by RevenueCat's webhook on our server
 * (/api/public/payments/revenuecat): points arrive a few seconds after the
 * store payment; a promotion is applied to the task by apply_store_promotion.
 */
import { supabase } from "@/integrations/supabase/client";
import { captureIssue } from "@/lib/monitoring/client";
import { isNativeApp, nativePlatform } from "@/lib/mobile-app";

const ANDROID_KEY = (import.meta.env["VITE_REVENUECAT_ANDROID_KEY"] as string | undefined) ?? "";
const IOS_KEY = (import.meta.env["VITE_REVENUECAT_IOS_KEY"] as string | undefined) ?? "";

function apiKey(): string {
  const platform = nativePlatform();
  if (platform === "android") return ANDROID_KEY;
  if (platform === "ios") return IOS_KEY;
  return "";
}

/** True only inside the app, when the store payment for this platform is set up. */
export function storePurchasesEnabled(): boolean {
  return isNativeApp() && apiKey() !== "";
}

let configuredFor: string | null = null;
let configuring: Promise<void> | null = null;

/** Connects RevenueCat to the signed-in user (their Supabase id). */
async function ensureConfigured(userId: string): Promise<void> {
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  if (!configuring) {
    configuring = Purchases.configure({ apiKey: apiKey(), appUserID: userId }).then(() => {
      configuredFor = userId;
    });
  }
  await configuring;
  if (configuredFor !== userId) {
    await Purchases.logIn({ appUserID: userId });
    configuredFor = userId;
  }
}

export type StorePrices = Record<string, string>;

/** Store prices as shown by Google/Apple (for example "6,99 €"), by product id. */
export async function getStorePrices(userId: string, productIds: string[]): Promise<StorePrices> {
  if (!productIds.length) return {};
  await ensureConfigured(userId);
  const { Purchases, PRODUCT_CATEGORY } = await import("@revenuecat/purchases-capacitor");
  const { products } = await Purchases.getProducts({
    productIdentifiers: productIds,
    type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  });
  const out: StorePrices = {};
  for (const p of products) out[p.identifier] = p.priceString;
  return out;
}

export type StorePurchaseResult = { status: "purchased"; transactionId: string } | { status: "cancelled" };

/** Opens the Google Play / App Store payment sheet for one product. */
export async function buyStoreProduct(userId: string, productId: string): Promise<StorePurchaseResult> {
  await ensureConfigured(userId);
  const { Purchases, PRODUCT_CATEGORY, PURCHASES_ERROR_CODE } = await import("@revenuecat/purchases-capacitor");
  const { products } = await Purchases.getProducts({
    productIdentifiers: [productId],
    type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  });
  const product = products.find((p) => p.identifier === productId);
  if (!product) throw new Error(`Store product not found: ${productId}`);

  try {
    const result = await Purchases.purchaseStoreProduct({ product });
    return { status: "purchased", transactionId: result.transaction.transactionIdentifier };
  } catch (error) {
    const e = error as { code?: string; userCancelled?: boolean | null };
    if (e?.userCancelled || e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { status: "cancelled" };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Promotions: the store payment arrives at our server a few seconds after the
// purchase, so applying it to the task is retried, and remembered across app
// restarts until it succeeds.

const PENDING_KEY = "tursya-pending-store-promotions";

type PendingPromotion = { transactionId: string; taskId: string };

function readPending(): PendingPromotion[] {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    const list = raw ? (JSON.parse(raw) as PendingPromotion[]) : [];
    return Array.isArray(list) ? list.filter((p) => p?.transactionId && p?.taskId) : [];
  } catch {
    return [];
  }
}

function writePending(list: PendingPromotion[]) {
  try {
    if (list.length) window.localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage blocked: the retry loop below still runs for this session.
  }
}

async function applyOnce(p: PendingPromotion): Promise<"applied" | "wait" | "failed"> {
  const { data, error } = await supabase.rpc("apply_store_promotion", {
    _transaction_id: p.transactionId,
    _task_id: p.taskId,
  });
  if (error) return "wait";
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  if (res.ok) return "applied";
  if (res.error === "PAYMENT_NOT_FOUND") return "wait";
  return "failed";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Applies a just-bought promotion; tries for about 40 seconds. */
export async function applyStorePromotion(transactionId: string, taskId: string): Promise<boolean> {
  const entry = { transactionId, taskId };
  writePending([...readPending().filter((p) => p.transactionId !== transactionId), entry]);
  for (let i = 0; i < 20; i++) {
    const r = await applyOnce(entry);
    if (r === "applied" || r === "failed") {
      writePending(readPending().filter((p) => p.transactionId !== transactionId));
      if (r === "failed") {
        captureIssue({ area: "payments.checkout", action: "apply store promotion", error: new Error(transactionId) });
      }
      return r === "applied";
    }
    await sleep(2000);
  }
  return false;
}

/** On app start: finish promotions that were paid but not applied yet. */
export async function resumePendingPromotions(): Promise<void> {
  for (const p of readPending()) {
    const r = await applyOnce(p);
    if (r !== "wait") writePending(readPending().filter((x) => x.transactionId !== p.transactionId));
  }
}
