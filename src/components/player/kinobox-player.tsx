"use client";

import { AlertTriangle, MonitorPlay } from "lucide-react";
import { useEffect, useId, useState } from "react";

interface KinoBoxPlayerProps { shikimoriId: string | number; title: string; }
declare global { interface Window { Kinobox?: new (selector: string, options: unknown) => { init: () => void }; } }

function KinoboxEmbed({ title }: { title: string }) {
  const id = `kinobox-${useId().replace(/:/g, "")}`;
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let alive = true;
    const init = () => { if (alive && window.Kinobox) new window.Kinobox(`#${id}`, { search: { title } }).init(); };
    const ready = document.querySelector<HTMLScriptElement>('script[data-kinobox-sdk="true"]');
    if (ready) { ready.addEventListener("load", init); ready.addEventListener("error", () => setUnavailable(true)); init(); return () => { alive = false; ready.removeEventListener("load", init); }; }
    const script = document.createElement("script"); script.src = "https://kinobox.tv/kinobox.min.js"; script.async = true; script.dataset.kinoboxSdk = "true"; script.onload = init; script.onerror = () => setUnavailable(true); document.body.appendChild(script);
    const timeout = window.setTimeout(() => { if (!window.Kinobox) setUnavailable(true); }, 7000);
    return () => { alive = false; script.onload = null; window.clearTimeout(timeout); };
  }, [id, title]);
  return unavailable ? <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-300"><AlertTriangle className="h-6 w-6" /></span><div><p className="font-semibold">KinoBox временно недоступен</p><p className="mt-1 max-w-sm text-xs text-muted">Сервис не отдаёт свой SDK. Переключитесь на Kodik — ваш сайт и данные при этом не затронуты.</p></div></div> : <div id={id} className="h-full w-full [&_.kinobox__wrapper]:!h-full [&_.kinobox__wrapper]:!max-h-none" />;
}

export function KinoBoxPlayer({ shikimoriId, title }: KinoBoxPlayerProps) {
  const [player, setPlayer] = useState<"kodik" | "kinobox">("kodik");
  return <section aria-label={`Плеер: ${title}`} className="w-full min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1"><div className="flex items-center gap-2 text-sm font-bold"><MonitorPlay className="h-4 w-4 text-accent" />Плеер: {player === "kodik" ? "Kodik" : "KinoBox"}</div><div className="flex rounded-lg border border-border bg-surface p-1">{(["kodik", "kinobox"] as const).map((item) => <button key={item} type="button" onClick={() => setPlayer(item)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${player === item ? "bg-accent text-background shadow-neon-sm" : "text-muted hover:text-foreground"}`}>{item === "kodik" ? "Kodik" : "KinoBox"}</button>)}</div></div>
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-black shadow-cyber">{player === "kodik" ? <iframe src={`https://kodik.ydns.eu/?shikimoriID=${shikimoriId}`} title={`Плеер Kodik: ${title}`} className="absolute -left-[5%] -top-[9%] h-[118%] w-[110%] border-0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="origin" /> : <KinoboxEmbed title={title} />}</div>
    <p className="mt-2 text-xs text-muted">Если плеер не работает или загрузился некорректно, попробуйте переключиться на другой.</p>
  </section>;
}
