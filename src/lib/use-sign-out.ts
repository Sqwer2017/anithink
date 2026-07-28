"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/providers/toast-provider";
import { PROFILE_STORAGE_KEY } from "@/lib/local-profile";

/**
 * Единый обработчик выхода для всей навигации (правый сайдбар,
 * мобильный drawer, страница профиля).
 *
 * Сбрасывает сессию Supabase, чистит localStorage и редиректит на главную.
 * (/login в проекте нет — вход через модалку AuthModal, поэтому
 * отправляем на «/», где профиль работает локально/гостево.)
 */
const CLEAR_KEYS = [
  PROFILE_STORAGE_KEY,
  "anithink:history",
  "anithink:watch-statuses",
  "anithink:favorites",
  "anithink:ratings",
  "anithink:chat-contacts",
  "anithink:playlists",
] as const;

export function useSignOut() {
  const router = useRouter();

  return async function signOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    // Очистка кэша предыдущего пользователя
    for (const key of CLEAR_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        // localStorage может быть недоступен в некоторых средах
      }
    }

    toast("Вы вышли из аккаунта");
    router.push("/");
  };
}
