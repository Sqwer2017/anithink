"use client";

import { useEffect, useState } from "react";
import { AuthModal } from "@/components/auth/auth-modal";

/**
 * Единая глобальная модалка авторизации.
 * Слушает window-событие `anithink:open-auth` (см. lib/auth-events.ts),
 * чтобы любые компоненты могли открыть вход в аккаунт из любого места
 * (плавающая кнопка «Отзыв», гейты на страницах и т.п.).
 * Монтируется один раз в layout.tsx.
 */
export function GlobalAuthModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const open = () => {
      setIsOpen(true);
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener("anithink:open-auth", open);
    const onProfile = () => setIsOpen(false);
    window.addEventListener("anithink:profile-changed", onProfile);
    return () => {
      window.removeEventListener("anithink:open-auth", open);
      window.removeEventListener("anithink:profile-changed", onProfile);
    };
  }, []);

  return (
    <AuthModal
      key={refreshKey}
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onSuccess={() => window.dispatchEvent(new Event("anithink:auth-changed"))}
    />
  );
}
