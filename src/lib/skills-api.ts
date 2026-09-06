import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { skillTagKey } from "@/lib/skill-tags";
import { cleanCredentials, parseCredentials, type Credential } from "@/lib/credentials";

export type ProfileSkills = {
  categories: string[];
  tags: string[];
  credentials: Credential[];
};

export function useMySkills(userId?: string) {
  return useQuery({
    queryKey: ["my-skills", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<ProfileSkills> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("profiles") as any)
        .select("skill_categories, skill_tags, credentials")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return {
        categories: (data?.skill_categories as string[] | null) ?? [],
        tags: (data?.skill_tags as string[] | null) ?? [],
        credentials: parseCredentials(data?.credentials),
      };
    },
  });
}

export function useSaveSkills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      categories: string[];
      tags: string[];
      credentials?: Credential[];
    }): Promise<{ tags: string[]; droppedTags: string[]; credentials: Credential[] }> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("profiles") as any)
        .update({
          skill_categories: input.categories,
          skill_tags: input.tags,
          credentials: cleanCredentials(input.credentials ?? []),
        })
        .eq("id", input.userId)
        .select("skill_tags, credentials")
        .single();
      if (error) {
        if (error.code === "23514" || String(error.message).includes("SKILL_TAG_BLOCKED")) {
          throw new Error("SKILL_TAG_BLOCKED");
        }
        throw error;
      }
      // The database masks and de-duplicates tags. Report anything it removed
      // or rewrote, so the UI never claims success for dropped content.
      const stored = ((data?.skill_tags as string[] | null) ?? []).map((t) => t);
      const storedKeys = new Set(stored.map(skillTagKey));
      const droppedTags = input.tags.filter((t) => !storedKeys.has(skillTagKey(t)));
      return { tags: stored, droppedTags, credentials: parseCredentials(data?.credentials) };
    },
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ["my-skills", input.userId] });
      void qc.invalidateQueries({ queryKey: ["public-profile", input.userId] });
    },
  });
}

export type PopularSkillTag = { tag: string; uses: number };

/** Existing tags used across the platform, optionally scoped to categories. */
export function usePopularSkillTags(categories: string[], enabled = true) {
  const key = [...categories].sort();
  return useQuery({
    queryKey: ["popular-skill-tags", key],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PopularSkillTag[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("popular_skill_tags", {
        p_categories: key.length ? key : null,
        p_limit: 24,
      });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data as any[]) ?? []).map((r) => ({ tag: String(r.tag), uses: Number(r.uses) }));
    },
  });
}
