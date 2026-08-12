export interface LocalSettings { effects: boolean; compactGrid: boolean; hideWatchTime: boolean; privateLists: boolean; releaseNotifications: boolean; customColor: string; mascotEnabled: boolean; }
export const SETTINGS_STORAGE_KEY = "anithink:settings";
export const DEFAULT_SETTINGS: LocalSettings = { effects: true, compactGrid: false, hideWatchTime: false, privateLists: false, releaseNotifications: false, customColor: "#b000ff", mascotEnabled: true };
export function readSettings(): LocalSettings { try { const value = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "{}"); return { ...DEFAULT_SETTINGS, ...(value && typeof value === "object" ? value : {}) }; } catch { return DEFAULT_SETTINGS; } }
export function saveSettings(value: LocalSettings) { window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value)); window.dispatchEvent(new Event("anithink:settings-changed")); }
