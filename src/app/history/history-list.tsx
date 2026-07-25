"use client";

import { History, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimeCard } from "@/components/anime/anime-card";
import { HISTORY_STORAGE_KEY } from "@/lib/local-playlists";
import type { Anime } from "@/lib/api/shikimori";

export function HistoryList() {
  const [anime, setAnime] = useState<Anime[] | null>(null);
  useEffect(() => { const ids: unknown = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]"); if (!Array.isArray(ids) || !ids.length) { setAnime([]); return; } void fetch(`/api/saved?ids=${ids.join(",")}`).then((response) => response.json()).then((items: Anime[]) => { const map = new Map(items.map((item) => [String(item.id), item])); setAnime(ids.map((id) => map.get(String(id))).filter((item): item is Anime => Boolean(item))); }).catch(() => setAnime([])); }, []);
  if (!anime) return <div className="mt-8 flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-accent" /></div>;
  if (!anime.length) return <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center"><History className="h-10 w-10 text-muted/40" /><p className="mt-3 text-sm text-muted">История пока пуста.</p></div>;
  return <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{anime.map((item, index) => <AnimeCard key={item.id} anime={item} index={index} />)}</div>;
}
