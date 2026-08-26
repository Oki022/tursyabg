import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  addFavourite,
  getFavouriteIds,
  getFavouritesCount,
  getFavouritesPage,
  removeFavourite,
} from "@/services/favourites";

export function useFavouriteIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favourites", "ids", user?.id],
    enabled: Boolean(user?.id),
    queryFn: getFavouriteIds,
    staleTime: 60_000,
  });
}

export function useFavouritesCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favourites", "count", user?.id],
    enabled: Boolean(user?.id),
    queryFn: getFavouritesCount,
  });
}

export function useFavouritesList() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["favourites", "list", user?.id],
    enabled: Boolean(user?.id),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getFavouritesPage(pageParam),
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** Optimistic save/unsave. Reverts the toggle when the request fails. */
export function useToggleFavourite() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ["favourites", "ids", user?.id];

  return useMutation({
    mutationFn: async ({ taskId, saved }: { taskId: string; saved: boolean }) => {
      if (!user) throw new Error("no-auth");
      if (saved) await removeFavourite(taskId);
      else await addFavourite(taskId, user.id);
    },
    onMutate: async ({ taskId, saved }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<string[]>(key);
      qc.setQueryData<string[]>(key, (ids = []) =>
        saved ? ids.filter((id) => id !== taskId) : [...ids, taskId],
      );
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      // Оптимистичното сърце се връща назад — потребителят трябва да разбере защо.
      toastError(error, { title: "Запазването не беше успешно" });
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["favourites"] });
    },
  });
}
