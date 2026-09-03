import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { skillTagKey } from "@/lib/skill-tags";

export type ProfileSkills = {
  categories: string[];
  tags: string[];
};

export function useMySkills(userId?: string) {
  return useQuery({
    queryKey: ["my-skills", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<ProfileSkills> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("profiles") as any)
        .select("skill_categories, skill_tags")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return {
        categories: (data?.skill_categories as string[] | null) ?? [],
        tags: (data?.skill_tags as string[] | null) ?? [],
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
    }): Promise<{ tags: string[]; droppedTags: string[] }> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("profiles") as any)
        .update({ skill_categories: input.categories, skill_tags: input.tags })
        .eq("id", input.userId)
        .select("skill_tags")
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
      return { tags: stored, droppedTags };
    },
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ["my-skills", input.userId] });
      void qc.invalidateQueries({ queryKey: ["public-profile", input.userId] });
    },
  });
}
