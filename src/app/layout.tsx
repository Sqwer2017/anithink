import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LocatorProvider } from "@/components/providers/locator-provider";
import { Header } from "@/components/layout/header";
import { RightSidebar } from "@/components/layout/right-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ToastProvider } from "@/components/providers/toast-provider";
import Mascot from "@/components/Mascot";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AniThink — Cyberpunk Edition",
  description:
    "Современная киберпанк-платформа для просмотра аниме. Топы, онгоинги, жанры и персональные рекомендации на базе Shikimori API.",
  applicationName: "AniThink",
  authors: [{ name: "AniThink Team" }],
  keywords: ["anime", "аниме", "shikimori", "cyberpunk", "streaming", "anithink"],
};

export const viewport: Viewport = {
  themeColor: "#050a15",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Запрещаем браузеру отправлять Referer, чтобы CDN Shikimori не отдавал 403 Forbidden */}
        <meta name="referrer" content="no-referrer" />
        {/* pixi-live2d-display требует Cubism 2 runtime (live2d.min.js), иначе бросит
            "Could not find Cubism 2 runtime". Загружаем оба рантайма до инициализации:
            Cubism 2 → Live2D, Cubism 3+ → Live2DCubismCore. */}
        <Script
          src="https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"
          strategy="beforeInteractive"
        />
        {/* Live2D Cubism Core (Cubism 3+) — для моделей .moc3, включая Unity-chan */}
        <Script
          src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          {/* Безопасный клиентский Locator */}
          <LocatorProvider />
          <ToastProvider />

          <div className="cyber-background" aria-hidden="true" />
          <div className="relative z-10 flex h-screen w-full overflow-hidden bg-transparent text-foreground">
            <div className="flex min-w-0 flex-1 flex-col">
              <Header />
              <main className="flex-1 overflow-y-auto scrollbar-cyber pb-20 lg:pb-0">
                {children}
              </main>
            </div>

            <RightSidebar />
            <MobileNav />
          </div>

          {/* Интерактивный Live2D-маскот поверх всех страниц */}
          <Mascot />
        </ThemeProvider>
      </body>
    </html>
  );
}
