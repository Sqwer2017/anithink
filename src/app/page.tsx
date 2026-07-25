import { Suspense } from "react";
import { Sparkles, Play, Flame, Radio, TrendingUp } from "lucide-react";
import Link from "next/link";
import { AnimeSection } from "@/components/anime/anime-section";
import { AnimeCardSkeleton } from "@/components/anime/anime-card";

/**
 * Главная страница (серверный компонент).
 * Загружает данные из Shikimori через ISR и рендерит:
 *  - Hero-блок
 *  - Топ-рейтинг (order=ranked)
 *  - Онгоинги (status=ongoing)
 *  - Сейчас популярно (order=popularity через random/сортировку)
 */
export default function HomePage() {
  return (
    <div className="relative mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface/60 p-6 shadow-panel md:p-12">
        {/* Неоновые свечения */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent/10 blur-[120px]"
        />
        {/* Декоративная сетка */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--border)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--border)) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Добро пожаловать в
          </span>

          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">
            Ani<span className="text-accent text-glow">Think</span>
          </h1>

          <p className="mt-4 max-w-xl text-base text-muted md:text-lg">
            Футуристичная-платформа для просмотра аниме. Топы, онгоинги, жанры
            и персональные рекомендации — всё в одном неоновом интерфейсе.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/catalog"
              className="group inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-background shadow-neon transition-transform hover:scale-[1.03]"
            >
              <Play className="h-4 w-4 fill-background" />
              Начать смотреть
            </Link>
            <Link
              href="/ongoing"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent/40 hover:text-accent"
            >
              <Radio className="h-4 w-4 text-accent" />
              Онгоинги
            </Link>
          </div>
        </div>
      </section>

      {/* Топ-рейтинг */}
      <Suspense
        fallback={
          <GridSkeleton title="Топ-рейтинг" icon={<TrendingUp className="h-6 w-6 text-accent" />} />
        }
      >
        <AnimeSection
          title="Топ-рейтинг"
          query={{ limit: 12, order: "ranked", censored: "false" }}
          seeAllHref="/top"
          icon={<TrendingUp className="h-6 w-6 text-accent" />}
        />
      </Suspense>

      {/* Онгоинги */}
      <Suspense
        fallback={
          <GridSkeleton title="Сейчас выходит" icon={<Radio className="h-6 w-6 text-accent" />} />
        }
      >
        <AnimeSection
          title="Сейчас выходит"
          query={{ limit: 12, status: "ongoing", order: "ranked", censored: "false" }}
          seeAllHref="/ongoing"
          icon={<Radio className="h-6 w-6 text-accent" />}
        />
      </Suspense>

      {/* Популярное */}
      <Suspense
        fallback={
          <GridSkeleton title="Популярное" icon={<Flame className="h-6 w-6 text-accent" />} />
        }
      >
        <AnimeSection
          title="Популярное"
          query={{ limit: 12, order: "name", censored: "false" }}
          seeAllHref="/catalog"
          icon={<Flame className="h-6 w-6 text-accent" />}
        />
      </Suspense>

      {/* Подсказка про тему */}
      <p className="mt-10 mb-4 text-center text-sm text-muted">
        💡 Кликни на аватар в правой панели, чтобы сменить{" "}
        <span className="text-accent">акцентный цвет</span> темы.
      </p>
    </div>
  );
}

/* Скелетон для секций во время загрузки */
function GridSkeleton({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold text-foreground md:text-2xl">
        {icon}
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <AnimeCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

