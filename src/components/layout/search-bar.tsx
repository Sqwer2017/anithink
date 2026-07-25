"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, CommandIcon, Star, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  name: string;
  russian: string | null;
  year: number | null;
  kind: string | null;
  score: string | null;
  image: string | null;
}

/**
 * Живая строка поиска с dropdown результатами.
 *
 * - Вводит пользователь → дебаунс 300мс → запрос /api/search?q=...
 * - Показывает dropdown с постером, названием, годом, оценкой
 * - Enter или клик → переход на /anime/[id]
 * - ⌘K / Ctrl+K → фокус на инпут
 * - Esc → закрыть dropdown
 */
export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMac, setIsMac] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Определяем платформу для hotkey-подсказки
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  // ⌘K / Ctrl+K → фокус на поиск
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Закрытие dropdown по клику вне
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Дебаунс-поиск
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data);
        setActiveIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function openResult(id: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/anime/${id}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) {
      if (e.key === "Enter" && results.length > 0) {
        openResult(results[0].id);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      openResult(results[activeIndex].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative ml-auto w-full max-w-xl">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-muted" />

      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Поиск аниме, манги, персонажей..."
        className="w-full rounded-xl border border-border bg-background/70 py-2.5 pl-11 pr-16 text-sm text-foreground placeholder:text-muted outline-none transition-all duration-300 focus:border-accent/60 focus:bg-background focus:shadow-[0_0_0_4px_rgb(var(--accent)/0.08),0_0_20px_rgb(var(--accent-glow)/0.25)]"
      />

      {/* Кнопка очистки */}
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setResults([]);
            inputRef.current?.focus();
          }}
          className="absolute right-12 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted transition-colors hover:text-foreground"
          aria-label="Очистить"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Hotkey hint */}
      {!query && (
        <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted sm:flex">
          {isMac ? (
            <CommandIcon className="h-3 w-3" />
          ) : (
            <span className="text-[10px] font-bold">Ctrl</span>
          )}
          <span>K</span>
        </kbd>
      )}

      {/* Dropdown с результатами */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-panel backdrop-blur-xl">
          {/* Состояние загрузки */}
          {loading && (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              Ищем...
            </div>
          )}

          {/* Нет результатов */}
          {!loading && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted">
              Ничего не найдено по запросу «{query}»
            </div>
          )}

          {/* Список результатов */}
          {!loading && results.length > 0 && (
            <ul className="max-h-[60vh] overflow-y-auto scrollbar-cyber py-1.5">
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => openResult(r.id)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                      i === activeIndex ? "bg-accent/10" : "hover:bg-surface-2/60",
                    )}
                  >
                    {/* Постер */}
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-surface-2">
                      {r.image && (
                        <Image
                          src={`https://shikimori.one${r.image}`}
                          alt={r.russian || r.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized
                        />
                      )}
                    </div>

                    {/* Текст */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          i === activeIndex ? "text-accent" : "text-foreground",
                        )}
                      >
                        {r.russian || r.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        {r.kind && (
                          <span className="uppercase">{r.kind}</span>
                        )}
                        {r.year && <span>{r.year}</span>}
                        {r.score && parseFloat(r.score) > 0 && (
                          <span className="flex items-center gap-0.5 text-accent">
                            <Star className="h-3 w-3 fill-accent" />
                            {parseFloat(r.score).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Подвал dropdown */}
          {!loading && results.length > 0 && (
            <div className="border-t border-border px-3 py-2 text-[11px] text-muted">
              <kbd className="rounded border border-border bg-surface-2 px-1">↵</kbd>{" "}
              открыть ·{" "}
              <kbd className="rounded border border-border bg-surface-2 px-1">↑↓</kbd>{" "}
              навигация ·{" "}
              <kbd className="rounded border border-border bg-surface-2 px-1">Esc</kbd>{" "}
              закрыть
            </div>
          )}
        </div>
      )}
    </div>
  );
}
