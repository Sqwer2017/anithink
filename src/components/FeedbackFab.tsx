"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { Send, Bug, Lightbulb, MessageSquare, CheckCircle2, Loader2, LogIn, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { openAuthModal } from "@/lib/auth-events";

type FeedbackType = "bug" | "suggestion" | "question";

const CATEGORIES: { id: FeedbackType; label: string; icon: typeof Bug }[] = [
  { id: "bug", label: "Баг", icon: Bug },
  { id: "suggestion", label: "Идея", icon: Lightbulb },
  { id: "question", label: "Другое", icon: MessageSquare },
];

/** Ширина свёрнутого правого сайдбара (коллапсированный). */
const SIDEBAR_COLLAPSED = 76;

/**
 * Плавающая круглая кнопка «Отзыв», которая располагается СЛЕВА от правого
 * сайдбара и при его раскрытии отъезжает вбок, чтобы не перекрывать меню
 * (в т.ч. кнопку «Выйти»). По клику морфится (расширяется) в панель
 * обратной связи. Только для авторизованных: гостям показывается
 * предупреждение с кнопкой «Войти» (открывает глобальную AuthModal).
 */
export function FeedbackFab() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Авторизация: ник подтягивается из профиля (поле «имя» не нужно).
  const [auth, setAuth] = useState<{ nickname: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Текущая ширина правого сайдбара — кнопка держится слева от него.
  // Используем motion value и обновляем его напрямую по кадрам (без re-render
  // и spring), чтобы кнопка зеркалила положение меню синхронно, 1:1.
  // Сдвиг right = ширина сайдбара + зазор.
  const rightMV = useMotionValue(SIDEBAR_COLLAPSED + 12);
  const setSidebarW = (w: number) => rightMV.set(Math.max(w, 12) + 12);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (user) {
        let nick = user.user_metadata?.nickname as string | undefined;
        let finalNick = nick?.trim() || "Аноним";
        const { data: prof } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", user.id)
          .maybeSingle();
        if (prof?.nickname) finalNick = prof.nickname;
        setAuth({ nickname: finalNick });
      }
      setAuthLoading(false);
    })();
  }, []);

  // Следим за шириной сайдбара: собственное событие из right-sidebar
  // (идёт каждый кадр spring-анимации → синхронно), ResizeObserver и resize.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>("aside[data-sidebar]");
    const fromEvent = (e: Event) =>
      setSidebarW((e as CustomEvent<number>).detail || SIDEBAR_COLLAPSED);
    const measure = () => {
      if (!el) return;
      const w = el.getBoundingClientRect().width || el.offsetWidth || SIDEBAR_COLLAPSED;
      setSidebarW(w);
    };
    window.addEventListener("anithink:sidebar-width", fromEvent);
    if (el) {
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      window.addEventListener("resize", measure);
      return () => {
        window.removeEventListener("anithink:sidebar-width", fromEvent);
        ro.disconnect();
        window.removeEventListener("resize", measure);
      };
    }
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("anithink:sidebar-width", fromEvent);
      window.removeEventListener("resize", measure);
    };
  }, []);

  const reset = () => {
    setType("bug");
    setMessage("");
    setLoading(false);
    setDone(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading || !auth) return;
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          nickname: auth.nickname,
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
        }),
      });
      const data = await res.json();
      if (data.success) setDone(true);
      else alert(data.error || "Не удалось отправить");
    } catch {
      alert("Ошибка сети — не удалось отправить");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="pointer-events-none fixed z-[45] bottom-24 lg:bottom-6 flex flex-col items-end"
      style={{ right: rightMV }}
      animate={{ width: open ? 340 : 56, height: open ? "auto" : 56 }}
      transition={{
        width: { type: "spring", stiffness: 220, damping: 26 },
        height: { type: "spring", stiffness: 220, damping: 26 },
      }}
    >
      <motion.div
        className="pointer-events-auto flex flex-col overflow-hidden border"
        animate={{
          width: open ? 340 : 56,
          height: open ? 420 : 56,
          borderRadius: open ? 24 : 999,
          borderColor: "rgb(var(--accent) / 0.4)",
          backgroundColor: open ? "rgb(var(--bg-card))" : "rgb(var(--accent))",
          boxShadow: open
            ? "0 0 24px rgb(var(--accent-glow) / 0.35), 0 12px 36px rgba(0,0,0,0.5)"
            : "0 0 16px rgb(var(--accent-glow) / 0.5)",
        }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
      >
        {/* Кнопка-триггер (круг) — видна когда закрыто */}
        {!open && (
          <button
            type="button"
            onClick={() => {
              if (auth) {
                setOpen(true);
                reset();
              } else {
                openAuthModal();
              }
            }}
            className="flex h-14 w-14 shrink-0 items-center justify-center text-background"
            aria-label="Обратная связь"
          >
            <Send className="h-6 w-6" />
          </button>
        )}

        {/* Панель (видна когда открыто) */}
        {open && (
          <div className="flex h-full w-full flex-col overflow-hidden bg-card text-foreground">
            {/* Шапка */}
            <div className="flex items-center justify-between border-b border-border bg-surface/60 px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-widest text-accent">Обратная связь</span>
              <button
                type="button"
                onClick={() => { setOpen(false); reset(); }}
                className="rounded-lg p-1 text-muted transition hover:text-foreground"
                aria-label="Закрыть"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <AnimatePresence mode="wait">
              {authLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-1 items-center justify-center gap-2 text-muted"
                >
                  <Loader2 className="h-5 w-5 animate-spin" /> Загрузка…
                </motion.div>
              ) : !auth ? (
                /* Гейт для гостей — писать отзывы/жалобы только залогиненным */
                <motion.div
                  key="gate"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-6 text-center"
                >
                  <User className="h-9 w-9 text-muted/50" />
                  <p className="text-sm text-muted">
                    Чтобы написать отзыв или жалобу, войдите в аккаунт. Ваш ник
                    подтянется из профиля автоматически.
                  </p>
                  <button
                    type="button"
                    onClick={openAuthModal}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-background hover:opacity-90"
                  >
                    <LogIn className="h-4 w-4" /> Войти
                  </button>
                </motion.div>
              ) : done ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center"
                >
                  <CheckCircle2 className="h-12 w-12 text-accent" />
                  <p className="font-display text-lg font-extrabold">Спасибо!</p>
                  <p className="text-sm text-muted">Сообщение доставлено ✨</p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onSubmit={submit}
                  className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3 scrollbar-cyber"
                >
                  {/* Кто пишет — из профиля (без поля «имя») */}
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-gradient text-[10px] font-bold text-background">
                      {auth.nickname[0]?.toUpperCase()}
                    </span>
                    Автор: <span className="font-semibold text-foreground">{auth.nickname}</span>
                  </div>

                  {/* Табы категорий */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const active = type === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setType(cat.id)}
                          className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                            active
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border bg-surface text-muted hover:border-accent/40 hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-[10px] font-bold leading-tight">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Опишите проблему или предложение..."
                    rows={4}
                    className="w-full flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
                  />

                  <button
                    type="submit"
                    disabled={!message.trim() || loading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-bold text-background transition hover:opacity-90 disabled:opacity-40"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Отправка…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" /> Отправить
                      </>
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
