export type ProfilePrivacy = "public" | "friends" | "close_friends" | "private";

export interface LocalProfile { nickname: string; tag: string; avatar: string; cover: string; bio: string; isSavedPrivate: boolean; characterIds: string[]; telegram: string; discord: string; steam: string; favoritesPrivacy: ProfilePrivacy; completedPrivacy: ProfilePrivacy; historyPrivacy: ProfilePrivacy; }
export const PROFILE_STORAGE_KEY = "anithink:profile";
export const DEFAULT_PROFILE: LocalProfile = { nickname: "AniThink User", tag: "anithink_user", avatar: "", cover: "", bio: "", isSavedPrivate: false, characterIds: ["80", "40", "4224"], telegram: "", discord: "", steam: "", favoritesPrivacy: "public", completedPrivacy: "public", historyPrivacy: "public" };
export function readProfile(): LocalProfile { try { const value: unknown = JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) ?? "{}"); return { ...DEFAULT_PROFILE, ...(value && typeof value === "object" ? value : {}) }; } catch { return DEFAULT_PROFILE; } }
export function saveProfile(profile: LocalProfile) { window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile)); window.dispatchEvent(new Event("anithink:profile-changed")); }
