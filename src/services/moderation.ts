/**
 * Single provider boundary for automated content moderation.
 *
 * Everything else in the app calls `moderateImage()` and never touches the
 * provider directly — swapping Sightengine for Rekognition / Vision only
 * means rewriting the body of this file.
 *
 * SERVER ONLY: credentials live in process.env and are read per call.
 */

export type ImageVerdict = "clean" | "review" | "reject";

export type ImageModerationResult = {
  verdict: ImageVerdict;
  /** Highest confidence among the violating categories (0..1). */
  score: number;
  /** Per-category scores, kept verbatim so moderators can see why. */
  labels: Record<string, number>;
  /** Violation category key, e.g. "nudity" | "gore" | "offensive" | "violence". */
  category: string | null;
  provider: string;
  /** True when the provider could not be reached — caller must fail closed. */
  unavailable: boolean;
};

const REJECT_AT = 0.85;
const REVIEW_AT = 0.4;

const PROVIDER = "sightengine";

function pickMax(labels: Record<string, number>) {
  let category: string | null = null;
  let score = 0;
  for (const [key, value] of Object.entries(labels)) {
    if (value > score) {
      score = value;
      category = key;
    }
  }
  return { category, score };
}

/** Flattens the Sightengine response into a flat category -> score map. */
function extractLabels(json: Record<string, any>): Record<string, number> {
  const nudity = json["nudity"] ?? {};
  const sexual = Math.max(
    Number(nudity["sexual_activity"] ?? 0),
    Number(nudity["sexual_display"] ?? 0),
    Number(nudity["very_suggestive"] ?? 0),
  );
  const erotica = Math.max(Number(nudity["erotica"] ?? 0), Number(nudity["suggestive"] ?? 0));
  const gore = Number(json["gore"]?.["prob"] ?? 0);
  const violence = Number(json["violence"]?.["prob"] ?? 0);
  const weapon = Number(json["weapon"]?.["classes"]?.["firearm"] ?? json["weapon"] ?? 0);
  const offensive = Number(json["offensive"]?.["prob"] ?? 0);

  return {
    nudity: sexual,
    erotica,
    gore,
    violence,
    weapon: Number.isFinite(weapon) ? weapon : 0,
    offensive,
  };
}

/**
 * Runs one image through the moderation provider.
 * Never throws — an outage returns `unavailable: true` with verdict "review",
 * so callers hold the content instead of publishing it.
 */
export async function moderateImage(
  bytes: ArrayBuffer | Uint8Array,
  filename = "upload.jpg",
): Promise<ImageModerationResult> {
  const user = process.env["SIGHTENGINE_API_USER"];
  const secret = process.env["SIGHTENGINE_API_SECRET"];

  const offline = (reason: string): ImageModerationResult => ({
    verdict: "review",
    score: 0,
    labels: {},
    category: null,
    provider: PROVIDER,
    unavailable: true,
    ...(reason ? {} : {}),
  });

  if (!user || !secret) return offline("missing-credentials");

  try {
    const form = new FormData();
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    form.append("media", new Blob([view as unknown as BlobPart], { type: "image/jpeg" }), filename);
    form.append("models", "nudity-2.1,gore-2.0,offensive-2.0,violence,weapon");
    form.append("api_user", user);
    form.append("api_secret", secret);

    const res = await fetch("https://api.sightengine.com/1.0/check.json", {
      method: "POST",
      body: form,
    });
    if (!res.ok) return offline("http-" + res.status);

    const json = (await res.json()) as Record<string, any>;
    if (json["status"] !== "success") return offline("api-error");

    const labels = extractLabels(json);
    const { category, score } = pickMax(labels);
    const verdict: ImageVerdict = score >= REJECT_AT ? "reject" : score >= REVIEW_AT ? "review" : "clean";

    return { verdict, score, labels, category, provider: PROVIDER, unavailable: false };
  } catch {
    return offline("network");
  }
}
