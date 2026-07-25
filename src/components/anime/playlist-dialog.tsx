"use client";

import { Camera, Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { createLocalId, readPlaylists, savePlaylists, type LocalPlaylist } from "@/lib/local-playlists";

export function PlaylistDialog({ animeId, onClose }: { animeId: string; onClose: () => void }) {
  const [playlists, setPlaylists] = useState<LocalPlaylist[]>(readPlaylists);
  const [name, setName] = useState("");
  const [cover, setCover] = useState("");

  const update = (next: LocalPlaylist[]) => {
    savePlaylists(next);
    setPlaylists(next);
  };

  const createPlaylist = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const playlist: LocalPlaylist = {
      id: createLocalId(), name: trimmedName, cover: cover.trim(), animeIds: [animeId], createdAt: Date.now(),
    };
    update([playlist, ...playlists]);
    setName("");
    setCover("");
  };

  const uploadCover = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCover(String(reader.result));
    reader.readAsDataURL(file);
  };

  const toggleAnime = (playlistId: string) => update(playlists.map((playlist) => {
    if (playlist.id !== playlistId) return playlist;
    const exists = playlist.animeIds.includes(animeId);
    return { ...playlist, animeIds: exists ? playlist.animeIds.filter((id) => id !== animeId) : [...playlist.animeIds, animeId] };
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Плейлисты">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-panel">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Добавить в плейлист</h2><button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-foreground" aria-label="Закрыть"><X /></button></div>
        <div className="mt-4 max-h-52 space-y-2 overflow-y-auto pr-1">
          {playlists.length === 0 ? <p className="text-sm text-muted">Создайте первый плейлист ниже.</p> : playlists.map((playlist) => {
            const selected = playlist.animeIds.includes(animeId);
            return <button key={playlist.id} type="button" onClick={() => toggleAnime(playlist.id)} className="flex w-full items-center justify-between rounded-xl border border-border bg-surface p-3 text-left hover:border-accent/60"><span><span className="block font-semibold">{playlist.name}</span><span className="text-xs text-muted">{playlist.animeIds.length} аниме</span></span>{selected && <Check className="text-accent" />}</button>;
          })}
        </div>
        <div className="mt-5 border-t border-border pt-4"><p className="text-sm font-semibold">Новый плейлист</p><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Название" className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent" /><input value={cover} onChange={(event) => setCover(event.target.value)} placeholder="Ссылка на обложку (необязательно)" className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent" /><label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground"><Camera className="h-4 w-4" />Загрузить обложку<input type="file" accept="image/*" className="hidden" onChange={(event) => uploadCover(event.target.files?.[0])} /></label><button type="button" onClick={createPlaylist} disabled={!name.trim()} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-bold text-background disabled:opacity-40"><Plus className="h-4 w-4" />Создать и добавить</button></div>
      </div>
    </div>
  );
}
