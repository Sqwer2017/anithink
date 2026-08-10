"use client";

import { MonitorPlay, Film } from "lucide-react";
import { useState } from "react";
import CustomPlayer from "@/components/CustomPlayer";

interface AnimePlayerProps {
  shikimoriId?: string | number | null;
  title: string;
}

// ─── Актуальные зеркала Kodik ───
const KODIK_MIRRORS = [
  { id: "s1", name: "Сервер 1", domain: "https://kodik.ydns.eu" },
  { id: "s2", name: "Сервер 2", domain: "https://kodik.biz" },
  { id: "s3", name: "Сервер 3", domain: "https://kodik.info" },
];

type PlayerMode = "kodik" | "anilibria";

export function AnimePlayer({ shikimoriId, title }: AnimePlayerProps) {
  const [mode, setMode] = useState<PlayerMode>("kodik");
  const [activeServer, setActiveServer] = useState(KODIK_MIRRORS[0].domain);

  const sid = shikimoriId ? String(shikimoriId) : "";

  // ── Рендер пустого состояния (нет Shikimori ID и заголовка) ──
  if (!sid && !title) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-black/50 text-center text-muted">
        <Film className="h-8 w-8 text-accent/50" />
        <p className="text-sm font-medium">Плеер недоступен для данного тайтла</p>
      </div>
    );
  }

  return (
    <section aria-label={`Плеер: ${title}`} className="w-full min-w-0">
      {/* ═══ ШАПКА И ПЕРЕКЛЮЧАТЕЛЬ ИСТОЧНИКОВ ═══ */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-sm font-bold">
          <MonitorPlay className="h-4 w-4 text-accent" />
          <span>Плеер: {mode === "kodik" ? "Kodik" : "AniLibria"}</span>
        </div>

        {/* Переключатель Kodik / AniLibria */}
        <div className="flex rounded-lg border border-border bg-surface p-1">
          {(["kodik", "anilibria"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                mode === item
                  ? "bg-accent text-background shadow-neon-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {item === "kodik" ? "Kodik" : "AniLibria"}
            </button>
          ))}
        </div>
      </div>

      {/*
        ════════════ Режим A: Kodik (iframe) ════════════
      */}
      {mode === "kodik" ? (
        <>
          {/* Выбор зеркала */}
          <div className="mb-2 flex gap-1.5 px-1">
            {KODIK_MIRRORS.map((mirror) => (
              <button
                key={mirror.id}
                type="button"
                onClick={() => setActiveServer(mirror.domain)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                  activeServer === mirror.domain
                    ? "text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {mirror.name}
              </button>
            ))}
          </div>

          {sid ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-black shadow-cyber">
              <iframe
                key={activeServer} // Пересоздает iframe при смене зеркала
                src={`${activeServer}/?shikimoriID=${sid}`}
                title={title ? `Плеер: ${title}` : "Видео плеер"}
                // Мобил: оверсайз поменьше; ПК (sm+): полный, скрывает чёрные полосы Kodik.
                className="absolute m-0 border-0 max-w-none top-[-40px] left-[-20px] h-[calc(100%+38px)] w-[calc(100%+40px)] sm:top-[-55px] sm:left-[-23px] sm:h-[calc(100%+96px)] sm:w-[calc(100%+46px)]"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="origin"
                scrolling="no"
              />
            </div>
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-black/50 text-center text-muted">
              <Film className="h-8 w-8 text-accent/50" />
              <p className="text-sm font-medium">
                Нет Shikimori ID для Kodik. Переключитесь на AniLibria.
              </p>
            </div>
          )}
        </>
      ) : (
        /*
          ════════════ Режим B: AniLibria (ArtPlayer + HLS) ════════════
        */
        <CustomPlayer title={title} />
      )}
    </section>
  );
}

export default AnimePlayer;
