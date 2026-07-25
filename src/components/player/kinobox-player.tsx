"use client";

interface KinoBoxPlayerProps {
  shikimoriId: string | number;
  title: string;
}

/**
 * KinoBox is currently unavailable: its public script returns HTTP 404.
 * Kodik provides a compatible embedded player resolved directly by Shikimori ID.
 */
export function KinoBoxPlayer({ shikimoriId, title }: KinoBoxPlayerProps) {
  const playerUrl = new URL("https://kodik.ydns.eu/");
  playerUrl.searchParams.set("shikimoriID", String(shikimoriId));

  return (
    <section aria-label={`Плеер: ${title}`} className="w-full">
      <div className="aspect-video overflow-hidden rounded-2xl border border-border/60 bg-card shadow-cyber">
        <div className="h-full w-full">
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
