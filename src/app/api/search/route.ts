import { NextRequest, NextResponse } from "next/server";
import { fetchAnimes, type AnimesQuery } from "@/lib/api/shikimori";

/**
 * Route Handler: GET /api/search?q=...
 *
 * Живой поиск аниме по названию через Shikimori API.
 * Используется выпадающей строкой поиска в хедере.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const query: AnimesQuery = {
    limit: 8,
    order: "ranked",
    search: q,
    censored: "false",
  };

  // Короткий кэш для быстрых повторных запросов
  const animes = await fetchAnimes(query, 120);

  // Возвращаем минимум полей — для dropdown
  const results = animes.map((a) => ({
    id: a.id,
    name: a.name,
    russian: a.russian,
    year: a.aired_on ? new Date(a.aired_on).getFullYear() : null,
    kind: a.kind,
    score: a.score,
    image: a.image?.original || null,
  }));

  return NextResponse.json(results);
}
