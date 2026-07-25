"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Star, Play } from "lucide-react";
import { buildImageUrl, type Anime } from "@/lib/api/shikimori";
import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/anime/image-with-fallback";

/**
 * Карточка аниме для сетки.
 * Hover-эффект: лёгкий подъём + неоновая рамка + overlay с "play".
 */
export function AnimeCard({
  anime,
  index = 0,
}: {
  anime: Anime;
  index?: number;
}) {
  const title = anime.russian || anime.name || "Без названия";
  const poster = buildImageUrl(anime.image?.original, "original");
  const score = anime.score ? parseFloat(anime.score) : 0;
  const year = anime.aired_on ? new Date(anime.aired_on).getFullYear() : null;
  const kind = anime.kind?.toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}
      className="group relative"
    >
      <Link
        href={`/anime/${anime.id}`}
        className="block overflow-hidden rounded-2xl border border-border bg-surface/50 transition-all duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-neon-sm"
      >
        {/* Постер */}
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-2">
          <ImageWithFallback
            src={poster || ""}
            alt={title}
            title={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 18vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />

          {/* Затемнение снизу */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent opacity-80" />

          {/* Play-overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-background shadow-neon">
              <Play className="h-5 w-5 fill-background" />
            </div>
          </div>

          {/* Оценка */}
          {score > 0 && (
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-background/80 px-2 py-1 text-xs font-bold text-accent backdrop-blur-sm">
              <Star className="h-3 w-3 fill-accent" />
              {score.toFixed(1)}
            </div>
          )}

          {/* Тип + год */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
            {kind && (
              <span className="rounded-md bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent backdrop-blur-sm">
                {kind}
              </span>
            )}
            {year && (
              <span className="rounded-md bg-background/70 px-1.5 py-0.5 text-[10px] font-medium text-muted backdrop-blur-sm">
                {year}
              </span>
            )}
          </div>
        </div>

        {/* Название */}
        <div className="p-3">
          <h3
            className={cn(
              "line-clamp-2 text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-accent"
            )}
          >
            {title}
          </h3>
          {anime.episodes ? (
            <p className="mt-1 text-[11px] text-muted">
              {anime.episodes_aired || 0} / {anime.episodes} эп.
            </p>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}

/** Скетч-загрузчик для карточек */
export function AnimeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface/50">
      <div className="relative aspect-[2/3] w-full animate-pulse bg-surface-2" />
      <div className="space-y-2 p-3">
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}