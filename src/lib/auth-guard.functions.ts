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
 *
 * On signup it also checks that the phone number is free and throws
 * PHONE_TAKEN otherwise. The check runs here, behind the rate limit and with
 * the service role, so anonymous visitors cannot probe which numbers are
 * registered by calling the database directly.
 */
export const guardAuthAttempt = createServerFn({ method: "POST" })
  .inputValidator((input: { action: AuthGuardAction; email?: string; phone?: string }) => {
    if (!input || !ACTIONS.includes(input.action)) throw new Error("INVALID_INPUT");
    const email = typeof input.email === "string" ? input.email.trim().slice(0, 320) : "";
    const phone = typeof input.phone === "string" ? input.phone.trim().slice(0, 20) : "";
    return { action: input.action, email, phone };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("guard_auth_attempt", {
      _action: data.action,
      _email: data.email,
      _ip: clientIp(),
    });
    // A limiter outage must never lock users out of the app.
    if (error?.message?.includes("RATE_LIMITED")) throw new Error("RATE_LIMITED");

    if (data.action === "signup" && data.phone) {
      const { data: available, error: phoneError } = await supabaseAdmin.rpc("is_phone_available", {
        _phone: data.phone,
      });
      // On a lookup failure we let the signup continue: set_my_phone still
      // keeps numbers unique when the phone is saved.
      if (!phoneError && available === false) throw new Error("PHONE_TAKEN");
    }

    return { ok: true as const };
  });