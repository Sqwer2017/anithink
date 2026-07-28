"use client";

import { MonitorPlay, Film } from "lucide-react";
import { useState } from "react";

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

export function AnimePlayer({ shikimoriId, title }: AnimePlayerProps) {
  const [activeServer, setActiveServer] = useState(KODIK_MIRRORS[0].domain);

  const sid = shikimoriId ? String(shikimoriId) : "";

  // ── Рендер пустого состояния (нет Shikimori ID) ──
  if (!sid) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-black/50 text-center text-muted">
        <Film className="h-8 w-8 text-accent/50" />
        <p className="text-sm font-medium">Плеер недоступен для данного тайтла</p>
      </div>
    );
  }

  return (
    <section aria-label={`Плеер: ${title}`} className="w-full min-w-0">
      {/* ═══ ШАПКА И ПЕРЕКЛЮЧАТЕЛЬ СЕРВЕРОВ ═══ */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-sm font-bold">
          <MonitorPlay className="h-4 w-4 text-accent" />
          <span>Плеер</span>
        </div>

        {/* Переключатель зеркал (вынесен в единую панель) */}
        <div className="flex rounded-lg border border-border bg-surface p-1">
          {KODIK_MIRRORS.map((mirror) => (
            <button
              key={mirror.id}
              type="button"
              onClick={() => setActiveServer(mirror.domain)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeServer === mirror.domain
                  ? "bg-accent text-background shadow-neon-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {mirror.name}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ ОПТИМИЗИРОВАННЫЙ IFRAME KODIK ═══ */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-black shadow-cyber">
        <iframe
          key={activeServer} // Пересоздает iframe при смене зеркала
          src={`${activeServer}/?shikimoriID=${sid}`}
          title={title ? `Плеер: ${title}` : "Видео плеер"}
          className="absolute max-w-none border-0"
          style={{
            top: "-55px",
            left: "-20px",
            width: "calc(100% + 40px)",
            height: "calc(100% + 96px)",
          }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin"
          scrolling="no"
        />
      </div>

      <p className="mt-2 text-xs text-muted">
        Если плеер не грузится или выдаёт ошибку сети, переключите сервер выше.
      </p>
    </section>
  );
}

export default AnimePlayer;