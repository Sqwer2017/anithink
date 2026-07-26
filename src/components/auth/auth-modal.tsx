"use client";

import { useState, FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/providers/toast-provider";
import { LogIn, UserPlus, X } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!supabase) {
      toast("Supabase клиент недоступен", true);
      return;
    }

    // 1. Проверка совпадения паролей при регистрации
    if (isSignUp && password !== confirmPassword) {
      toast("Пароли не совпадают!", true);
      return;
    }

    setLoading(true);

    const cleanEmail = email.trim();
    const cleanTag = tag.trim().toLowerCase().replace(/^@+/, "").replace(/\s+/g, "");

    try {
      if (isSignUp) {
        if (!cleanTag || !nickname.trim()) {
          toast("Заполните имя и тег", true);
          setLoading(false);
          return;
        }

        // Проверяем, свободен ли тег
        const { data: existingTag } = await supabase
          .from("profiles")
          .select("id")
          .eq("tag", cleanTag)
          .maybeSingle();

        if (existingTag) {
          toast(`Тег @${cleanTag} уже занят!`, true);
          setLoading(false);
          return;
        }

        // Регистрация
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              nickname: nickname.trim(),
              tag: cleanTag,
            },
          },
        });

        if (error) throw error;
        toast("Регистрация успешна!");
      } else {
        // Вход
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;
        toast("С возвращением!");
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ошибка авторизации";
      toast(message, true);
    } finally {
      setLoading(false);
    }
  };

  // Вход через Google
  const handleGoogleLogin = async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/profile`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ошибка входа через Google";
      toast(message, true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-cyber animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-surface hover:text-foreground transition"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-extrabold font-display mb-1">
          {isSignUp ? "Регистрация" : "Вход в аккаунт"}
        </h2>
        <p className="text-xs text-muted mb-5">
          {isSignUp
            ? "Создай аккаунт, чтобы общаться и сохранять списки"
            : "Войди под своим аккаунтом для доступа к чатам"}
        </p>

        {/* Кнопка Google */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full mb-4 flex items-center justify-center gap-3 rounded-xl border border-border bg-surface py-2.5 text-xs font-bold transition hover:bg-border/40"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3h3.88c2.28-2.09 3.665-5.17 3.665-9.12z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.1C3.25 21.32 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.58H1.26C.46 8.16 0 9.98 0 12s.46 3.84 1.26 5.42l4.02-3.1z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.68 1.26 6.58l4.02 3.1c.95-2.83 3.6-4.93 6.72-4.93z"
            />
          </svg>
          Продолжить через Google
        </button>

        <div className="relative flex items-center justify-center mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative bg-card px-2 text-[10px] uppercase font-bold text-muted">или</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignUp && (
            <>
              <div>
                <label className="block text-xs font-bold text-muted mb-1">Никнейм</label>
                <input
                  type="text"
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Sqwer"
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted mb-1">Тег</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-muted font-bold text-sm">@</span>
                  <input
                    type="text"
                    required
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    placeholder="sqwer"
                    className="w-full rounded-xl border border-border bg-surface py-2.5 pl-8 pr-4 text-sm outline-none focus:border-accent"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-muted mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted mb-1">Пароль</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-bold text-muted mb-1">Повторите пароль</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none bg-surface transition ${
                  confirmPassword && password !== confirmPassword
                    ? "border-red-500 focus:border-red-500"
                    : "border-border focus:border-accent"
                }`}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-[10px] text-red-400">Пароли не совпадают</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {isSignUp ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            {loading ? "Загрузка..." : isSignUp ? "Зарегистрироваться" : "Войти"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setConfirmPassword("");
            }}
            className="text-xs text-accent hover:underline font-medium"
          >
            {isSignUp ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
          </button>
        </div>
      </div>
    </div>
  );
}