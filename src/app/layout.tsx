import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LocatorProvider } from "@/components/providers/locator-provider";
import { Header } from "@/components/layout/header";
import { RightSidebar } from "@/components/layout/right-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

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
      </head>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          {/* Безопасный клиентский Locator */}
          <LocatorProvider />

          <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
            <div className="flex min-w-0 flex-1 flex-col">
              <Header />
              <main className="flex-1 overflow-y-auto scrollbar-cyber pb-20 lg:pb-0">
                {children}
              </main>
            </div>

            <RightSidebar />
            <MobileNav />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}