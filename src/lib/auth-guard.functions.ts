import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";

export type AuthGuardAction = "signup" | "login" | "reset" | "magiclink" | "resend";

const ACTIONS: AuthGuardAction[] = ["signup", "login", "reset", "magiclink", "resend"];

function clientIp(): string {
  const forwarded =
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-real-ip") ??
    getRequestHeader("x-forwarded-for") ??
    "";
  const first = forwarded.split(",")[0]?.trim() ?? "";
  if (first) return first;
  try {
    return new URL(getRequest().url).hostname;
  } catch {
    return "";
  }
}

/**
 * Server-side throttle for auth attempts, keyed by both email address and
 * client IP. Runs before every signup / login / reset / magic-link / resend
 * call so scripted abuse is stopped in our own code, on top of the auth
 * provider's built-in per-IP limits. Throws RATE_LIMITED when exceeded.
 */
export const guardAuthAttempt = createServerFn({ method: "POST" })
  .inputValidator((input: { action: AuthGuardAction; email?: string }) => {
    if (!input || !ACTIONS.includes(input.action)) throw new Error("INVALID_INPUT");
    const email = typeof input.email === "string" ? input.email.trim().slice(0, 320) : "";
    return { action: input.action, email };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("guard_auth_attempt", {
      _action: data.action,
      _email: data.email,
      _ip: clientIp(),
    });
    if (error) {
      if (error.message?.includes("RATE_LIMITED")) throw new Error("RATE_LIMITED");
      // A limiter outage must never lock users out of the app.
      return { ok: true as const };
    }
    return { ok: true as const };
  });
