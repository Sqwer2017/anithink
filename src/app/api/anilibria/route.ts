import { NextRequest, NextResponse } from "next/server";

const ANILIBERTY_API = "https://anilibria.top/api/v1";

/**
 * Серверный прокси для AniLiberty.
 *
 * Flow:
 *  1. Принимает `title` (русское/англ. название) или `alias`.
 *  2. Ищет release через /app/search/releases?query=
 *  3. Получает полный release (с эпизодами HLS) через /anime/releases/list?aliases=
 *  4. Форматирует эпизоды в { [номер]: { name, hlsUrl } }
 *
 * Кэшируется на 30 минут (fresh) — HLS-ссылки AniLiberty живут долго.
 */
export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim();
  const alias = request.nextUrl.searchParams.get("alias")?.trim();

  if (!alias && !title) {
    return NextResponse.json({ error: "Параметры title или alias обязательны" }, { status: 400 });
  }

  try {
    let releaseAlias = alias ? alias.toLowerCase() : "";

    // 1. Ищем по названию, если alias не передан
    if (!releaseAlias && title) {
      const searchRes = await fetch(
        `${ANILIBERTY_API}/app/search/releases?query=${encodeURIComponent(title)}&limit=5`,
        {
          headers: { Accept: "application/json" },
          next: { revalidate: 1800 },
        },
      );
      if (!searchRes.ok) {
        return NextResponse.json({ error: `API status: ${searchRes.status}` }, { status: searchRes.status });
      }

      const searchJson = await searchRes.json();
      const results = Array.isArray(searchJson) ? searchJson : searchJson?.data ?? [];
      if (results.length === 0) {
        return NextResponse.json({ error: "Тайтл не найден в AniLiberty" }, { status: 404 });
      }

      // Выбираем первый подходящий (по русскому/англ названию)
      const normalized = title.toLowerCase();
      const match =
        results.find((r: any) =>
          (r?.name?.main || "").toLowerCase() === normalized ||
          (r?.name?.english || "").toLowerCase() === normalized,
        ) ?? results[0];

      releaseAlias = (match?.alias || "").toLowerCase();
      if (!releaseAlias) {
        return NextResponse.json({ error: "Не удалось определить alias" }, { status: 404 });
      }
    }

    // 2. Получаем полный release с эпизодами
    const releaseRes = await fetch(
      `${ANILIBERTY_API}/anime/releases/list?aliases=${encodeURIComponent(releaseAlias)}&limit=1`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 1800 },
      },
    );
    if (!releaseRes.ok) {
      return NextResponse.json({ error: `API status: ${releaseRes.status}` }, { status: releaseRes.status });
    }

    const releaseJson = await releaseRes.json();
    const release = (releaseJson?.data?.[0]) ?? releaseJson?.[0];

    if (!release) {
      return NextResponse.json({ error: "Релиз не найден" }, { status: 404 });
    }

    const episodesList = release.episodes ?? [];
    if (episodesList.length === 0) {
      return NextResponse.json({ error: "У данного тайтла нет серий" }, { status: 404 });
    }

    // 3. Формируем список эпизодов с HLS
    const formattedEpisodes: Record<string, { name: string; hlsUrl: string }> = {};

    episodesList.forEach((ep: any) => {
      const hlsStream = typeof ep.hls_1080 === "string"
        ? ep.hls_1080
        : (typeof ep.hls_720 === "string"
            ? ep.hls_720
            : ep.hls_480);

      const epNumber = String(ep.ordinal ?? ep.sort_order ?? 1);

      if (hlsStream) {
        const fullHlsUrl = hlsStream.startsWith("http")
          ? hlsStream
          : `https://anilibria.top${hlsStream}`;

        // Грузим все три качества для quality-меню, если они есть
        formattedEpisodes[epNumber] = {
          name: ep.name_english || `Серия ${epNumber}`,
          hlsUrl: fullHlsUrl,
        };
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
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
