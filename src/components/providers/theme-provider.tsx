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

export type ThemeAccent = "green" | "blue" | "violet" | "red";

interface ThemeContextValue {
  accent: ThemeAccent;
  setAccent: (t: ThemeAccent) => void;
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
  }, [accent]);

  const setAccent = useCallback((t: ThemeAccent) => {
    setAccentState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ accent, setAccent }),
    [accent, setAccent],
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
];
