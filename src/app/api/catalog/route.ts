import { NextRequest, NextResponse } from "next/server";
import { fetchAnimes, type AnimesQuery } from "@/lib/api/shikimori";

/**
 * Route Handler: GET /api/catalog?limit=24&order=ranked&kind=tv&genre=1
 *
 * Проксирует запрос к Shikimori API для клиентского каталога.
 * Используется CatalogClient для интерактивной фильтрации.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const query: AnimesQuery = {
    limit: parseInt(searchParams.get("limit") || "24", 10),
    page: parseInt(searchParams.get("page") || "1", 10),
    order: (searchParams.get("order") as AnimesQuery["order"]) || "ranked",
    kind: searchParams.get("kind") || undefined,
    genre: searchParams.get("genre") || undefined,
    season: searchParams.get("season") || undefined,
    score: searchParams.get("score")
      ? parseInt(searchParams.get("score")!, 10)
      : undefined,
    censored: "false",
  };

  // Меньший кэш для интерактивных запросов — 10 минут
  const animes = await fetchAnimes(query, 600);

  return NextResponse.json(animes);
}