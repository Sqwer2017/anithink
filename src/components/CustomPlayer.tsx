"use client";

import { useEffect, useRef, useState } from "react";
import Artplayer from "artplayer";
import Hls from "hls.js";
import { Loader2 } from "lucide-react";

interface Episode {
  name: string;
  hlsUrl: string;
}

interface CustomPlayerProps {
  /** Русское/англ. название для поиска в AniLiberty */
  title: string;
  /** Прямой alias (опционально, надёжнее названия) */
  alias?: string;
}

/** Достаёт hex-цвет акцента из CSS-переменной темы */
function getAccentColor(): string {
  if (typeof window === "undefined") return "#10b981";
  const value = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  // Значение вида "0 255 128" (три числа)
  const parts = value.split(/\s+/).map(Number);
  if (parts.length >= 3 && parts.every((n) => !Number.isNaN(n))) {
    return `#${parts.slice(0, 3).map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  }
  return "#10b981";
}

export default function CustomPlayer({ title, alias }: CustomPlayerProps) {
  const artContainerRef = useRef<HTMLDivElement>(null);
  const artInstanceRef = useRef<Artplayer | null>(null);

  const [animeTitle, setAnimeTitle] = useState("");
  const [episodes, setEpisodes] = useState<Record<string, Episode>>({});
  const [currentEpKey, setCurrentEpKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Загрузка данных аниме
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setEpisodes({});
    setCurrentEpKey("");

    const query = alias
      ? `alias=${encodeURIComponent(alias)}`
      : `title=${encodeURIComponent(title)}`;

    fetch(`/api/anilibria?${query}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        // API может вернуть { success: false } — это не ошибка, а "озвучка не найдена".
        if (data.success === false) {
          setError(null);
          setEpisodes({});
          setLoading(false);
          return;
        }
        if (data.error || !data.episodes) {
          throw new Error(data.error || "Не удалось загрузить серии");
        }
        setAnimeTitle(data.title);
        setEpisodes(data.episodes);
        const keys = Object.keys(data.episodes);
        if (keys.length > 0) setCurrentEpKey(keys[0]);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Ошибка загрузки");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [title, alias]);

  // 2. Инициализация и обновление ArtPlayer
  useEffect(() => {
    if (!artContainerRef.current || !currentEpKey || !episodes[currentEpKey]) return;
    const accent = getAccentColor();
    const streamUrl = episodes[currentEpKey].hlsUrl;

    if (artInstanceRef.current) {
      artInstanceRef.current.destroy(false);
    }

    artInstanceRef.current = new Artplayer({
      container: artContainerRef.current,
      url: streamUrl,
      type: "m3u8",
      customType: {
        m3u8: (video: HTMLVideoElement, url: string) => {
          if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
          }
        },
      },
      theme: accent,
      autoplay: false,
      fullscreen: true,
      fullscreenWeb: true,
      pip: true,
      setting: true,
      playbackRate: true,
      aspectRatio: true,
    });

    return () => {
      if (artInstanceRef.current) {
        artInstanceRef.current.destroy(false);
        artInstanceRef.current = null;
      }
    };
  }, [currentEpKey, episodes]);

  return (
    <div className="w-full space-y-3">
      {/* Рама плеера */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-black shadow-cyber">
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/90">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm text-muted">Загрузка потока AniLiberty…</p>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/95 p-6 text-center">
            <span className="text-3xl">⚠️</span>
            <p className="text-base font-semibold">Ошибка загрузки</p>
            <p className="max-w-sm text-xs text-muted">{error}</p>
          </div>
        )}

        {!loading && !error && Object.keys(episodes).length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/95 p-6 text-center">
            <span className="text-3xl">🔍</span>
            <p className="text-base font-semibold">Озвучки не найдено</p>
            <p className="max-w-sm text-xs text-muted">
              В AniLibria нет озвучки для этого тайтла. Попробуйте переключиться на Kodik.
            </p>
          </div>
        )}

        <div ref={artContainerRef} className="h-full w-full" />
      </div>

      {/* Название + список серий */}
      {!loading && !error && Object.keys(episodes).length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-panel">
          <h2 className="font-display text-lg font-bold text-foreground">
            {animeTitle || title}
          </h2>

          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Выбор серии
            </p>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto scrollbar-cyber">
              {Object.keys(episodes).map((key) => {
                const active = key === currentEpKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCurrentEpKey(key)}
                    className={`rounded-lg px-3 py-1.5 text-xs transition border ${
                      active
                        ? "border-accent bg-accent text-background font-bold shadow-neon-sm"
                        : "border-border bg-surface text-muted hover:border-accent/40 hover:text-foreground"
                    }`}
                  >
                    {episodes[key].name || `Серия ${key}`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
