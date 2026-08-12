"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { MAIN_NAV } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { SearchBar } from "./search-bar";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="relative z-30 flex h-auto flex-col gap-3 border-b border-border bg-surface/40 px-4 py-3 backdrop-blur-xl md:px-6">
      {/* Верхняя строка: лого + поиск */}
      <div className="flex items-center gap-4">
        {/* Лого */}
        <Link
          href="/"
          className="group flex shrink-0 items-center font-display text-xl font-extrabold tracking-tight md:text-2xl"
        >
          <span className="text-foreground">Ani</span>
          <span className="text-accent text-glow transition-transform group-hover:scale-110">
            Think
          </span>
        </Link>

        {/* Живой поиск с dropdown */}
        <SearchBar />
      </div>

      {/* Горизонтальная навигация-пилюли (десктоп/планшет) */}
      {/* py-1.5 / px-2 — чтобы неоновая тень активной кнопки НЕ резалась
          (overflow-x-auto режет тень первой/последней кнопки по горизонтали) */}
      <nav className="scrollbar-none flex items-center gap-1 overflow-x-auto py-1.5 px-2">
        {MAIN_NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "text-accent"
                  : "text-muted hover:bg-surface-2/60 hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="header-nav-active"
                  className="absolute inset-0 -z-10 rounded-lg bg-accent/10 shadow-neon-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
