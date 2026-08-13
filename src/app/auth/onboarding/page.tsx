"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/providers/toast-provider";
import { Sparkles, UserRound, AtSign, KeyRound, ArrowRight, Loader2 } from "lucide-react";

/**
 * Онбординг после входа через Google.
 *
 * Открывается из /auth/callback, если профиль нового пользователя
 * не заполнен (нет nickname/tag). Даёт ввести ник, уникальный тег
 * и (опционально) пароль для входа по email.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [tag, setTag] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Проверяем сессию; если нет — редирект
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!supabase) {
        router.replace("/");
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data?.user) {
        router.replace("/");
        return;
      }
      setUserId(data.user.id);
      // Если профиль уже заполнен — пропускаем онбординг
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, tag, nickname")
          .eq("id", data.user.id)
          .maybeSingle();
        if (
          !cancelled &&
          profile?.nickname &&
          profile.tag &&
          profile.tag !== "anithink_user"
        ) {
          router.replace("/");
          return;
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setLoading(false);
    }
    void check();
    return () => { cancelled = true; };
  }, [router]);

  const sanitizeTag = (v: string) =>
    v
      .trim()
      .toLowerCase()
      .replace(/^@+/, "")
      .replace(/[\s@]/g, "")
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 30);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !userId) return;

    const cleanTag = sanitizeTag(tag);
    if (!nickname.trim() || !cleanTag) {
      toast("Заполните никнейм и тег", true);
      return;
    }

    setSaving(true);

    // Сохраняем nickname + tag в profiles
    const { error: profileErr } = await supabase.from("profiles").upsert(
      {
        id: userId,
        nickname: nickname.trim(),
        full_name: nickname.trim(),
        tag: cleanTag,
      },
      { onConflict: "id" },
    );

    if (profileErr) {
      console.error("[onboarding] profile upsert:", profileErr);
      if (profileErr.code === "23505") {
        toast("Этот тег уже занят, попробуйте другой", true);
      } else {
        toast(`Ошибка сохранения: ${profileErr.message}`, true);
      }
      setSaving(false);
      return;
    }

    // Опционально — установить пароль для входа по email
    if (password) {
      const { error: passErr } = await supabase.auth.updateUser({ password });
      if (!passErr) {
        try {
          await supabase
            .from("profiles")
            .update({ password_set: true })
            .eq("id", userId);
        } catch {
          /* ignore */
        }
      }
    }

    toast("Профиль готов!");
    router.replace("/");
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-cyber">
        <div className="mb-5 flex items-center gap-2 font-display text-2xl font-extrabold">
          <Sparkles className="h-6 w-6 text-accent" />
          Завершение регистрации
        </div>
        <p className="mb-5 text-sm text-muted">
          Почти готово! Введи никнейм и уникальный тег, чтобы тебя можно было найти на сайте.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Никнейм */}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted">
              <UserRound className="h-3.5 w-3.5 text-accent" />
              Никнейм
            </label>
            <input
              type="text"
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Ваш никнейм"
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>

          {/* Тег */}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted">
              <AtSign className="h-3.5 w-3.5 text-accent" />
              Тег
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-muted font-bold text-sm">@</span>
              <input
                type="text"
                required
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="nickname"
                className="w-full rounded-xl border border-border bg-surface py-2.5 pl-8 pr-4 text-sm outline-none focus:border-accent"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted">Без пробелов; латиница, цифры и _</p>
          </div>

          {/* Пароль (опционально) */}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted">
              <KeyRound className="h-3.5 w-3.5 text-accent" />
              Пароль <span className="font-normal text-muted/60">(необязательно)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Для входа по email"
              minLength={6}
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Сохранение…
              </>
            ) : (
              <>
                Завершить регистрацию <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
