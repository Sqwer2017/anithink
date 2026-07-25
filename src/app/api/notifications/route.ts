import { NextResponse } from "next/server";
import { fetchAnimes, fetchTopics } from "@/lib/api/shikimori";

export async function GET() {
  const [news, ongoing] = await Promise.all([
    fetchTopics({ forum: "news", limit: 12 }, 300),
    fetchAnimes({ status: "ongoing", order: "aired_on", limit: 8 }, 300),
  ]);
  return NextResponse.json({ news: news.map(({ id, topic_title, title, created_at }) => ({ id: `news-${id}`, title: topic_title || title || "Новая новость", createdAt: created_at, href: `/news/${id}`, kind: "news" })), ongoing: ongoing.map(({ id, russian, name, episodes_aired }) => ({ id: `anime-${id}-${episodes_aired ?? 0}`, title: `${russian || name}: доступен новый эпизод`, href: `/anime/${id}`, kind: "episode" })) });
}
