"use client";

import { AlertTriangle, MonitorPlay } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Script from "next/script";

interface KinoBoxPlayerProps { shikimoriId: string | number; title: string; }

/**
 * Встроенный плеер KinoBox.
 *
 * Исправление: Kinobox SDK выставляет window.kbox (не window.Kinobox!).
 * См. src/types/global.d.ts.
 * Загружаем SDK через <Script next/script> с afterInteractive,
 * таймаут 5 секунд, после которого — fallback-заглушка.
 */
function KinoboxEmbed({ shikimoriId }: { shikimoriId: string }) {
  const id = useId().replace(/:/g, "");
  const containerId = `kinobox-${id}`;
  const loadedRef = useRef(false);
  const [unavailable, setUnavailable] = useState(false);

  const onLoad = useCallback(() => {
    loadedRef.current = true;
    if (typeof window.kbox === "function") {
      window.kbox(`#${containerId}`, {
        search: { shikimori: shikimoriId },
        players: {
          alloha: { enable: true, position: 0 },
          kodik: { enable: true, position: 1 },
          collaps: { enable: true, position: 2 },
        },
      });
    }
  }, [containerId, shikimoriId]);

  useEffect(() => {
    // Таймаут: если SDK не загрузился за 5000ms — показываем заглушку.
    const timeout = window.setTimeout(() => {
      if (!loadedRef.current) {
        setUnavailable(true);
      }
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, []);

  if (unavailable) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <div>
          <p className="font-semibold">KinoBox временно недоступен</p>
          <p className="mt-1 max-w-sm text-xs text-muted">
            Сервис не отдаёт свой SDK. Переключитесь на Kodik — ваш сайт и данные при этом не затронуты.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://kinobox.tv/kinobox.min.js"
        strategy="afterInteractive"
        onLoad={onLoad}
      />
      <div id={containerId} className="h-full w-full [&_.kinobox__wrapper]:!h-full [&_.kinobox__wrapper]:!max-h-none" />
    </>
  );
}

export function KinoBoxPlayer({ shikimoriId, title }: KinoBoxPlayerProps) {
  const [player, setPlayer] = useState<"kodik" | "kinobox">("kodik");
  const sid = String(shikimoriId);

  return (
    <section aria-label={`Плеер: ${title}`} className="w-full min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-sm font-bold">
          <MonitorPlay className="h-4 w-4 text-accent" />
          Плеер: {player === "kodik" ? "Kodik" : "KinoBox"}
        </div>
        <div className="flex rounded-lg border border-border bg-surface p-1">
          {(["kodik", "kinobox"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPlayer(item)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                player === item
                  ? "bg-accent text-background shadow-neon-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {item === "kodik" ? "Kodik" : "KinoBox"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-black shadow-cyber">
        {player === "kodik" ? (
          <iframe
            src={`https://kodik.ydns.eu/?shikimoriID=${sid}`}
            title={`Плеер Kodik: ${title}`}
            className="absolute -left-[3%] -top-[6%] h-[112%] w-[106%] border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="origin"
          />
        ) : (
          <KinoboxEmbed shikimoriId={sid} />
        )}
      </div>

      <p className="mt-2 text-xs text-muted">
        Если плеер не работает или загрузился некорректно, попробуйте переключиться на другой.
      </p>
    </section>
  );
}
