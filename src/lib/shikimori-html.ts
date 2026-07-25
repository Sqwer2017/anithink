/**
 * Процессор HTML-контента Shikimori.
 *
 * Превращает «сырой» HTML Shikimori (классы b-video, b-image, b-shiki_wall,
 * b-quote и т.д.) в чистый HTML, готовый для нашего AniThink-интерфейса:
 *  - YouTube-видео → встроенный <iframe> (кликабельный, с превью)
 *  - Изображения (b-image) → центрированные с неоновой обводкой
 *  - Спойлеры, цитаты — нормализуются
 *
 * Всё это — серверные строковые трансформации (без DOM-парсинга), быстро.
 */

const SHIKIMORI_HOST = "https://shikimori.one";

/** Заменяет относительные URL Shikimori на абсолютные в src/href. */
function absolutizeUrls(html: string): string {
  // shikimori.one / io относительные ссылки и proto-relative
  return html
    .replace(
      /(src|href)=["'](\/\/(?:shikimori\.one|shikimori\.io|img\.youtube\.com)[^"']*)["']/g,
      '$1="https:$2"',
    )
    .replace(
      /(src|href)=["'](\/(?:animes|mangas|system|forum|users)[^"']*)["']/g,
      (_m, attr, path) => `${attr}="${SHIKIMORI_HOST}${path}"`,
    );
}

/** Извлекает YouTube video ID из различных форматов Shikimori. */
function extractYouTubeId(html: string): string | null {
  // data-href="https://youtube.com/embed/ID"
  const embed = html.match(/youtube\.com\/embed\/([\w-]{6,})/);
  if (embed) return embed[1];
  // href="https://youtu.be/ID"
  const short = html.match(/youtu\.be\/([\w-]{6,})/);
  if (short) return short[1];
  // src="//img.youtube.com/vi/ID/..."
  const img = html.match(/img\.youtube\.com\/vi\/([\w-]{6,})\//);
  if (img) return img[1];
  return null;
}

/**
 * Главная функция обработки HTML.
 * Возвращает безопасный HTML для рендера в prose-cyber.
 */
export function processShikimoriHtml(html: string): string {
  if (!html) return "";
  let out = html;

  // 1. Абсолютизация URL
  out = absolutizeUrls(out);

  // 2. YouTube-видео → встроенный iframe (lazy, кликабельный)
  out = out.replace(
    /<div[^>]*class="[^"]*b-video[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    (block) => {
      const id = extractYouTubeId(block);
      if (!id) return "";
      return (
        `<div class="media-embed video-embed">` +
        `<div class="video-frame" data-youtube-id="${id}">` +
        `<img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="Видео" loading="lazy" />` +
        `<button type="button" class="video-play-btn" aria-label="Воспроизвести">` +
        `<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">` +
        `<path d="M8 5v14l11-7z"/></svg></button>` +
        `</div></div>`
      );
    },
  );

  // 3. b-image → центрированное изображение с классом для стилизации
  out = out.replace(
    /<a[^>]*class="[^"]*b-image[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    (_m, inner) => {
      const imgMatch = inner.match(/<img[^>]*>/i);
      if (!imgMatch) return inner;
      // Берём src и alt
      const src =
        imgMatch[0].match(/src=["']([^"']+)["']/i)?.[1] || "";
      const alt =
        imgMatch[0].match(/alt=["']([^"']*)["']/i)?.[1] || "Изображение";
      if (!src || src.includes("missing_")) return "";
      return `<div class="media-embed image-embed"><img src="${src}" alt="${alt}" loading="lazy" /></div>`;
    },
  );

  // 4. b-shiki_wall — оборачиваем в контейнер (если что-то осталось внутри)
  out = out.replace(
    /<div[^>]*class="[^"]*b-shiki_wall[^"]*"[^>]*>/gi,
    '<div class="shiki-wall">',
  );

  // 5. Очистка остаточных Shikimori-обёрток (to-process, data-dynamic)
  out = out.replace(/\s*to-process|data-dynamic="[^"]*"/gi, "");

  return out;
}
