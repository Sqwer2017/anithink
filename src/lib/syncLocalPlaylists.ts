"use client";

import { supabase } from "@/lib/supabase";
import { readPlaylists, type LocalPlaylist } from "@/lib/local-playlists";

/**
 * Облачная синхронизация локальных плейлистов (localStorage `anithink:playlists`)
 * в таблицы public.playlists / public.playlist_items (по пользователю).
 *
 * Логика — идемпотентная "полная проекция": читаем текущие локальные плейлисты
 * и upsert-им их и элементы под найденного авторизованного пользователя. Так событие
 * можно вызвать из любого места (создание/добавление/удаление), не таская user_id.
 * Если юзер не залогинен — no-op (все остаётся локально).
 */

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function syncLocalPlaylists(): Promise<void> {
  if (!supabase) return;
  const userId = await currentUserId();
  if (!userId) return;

  const local: LocalPlaylist[] = readPlaylists();
  if (!local.length) return;
  const now = new Date().toISOString();

  // 1. Строки плейлистов
  const headerRows = local.map((p) => ({
    id: p.id,
    user_id: userId,
    name: p.name,
    cover: p.cover || null,
    created_at: new Date(p.createdAt || Date.now()).toISOString(),
    updated_at: now,
  }));

  try {
    const { error: errH } = await supabase.from("playlists").upsert(headerRows, {
      onConflict: "id",
    });
    if (errH) console.error("[playlists] header upsert:", errH.message);
  } catch (e) {
    console.error("[playlists] header upsert error:", e);
  }

  // 2. Элементы (playlist_items)
  const items = local.flatMap((p) =>
    p.animeIds.map((animeId) => ({ playlist_id: p.id, anime_id: animeId, added_at: now })),
  );
  if (items.length) {
    try {
      const { error: errI } = await supabase.from("playlist_items").upsert(items, {
        onConflict: "playlist_id,anime_id",
      });
      if (errI) console.error("[playlists] items upsert:", errI.message);
    } catch (e) {
      console.error("[playlists] items upsert error:", e);
    }
  }
}
