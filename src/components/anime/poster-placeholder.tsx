import { ImageOff } from "lucide-react";

export function PosterPlaceholder({ title, className, variant = "anime" }: { title?: string; className?: string; variant?: "anime" | "news" }) {
  const src = variant === "news" ? "/news-placeholder.png" : "/anime-placeholder.png";
  return <div className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className ?? ""}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={title || "Нет постера"} className="h-full w-full object-cover" />
    {title && <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-background/90 via-background/20 to-transparent p-3"><span className="flex items-center gap-1.5 text-[11px] font-medium text-muted"><ImageOff className="h-3 w-3" />{title.length > 40 ? `${title.slice(0, 40)}…` : title}</span></div>}
  </div>;
}
