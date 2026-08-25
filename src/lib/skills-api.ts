import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    mutationFn: async (input: { userId: string; categories: string[]; tags: string[] }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("profiles") as any)
        .update({ skill_categories: input.categories, skill_tags: input.tags })
        .eq("id", input.userId);
      if (error) {
        if (error.code === "23514" || String(error.message).includes("SKILL_TAG_BLOCKED")) {
          throw new Error("SKILL_TAG_BLOCKED");
        }
        throw error;
      }
    },
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ["my-skills", input.userId] });
      void qc.invalidateQueries({ queryKey: ["public-profile", input.userId] });
    },
  });
}
