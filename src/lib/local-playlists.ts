export interface LocalPlaylist {
  id: string;
  name: string;
  cover: string;
  animeIds: string[];
  createdAt: number;
}

export const PLAYLISTS_STORAGE_KEY = "anithink:playlists";
export const HISTORY_STORAGE_KEY = "anithink:history";

export function readPlaylists(): LocalPlaylist[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(PLAYLISTS_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? (value as LocalPlaylist[]) : [];
  } catch {
    return [];
  }
}

export function savePlaylists(playlists: LocalPlaylist[]) {
  window.localStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(playlists));
}
