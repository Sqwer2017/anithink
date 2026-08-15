"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/providers/toast-provider";
import { Sparkles, UserRound, AtSign, KeyRound, ArrowRight, Loader2, Camera } from "lucide-react";
import { compressImage } from "@/lib/local-media";
import { uploadProfileMedia } from "@/lib/media-upload";

/**
 * Онбординг после регистрации (email/пароль или Google).
 *
 * Открывается из /auth/callback (если профиль не заполнен) или сразу после
 * signUp. Даёт ввести ник, уникальный тег и загрузить аватарку — всё
 * сохраняется сразу. Тег проверяется на занятость (защита от повторений).
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [tag, setTag] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null); // preview (dataUrl)
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
      const user = data.user;
      setUserId(user.id);
      // Предзаполняем из того, что ввели при регистрации (email/пароль) —
      // либо из метаданных (Google).
      try {
        const pendingRaw = JSON.parse(
          window.localStorage.getItem("anithink:pending-profile") ?? "{}",
        );
        if (pendingRaw?.nickname) setNickname(String(pendingRaw.nickname));
        if (pendingRaw?.tag) setTag(String(pendingRaw.tag));
      } catch {
        /* ignore */
      }
      const metaNick =
        (user.user_metadata?.nickname as string) || (user.user_metadata?.name as string) || "";
      if (metaNick && !nickname) setNickname(metaNick);
      const metaTag = (user.user_metadata?.tag as string) || "";
      if (metaTag && !tag) setTag(metaTag);

      // Если профиль уже заполнен — пропускаем онбординг, НО:
      //  - если мы пришли прямо с регистрации (pending/needs-onboarding) — показываем форму;
      //  - если профиль авто-создан триггером из email (Google) — тоже показываем форму.
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, tag, nickname, avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        const forced = window.localStorage.getItem("anithink:needs-onboarding") === "1";
        const emailPrefix = (user.email?.split("@")[0] || "").toLowerCase();
        const autoDerived =
          !!profile &&
          (!profile.tag ||
            profile.tag === "anithink_user" ||
            (!!emailPrefix &&
              (profile.tag.toLowerCase() === emailPrefix ||
                (profile.nickname || "").toLowerCase() === emailPrefix)));
        if (!cancelled && profile?.avatar_url) setAvatar(profile.avatar_url);
        if (
          !cancelled &&
          !forced &&
          profile?.nickname &&
          profile.tag &&
          profile.tag !== "anithink_user" &&
          !autoDerived
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

  const pickAvatar = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, 480);
      setAvatar(dataUrl);
    } catch {
      toast("Не удалось обработать изображение", true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !userId) return;

    const cleanTag = sanitizeTag(tag);
    if (!nickname.trim() || !cleanTag) {
      toast("Заполните никнейм и тег", true);
      return;
    }

    setSaving(true);

    try {
      // Пред-проверка занятости тега (защита от повторений) — для быстрого тоста.
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("tag", cleanTag)
        .maybeSingle();
      if (existing && existing.id !== userId) {
        toast(`Тег @${cleanTag} уже занят, попробуйте другой`, true);
        setSaving(false);
        return;
      }

      // Аватарка — загружаем в Storage, получаем публичный URL.
      let avatarUrl: string | null = null;
      if (avatar && avatar.startsWith("data:")) {
        const blob = await (await fetch(avatar)).blob();
        const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
        avatarUrl = await uploadProfileMedia(file, "avatar", userId);
      } else {
        avatarUrl = avatar; // уже URL (из БД)
      }

      // Сохраняем nickname + tag + avatar в profiles.
      const { error: profileErr } = await supabase.from("profiles").upsert(
        {
          id: userId,
          nickname: nickname.trim(),
          full_name: nickname.trim(),
          tag: cleanTag,
          avatar_url: avatarUrl,
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

      try {
        window.localStorage.removeItem("anithink:pending-profile");
        window.localStorage.removeItem("anithink:needs-onboarding");
      } catch {
        /* ignore */
      }

      toast("Профиль готов!");
      router.replace("/");
    } catch (err) {
      console.error("[onboarding] error:", err);
      toast("Ошибка сохранения профиля. Попробуйте ещё раз", true);
      setSaving(false);
    }
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
          Почти готово! Введи никнейм, уникальный тег и (по желанию) аватарку, чтобы тебя можно
          было найти на сайте.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Аватар */}
          <div className="flex items-center gap-4">
            <label className="relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-accent bg-accent-gradient shadow-neon-sm">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void pickAvatar(event.target.files?.[0])}
              />
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-background">
                  <Camera className="h-5 w-5" />
                  Аватар
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-background/0 text-[10px] font-bold text-foreground opacity-0 transition-opacity hover:bg-background/40 hover:opacity-100">
                Загрузить
              </span>
            </label>
            <p className="text-xs text-muted">
              Квадратная картинка до ~480px. Это твоя аватарка в чатах и на профиле.
            </p>
          </div>

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
