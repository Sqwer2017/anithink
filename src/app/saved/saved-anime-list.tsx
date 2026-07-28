"use client";

import { Bookmark, Heart, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimeCard } from "@/components/anime/anime-card";
import type { Anime } from "@/lib/api/shikimori";
import { syncFavoriteToUserAnime } from "@/lib/user-anime";

const FAVORITES_STORAGE_KEY = "anithink:favorites";
const WATCH_LATER_STORAGE_KEY = "anithink:playlist:watch-later";

interface SavedAnime extends Anime {
  isFavorite: boolean;
  isWatchLater: boolean;
}

function readStringList(key: string): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) && value.every((item) => typeof item === "string")
      ? value
      : [];
  } catch {
    return [];
  }
}

function writeStringList(key: string, items: string[]) {
  window.localStorage.setItem(key, JSON.stringify(items));
}

export function SavedAnimeList() {
  const [anime, setAnime] = useState<SavedAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const favorites = readStringList(FAVORITES_STORAGE_KEY);
    const watchLater = readStringList(WATCH_LATER_STORAGE_KEY);
    const ids = [...new Set([...favorites, ...watchLater])];

    if (ids.length === 0) {
      setAnime([]);
      setIsLoading(false);
      return;
    }

    const loadSavedAnime = async () => {
      try {
        const response = await fetch(`/api/saved?ids=${ids.join(",")}`);
        if (!response.ok) {
          throw new Error("Unable to load saved anime");
        }

        const data: Anime[] = await response.json();
        const byId = new Map(data.map((item) => [String(item.id), item]));
        setAnime(
          ids
            .map((id) => byId.get(id))
            .filter((item): item is Anime => Boolean(item))
            .map((item) => ({
              ...item,
              isFavorite: favorites.includes(String(item.id)),
              isWatchLater: watchLater.includes(String(item.id)),
            })),
        );
      } catch {
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSavedAnime();
  }, []);

  const removeFromList = (animeId: string, key: string) => {
    writeStringList(
      key,
      readStringList(key).filter((id) => id !== animeId),
    );

    // Синхронизация удаления избранного с Supabase.
    if (key === FAVORITES_STORAGE_KEY) {
      void syncFavoriteToUserAnime(animeId, false);
    }

    setAnime((current) =>
      current
        .map((item) =>
          String(item.id) !== animeId
            ? item
            : {
                ...item,
                isFavorite:
                  key === FAVORITES_STORAGE_KEY ? false : item.isFavorite,
                isWatchLater:
                  key === WATCH_LATER_STORAGE_KEY ? false : item.isWatchLater,
              },
        )
        .filter((item) => item.isFavorite || item.isWatchLater),
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-52 items-center justify-center rounded-2xl border border-border bg-surface/40">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
        Не удалось загрузить сохранённые аниме. Попробуйте обновить страницу.
      </div>
    );
  }

  if (anime.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 px-6 text-center">
        <Bookmark className="h-10 w-10 text-muted/40" />
        <h2 className="mt-4 font-display text-xl font-bold">Здесь пока пусто</h2>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Добавляйте тайтлы в избранное или в плейлист «Буду смотреть» на странице аниме.
        </p>
      </div>
    );
  }

  const DISPLAY_LIMIT = 48;
  const displayed = anime.slice(0, DISPLAY_LIMIT);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {displayed.map((item, index) => (
          <div key={item.id} className="group rounded-2xl border border-transparent transition-colors hover:border-border">
            <AnimeCard anime={item} index={index} />
            <div className="mt-2 flex flex-wrap gap-1.5 px-1 pb-1">
              {item.isFavorite && (
                <button
                  type="button"
                  onClick={() => removeFromList(String(item.id), FAVORITES_STORAGE_KEY)}
                  className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-red-500/15 hover:text-red-300"
                  aria-label="Убрать из избранного"
                >
                  <Heart className="h-3 w-3 fill-current" />
                  Избранное
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
              {item.isWatchLater && (
                <button
                  type="button"
                  onClick={() => removeFromList(String(item.id), WATCH_LATER_STORAGE_KEY)}
                  className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[11px] font-semibold text-muted transition-colors hover:bg-red-500/15 hover:text-red-300"
                  aria-label="Убрать из плейлиста «Буду смотреть»"
                >
                  <Bookmark className="h-3 w-3 fill-current" />
                  Буду смотреть
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {anime.length > DISPLAY_LIMIT && (
        <div className="mt-6 flex justify-center">
          <span className="rounded-xl border border-border bg-surface px-5 py-2.5 text-xs font-bold text-muted">
            Показано {DISPLAY_LIMIT} из {anime.length}
          </span>
        </div>
      )}
    </>
  );
}
