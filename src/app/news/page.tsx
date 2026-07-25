import { Newspaper } from "lucide-react";
import { fetchTopics } from "@/lib/api/shikimori";
import { NewsCard } from "./_components/news-card";

export const revalidate = 3600;

export const metadata = {
  title: "Новости — AniThink",
};

/**
 * Страница «Новости».
 * Сетку карточек в едином стиле AniThink. Каждая ведёт на внутреннюю
 * страницу /news/[id], где статья открывается прямо на сайте.
 */
export default async function NewsPage() {
  const topics = await fetchTopics({ forum: "news", limit: 50 }, 3600);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
      {/* Заголовок */}
      <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold md:text-4xl">
        <Newspaper className="h-8 w-8 text-accent" />
        Новости
      </h1>

      {/* Подзаголовок + live-индикатор */}
      <div className="mt-2 flex flex-col gap-1">
        <p className="text-sm text-muted">
          Новости, обсуждаемые прямо сейчас · {topics.length} публикаций
        </p>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-glow" />
          <span className="text-xs font-medium text-accent">
            Обновляется каждый час
          </span>
        </div>
      </div>

      {/* Сетка новостей */}
      {topics.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 py-16 text-center">
          <Newspaper className="mb-3 h-10 w-10 text-muted/40" />
          <p className="text-sm text-muted">
            Не удалось загрузить новости. Попробуйте позже.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
          {topics.map((topic, i) => (
            <NewsCard key={topic.id} topic={topic} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Локальный плейсхолдер для новостей без обложки */
function PosterPlaceholder({
  title,
  iconSize = "h-10 w-10",
}: {
  title?: string;
  iconSize?: string;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-2 p-4 text-center">
      {/* Newspaper икона должна быть импортирована вверху файла */}
      <Newspaper className={`${iconSize} text-muted/50`} />
      {title && (
        <p className="line-clamp-1 text-xs text-muted/70">{title}</p>
      )}
    </div>
  );
}

