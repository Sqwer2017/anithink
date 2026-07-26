"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeAccent = "green" | "blue" | "violet" | "red" | "custom";

interface ThemeContextValue {
  accent: ThemeAccent;
  setAccent: (t: ThemeAccent) => void;
  setCustomAccent: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "animex-accent";

/**
 * Управляет акцентным цветом сайта через атрибут [data-theme] на <html>.
 * Сохраняет выбор в localStorage.
 *
 * Tailwind читает rgb(var(--accent)) — поэтому смена атрибута мгновенно
 * перекрашивает весь UI (Material You стиль).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<ThemeAccent>("green");

  // Гидратация из localStorage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(
        STORAGE_KEY,
      ) as ThemeAccent | null;
      if (saved) setAccentState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  // Применяем тему к <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", accent);
    if (accent === "custom") {
      const color = window.localStorage.getItem("anithink:custom-accent") || "#b000ff";
      const hex = color.replace("#", "");
      if (/^[0-9a-fA-F]{6}$/.test(hex)) { const rgb = `${parseInt(hex.slice(0, 2), 16)} ${parseInt(hex.slice(2, 4), 16)} ${parseInt(hex.slice(4, 6), 16)}`; document.documentElement.style.setProperty("--accent", rgb); document.documentElement.style.setProperty("--accent-soft", rgb); document.documentElement.style.setProperty("--accent-glow", rgb); }
    } else { document.documentElement.style.removeProperty("--accent"); document.documentElement.style.removeProperty("--accent-soft"); document.documentElement.style.removeProperty("--accent-glow"); }
  }, [accent]);

  const setAccent = useCallback((t: ThemeAccent) => {
    setAccentState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const setCustomAccent = useCallback((color: string) => { window.localStorage.setItem("anithink:custom-accent", color); setAccentState("custom"); window.localStorage.setItem(STORAGE_KEY, "custom"); const hex = color.replace("#", ""); if (/^[0-9a-fA-F]{6}$/.test(hex)) { const rgb = `${parseInt(hex.slice(0, 2), 16)} ${parseInt(hex.slice(2, 4), 16)} ${parseInt(hex.slice(4, 6), 16)}`; document.documentElement.style.setProperty("--accent", rgb); document.documentElement.style.setProperty("--accent-soft", rgb); document.documentElement.style.setProperty("--accent-glow", rgb); } }, []);

  const value = useMemo(
    () => ({ accent, setAccent, setCustomAccent }),
    [accent, setAccent, setCustomAccent],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme должен использоваться внутри ThemeProvider");
  return ctx;
}

/** Визуальные метаданные для переключателя тем */
export const ACCENT_THEMES: {
  id: ThemeAccent;
  label: string;
  color: string;
}[] = [
  { id: "green", label: "Neon", color: "#c7ff00" },
  { id: "blue", label: "Ice", color: "#00e5ff" },
  { id: "violet", label: "Vapor", color: "#b000ff" },
  { id: "red", label: "Blood", color: "#ff2a2a" },
  { id: "custom", label: "Custom", color: "#b000ff" },
];
