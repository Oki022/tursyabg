import { AwsClient } from "aws4fetch";

/**
 * Server-only Cloudflare R2 access (S3 compatible API).
 * Credentials are read inside the functions so they resolve at call time.
 */

export const R2_PREFIX = "r2:";

export function isR2Configured() {
  return Boolean(
    process.env["R2_ACCESS_KEY_ID"] &&
      process.env["R2_SECRET_ACCESS_KEY"] &&
      process.env["R2_BUCKET_NAME"] &&
      (process.env["R2_ENDPOINT"] || process.env["R2_ACCOUNT_ID"]),
  );
}

function config() {
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];
  const bucket = process.env["R2_BUCKET_NAME"];
  const accountId = process.env["R2_ACCOUNT_ID"];
  const endpoint =
    process.env["R2_ENDPOINT"] ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) throw new Error("R2_NOT_CONFIGURED");

  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  return { client, base: `${endpoint.replace(/\/$/, "")}/${bucket}` };
}

/** Uploads bytes to R2 and returns the stored key (without the r2: prefix). */
export async function r2Upload(key: string, body: Uint8Array, contentType: string): Promise<string> {
  const { client, base } = config();
  const res = await client.fetch(`${base}/${key}`, {
    method: "PUT",
    body: body as unknown as BodyInit,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) throw new Error(`R2_UPLOAD_FAILED ${res.status}: ${await res.text()}`);
  return key;
}

/** Presigned GET URL, valid one hour — mirrors the Supabase signed URL lifetime. */
export async function r2SignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const publicBase = process.env["R2_PUBLIC_URL"];
  if (publicBase) return `${publicBase.replace(/\/$/, "")}/${key}`;

  const { client, base } = config();
  const url = new URL(`${base}/${key}`);
  url.searchParams.set("X-Amz-Expires", String(expiresIn));
  const signed = await client.sign(new Request(url, { method: "GET" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}

export async function r2Delete(key: string): Promise<void> {
  const { client, base } = config();
  const res = await client.fetch(`${base}/${key}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`R2_DELETE_FAILED ${res.status}`);
}
