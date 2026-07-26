"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { PROFILE_NAV, LOGOUT_NAV } from "@/lib/navigation";
import {
  ACCENT_THEMES,
  useTheme,
  type ThemeAccent,
} from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";
import { readProfile, type LocalProfile } from "@/lib/local-profile";

const COLLAPSED_WIDTH = 76;
const EXPANDED_WIDTH = 264;

/**
 * Правый интерактивный сайдбар.
 *
 * Поведение:
 *  - По умолчанию свёрнут (76px) — только аватар + иконки.
 *  - Разворачивается по КЛИКУ на аватар (не по hover — стабильнее на тачпадах
 *    и нет багов с "пропадающим" состоянием). Повторный клик сворачивает.
 *  - В развёрнутом виде: ник/уровень, текст пунктов, бейджи, переключатель тем.
 *
 * Ширина сознательно уменьшена и отступы симметричны (px-3 / nav px-3),
 * чтобы не было визуальной асимметрии справа.
 *
 * На < lg этот компонент скрыт — там работает MobileNav drawer.
 */
export function RightSidebar() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  useEffect(() => { const syncProfile = () => setProfile(readProfile()); const syncNotifications = (event: Event) => setNotificationCount((event as CustomEvent<number>).detail); const clearNotifications = () => setNotificationCount(0); syncProfile(); window.addEventListener("anithink:profile-changed", syncProfile); window.addEventListener("anithink:notifications-changed", syncNotifications); window.addEventListener("anithink:notifications-read", clearNotifications); void fetch("/api/notifications").then((response) => response.json()).then((data) => { const dismissed: unknown = JSON.parse(window.localStorage.getItem("anithink:notifications-dismissed") ?? "[]"); const dismissedIds = new Set(Array.isArray(dismissed) ? dismissed : []); const items = [...data.news, ...data.ongoing].filter((item: { id: string }) => !dismissedIds.has(item.id)); const rawSeen = window.localStorage.getItem("anithink:notifications-seen"); const seen: unknown = JSON.parse(rawSeen ?? "[]"); if (rawSeen === null) { window.localStorage.setItem("anithink:notifications-seen", JSON.stringify(items.map((item: { id: string }) => item.id))); setNotificationCount(0); return; } const seenIds = new Set(Array.isArray(seen) ? seen : []); setNotificationCount(items.filter((item: { id: string }) => !seenIds.has(item.id)).length); }).catch(() => {}); return () => { window.removeEventListener("anithink:profile-changed", syncProfile); window.removeEventListener("anithink:notifications-changed", syncNotifications); window.removeEventListener("anithink:notifications-read", clearNotifications); }; }, []);

  return (
    <motion.aside
      animate={{ width: open ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className={cn(
        "relative z-20 hidden h-full shrink-0 flex-col border-l border-border bg-surface/60 backdrop-blur-xl lg:flex",
        "overflow-hidden",
      )}
      style={{ width: COLLAPSED_WIDTH }}
    >
      {/* Декоративная неоновая линия слева */}
      <span className="pointer-events-none absolute left-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-accent/40 to-transparent" />

      {/* Аватар — кликабельный тоггл */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Свернуть панель" : "Развернуть панель"}
        aria-expanded={open}
        className="group flex h-[72px] w-full items-center gap-3 border-b border-border px-3 text-left transition-colors hover:bg-surface-2/40"
      >
        <UserAvatar profile={profile} />

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="min-w-0 flex-1"
            >
              <p className="truncate text-sm font-semibold text-foreground">
                @{profile?.tag || "anithink_user"}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                  LVL 0
                </span>
                <span className="text-[11px] text-muted">Sensei</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Маленький индикатор-шеврон (подсказка, что аватар кликабелен) */}
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-all duration-300",
            open && "rotate-180 text-accent",
          )}
        />
      </button>

      {/* Список пунктов */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2 scrollbar-cyber">
        {PROFILE_NAV.map((item) => (
          <ProfileLink key={item.href} item={item} expanded={open} badge={item.href === "/notifications" && notificationCount ? String(notificationCount) : undefined} />
        ))}
      </nav>

      {/* Переключатель темы — только в развёрнутом состоянии */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="px-3 pb-3"
          >
            <ThemeSwitcher />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Выйти */}
      <div className="border-t border-border px-3 py-2">
        <ProfileLink item={LOGOUT_NAV} expanded={open} danger />
      </div>
    </motion.aside>
  );
}

/* ============================ Аватар ============================ */

function UserAvatar({ profile }: { profile: LocalProfile | null }) {
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full bg-accent-gradient text-xs font-bold text-background",
          "ring-2 ring-accent shadow-neon-sm transition-transform group-hover:scale-105",
        )}
      >
        {profile?.avatar ? <img src={profile.avatar} alt="" className="h-full w-full rounded-full object-cover" /> : (profile?.nickname || "AT").slice(0, 2).toUpperCase()}
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent shadow-neon-sm animate-pulse-glow" />
    </div>
  );
}

/* ========================= Пункт меню ========================= */

function ProfileLink({
  item,
  expanded,
  danger = false,
  badge,
}: {
  item: (typeof PROFILE_NAV)[number];
  expanded: boolean;
  danger?: boolean;
  badge?: string;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.label}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        danger
          ? "text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
          : "text-muted hover:bg-surface-2/60 hover:text-foreground",
      )}
    >
      <span className="relative shrink-0">
        <Icon className="h-[18px] w-[18px] transition-transform group-hover:scale-110" />
        {/* Бейдж в свёрнутом состоянии */}
        {(badge || item.badge) && (
          <span
            className={cn(
              "absolute -right-2 -top-2 flex min-w-[15px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-background shadow-neon-sm",
              expanded && "hidden",
            )}
          >
            {badge || item.badge}
          </span>
        )}
      </span>

      <AnimatePresence>
        {expanded && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.18 }}
            className="flex flex-1 items-center justify-between"
          >
            <span className="truncate">{item.label}</span>
            {(badge || item.badge) && (
              <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                {badge || item.badge}
              </span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

/* ====================== Переключатель тем ===================== */

function ThemeSwitcher() {
  const { accent, setAccent } = useTheme();

  return (
    <div className="rounded-xl border border-border bg-surface-2/60 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
        Тема акцента
      </p>
      <div className="flex items-center justify-between gap-2">
        {ACCENT_THEMES.map((t) => {
          const active = accent === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setAccent(t.id as ThemeAccent)}
              title={t.label}
              aria-label={`Тема: ${t.label}`}
              aria-pressed={active}
              className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110",
                active && "scale-110",
              )}
              style={{
                backgroundColor: t.id === "custom" ? "rgb(var(--accent))" : t.color,
                boxShadow: active
                  ? `0 0 0 2px var(--bg-panel), 0 0 0 4px ${t.id === "custom" ? "rgb(var(--accent))" : t.color}, 0 0 14px ${t.id === "custom" ? "rgb(var(--accent))" : t.color}`
                  : `0 0 0 1px rgba(255,255,255,0.1)`,
              }}
            >
              {active && (
                <motion.span
                  layoutId="theme-active-dot"
                  className="h-2 w-2 rounded-full bg-white"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
