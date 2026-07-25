"use client";

import { useEffect } from "react";
import { HISTORY_STORAGE_KEY } from "@/lib/local-playlists";

export function AnimeHistoryTracker({ animeId }: { animeId: string }) {
  useEffect(() => {
    try {
      const current: unknown = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]");
      const ids = Array.isArray(current) ? current.filter((id): id is string => typeof id === "string") : [];
      window.localStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify([animeId, ...ids.filter((id) => id !== animeId)].slice(0, 30)),
      );
    } catch {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([animeId]));
    }
  }, [animeId]);

  return null;
}
