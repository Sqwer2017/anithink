"use client";

import { supabase } from "@/lib/supabase";

/**
 * Слой синхронизации аниме-списков (favorites / watch-status / history)
 * с таблицей public.user_anime.
 *
 * Принцип (повторяет паттерн handleSaveAll в profile-client):
 *  - Каждый вызов auth-gated: без авторизованного пользователя — no-op
 *    (данные остаются только в localStorage).
 *  - Null-safe на supabase (клиент может быть null если нет env).
 *  - upsert по ключу (user_id, anime_id).
 *  - Никогда не бросает: логирует ошибку, но не ломает локальный UX.
 */

export type WatchStatus = "watching" | "completed" | "planned" | "dropped";

async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function upsertUserAnime(
  userId: string,
  animeId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from("user_anime").upsert(
      {
        user_id: userId,
        anime_id: animeId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,anime_id" },
    );
    if (error) {
      console.error("user_anime upsert error:", error.message);
    }
  } catch (err) {
    console.error("user_anime upsert error:", err);
  }
}

/** Добавить/убрать из избранного. isFav=false НЕ удаляет строку —
 *  оставляет запись (могут быть status/history), только снимает флаг. */
export async function syncFavoriteToUserAnime(
  animeId: string,
  isFav: boolean,
): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await upsertUserAnime(userId, animeId, { is_favorite: isFav });
}

/** Установить статус просмотра. status=null — снять статус. */
export async function syncWatchStatusToUserAnime(
  animeId: string,
  status: WatchStatus | null,
): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await upsertUserAnime(userId, animeId, { watch_status: status });
}

/** Отметить аниме в истории. */
export async function syncHistoryToUserAnime(animeId: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await upsertUserAnime(userId, animeId, { in_history: true });
}
