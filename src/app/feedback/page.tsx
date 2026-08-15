"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, User, MessageSquarePlus, Loader2, Quote } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/providers/toast-provider";
import { openAuthModal } from "@/lib/auth-events";
import Link from "next/link";

interface Review {
  id: string;
  user_id: string | null;
  nickname: string | null;
  rating: number;
  title: string | null;
  content: string;
  created_at: string;
}

export default function FeedbackPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  // Мапа user_id -> tag (для ссылки на профиль)
  const [tags, setTags] = useState<Record<string, { tag: string; avatar_url: string | null }>>({});

  // Новая форма отзыва
  // Ник берём из профиля пользователя, поле "имя" не нужно
  const [authUser, setAuthUser] = useState<{ id: string; nickname: string } | null>(null);
  const [title, setTitle] = useState("");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Загружаем текущего пользователя (ник из профиля)
  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (cancelled) return;
      if (user) {
        let nick = user.user_metadata?.nickname as string | undefined;
        let finalNick = nick?.trim() || "Аноним";
        const { data: prof } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", user.id)
          .maybeSingle();
        if (prof?.nickname) finalNick = prof.nickname;
        if (!cancelled) setAuthUser({ id: user.id, nickname: finalNick });
      }
    }
    void loadMe();
    // Обновляемся после входа через глобальную модалку
    const onAuth = () => void loadMe();
    window.addEventListener("anithink:auth-changed", onAuth);
    return () => {
      cancelled = true;
      window.removeEventListener("anithink:auth-changed", onAuth);
    };
  }, []);

  const load = () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase
      .from("reviews")
      .select("id, user_id, nickname, rating, title, content, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(async ({ data, error }) => {
        if (!supabase) {
          setLoading(false);
          return;
        }
        if (!error && data) {
          setReviews(data as Review[]);
          // Достаём tag/avatar из profiles для user_id
          const ids = (data as Review[])
            .map((r) => r.user_id)
            .filter((id): id is string => Boolean(id));
          if (ids.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, tag, avatar_url")
              .in("id", ids);
            if (profiles) {
              const m: Record<string, { tag: string; avatar_url: string | null }> = {};
              profiles.forEach((p) => {
                m[p.id] = { tag: p.tag, avatar_url: p.avatar_url };
              });
              setTags(m);
            }
          }
        }
        setLoading(false);
      });
  };

  useEffect(load, []);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    if (!authUser) {
      toast("Войдите, чтобы оставить отзыв", true);
      return;
    }
    setSubmitting(true);
    try {
      if (!supabase) {
        toast("База недоступна", true);
        return;
      }
      const { error } = await supabase.from("reviews").insert({
        user_id: authUser.id,
        nickname: authUser.nickname,
        rating,
        title: title.trim() || null,
        content: content.trim(),
      });
      if (error) {
        toast(`Ошибка: ${error.message}`, true);
        return;
      }
      toast("Спасибо за отзыв! ✨");
      setContent("");
      setTitle("");
      setRating(5);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      {/* Заголовок */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-cyber">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Feedback</p>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold">
          <MessageSquarePlus className="h-7 w-7 text-accent" /> Отзывы
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Оцените AniThink и поделитесь впечатлениями — оставьте отзыв (до 5 звёзд) или используйте
          плавающую кнопку «Отзыв» в углу экрана для обратной связи.
        </p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Список отзывов */}
        <section>
          <h2 className="font-display text-xl font-bold">Отзывы пользователей</h2>
          {loading ? (
            <div className="mt-4 flex items-center justify-center gap-2 py-16 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" /> Загрузка…
            </div>
          ) : reviews.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
              Отзывов пока нет. Станьте первым!
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {reviews.map((r, i) => {
                const profile = r.user_id ? tags[r.user_id] : undefined;
                const href = profile?.tag ? `/user/${profile.tag}` : null;
                return (
                  <motion.article
                    key={r.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className="rounded-2xl border border-border bg-surface/40 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {/* Аватар — кликабелен, ведёт на профиль пользователя */}
                        {href ? (
                          <Link href={href} className="group" aria-label={`Профиль @${profile?.tag}`}>
                            {profile?.avatar_url ? (
                              <img
                                src={profile.avatar_url}
                                alt={r.nickname || "aва"}
                                className="h-9 w-9 rounded-full border border-border object-cover transition group-hover:border-accent"
                              />
                            ) : (
                              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-gradient text-xs font-bold text-background transition group-hover:ring-2 group-hover:ring-accent">
                                {(r.nickname || "A")[0]?.toUpperCase()}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-gradient text-xs font-bold text-background">
                            {(r.nickname || "A")[0]?.toUpperCase()}
                          </span>
                        )}
                        <div>
                          {href ? (
                            <Link href={href} className="text-sm font-bold hover:text-accent">
                              {r.nickname || "Аноним"}
                            </Link>
                          ) : (
                            <p className="text-sm font-bold">{r.nickname || "Аноним"}</p>
                          )}
                          {profile?.tag && (
                            <p className="text-[11px] text-accent">@{profile.tag}</p>
                          )}
                          {r.title && <p className="text-xs text-accent/70">{r.title}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-accent text-accent" : "text-muted"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{r.content}</p>
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-muted/60">
                      <Quote className="h-3 w-3" />
                      {new Date(r.created_at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </motion.article>
                );
              })}
            </div>
          )}
        </section>

        {/* Форма оставить отзыв */}
        <aside className="h-fit rounded-3xl border border-border bg-card p-5 shadow-panel lg:sticky lg:top-4">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold">
            <User className="h-5 w-5 text-accent" /> Оставить отзыв
          </h3>

          {!authUser ? (
            /* Гейт для неавторизованных */
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface/40 p-6 text-center">
              <User className="h-8 w-8 text-muted/50" />
              <p className="text-sm text-muted">
                Чтобы оставить отзыв, нужно войти в аккаунт. Ваш ник и аватар подтянутся из профиля.
              </p>
              <button
                type="button"
                onClick={openAuthModal}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-background hover:opacity-90"
              >
                Войти в аккаунт
              </button>
            </div>
          ) : (
            <form onSubmit={submitReview} className="mt-4 space-y-3">
              {/* Ник из профиля (автоматически) */}
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-muted">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-gradient text-[10px] font-bold text-background">
                  {authUser.nickname[0]?.toUpperCase()}
                </span>
                {authUser.nickname}
              </div>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Заголовок (необязательно)"
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
              />

              {/* Оценка звёздами (до 5) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">Оценка</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className="p-0.5"
                      aria-label={`Оценка ${n}`}
                    >
                      <Star
                        className={`h-6 w-6 transition ${n <= rating ? "fill-accent text-accent" : "text-muted"}`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs text-muted">{rating}/5</span>
                </div>
              </div>

              <textarea
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Ваш отзыв об AniThink..."
                rows={4}
                className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-accent"
              />

              <button
                type="submit"
                disabled={!content.trim() || submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-background hover:opacity-90 disabled:opacity-40"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Отправка…
                  </>
                ) : (
                  "Опубликовать отзыв"
                )}
              </button>
            </form>
          )}
        </aside>
      </div>
    </main>
  );
}
