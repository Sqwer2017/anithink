import { Trophy } from "lucide-react";
import { fetchAnimes } from "@/lib/api/shikimori";
import { TopRankedCard } from "./_components/top-ranked-card";

export const metadata = { title: "Топ 10 — AniThink" };

/**
 * Страница «Топ 10».
 * Верхний блок: большой Топ-3 с ранкингом (золото/серебро/бронза).
 * Ниже: сетка 4–50 (продолжение рейтинга).
 */
export default async function TopPage() {
  const topAnimes = await fetchAnimes(
    { limit: 50, order: "ranked", censored: "false" },
    3600,
  );

  const top3 = topAnimes.slice(0, 3);
  const rest = topAnimes.slice(3);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
      {/* Заголовок */}
      <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold md:text-4xl">
        <Trophy className="h-8 w-8 text-accent" />
        Топ <span className="text-accent">10</span>
      </h1>
      <p className="mt-1 text-sm text-muted">
        Лучшие аниме по рейтингу Shikimori
      </p>

      {/* ── Топ-3: крупные карточки ── */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {top3.map((anime, i) => (
          <TopRankedCard key={anime.id} anime={anime} rank={i + 1} />
        ))}
      </div>

      {/* ── 4–50: обычная сетка ── */}
      <section className="mt-10">
        <h2 className="mb-4 font-display text-xl font-bold">Продолжение рейтинга</h2>
        {rest.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {rest.map((anime, i) => (
              <div key={anime.id} className="relative">
                {/* Номер ранкинга */}
                <span className="absolute left-2 top-2 z-20 flex h-7 min-w-[28px] items-center justify-center rounded-lg bg-background/90 px-1.5 text-xs font-bold text-accent shadow-neon-sm backdrop-blur-sm ring-1 ring-accent/30">
                  {i + 4}
                </span>
                <TopRankedCard key={anime.id} anime={anime} rank={i + 4} small />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 py-16 text-center">
      <Trophy className="mb-3 h-10 w-10 text-muted/40" />
      <p className="text-sm text-muted">Не удалось загрузить рейтинг. Попробуйте позже.</p>
    </div>
  );
}