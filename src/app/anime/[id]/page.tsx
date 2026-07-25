import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, Calendar, Tv, ArrowLeft } from "lucide-react";
import { AnimeWatchCard } from "@/components/anime/anime-watch-card";
import { AnimeStatisticsCard } from "@/components/anime/anime-statistics-card";
import { ShikimoriDescription } from "@/components/anime/shikimori-description";
import {
  fetchAnimeById,
  buildImageUrl,
  fetchComments,
  fetchTopics,
} from "@/lib/api/shikimori";
import { AnimeCommentsSection } from "./_components/anime-comments-section";
import { AnimeHistoryTracker } from "@/components/anime/anime-history-tracker";

export const revalidate = 0;

/**
 * Страница аниме: /anime/[id]
 * Серверный компонент, ISR 1 час.
 */
export default async function AnimePage({
  params,
}: {
  params: { id: string };
}) {
  const [anime, linkedTopics] = await Promise.all([
    fetchAnimeById(params.id, 3600),
    fetchTopics(
      { linked_id: Number(params.id), linked_type: "Anime", limit: 1 },
      600,
    ),
  ]);
  if (!anime) notFound();

  const animeTopic = linkedTopics[0];
  const comments = animeTopic
    ? await fetchComments(String(animeTopic.id), "Topic", 1, 30, 600)
    : [];

  const title = anime.russian || anime.name || "Без названия";
  const poster = buildImageUrl(anime.image?.original, "original");
  const score = anime.score ? parseFloat(anime.score) : 0;
  const year = anime.aired_on ? new Date(anime.aired_on).getFullYear() : null;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
      <AnimeHistoryTracker animeId={params.id} />
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад
      </Link>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
        {/* Постер */}
        <div className="mx-auto w-full max-w-[280px] md:mx-0">
          <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-surface shadow-panel">
            {poster && (
              <Image
                src={poster}
                alt={title}
                fill
                sizes="280px"
                className="object-cover"
              />
            )}
          </div>
        </div>

        {/* Инфо */}
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            {title}
          </h1>
          {anime.name && anime.name !== title && (
            <p className="mt-1 text-base text-muted">{anime.name}</p>
          )}

          {/* Мета-бейджи */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {score > 0 && (
              <span className="flex items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1.5 text-sm font-bold text-accent">
                <Star className="h-4 w-4 fill-accent" />
                {score.toFixed(2)}
              </span>
            )}
            {anime.kind && (
              <span className="flex items-center gap-1 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1.5 text-sm font-medium uppercase text-muted">
                <Tv className="h-4 w-4" />
                {anime.kind}
              </span>
            )}
            {year && (
              <span className="flex items-center gap-1 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1.5 text-sm font-medium text-muted">
                <Calendar className="h-4 w-4" />
                {year}
              </span>
            )}
            {anime.episodes ? (
              <span className="rounded-lg border border-border bg-surface-2/60 px-2.5 py-1.5 text-sm font-medium text-muted">
                {anime.episodes_aired || 0} / {anime.episodes} эп.
              </span>
            ) : null}
            {anime.status && (
              <span className="rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-sm font-medium text-accent">
                {anime.status === "ongoing"
                  ? "Онгоинг"
                  : anime.status === "released"
                    ? "Вышел"
                    : "Анонс"}
              </span>
            )}
          </div>

          {/* Жанры */}
          {anime.genres && anime.genres.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {anime.genres.map((g) => (
                <span
                  key={g.id}
                  className="rounded-md bg-surface-2/60 px-2 py-1 text-xs text-muted"
                >
                  {g.russian || g.name}
                </span>
              ))}
            </div>
          )}

          {/* Описание */}
          {anime.description && (
            <div className="mt-6">
              <h2 className="mb-2 font-display text-lg font-bold">Описание</h2>
              <ShikimoriDescription text={anime.description} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-display text-xl font-bold">Смотреть аниме</h2>
        <AnimeWatchCard
          shikimoriId={params.id}
          title={title}
          score={Number.isFinite(score) ? score : 0}
        />
        <AnimeStatisticsCard
          shikimoriId={params.id}
          score={Number.isFinite(score) ? score : 0}
          episodes={anime.episodes}
          episodesAired={anime.episodes_aired}
          duration={anime.duration}
        />
      </div>

      <AnimeCommentsSection
        comments={comments}
        totalCount={animeTopic?.comments_count ?? comments.length}
      />
    </div>
  );
}
