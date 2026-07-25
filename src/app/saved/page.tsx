import { SavedAnimeList } from "./saved-anime-list";

export const metadata = {
  title: "Сохранёнки | AniThink",
};

export default function SavedPage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-medium text-accent">Ваша библиотека</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          Сохранёнки
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Избранные аниме и тайтлы, добавленные в плейлист «Буду смотреть».
        </p>
      </div>

      <SavedAnimeList />
    </main>
  );
}
