import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimeCard } from "./anime-card";
import { fetchAnimes, type AnimesQuery } from "@/lib/api/shikimori";

/**
 * Серверная секция: загружает аниме из Shikimori на сервере (ISR, 1 час)
 * и рендерит адаптивную сетку карточек.
 */
export async function AnimeSection({
  title,
  query,
  seeAllHref,
  icon,
}: {
  title: string;
  query: AnimesQuery;
  seeAllHref?: string;
  icon?: React.ReactNode;
}) {
  const animes = await fetchAnimes(query, 3600);

  return (
    <section className="mt-10">
      {/* Заголовок */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-foreground md:text-2xl">
          {icon}
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="group flex shrink-0 items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-accent"
          >
            Все
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>

      {animes.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 py-12 text-sm text-muted">
          Не удалось загрузить данные. Попробуйте позже.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {animes.map((a, i) => (
            <AnimeCard key={a.id} anime={a} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
