import { PlaylistsClient } from "./playlists-client";

export default function PlaylistsPage() {
  return <main className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8"><h1 className="font-display text-3xl font-extrabold">Плейлисты</h1><p className="mt-2 text-sm text-muted">Ваши локальные подборки аниме.</p><PlaylistsClient /></main>;
}
