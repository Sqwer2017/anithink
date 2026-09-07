import { notFound } from "next/navigation";
import { fetchAnimeById } from "@/lib/api/shikimori";
import { WatchParty } from "./watch-party";

export const revalidate = 0;

/**
 * Страница совместного просмотра (Watch Party): /watch/[id]?room=<roomId>
 * Серверный слой достаёт название аниме (для поиска AniLibria) и прокидывает
 * id комнаты из query. Сам плеер + комната живут в клиент-компоненте.
 */
export default async function WatchPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { room?: string };
}) {
  let title = "";
  try {
    const anime = await fetchAnimeById(params.id, 3600);
    title = anime?.russian || anime?.name || "";
  } catch {
    title = "";
  }
  if (!params.id) notFound();

  const roomId = typeof searchParams?.room === "string" ? searchParams.room : null;

  return (
    <div className="w-full">
      <WatchParty animeId={params.id} animeTitle={title || `аниме ${params.id}`} roomId={roomId} />
    </div>
  );
}
