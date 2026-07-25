import { Grid2x2 } from "lucide-react";
import Link from "next/link";
import { fetchGenres } from "@/lib/api/shikimori";

export const metadata = { title: "Жанры — AniThink" };

/**
 * Страница «Жанры».
 * Сетка всех жанров Shikimori. Клик по жанру ведёт в /catalog?genre=ID.
 */
export default async function GenresPage() {
  const genres = Array.from(
    new Map(
      (await fetchGenres(86400))
        .filter((genre) => genre.entry_type === "Anime")
        .map((genre) => [`${genre.russian || genre.name}`.trim().toLocaleLowerCase("ru"), genre]),
    ).values(),
  ).sort((a, b) => (a.russian || a.name).localeCompare(b.russian || b.name, "ru"));

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
      <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold md:text-4xl">
        <Grid2x2 className="h-8 w-8 text-accent" />
        Жанры
      </h1>
      <p className="mt-1 text-sm text-muted">
        Выберите жанр для просмотра каталога
      </p>

      {genres.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {genres.map((genre) => (
            <Link
              key={genre.id}
              href={`/catalog?genre=${genre.id}`}
              className="group relative overflow-hidden rounded-2xl border border-border bg-surface/50 p-5 transition-all duration-300 hover:border-accent/50 hover:shadow-neon-sm"
            >
              {/* Декоративный фон */}
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/0 transition-colors duration-300 group-hover:bg-accent/8" />

              <h3 className="relative text-base font-semibold text-foreground transition-colors group-hover:text-accent">
                {genre.russian || genre.name}
              </h3>
              <p className="relative mt-1 text-xs text-muted">{genre.name}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 py-16 text-center">
      <Grid2x2 className="mb-3 h-10 w-10 text-muted/40" />
      <p className="text-sm text-muted">Не удалось загрузить жанры. Попробуйте позже.</p>
    </div>
  );
}
