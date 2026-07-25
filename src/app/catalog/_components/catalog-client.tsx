"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { AnimeCard, AnimeCardSkeleton } from "@/components/anime/anime-card";
import type { Anime } from "@/lib/api/shikimori";

const KINDS = [
  { value: "", label: "Все типы" },
  { value: "tv", label: "TV Сериал" },
  { value: "movie", label: "Фильм" },
  { value: "ova", label: "OVA" },
  { value: "ona", label: "ONA" },
  { value: "special", label: "Спешл" },
];

const ORDERS = [
  { value: "ranked", label: "По рейтингу" },
  { value: "popularity", label: "По популярности" },
  { value: "name", label: "По названию" },
  { value: "aired_on", label: "По дате выхода" },
  { value: "id_desc", label: "Новые" },
];

const LIMITS = [12, 24, 48];

/**
 * Клиентский каталог с фильтрами.
 * Загружает данные через /api/catalog (RSC proxy) или напрямую через fetch.
 * Используем прямые серверные запросы через отдельный endpoint.
 */
export function CatalogClient() {
  const searchParams = useSearchParams();
  const initialGenre = searchParams.get("genre") || "";

  const [animes, setAnimes] = useState<Anime[]>([]);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState("");
  const [order, setOrder] = useState("ranked");
  const [limit, setLimit] = useState(24);
  const [genre, setGenre] = useState(initialGenre);

  function load() {
    startTransition(async () => {
      const params = new URLSearchParams({ limit: String(limit), order, censored: "false" });
      if (kind) params.set("kind", kind);
      if (genre) params.set("genre", genre);
      try {
        const res = await fetch(`/api/catalog?${params}`);
        const data = await res.json();
        setAnimes(data);
      } catch {
        setAnimes([]);
      }
    });
  }

  // Автозагрузка при смене фильтров
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, order, limit, genre]);

  return (
    <div className="mt-6">
      {/* Фильтры */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface/50 p-4">
        <FilterSelect label="Тип" value={kind} onChange={setKind} options={KINDS} />
        <FilterSelect label="Сортировка" value={order} onChange={setOrder} options={ORDERS} />
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Кол-во</span>
          <div className="flex gap-1">
            {LIMITS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLimit(l)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  limit === l
                    ? "bg-accent/15 text-accent"
                    : "bg-surface-2/60 text-muted hover:text-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Жанр из URL — показывает активный жанр */}
        {genre && (
          <button
            type="button"
            onClick={() => setGenre("")}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
          >
            Жанр #{genre}
            <span className="text-xs opacity-70">✕</span>
          </button>
        )}
      </div>

      {/* Результаты */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {pending
          ? Array.from({ length: limit }).map((_, i) => <AnimeCardSkeleton key={i} />)
          : animes.map((a, i) => <AnimeCard key={a.id} anime={a} index={i} />)}
      </div>

      {!pending && animes.length === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface/40 py-12 text-sm text-muted">
          Ничего не найдено. Попробуйте изменить фильтры.
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-border bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}