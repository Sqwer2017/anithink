import { NextRequest, NextResponse } from "next/server";
import { fetchAnimeById } from "@/lib/api/shikimori";

const MAX_SAVED_ANIME = 50;

export async function GET(request: NextRequest) {
  const rawIds = request.nextUrl.searchParams.get("ids") ?? "";
  const ids = [...new Set(rawIds.split(",").filter((id) => /^\d+$/.test(id)))].slice(
    0,
    MAX_SAVED_ANIME,
  );

  if (ids.length === 0) {
    return NextResponse.json([]);
  }

  const animes = await Promise.all(ids.map((id) => fetchAnimeById(id, 3600)));
  return NextResponse.json(animes.filter((anime) => anime !== null));
}
