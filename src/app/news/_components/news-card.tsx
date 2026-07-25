import Link from "next/link";
import Image from 'next/image';
import { MessageCircle, Clock, ArrowRight, User } from "lucide-react";
import {
  buildUserAvatarUrl,
  getTopicCover,
  getTopicLinked,
  getTopicTitle,
  type Topic,
} from "@/lib/api/shikimori";
import { ImageWithFallback } from "@/components/anime/image-with-fallback";

/**
 * Карточка новости в стиле AniThink.
 * Обложка: постер linked-аниме (с CDN-fallback по id, если постер missing).
 * Ведёт на внутреннюю страницу /news/[id].
 */
export function NewsCard({ topic, index = 0 }: { topic: Topic; index?: number }) {
  const title = getTopicTitle(topic);
  const rawCover = getTopicCover(topic);
  // Замени этот URL на любую свою картинку из инета или из папки /public
  const DEFAULT_COVER = "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1000&auto=format&fit=crop"; 
  const cover = rawCover || DEFAULT_COVER;

  const linkedAnime = getTopicLinked(topic)[0];
  const authorAvatar = buildUserAvatarUrl(topic.user);

  const date = topic.created_at
    ? new Date(topic.created_at).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Link
      href={`/news/${topic.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface/50 transition-all duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-neon-sm"
    >
      {/* Обложка / плейсхолдер */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-2">
        <ImageWithFallback
          src={cover}
          alt={title}
          fill
          unoptimized //
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          title={linkedAnime?.russian || linkedAnime?.name}
        />

        {/* Градиент */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

        {/* Бейдж комментариев */}
        {typeof topic.comments_count === "number" && topic.comments_count > 0 && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-background/80 px-2 py-1 text-xs font-bold text-accent backdrop-blur-sm">
            <MessageCircle className="h-3 w-3" />
            {topic.comments_count}
          </div>
        )}
      </div>

      {/* Контент */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-accent">
          {title}
        </h3>

        {/* Связанное аниме */}
        {linkedAnime?.russian && (
          <span className="mt-2 inline-flex w-fit items-center rounded-md bg-surface-2/70 px-2 py-0.5 text-[11px] text-muted">
            {linkedAnime.russian}
          </span>
        )}

        {/* Футер */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted">
          {/* Автор */}
          <span className="flex min-w-0 items-center gap-1.5">
            {authorAvatar ? (
              <Image
                src={authorAvatar}
                alt={topic.user?.nickname || ""}
                width={20}
                height={20}
                className="h-5 w-5 shrink-0 rounded-full border border-border object-cover"
                unoptimized
              />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2">
                <User className="h-3 w-3" />
              </span>
            )}
            <span className="truncate">{topic.user?.nickname || "Аноним"}</span>
          </span>

          {/* Дата */}
          {date && (
            <span className="flex shrink-0 items-center gap-1">
              <Clock className="h-3 w-3" />
              {date}
            </span>
          )}
        </div>

        {/* Hover-стрелка */}
        <span className="mt-3 flex items-center gap-1 text-xs font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
          Читать
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}