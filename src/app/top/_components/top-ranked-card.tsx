import Link from "next/link";
import { Star, Crown, Medal } from "lucide-react";
import { buildImageUrl, type Anime } from "@/lib/api/shikimori";
import { ImageWithFallback } from "@/components/anime/image-with-fallback";
import { PosterPlaceholder } from "@/components/anime/poster-placeholder";
import { cn } from "@/lib/utils";

const RANK_STYLES: Record<
  number,
  { badge: string; icon: typeof Crown; ring: string }
> = {
  1: {
    badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: Crown,
    ring: "ring-yellow-500/60",
  },
  2: {
    badge: "bg-gray-400/15 text-gray-300 border-gray-400/30",
    icon: Medal,
    ring: "ring-gray-400/40",
  },
  3: {
    badge: "bg-amber-700/15 text-amber-500 border-amber-700/30",
    icon: Medal,
    ring: "ring-amber-700/40",
  },
};

export function TopRankedCard({
  anime,
  rank,
  small = false,
}: {
  anime: Anime;
  rank: number;
  small?: boolean;
}) {
  const title = anime.russian || anime.name || "—";
  const poster = buildImageUrl(anime.image?.original, "original");
  const score = anime.score ? parseFloat(anime.score) : 0;
  const style = RANK_STYLES[rank];
  const RankIcon = style?.icon ?? Star;

  if (small) {
    return (
      <Link
        href={`/anime/${anime.id}`}
        className="group block overflow-hidden rounded-2xl border border-border bg-surface/50 transition-all duration-300 hover:-translate-y-1 hover:border-accent/50"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-2">
          <ImageWithFallback
            src={poster || ""}
            alt={title}
            title={title}
            fill
            sizes="(max-width: 640px) 50vw, 18vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-70" />
          {score > 0 && (
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-background/80 px-2 py-1 text-xs font-bold text-accent backdrop-blur-sm">
              <Star className="h-3 w-3 fill-accent" />
              {score.toFixed(1)}
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-accent">
            {title}
          </h3>
        </div>
      </Link>
    );
  }

  /* ── Большая карточка для Топ-3 ── */
  return (
    <Link
      href={`/anime/${anime.id}`}
      className={cn(
        "group relative overflow-hidden rounded-3xl border bg-surface/50 shadow-panel transition-all duration-300 hover:-translate-y-1",
        style ? `border-accent/30` : "border-border",
      )}
    >
      {/* Постер */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-2 sm:aspect-[2/3]">
        <ImageWithFallback
          src={poster || ""}
          alt={title}
          title={title}
          fill
          sizes="(max-width: 640px) 100vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

        {/* Ранкинг-бейдж */}
        {style && (
          <div
            className={cn(
              "absolute left-3 top-3 flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-sm font-bold backdrop-blur-sm",
              style.badge,
            )}
          >
            <RankIcon className="h-4 w-4" />
            #{rank}
          </div>
        )}

        {/* Оценка */}
        {score > 0 && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-xl bg-background/80 px-2.5 py-1.5 text-sm font-bold text-accent backdrop-blur-sm">
            <Star className="h-4 w-4" />
            {score.toFixed(2)}
          </div>
        )}

        {/* Инфо снизу */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="line-clamp-2 text-lg font-bold leading-tight text-white drop-shadow-lg sm:text-xl">
            {title}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {anime.kind && (
              <span className="rounded-lg bg-accent/20 px-2 py-0.5 text-xs font-bold uppercase text-accent backdrop-blur-sm">
                {anime.kind}
              </span>
            )}
            {anime.episodes && (
              <span className="rounded-lg bg-white/10 px-2 py-0.5 text-xs text-white/80 backdrop-blur-sm">
                {anime.episodes} эп.
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
