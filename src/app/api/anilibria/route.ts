import { NextRequest, NextResponse } from "next/server";

const ANILIBERTY_API = "https://aniliberty.top/api/v1";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

  if (!alias && !query) {
    return NextResponse.json(
      { error: "Укажите параметр title или alias" },
      { status: 400 },
    );
  }

  const headers = {
    "User-Agent": BROWSER_UA,
    Accept: "application/json",
  };

  try {
    let releaseAlias = alias ? alias.toLowerCase() : "";

    // ── 1. Поиск по названию ──
    if (!releaseAlias && query) {
      const searchUrl = `${ANILIBERTY_API}/app/search/releases?query=${encodeURIComponent(query)}&limit=10`;
      const searchRes = await fetch(searchUrl, {
        headers,
        next: { revalidate: 300 },
      });

      if (!searchRes.ok) {
        return NextResponse.json(
          { error: `API search: ${searchRes.status}` },
          { status: searchRes.status },
        );
      }

      const searchJson = await searchRes.json().catch(() => null);
      const results = Array.isArray(searchJson) ? searchJson : searchJson?.data ?? [];

      if (results.length === 0) {
        return NextResponse.json({ error: "Тайтл не найден в AniLibria" }, { status: 404 });
      }

      // Точное совпадение по рус/англ названию, иначе — первый результат
      const normalized = query.toLowerCase();
      const match =
        results.find(
          (r: any) =>
            String(r?.name?.main || "").toLowerCase() === normalized ||
            String(r?.name?.english || "").toLowerCase() === normalized,
        ) ?? results[0];

      releaseAlias = String(match?.alias || "").toLowerCase();
      if (!releaseAlias) {
        return NextResponse.json({ error: "Не удалось определить alias" }, { status: 404 });
      }
    }

    // ── 2. Полный релиз с эпизодами ──
    const releaseUrl = `${ANILIBERTY_API}/anime/releases/list?aliases=${encodeURIComponent(releaseAlias)}&limit=1`;
    const releaseRes = await fetch(releaseUrl, {
      headers,
      next: { revalidate: 300 },
    });

    if (!releaseRes.ok) {
      return NextResponse.json(
        { error: `API releases: ${releaseRes.status}` },
        { status: releaseRes.status },
      );
    }

    const releaseJson = await releaseRes.json().catch(() => null);
    const release = releaseJson?.data?.[0] ?? (Array.isArray(releaseJson) ? releaseJson[0] : null);

    if (!release) {
      return NextResponse.json({ error: "Релиз не найден" }, { status: 404 });
    }

    const episodesList = release.episodes ?? [];
    if (episodesList.length === 0) {
      return NextResponse.json({ error: "У данного тайтла нет серий" }, { status: 404 });
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
      return NextResponse.json({ error: "У тайтла нет доступных HLS-потоков" }, { status: 404 });
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
