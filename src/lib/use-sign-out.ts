"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/providers/toast-provider";

/**
 * Единый обработчик выхода для всей навигации (правый сайдбар,
 * мобильный drawer, страница профиля).
 *
 * Сбрасывает сессию Supabase и редиректит на главную.
 * (/login в проекте нет — вход через модалку AuthModal, поэтому
 * отправляем на «/», где профиль работает локально/гостево.)
 */
export function useSignOut() {
  const router = useRouter();

  return async function signOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    toast("Вы вышли из аккаунта");
    router.push("/");
  };
}
