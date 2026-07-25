import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  MessageCircle,
  Eye,
  Heart,
  ExternalLink,
  Newspaper,
} from "lucide-react";
import {
  fetchTopicById,
  fetchComments,
  buildUserAvatarUrl,
  getTopicBodyHtml,
  getTopicCover,
  getTopicLinked,
  getTopicTitle,
  type Comment,
} from "@/lib/api/shikimori";
import { processShikimoriHtml } from "@/lib/shikimori-html";
import { ArticleContent } from "./_components/article-content";
import { CommentsSection } from "./_components/comments-section";
import { ImageWithFallback } from "@/components/anime/image-with-fallback";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: { id: string } }) {
  const topic = await fetchTopicById(params.id, 600);
  if (!topic) return { title: "Новость не найдена — AniThink" };
  const title = getTopicTitle(topic);
  return {
    title: `${title} — AniThink`,
    description: title,
  };
}

/**
 * Страница отдельной новости: /news/[id]
 */
export default async function NewsArticlePage({
  params,
}: {
  params: { id: string };
}) {
  const topic = await fetchTopicById(params.id, 600);
  if (!topic) notFound();

  const comments = await fetchComments(params.id, "Topic", 1, 30, 600);

  const date = topic.created_at
    ? new Date(topic.created_at).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const authorAvatar = buildUserAvatarUrl(topic.user);

  // Нормализованные данные через хелперы
  const title = getTopicTitle(topic);
  const bodyHtml = getTopicBodyHtml(topic);
  const linkedAnime = getTopicLinked(topic).find((l) => l.type === "anime");
  const cover = getTopicCover(topic);
  console.log("ПОЛУЧЕННЫЙ COVER URL:", cover); // <--- ДОБАВЬ ЭТОТ LOG

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 lg:px-8">
      {/* Назад */}
      <Link
        href="/news"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Все новости
      </Link>

      {/* ── Hero-обложка ── */}
        <div className="relative mb-6 aspect-[16/7] w-full overflow-hidden rounded-3xl border border-border bg-surface-2">
          {(() => {
            const cover = getTopicCover(topic);
            if (cover) {
              return (
                <>
                  <ImageWithFallback
                    src={cover}
                    alt={title}
                    title={title}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                </>
              );
            }
          return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-2 p-4 text-center">
              <Newspaper className="h-10 w-10 text-muted/50" />
              {(linkedAnime?.russian || linkedAnime?.name) && (
                <p className="line-clamp-1 text-xs text-muted/70">
                  {linkedAnime?.russian || linkedAnime?.name}
                </p>
              )}
            </div>
          );
        })()}
    </div>

      {/* ── Шапка статьи ── */}
      <article>
        {/* Мета-строка */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {topic.forum_id && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent">
              <Newspaper className="h-3.5 w-3.5" />
              Новость
            </span>
          )}
          {date && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Clock className="h-3.5 w-3.5" />
              {date}
            </span>
          )}
        </div>

        {/* Заголовок */}
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
          {title}
        </h1>

        {/* Автор */}
        <div className="mt-5 flex items-center gap-3 border-y border-border py-4">
          {authorAvatar ? (
            <ImageWithFallback
              src={authorAvatar}
              alt={topic.user?.nickname || ""}
              title={topic.user?.nickname}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full border border-border object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-accent">
              {(topic.user?.nickname || "?").charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {topic.user?.nickname || "Аноним"}
            </p>
            <p className="text-xs text-muted">Автор публикации</p>
          </div>

          {/* Статистика справа */}
          <div className="ml-auto flex items-center gap-4 text-xs text-muted">
            {typeof topic.view_count === "number" && (
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {topic.view_count.toLocaleString("ru-RU")}
              </span>
            )}
            {typeof topic.comments_count === "number" && (
              <span className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                {topic.comments_count}
              </span>
            )}
            {typeof topic.likes_count === "number" && topic.likes_count > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                {topic.likes_count}
              </span>
            )}
          </div>
        </div>

        {/* ── Связанное аниме-карточка ── */}
        {linkedAnime && (
          <div className="mt-8 flex justify-center">
            <a
            href={`https://shikimori.one${linkedAnime.url || ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex w-full max-w-lg items-center justify-between gap-4 overflow-hidden rounded-2xl border border-border/80 bg-surface/60 p-4 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/60 hover:bg-surface/90 hover:shadow-[0_0_25px_rgba(var(--accent-rgb),0.15)]"
          >
            {/* Акцентный градиент-свет на фоне при наведении */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-accent/0 via-accent/5 to-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-background">
                <ExternalLink className="h-4 w-4" />
              </span>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted/70">
                  Связанный тайтл
                </span>
                <span className="text-sm font-bold text-foreground transition-colors group-hover:text-accent">
                  {linkedAnime.russian || linkedAnime.name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs font-semibold text-accent opacity-80 group-hover:opacity-100">
              <span>Открыть</span>
              <ArrowLeft className="h-3.5 w-3.5 rotate-180 transition-transform duration-300 group-hover:translate-x-1" />

            </div>
          </a>
        </div>
      )}

        {/* Контент статьи */}
        {bodyHtml ? (
          <div
            className="prose-cyber mt-8 [&_img]:mx-auto [&_img]:my-6 [&_img]:max-h-[500px]: [&_img]:rounded-2xl [&_img]:border [&_img]:border-border/60 [&_img]:object-contain [&_iframe]:mx-auto [&_iframe]:my-6 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:max-w-2xl [&_iframe]:rounded-2xl [&_iframe]:border [&_iframe]:border-border/60 [&_iframe]:shadow-lg"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <p className="mt-6 text-sm text-muted">
            Текст публикации недоступен.
          </p>
        )}

        {/* Подвал статьи */}
        {topic.html_footer && (
          <div
            className="prose-cyber mt-6 border-t border-border pt-6 text-xs text-muted"
            dangerouslySetInnerHTML={{ __html: topic.html_footer }}
          />
        )}

        {/* Оригинал на Shikimori */}
        <div className="mt-10 flex justify-center">
          <div className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-surface-2/40 px-5 py-3.5 backdrop-blur-sm transition-colors hover:border-border">
            <span className="text-xs text-muted/80">
              Данные предоставлены <strong className="font-semibold text-foreground">Shikimori</strong>
            </span>
            <a
              href={`https://shikimori.one${topic.url || `/topics/${topic.id}`}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-1.5 text-xs font-semibold text-accent transition-all hover:bg-accent hover:text-background"
            >
              <span>Источник</span>
              <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
            </a>
          </div>
        </div>
      </article>

      {/* ── Комментарии ── */}
      <CommentsSection
        topicId={params.id}
        initialComments={comments}
        totalCount={topic.comments_count ?? comments.length}
      />
    </div>
  );
}