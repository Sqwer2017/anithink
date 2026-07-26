"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { MAIN_NAV, PROFILE_NAV, LOGOUT_NAV } from "@/lib/navigation";
import { ACCENT_THEMES, useTheme, type ThemeAccent } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";
import { readProfile, type LocalProfile } from "@/lib/local-profile";

/**
 * Мобильная навигация.
 *
 *  - Нижняя fixed панель с 5 главными пунктами (Главная/Топ/Каталог/Онгоинги/Ещё).
 *  - Кнопка «Ещё» открывает полный drawer, в котором лежит весь правый
 *    сайдбар (профиль, темы, пункты) + полный список навигации.
 *
 *  Видна только на < lg. На десктопе вместо неё статичные сайдбары.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<LocalProfile | null>(null);

  useEffect(() => {
    const syncProfile = () => setProfile(readProfile());
    syncProfile();
    window.addEventListener("anithink:profile-changed", syncProfile);
    return () => window.removeEventListener("anithink:profile-changed", syncProfile);
  }, []);

  // 5 пунктов в нижней панели; «Ещё» открывает drawer
  const quickNav = [
    MAIN_NAV[0], // Главная
    MAIN_NAV[1], // Топ 10
    MAIN_NAV[3], // Каталог
    MAIN_NAV[4], // Онгоинги
  ];

  return (
    <>
      {/* Bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-surface/90 backdrop-blur-xl lg:hidden">
        {quickNav.map((item) => {
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
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                active ? "text-accent" : "text-muted",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  active && "drop-shadow-[0_0_8px_rgb(var(--accent-glow)/0.8)]",
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Кнопка «Ещё» -> drawer */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted"
        >
          <Menu className="h-5 w-5" />
          <span>Ещё</span>
        </button>
      </nav>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 right-0 z-50 flex w-[300px] max-w-[85vw] flex-col border-l border-border bg-surface shadow-panel lg:hidden"
            >
              {/* Header drawer */}
              <div className="flex items-center justify-between border-b border-border px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-accent-gradient font-bold text-background ring-2 ring-accent shadow-neon-sm">
                    {profile?.avatar ? <img src={profile.avatar} alt="" className="h-full w-full object-cover" /> : (profile?.nickname || "AT").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">@{profile?.tag || "anithink_user"}</p>
                    <p className="text-[11px] text-muted">LVL 0 · Sensei</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-foreground"
                  aria-label="Закрыть"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Содержимое */}
              <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-cyber">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Навигация
                </p>
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
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                        active
                          ? "bg-accent/10 text-accent"
                          : "text-muted hover:bg-surface-2/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}

                <p className="mt-3 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Профиль
                </p>
                {PROFILE_NAV.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2/60 hover:text-foreground"
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-5 w-5" />
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}

                {/* Темы */}
                <div className="mt-4">
                  <MobileThemeSwitcher />
                </div>

                {/* Выйти */}
                <Link
                  href={LOGOUT_NAV.href}
                  onClick={() => setOpen(false)}
                  className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
                >
                  <LOGOUT_NAV.icon className="h-5 w-5" />
                  {LOGOUT_NAV.label}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function MobileThemeSwitcher() {
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
              className={cn(
                "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[10px] font-medium transition-all",
                active ? "text-background" : "text-muted",
              )}
              style={{
                backgroundColor: active ? (t.id === "custom" ? "rgb(var(--accent))" : t.color) : "transparent",
                border: active ? "none" : "1px solid rgb(var(--border))",
              }}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: t.id === "custom" ? "rgb(var(--accent))" : t.color }}
              />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
