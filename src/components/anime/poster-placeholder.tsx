import { ImageOff } from "lucide-react";

/**
 * Плейсхолдер для отсутствующего постера.
 * Показывает кастомную картинку-заглушку AniThink.
 *
 * variant="news"   → /news-placeholder.png   (для карточек новостей)
 * variant="anime"  → /anime-placeholder.png  (для карточек аниме)
 */
export function PosterPlaceholder({
  title,
  className,
  iconSize = "h-8 w-8",
  variant = "anime",
}: {
  title?: string;
  className?: string;
  iconSize?: string;
  variant?: "anime" | "news";
}) {
  const placeholderSrc =
    variant === "news" ? "/news-placeholder.png" : "/anime-placeholder.png";

  return (
    <div
      className={
        "relative flex h-full w-full items-center justify-center overflow-hidden " +
        (className || "")
      }
    >
      {/* Кастомная картинка-плейсхолдер */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={placeholderSrc}
        alt={title || "Нет постера"}
        className="h-full w-full object-cover"
        onError={(e) => {
          // Если и плейсхолдера нет — показываем иконку
          const t = e.currentTarget;
          t.style.display = "none";
        }}
      />

      {/* Если есть title — показываем иконку-индикатор */}
      {title && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-background/90 via-background/20 to-transparent p-3">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <ImageOff className="h-3 w-3" />
            {title.length > 40 ? title.slice(0, 40) + "…" : title}
          </span>
        </div>
      )}
    </div>
  );
}
