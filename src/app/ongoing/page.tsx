import { Suspense } from "react";
import { Radio } from "lucide-react";
import { fetchAnimes } from "@/lib/api/shikimori";
import { AnimeCard, AnimeCardSkeleton } from "@/components/anime/anime-card";

export const metadata = { title: "Онгоинги — AniThink" };

/**
 * Страница «Онгоинги».
 * Показывает все текущие онгоинги. Два под-раздела:
 *  - «Сейчас выходит» (status=ongoing)
 */
export default async function OngoingPage() {
  const ongoing = await fetchAnimes(
    { limit: 50, status: "ongoing", order: "ranked", censored: "false" },
    1800, // 30 мин — онгоинги обновляются чаще
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
      <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold md:text-4xl">
        <Radio className="h-8 w-8 text-accent" />
        Онгоинги
      </h1>
      <p className="mt-1 text-sm text-muted">
        Аниме, выходящие прямо сейчас · {ongoing.length} тайтлов
      </p>

      <div className="mt-2 mb-6 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent animate-pulse-glow" />
        <span className="text-xs font-medium text-accent">Обновляется каждые 30 минут</span>
      </div>

      {ongoing.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 py-16 text-center">
          <Radio className="mb-3 h-10 w-10 text-muted/40" />
          <p className="text-sm text-muted">Не удалось загрузить онгоинги. Попробуйте позже.</p>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {Array.from({ length: 24 }).map((_, i) => (
                <AnimeCardSkeleton key={i} />
              ))}
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {ongoing.map((anime, i) => (
              <AnimeCard key={anime.id} anime={anime} index={i} />
            ))}
          </div>
        </Suspense>
      )}
    </div>
  );
}