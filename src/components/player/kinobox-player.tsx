"use client";

import { useEffect, useRef, useState } from "react";

interface KinoBoxPlayerProps {
  shikimoriId: string | number;
  title: string;
}

/**
 * KinoBox is currently unavailable: its public script returns HTTP 404.
 * Kodik provides a compatible embedded player resolved directly by Shikimori ID.
 */
export function KinoBoxPlayer({ shikimoriId, title }: KinoBoxPlayerProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ width: 960, height: 540 });

  useEffect(() => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    const updateFrameSize = (width: number, height: number) => {
      const nextSize = { width: Math.round(width), height: Math.round(height) };

      if (nextSize.width > 0 && nextSize.height > 0) {
        setFrameSize((currentSize) =>
          currentSize.width === nextSize.width && currentSize.height === nextSize.height
            ? currentSize
            : nextSize,
        );
      }
    };

    const resizeObserver = new ResizeObserver(([entry]) => {
      updateFrameSize(entry.contentRect.width, entry.contentRect.height);
    });

    resizeObserver.observe(frame);
    updateFrameSize(frame.clientWidth, frame.clientHeight);

    return () => resizeObserver.disconnect();
  }, []);

  const playerUrl = new URL("https://kodik.ydns.eu/");
  playerUrl.searchParams.set("shikimoriID", String(shikimoriId));
  playerUrl.searchParams.set("width", String(frameSize.width));
  playerUrl.searchParams.set("height", String(frameSize.height));
  playerUrl.searchParams.set("noEmbed", "");

  return (
    <section aria-label={`Плеер: ${title}`} className="w-full">
      <div className="aspect-video overflow-hidden rounded-2xl border border-border/60 bg-card shadow-cyber">
        <div ref={frameRef} className="h-full w-full">
          <iframe
            src={playerUrl.toString()}
            title={`Плеер аниме «${title}»`}
            className="block h-full w-full border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="origin"
          />
        </div>
      </div>
    </section>
  );
}
