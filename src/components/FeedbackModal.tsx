"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Bug, Lightbulb, MessageSquare, CheckCircle2, Loader2 } from "lucide-react";

type FeedbackType = "bug" | "suggestion" | "question";

const CATEGORIES: { id: FeedbackType; label: string; icon: typeof Bug }[] = [
  { id: "bug", label: "Нашёл баг", icon: Bug },
  { id: "suggestion", label: "Идея / Предложение", icon: Lightbulb },
  { id: "question", label: "Другое", icon: MessageSquare },
];

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setType("bug");
      setMessage("");
      setContact("");
      setLoading(false);
      setDone(false);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          userContact: contact.trim(),
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
        setTimeout(onClose, 1800);
      } else {
        alert(data.error || "Не удалось отправить");
      }
    } catch {
      alert("Ошибка сети — не удалось отправить");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Оверлей */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/85 backdrop-blur-sm"
          />

          {/* Модалка */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg rounded-3xl border border-accent/30 bg-card p-6 shadow-cyber"
          >
            {/* Крестик */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-2 text-muted transition hover:bg-surface hover:text-foreground"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Успех */}
            <AnimatePresence>
              {done ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 py-10 text-center"
                >
                  <CheckCircle2 className="h-14 w-14 text-accent" />
                  <p className="font-display text-xl font-extrabold">Спасибо!</p>
                  <p className="text-sm text-muted">Сообщение доставлено ✨</p>
                </motion.div>
              ) : (
                <form onSubmit={submit}>
                  {/* Заголовок */}
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Обратная связь</p>
                  <h2 className="mt-1 font-display text-2xl font-extrabold">Расскажите нам</h2>
                  <p className="mt-1 text-xs text-muted">
                    Нашли баг, хотите предложить идею или просто задать вопрос? Пишите!
                  </p>

                  {/* Табы категорий */}
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const active = type === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setType(cat.id)}
                          className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition ${
                            active
                              ? "border-accent bg-accent/10 text-accent shadow-neon-sm"
                              : "border-border bg-surface text-muted hover:border-accent/40 hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-[11px] font-bold leading-tight">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Сообщение */}
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Опишите проблему или предложение..."
                    rows={5}
                    className="mt-4 w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
                  />

                  {/* Контакт */}
                  <input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="Ваш контакт (TG / Email) — необязательно"
                    className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
                  />

                  {/* Отправить */}
                  <button
                    type="submit"
                    disabled={!message.trim() || loading}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-background transition hover:opacity-90 disabled:opacity-40"
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
                </form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
