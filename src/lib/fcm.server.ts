/**
 * Firebase Cloud Messaging (HTTP v1) for push notifications to the mobile app.
 *
 * Needs one server environment variable (Vercel, never in git):
 *   FIREBASE_SERVICE_ACCOUNT — the whole JSON of a Firebase service account key
 *   (Firebase console › Project settings › Service accounts › Generate new key).
 *
 * The access token is made with Web Crypto (RS256), so it works in every
 * server runtime without extra packages.
 */

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

export type PushMessage = { title: string; body: string; link: string | null };

export type PushResult = "sent" | "invalid_token" | "failed";

let cachedToken: { value: string; expiresAt: number } | null = null;

export function readServiceAccount(): ServiceAccount | null {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return {
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      // Some dashboards keep "\n" as two characters; the key needs real newlines.
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Signed JWT for Google's OAuth token endpoint (exported for tests). */
export async function signServiceAccountJwt(sa: ServiceAccount, nowSeconds: number): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(signature)}`;
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.value;

  const assertion = await signServiceAccountJwt(sa, Math.floor(now / 1000));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`FCM token request failed [${res.status}]`);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("FCM token response without access_token");
  cachedToken = { value: json.access_token, expiresAt: now + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

/** Sends one notification to one phone. */
export async function sendPush(sa: ServiceAccount, deviceToken: string, msg: PushMessage): Promise<PushResult> {
  const token = await accessToken(sa);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title: msg.title, body: msg.body },
        data: { link: msg.link ?? "/notifications" },
        android: { priority: "high" },
      },
    }),
  });
  if (res.ok) return "sent";

  // The phone uninstalled the app or the token expired: remove it.
  const text = await res.text().catch(() => "");
  if (res.status === 404 || text.includes("UNREGISTERED") || text.includes("registration-token-not-registered")) {
    return "invalid_token";
  }
  if (res.status === 400 && text.includes("INVALID_ARGUMENT") && text.toLowerCase().includes("token")) {
    return "invalid_token";
  }
  return "failed";
}
