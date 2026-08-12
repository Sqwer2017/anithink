import type { Config } from "tailwindcss";

/**
 * Конфигурация Tailwind для ANIME X.
 * Все цвета завязаны на CSS-переменные из globals.css,
 * что позволяет динамически менять акцентную тему
 * (Material You стиль) простым переключением класса на <html>.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Фоны (статичные киберпанк-темные)
        background: "rgb(var(--bg-main) / <alpha-value>)",
        card: "rgb(var(--bg-panel) / <alpha-value>)",
        surface: "rgb(var(--bg-panel) / <alpha-value>)",
        "surface-2": "rgb(var(--bg-panel-2) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        // Текст
        foreground: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--fg-muted) / <alpha-value>)",
        // Акцент — меняется через тему ([data-theme])
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-soft": "rgb(var(--accent-soft) / <alpha-value>)",
        "accent-glow": "rgb(var(--accent-glow) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        // Компактные неоновые тени: меньше blur, чтобы не обрезались overflow-hidden
        // и выглядели мягким равномерным свечением (0 0 12-15px).
        neon: "0 0 12px rgb(var(--accent-glow) / 0.5), 0 0 3px rgb(var(--accent-glow) / 0.6)",
        "neon-sm":
          "0 0 9px rgb(var(--accent-glow) / 0.4), inset 0 0 0 1px rgb(var(--accent) / 0.4)",
        panel: "0 8px 40px rgba(0,0,0,0.55)",
        cyber:
          "0 0 0 1px rgb(var(--accent) / 0.16), 0 12px 36px rgba(0, 0, 0, 0.55), 0 0 18px rgb(var(--accent-glow) / 0.12)",
      },
      backgroundImage: {
        "grid-cyber":
          "linear-gradient(rgb(var(--border) / 0.25) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--border) / 0.25) 1px, transparent 1px)",
        "accent-gradient":
          "linear-gradient(135deg, rgb(var(--accent) / 0.9), rgb(var(--accent-glow) / 0.6))",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
        "fade-in": "fade-in 0.4s ease-out both",
        shimmer: "shimmer 2s infinite",
      },
      transitionTimingFunction: {
        cyber: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
