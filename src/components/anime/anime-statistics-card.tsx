"use client";

import { BarChart3, Clock3, ListChecks, Star } from "lucide-react";
import { useEffect, useState } from "react";

interface AnimeStatisticsCardProps {
  shikimoriId: string | number;
  score: number;
  episodes?: number;
  episodesAired?: number;
  duration?: number;
}

const WATCH_STATUS_STORAGE_KEY = "anithink:watch-statuses";

const STATUS_LABELS = {
  watching: "Смотрю",
  completed: "Просмотрено",
  planned: "Буду смотреть",
  dropped: "Брошено",
} as const;

type WatchStatus = keyof typeof STATUS_LABELS;

function isWatchStatus(value: unknown): value is WatchStatus {
  return typeof value === "string" && value in STATUS_LABELS;
}

function formatDuration(minutes?: number): string {
  if (!minutes) return "Не указана";
  return `${minutes} мин./эп.`;
}

export function AnimeStatisticsCard({
  shikimoriId,
  score,
  episodes,
  episodesAired,
  duration,
}: AnimeStatisticsCardProps) {
  const [watchStatus, setWatchStatus] = useState<WatchStatus | null>(null);

  useEffect(() => {
    const restoreStatus = () => {
      try {
        const saved: unknown = JSON.parse(
          window.localStorage.getItem(WATCH_STATUS_STORAGE_KEY) ?? "{}",
        );
        if (saved && typeof saved === "object" && !Array.isArray(saved)) {
          const value = (saved as Record<string, unknown>)[String(shikimoriId)];
          setWatchStatus(isWatchStatus(value) ? value : null);
        }
      } catch {
        setWatchStatus(null);
      }
    };

    const handleStatusChange = (event: Event) => {
      const detail = (event as CustomEvent<{ animeId: string; status: WatchStatus | null }>).detail;
      if (detail.animeId === String(shikimoriId)) {
        setWatchStatus(detail.status);
      }
    };

    restoreStatus();
    window.addEventListener("anithink:watch-status-changed", handleStatusChange);

    return () =>
      window.removeEventListener("anithink:watch-status-changed", handleStatusChange);
  }, [shikimoriId]);

  const watchedEpisodes =
    watchStatus === "completed" ? episodes ?? episodesAired ?? 0 : episodesAired ?? 0;

  const statistics = [
    {
      icon: Star,
      label: "Рейтинг Shikimori",
      value: score > 0 ? `${score.toFixed(1)} / 10` : "Нет оценки",
    },
    {
      icon: ListChecks,
      label: "Эпизоды",
      value: episodes ? `${episodesAired ?? 0} из ${episodes}` : `${episodesAired ?? 0} вышло`,
    },
    { icon: Clock3, label: "Хронометраж", value: formatDuration(duration) },
    {
      icon: BarChart3,
      label: "Ваш прогресс",
      value: watchStatus
        ? `${STATUS_LABELS[watchStatus]} · ${watchedEpisodes} эп.`
        : "Статус не выбран",
    },
  ];

  return (
    <section className="mt-5 max-w-[1320px] rounded-2xl border border-border/60 bg-card p-4 shadow-panel md:p-5">
      <h2 className="font-display text-lg font-bold">Статистика аниме</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statistics.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-border/70 bg-surface-2/40 p-3.5">
            <Icon className="h-4 w-4 text-accent" />
            <p className="mt-3 text-xs font-medium text-muted">{label}</p>
            <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
