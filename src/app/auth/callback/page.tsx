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
      .then(async ({ error }) => {
        if (cancelled) return;
        if (error) {
          console.error("OAuth exchangeCodeForSession error:", error.message);
          setError(error.message);
          return;
        }
        // После OAuth проверяем, заполнен ли профиль (nickname/tag).
        // Если новый Google-пользователь не завершил регистрацию — ведём в онбординг.
        if (!supabase) return;
        try {
          const { data: userData } = await supabase.auth.getUser();
          const user = userData?.user;
          if (!user) {
            router.replace("/");
            return;
          }

          // Если при регистрации не было сессии (подтверждение почты) — здесь
          // профиль мог не создаться. До-создаём его из сохранённого ник/тега.
          let pendingNick: string | null = null;
          let pendingTag: string | null = null;
          try {
            const raw = JSON.parse(window.localStorage.getItem("anithink:pending-profile") ?? "{}");
            pendingNick = raw?.nickname || null;
            pendingTag = raw?.tag || null;
          } catch {
            /* ignore */
          }
          if (pendingNick && pendingTag) {
            try {
              await supabase.from("profiles").upsert(
                {
                  id: user.id,
                  email: user.email,
                  nickname: pendingNick,
                  full_name: pendingNick,
                  tag: pendingTag,
                },
                { onConflict: "id" },
              );
            } catch {
              /* ignore — профиль может создать/существовать и так */
            }
            try {
              window.localStorage.removeItem("anithink:pending-profile");
            } catch {
              /* ignore */
            }
          }

          const { data: profile } = await supabase
            .from("profiles")
            .select("id, tag, nickname")
            .eq("id", user.id)
            .maybeSingle();

          // Считаем профиль «завершённым», если у него задан СВОЙ тег, а не
          // авто-производное из email (сигнал нового Google-юзера, которого
          // надо отправить на онбординг за ник/тэг/аватар).
          const emailPrefix = (user.email?.split("@")[0] || "").toLowerCase();
          const autoDerived =
            !!profile &&
            (!profile.tag ||
              profile.tag === "anithink_user" ||
              (!!emailPrefix &&
                (profile.tag.toLowerCase() === emailPrefix ||
                  (profile.nickname || "").toLowerCase() === emailPrefix)));
          const forced = window.localStorage.getItem("anithink:needs-onboarding") === "1";
          const completed =
            !forced &&
            !!profile &&
            !!profile.nickname &&
            !!profile.tag &&
            profile.tag !== "anithink_user" &&
            !autoDerived;

          router.replace(completed ? "/" : "/auth/onboarding");
        } catch {
          router.replace("/");
        }
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
