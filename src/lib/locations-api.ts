import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Municipality, Neighborhood, Region } from "@/lib/locations";

/** Old city slugs that must keep resolving after the move to община slugs. */
export const LEGACY_MUNICIPALITY_SLUGS: Record<string, string> = {
  sofia: "sofiya",
  stolichna: "sofiya",
  bourgas: "burgas",
  rousse: "ruse",
  plovdif: "plovdiv",
  byala: "byala-ruse",
};

const MUNICIPALITY_SELECT =
  "id, name, slug, has_neighborhoods, lat, lng, regions!inner(name, slug)";

function mapMunicipality(row: any): Municipality {
  const region = Array.isArray(row.regions) ? row.regions[0] : row.regions;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    hasNeighborhoods: Boolean(row.has_neighborhoods),
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
    regionName: region?.name ?? "",
    regionSlug: region?.slug ?? "",
  };
}

export async function fetchRegions(): Promise<Region[]> {
  const { data, error } = await supabase.from("regions").select("id, name, slug").order("name");
  if (error) throw error;
  return (data ?? []) as Region[];
}

/** All 265 общини (small, cached indefinitely) so search can run client-side. */
export async function fetchMunicipalities(): Promise<Municipality[]> {
  const { data, error } = await supabase
    .from("municipalities")
    .select(MUNICIPALITY_SELECT)
    .order("name");
  if (error) throw error;
  return (data ?? []).map(mapMunicipality);
}

export async function fetchMunicipalityBySlug(slug: string): Promise<Municipality | null> {
  const target = LEGACY_MUNICIPALITY_SLUGS[slug] ?? slug;
  const { data, error } = await supabase
    .from("municipalities")
    .select(MUNICIPALITY_SELECT)
    .eq("slug", target)
    .maybeSingle();
  if (error || !data) return null;
  return mapMunicipality(data);
}

export async function fetchNeighborhoods(municipalityId: string): Promise<Neighborhood[]> {
  const { data, error } = await supabase
    .from("neighborhoods")
    .select("id, name, slug")
    .eq("municipality_id", municipalityId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Neighborhood[];
}

export type MunicipalityCount = { slug: string; name: string; taskCount: number };

/** Active-task counts per община inside an област (used for "nearby" suggestions). */
export async function fetchRegionCounts(
  regionSlug: string,
  category?: string,
): Promise<MunicipalityCount[]> {
  const { data, error } = await supabase.rpc("region_municipality_counts", {
    _region: regionSlug,
    ...(category ? { _category: category } : {}),
  });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    slug: r.slug,
    name: r.name,
    taskCount: Number(r.task_count ?? 0),
  }));
}

export function useRegions() {
  return useQuery({ queryKey: ["regions"], queryFn: fetchRegions, staleTime: Infinity });
}

export function useMunicipalities() {
  return useQuery({
    queryKey: ["municipalities"],
    queryFn: fetchMunicipalities,
    staleTime: Infinity,
  });
}

export function useNeighborhoods(municipalityId?: string) {
  return useQuery({
    queryKey: ["neighborhoods", municipalityId],
    queryFn: () => fetchNeighborhoods(municipalityId!),
    enabled: Boolean(municipalityId),
    staleTime: Infinity,
  });
}

export function useRegionCounts(regionSlug?: string, category?: string) {
  return useQuery({
    queryKey: ["region-counts", regionSlug, category ?? null],
    queryFn: () => fetchRegionCounts(regionSlug!, category),
    enabled: Boolean(regionSlug),
    staleTime: 60_000,
  });
}
