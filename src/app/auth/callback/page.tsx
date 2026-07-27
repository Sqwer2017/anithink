"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * OAuth callback.
 *
 * Supabase использует PKCE-поток: после входа через Google
 * провайдер редиректит сюда с ?code=... в URL. Обмениваем код
 * на сессию тем же браузерным клиентом (сессия ложится в localStorage,
 * как и при обычном входе по паролю). Существующий onAuthStateChange
 * в profile-client подхватит сессию автоматически.
 */
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");

    // Нет кода — идти нечего, уводим на профиль.
    if (!code) {
      router.replace("/profile");
      return;
    }

    // Клиент недоступен (нет env) — тоже на профиль, профиль работает локально.
    if (!supabase) {
      router.replace("/profile");
      return;
    }

    let cancelled = false;

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (cancelled) return;
        if (error) {
          console.error("OAuth exchangeCodeForSession error:", error.message);
          setError(error.message);
          return;
        }
        router.replace("/profile");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Ошибка авторизации");
      });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        {error ? (
          <p className="text-sm text-red-400">
            Не удалось войти: {error}
          </p>
        ) : (
          <p className="text-sm text-muted">Вход через Google…</p>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  // useSearchParams должен быть внутри <Suspense>, иначе Next.js ругается при build.
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><p className="text-sm text-muted">Загрузка…</p></div>}>
      <AuthCallbackInner />
    </Suspense>
  );
}
