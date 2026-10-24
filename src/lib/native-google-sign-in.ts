/**
 * Google sign-in inside the Android app with the phone's own account picker
 * (Credential Manager): no browser, no Supabase address, no Gmail check.
 * The ID token goes to Supabase (signInWithIdToken). Needs:
 *  - VITE_GOOGLE_WEB_CLIENT_ID: the Web OAuth client ID that Supabase's Google
 *    provider uses (public, not a secret);
 *  - an Android OAuth client in the same Google Cloud project with package
 *    bg.tursya.app and the app's SHA-1.
 * Without the client ID the app keeps using the browser sheet.
 */
import { supabase } from "@/integrations/supabase/client";

export const GOOGLE_WEB_CLIENT_ID = (import.meta.env["VITE_GOOGLE_WEB_CLIENT_ID"] as string | undefined) ?? "";

let initialized: Promise<void> | null = null;

function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type NativeGoogleResult = "signed_in" | "cancelled";

/** Throws when the native picker is not available or not set up; the caller then uses the browser. */
export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  if (!initialized) {
    initialized = SocialLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID, mode: "online" } });
  }
  await initialized;

  // Google gets the hashed nonce, Supabase the raw one; Supabase checks they match.
  const rawNonce = randomNonce();
  const hashedNonce = await sha256Hex(rawNonce);

  let idToken: string | null = null;
  try {
    const res = await SocialLogin.login({
      provider: "google",
      options: { scopes: ["email", "profile"], nonce: hashedNonce },
    });
    const result = res.result as { idToken?: string | null };
    idToken = result.idToken ?? null;
  } catch (error) {
    const text = String((error as { message?: unknown })?.message ?? error).toLowerCase();
    if (text.includes("cancel")) return "cancelled";
    throw error;
  }
  if (!idToken) throw new Error("Google sign-in returned no ID token");

  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce: rawNonce });
  if (error) throw error;
  return "signed_in";
}
