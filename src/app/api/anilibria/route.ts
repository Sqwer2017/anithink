import { NextRequest, NextResponse } from "next/server";

const ANILIBERTY_API = "https://aniliberty.top/api/v1";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Очищает название для поиска: обрезает всё после двоеточия/тире/точки,
 * убирает номера сезонов в конце (включая "ТВ-2").
 * «Реинкарнация безработного: История о приключениях в другом мире 2 — Маг-хранитель Фитц»
 * → «реинкарнация безработного»
 */
function cleanTitle(s: string): string {
  return s
    .toLowerCase()
    // Отбрасываем подзаголовок после : или — или - или .
    .split(/[:—–\-.]/)[0]
    .replace(/\(.+?\)/g, "")
    .replace(/\b(season|сезон|tv)\s*\d+/gi, "")
    .replace(/\b\d+-?\d*\s*$/, "")
    .replace(/[^a-zа-яё0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ответ «не найдено» — HTTP 200 (без 404), с диагностикой reason/sourcesChecked. */
interface NotFoundInfo {
  message?: string;
  reason?: string;
  sourcesChecked?: string[];
}
function notFound(opts: string | NotFoundInfo = "Не найдено") {
  const info: NotFoundInfo = typeof opts === "string" ? { message: opts, reason: opts } : opts;
  return NextResponse.json({
    success: false,
    items: [],
    message: info.message || info.reason || "Не найдено",
    reason: info.reason || info.message || "not_found",
    sourcesChecked: info.sourcesChecked || [],
  });
}

/** Токены очищенного названия. */
function tokens(s: string): string[] {
  return cleanTitle(s).split(" ")
    .filter(Boolean);
}

/** Последовательное совпадение префикса (сколько подряд идётначальных слов). */
function prefixScore(candidateTokens: string[], queryTokens: string[]): number {
  let n = 0;
  const limit = Math.min(candidateTokens.length, queryTokens.length);
  while (n < limit && candidateTokens[n] === queryTokens[n]) n += 1;
  return n;
}

/**
 * Выбирает лучший кандидат из названий одного релиза. Возвращает null,
 * если достаточно уверенного совпадения нет (типа «Реинкарнация аристократа»
 * для запроса «Реинкарнация безработного» — не должно детектиться).
 */
function bestCandidateName(query: string, names: string[]): string | null {
  const qt = tokens(query);
  if (!qt.length) return null;
  let best = -1;
  let bestName: string | null = null;

  for (const raw of names) {
    const ct = tokens(raw);
    if (!ct.length) continue;
    const paired = prefixScore(ct, qt);
    const equal = ct.join(" ") === qt.join(" ");

    let score = -1;
    if (equal) score = 1000;
    else if (paired >= qt.length) score = 500;         // все слова запроса совпали
    else if (qt.length === 1 && paired === 1) score = 300; // одиночное и совпало
    // иначе: qt>=2, но совпало только 1 слово -> НЕ проходит (иначе ошибочный выбор)

    if (score > best) {
      best = score;
      bestName = raw;
    }
  }
  return best > 0 ? bestName : null;
}

/** Один поисковый запрос к AniLibria с сопоставлением; возврат alias или null. */
async function resolveAliasByQuery(qRaw: string, headers: Record<string, string>) {
  if (!qRaw) return null;
  const clean = cleanTitle(qRaw) || qRaw;
  const url = `${ANILIBERTY_API}/app/search/releases?query=${encodeURIComponent(clean)}&limit=25`;
  const res = await fetch(url, { headers, next: { revalidate: 300 } });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const results = Array.isArray(json) ? json : (json ? json.data ?? [] : []);
  if (!results.length) return null;
  const match = (results as any[]).find((r: any) => {
    const names = [r?.name?.main, r?.name?.english, r?.name?.alternative]
      .filter(Boolean) as string[];
    return bestCandidateName(qRaw, names) != null;
  });
  return match ? String(match.alias || "") : null;
}

/**
 * Серверный прокси AniLiberty (зеркало Anilibria).
 *
 * Логика:
 *  1. Ищем релиз по названию (title/query) через /app/search/releases?query=
 *     — это ЕДИНСТВЕННЫЙ рабочий поиск. /anime/releases?search= НЕ работает.
 *  2. Берём alias и тянем полный release с эпизодами через /anime/releases/list?aliases=
 *  3. Формируем { [номер]: { name, hlsUrl } } из hls_1080/720/480.
 *
 * Важно:
 *  - Без браузерного User-Agent API отдаёт пустой ответ. UA обязателен.
 *  - Эпизоды доступны в /anime/releases/list (там поле episodes), а не в search-ответе.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const alias = searchParams.get("alias")?.trim();
  const query =
    searchParams.get("title")?.trim() ||
    searchParams.get("search")?.trim() ||
    searchParams.get("q")?.trim();
  // Оригинальное англ./ромадзи имя (из Shikimori) — приоритет для AniLibria.
  const englishName =
    searchParams.get("name")?.trim() ||
    searchParams.get("english")?.trim() ||
    searchParams.get("romaji")?.trim();

  if (!alias && !query && !englishName) {
    return NextResponse.json(
      { error: "Укажите параметр title / name / alias" },
      { status: 400 },
    );
  }

  const headers = {
    "User-Agent": BROWSER_UA,
    Accept: "application/json",
  };

  try {
    let releaseAlias = alias ? alias.toLowerCase() : "";

    // ── 0. Каскад: англ./ромадзи имя первым (надёжнее для AniLibria), затем русское ──
    if (!releaseAlias) {
      const attempts = [
        englishName && cleanTitle(englishName),
        query && cleanTitle(query),
      ].filter(Boolean) as string[];
      for (const attempt of attempts) {
        releaseAlias = (await resolveAliasByQuery(attempt, headers)) || "";
        if (releaseAlias) break;
      }
    }

    // Ничего для дальнейшего поиска (только если не сработал ни английский, ни русский)
    if (!releaseAlias && !query && !englishName) {
      return notFound({ message: "Не удалось сопоставить тайтл в AniLibria", reason: "no_confident_match", sourcesChecked: ["shikimori-english", "shikimori-russian"] });
    }

    // ── 1. Поиск по названию ──
    if (!releaseAlias && query) {
      // Очищаем запрос (убираем сезон/скобки/подзаголовок) для точного поиска в API
      const cleanQuery = cleanTitle(query);
      const searchUrl = `${ANILIBERTY_API}/app/search/releases?query=${encodeURIComponent(cleanQuery || query)}&limit=25`;
      const searchRes = await fetch(searchUrl, {
        headers,
        next: { revalidate: 300 },
      });

      if (!searchRes.ok) {
        return notFound(`API search: ${searchRes.status}`);
      }

      const searchJson = await searchRes.json().catch(() => null);
      const results = Array.isArray(searchJson) ? searchJson : searchJson?.data ?? [];

      if (results.length === 0) {
        return notFound();
      }

      // Уверенное сопоставление по всем названиям (main / english / alternative).
      // Берём первый релиз, у которого хотя бы одно имя надёжно совпадает.
      // (Для 2-словного запроса требуется совпадение ОБОИХ слов — иначе мимо.)
      const match = (results as any[]).find((r: any) => {
        const names = [r?.name?.main, r?.name?.english, r?.name?.alternative]
          .filter(Boolean) as string[];
        return bestCandidateName(query, names) != null;
      });

      if (!match) {
        return notFound({ message: "Не удалось сопоставить тайтл в AniLibria", reason: "no_confident_match", sourcesChecked: ["shikimori-english", "shikimori-russian"] });
      }

      releaseAlias = String(match?.alias || "").toLowerCase();
      if (!releaseAlias) {
        return notFound();
      }
    }

    // ── 2. Полный релиз с эпизодами ──
    const releaseUrl = `${ANILIBERTY_API}/anime/releases/list?aliases=${encodeURIComponent(releaseAlias)}&limit=1`;
    const releaseRes = await fetch(releaseUrl, {
      headers,
      next: { revalidate: 300 },
    });

    if (!releaseRes.ok) {
      return notFound(`API releases: ${releaseRes.status}`);
    }

    const releaseJson = await releaseRes.json().catch(() => null);
    const release = releaseJson?.data?.[0] ?? (Array.isArray(releaseJson) ? releaseJson[0] : null);

    if (!release) {
      return notFound();
    }

    const episodesList = release.episodes ?? [];
    if (episodesList.length === 0) {
      return notFound("У данного тайтла нет серий");
    }

    // ── 3. Формирование эпизодов ──
    const formattedEpisodes: Record<string, { name: string; hlsUrl: string }> = {};
    const hasStream: Record<string, string[]> = {};

    episodesList.forEach((ep: any) => {
      const epNumber = String(ep.ordinal ?? ep.sort_order ?? 1);
      // Собираем доступные качества
      const quals: string[] = [];
      if (typeof ep.hls_1080 === "string") quals[0] = ep.hls_1080;
      const hd = typeof ep.hls_720 === "string" && !quals[0] ? ep.hls_720 : null;
      const sd = typeof ep.hls_480 === "string" && !quals[0] && !hd ? ep.hls_480 : null;
      const chosen = quals[0] || hd || sd;

      if (chosen) {
        const fullUrl = chosen.startsWith("http")
          ? chosen
          : `https://anilibria.top${chosen}`;
        formattedEpisodes[epNumber] = {
          name: ep.name_english || ep.name || `Серия ${epNumber}`,
          hlsUrl: fullUrl,
        };
        hasStream[epNumber] = [fullUrl];
      }
    });

    if (Object.keys(formattedEpisodes).length === 0) {
      return notFound("У тайтла нет доступных HLS-потоков");
    }

    return NextResponse.json({
      title: release.name?.main || release.alias,
      alias: release.alias,
      episodes: formattedEpisodes,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Ошибка сервера" },
      { status: 500 },
    );
  }
}
