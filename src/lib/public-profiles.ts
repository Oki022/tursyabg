import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Safe public identity lookup — the same source the public profile page uses.
 * Only exposes public fields (name, avatar, city, ratings, review counts,
 * completed jobs, skills, member since). Never phone or email.
 */
export type PublicIdentity = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  city: string | null;
  neighborhood: string | null;
  ratingAsPro: number | null;
  reviewCountAsPro: number;
  ratingAsClient: number | null;
  reviewCountAsClient: number;
  completedJobs: number;
  memberSince: string | null;
};

export const FALLBACK_NAME = "Потребител";

type Row = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  neighborhood: string | null;
  rating_as_pro: number | string | null;
  review_count_as_pro: number | null;
  rating_as_client: number | string | null;
  review_count_as_client: number | null;
  completed_jobs: number | null;
  created_at: string | null;
};

function mapRow(r: Row): PublicIdentity {
  return {
    id: r.id,
    fullName: r.full_name ?? null,
    avatarUrl: r.avatar_url ?? null,
    city: r.city ?? null,
    neighborhood: r.neighborhood ?? null,
    ratingAsPro: r.rating_as_pro == null ? null : Number(r.rating_as_pro),
    reviewCountAsPro: Number(r.review_count_as_pro ?? 0),
    ratingAsClient: r.rating_as_client == null ? null : Number(r.rating_as_client),
    reviewCountAsClient: Number(r.review_count_as_client ?? 0),
    completedJobs: Number(r.completed_jobs ?? 0),
    memberSince: r.created_at ?? null,
  };
}

/** Batched lookup, keyed by user id. Works logged out as well. */
export async function fetchPublicIdentities(
  ids: (string | null | undefined)[],
): Promise<Record<string, PublicIdentity>> {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  if (unique.length === 0) return {};
  const { data, error } = await supabase.rpc("public_profiles" as never, {
    _ids: unique,
  } as never);
  if (error) throw error;
  const map: Record<string, PublicIdentity> = {};
  for (const row of ((data ?? []) as unknown as Row[])) map[row.id] = mapRow(row);
  return map;
}

/** Convenience: id -> display name, with the Bulgarian fallback applied. */
export async function fetchPublicNames(
  ids: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const map = await fetchPublicIdentities(ids);
  const names: Record<string, string> = {};
  for (const [id, p] of Object.entries(map)) names[id] = p.fullName ?? FALLBACK_NAME;
  return names;
}

export function usePublicIdentities(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean) as string[])].sort();
  return useQuery({
    queryKey: ["public-identities", unique],
    queryFn: () => fetchPublicIdentities(unique),
    enabled: unique.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/** Bulgarian plural: 1 отзив, 2 отзива. */
export function reviewCountBg(count: number): string {
  return `${count} ${count === 1 ? "отзив" : "отзива"}`;
}

/** Rating formatted the Bulgarian way (decimal comma), e.g. 3,7. */
export function formatRatingBg(rating: number, digits = 1): string {
  return rating.toFixed(digits).replace(".", ",");
}
