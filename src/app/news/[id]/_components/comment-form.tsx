"use client";

import { useState } from "react";
import { Send, Lock, ShieldCheck } from "lucide-react";

/**
 * Форма комментария — UI-заготовка.
 *
 * ВАЖНО про публикацию: Shikimori требует OAuth2-авторизацию пользователя
 * для записи комментариев (нельзя публиковать анонимно или только с
 * User-Agent). Поэтому при попытке отправки показываем честный info-блок
 * с предложением войти через Shikimori — это задел на будущее, когда
 * добавим OAuth-флоу. Сам текст комментария сохраняется в локальный
 * стейт, чтобы ничего не потерялось.
 */
export function CommentForm({ subjectLabel = "новости" }: { subjectLabel?: string }) {
  const [text, setText] = useState("");
  const [showAuthNotice, setShowAuthNotice] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    // Реальная отправка требует OAuth2 Shikimori — пока показываем notice.
    setShowAuthNotice(true);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface/50 p-4">
      {/* Info-блок про авторизацию */}
      {showAuthNotice && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/10 p-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Нужен вход через Shikimori
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Публикация комментариев требует авторизации. Войддите через
              Shikimori OAuth, чтобы участвовать в обсуждении.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAuthNotice(false)}
            className="text-xs text-muted transition-colors hover:text-foreground"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
      )}

      {/* Форма */}
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <ShieldCheck className="h-3.5 w-3.5" />
            Ваш комментарий
          </label>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Поделитесь своим мнением об ${subjectLabel}...`}
          rows={3}
          className="mt-2 w-full resize-none rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none transition-all duration-300 focus:border-accent/60 focus:shadow-[0_0_0_4px_rgb(var(--accent)/0.08)]"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted">
            {text.length}/1000 · Markdown поддерживается
          </span>

          <button
            type="submit"
            disabled={!text.trim()}
            className="group inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-background shadow-neon-sm transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            Отправить
          </button>
        </div>
      </form>
    </div>
  );
}
