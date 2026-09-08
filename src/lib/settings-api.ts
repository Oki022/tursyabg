import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Публични настройки на платформата. Пазят се в базата, за да могат да се
 * променят без ново качване на кода (например размерът на бонуса).
 */
export async function getAppSettingNumber(key: string, fallback: number): Promise<number> {
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error || !data) return fallback;
  const n = Number(data.value);
  return Number.isFinite(n) ? n : fallback;
}

/** Броят безплатни кредити, които нов профил получава при регистрация. */
export function useWelcomeBonus() {
  return useQuery({
    queryKey: ["settings", "welcome_bonus_credits"],
    queryFn: () => getAppSettingNumber("welcome_bonus_credits", 50),
    staleTime: 10 * 60 * 1000,
  });
}
