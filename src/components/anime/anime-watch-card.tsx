"use client";

import { Heart, ListPlus, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { KinoBoxPlayer } from "@/components/player/kinobox-player";
import { PlaylistDialog } from "@/components/anime/playlist-dialog";
import { WATCH_STATUS_STORAGE_KEY } from "@/lib/local-playlists";

interface AnimeWatchCardProps {
  shikimoriId: string | number;
  title: string;
  score: number;
}

const FAVORITES_STORAGE_KEY = "anithink:favorites";
const WATCH_LATER_STORAGE_KEY = "anithink:playlist:watch-later";
const RATINGS_STORAGE_KEY = "anithink:ratings";

const WATCH_STATUSES = [
  { value: "watching", label: "Смотрю" },
  { value: "completed", label: "Просмотрено" },
  { value: "planned", label: "Буду смотреть" },
  { value: "dropped", label: "Брошено" },
] as const;

type WatchStatus = (typeof WATCH_STATUSES)[number]["value"];

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

function saveStringList(key: string, items: string[]) {
  window.localStorage.setItem(key, JSON.stringify(items));
}

function readRatings(): Record<string, number> {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(RATINGS_STORAGE_KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).filter(
        ([, rating]) => typeof rating === "number" && rating >= 1 && rating <= 10,
      ),
    );
  } catch {
    return {};
  }
}

export function AnimeWatchCard({ shikimoriId, title, score }: AnimeWatchCardProps) {
  const animeId = String(shikimoriId);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isInWatchLater, setIsInWatchLater] = useState(false);
  const [personalRating, setPersonalRating] = useState(0);
  const [watchStatus, setWatchStatus] = useState<WatchStatus | null>(null);
  const [isPlaylistDialogOpen, setIsPlaylistDialogOpen] = useState(false);

  useEffect(() => {
    setIsFavorite(readStringList(FAVORITES_STORAGE_KEY).includes(animeId));
    setIsInWatchLater(readStringList(WATCH_LATER_STORAGE_KEY).includes(animeId));
    setPersonalRating(readRatings()[animeId] ?? 0);
    try {
      const statuses: unknown = JSON.parse(
        window.localStorage.getItem(WATCH_STATUS_STORAGE_KEY) ?? "{}",
      );
      const savedStatus =
        statuses && typeof statuses === "object" && !Array.isArray(statuses)
          ? (statuses as Record<string, unknown>)[animeId]
          : null;
      setWatchStatus(
        WATCH_STATUSES.some(({ value }) => value === savedStatus)
          ? (savedStatus as WatchStatus)
          : null,
      );
    } catch {
      setWatchStatus(null);
    }
  }, [animeId]);

  const toggleListItem = (
    key: string,
    currentValue: boolean,
    setValue: (value: boolean) => void,
  ) => {
    const items = readStringList(key);
    const nextItems = currentValue
      ? items.filter((id) => id !== animeId)
      : [...new Set([...items, animeId])];

    saveStringList(key, nextItems);
    setValue(!currentValue);
  };

  const setRating = (rating: number) => {
    const ratings = readRatings();
    const nextRating = personalRating === rating ? 0 : rating;

    if (nextRating === 0) {
      delete ratings[animeId];
    } else {
      ratings[animeId] = nextRating;
    }

    window.localStorage.setItem(RATINGS_STORAGE_KEY, JSON.stringify(ratings));
    setPersonalRating(nextRating);
  };

  const setStatus = (status: WatchStatus) => {
    let statuses: Record<string, WatchStatus> = {};
    try {
      const saved: unknown = JSON.parse(
        window.localStorage.getItem(WATCH_STATUS_STORAGE_KEY) ?? "{}",
      );
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        statuses = saved as Record<string, WatchStatus>;
      }
    } catch {
      statuses = {};
    }

    const nextStatus = watchStatus === status ? null : status;
    if (nextStatus) {
      statuses[animeId] = nextStatus;
    } else {
      delete statuses[animeId];
    }
    window.localStorage.setItem(WATCH_STATUS_STORAGE_KEY, JSON.stringify(statuses));
    setWatchStatus(nextStatus);
    window.dispatchEvent(
      new CustomEvent("anithink:watch-status-changed", {
        detail: { animeId, status: nextStatus },
      }),
    );
  };

  return (
    <section className="max-w-[1320px] rounded-2xl border border-border/60 bg-card p-4 shadow-cyber md:p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_270px]">
        <KinoBoxPlayer shikimoriId={shikimoriId} title={title} />

        <aside className="flex flex-col rounded-xl border border-border/70 bg-surface-2/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Рейтинг Shikimori
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span className="font-display text-4xl font-extrabold text-accent">
              {score > 0 ? score.toFixed(1) : "—"}
            </span>
            <span className="mb-1 text-sm text-muted">из 10</span>
          </div>
          <div className="mt-2 flex gap-1" aria-label={`Рейтинг Shikimori: ${score.toFixed(1)} из 10`}>
            {Array.from({ length: 5 }, (_, index) => (
              <Star
                key={index}
                className="h-4 w-4 text-accent"
                fill={score >= (index + 1) * 2 ? "currentColor" : "none"}
              />
            ))}
          </div>

          <div className="my-5 h-px bg-border/70" />

          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Моя оценка
          </p>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: 5 }, (_, index) => {
              const rating = (index + 1) * 2;
              return (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setRating(rating)}
                  aria-label={`Поставить ${rating} из 10`}
                  className="rounded p-1 text-muted transition-colors hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/60"
                >
                  <Star
                    className="h-5 w-5"
                    fill={personalRating >= rating ? "currentColor" : "none"}
                  />
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted">
            {personalRating ? `${personalRating} / 10` : "Выберите оценку"}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {WATCH_STATUSES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                  watchStatus === value
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border bg-surface text-muted hover:border-accent/50 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-auto grid gap-2 pt-5">
            <button
              type="button"
              onClick={() =>
                toggleListItem(FAVORITES_STORAGE_KEY, isFavorite, setIsFavorite)
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold transition-colors hover:border-accent/60 hover:text-accent"
            >
              <Heart className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
              {isFavorite ? "В избранном" : "В избранное"}
            </button>
            <button
              type="button"
              onClick={() => setIsPlaylistDialogOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-bold text-background transition-opacity hover:opacity-90"
            >
              <ListPlus className="h-4 w-4" />
              В плейлисты
            </button>
          </div>
        </aside>
      </div>
      {isPlaylistDialogOpen && <PlaylistDialog animeId={animeId} onClose={() => setIsPlaylistDialogOpen(false)} />}
    </section>
  );
}
