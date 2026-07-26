"use client";

import {
  Camera,
  Clock3,
  ExternalLink,
  Film,
  Gamepad2,
  Heart,
  History,
  MessageCircle,
  Save,
  Send,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  LogIn,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { readProfile, saveProfile, type LocalProfile } from "@/lib/local-profile";
import { HISTORY_STORAGE_KEY, WATCH_STATUS_STORAGE_KEY } from "@/lib/local-playlists";
import { AnimeCard } from "@/components/anime/anime-card";
import type { Anime } from "@/lib/api/shikimori";
import { compressImage } from "@/lib/local-media";
import { toast } from "@/components/providers/toast-provider";
import { supabase } from "@/lib/supabase";
import { AuthModal } from "@/components/auth/auth-modal";

function readIds(key: string) {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function readCompletedIds() {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(WATCH_STATUS_STORAGE_KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? Object.entries(value)
          .filter(([, status]) => status === "completed")
          .map(([id]) => id)
      : [];
  } catch {
    return [];
  }
}

export function ProfileClient() {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [recent, setRecent] = useState<Anime[]>([]);
  const [completed, setCompleted] = useState<Anime[]>([]);
  const [favorites, setFavorites] = useState<Anime[]>([]);
  const [hidden, setHidden] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Состояние авторизации
  const [authUser, setAuthUser] = useState<unknown>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    const loadAnime = (ids: string[], set: (anime: Anime[]) => void) => {
      if (!ids.length) {
        set([]);
        return;
      }
      void fetch(`/api/saved?ids=${ids.slice(0, 30).join(",")}`)
        .then((response) => response.json())
        .then(set)
        .catch(() => set([]));
    };

    const sync = async () => {
      const saved = readProfile();
      setProfile(saved);
      setHidden(saved.isSavedPrivate);
      loadAnime(readIds(HISTORY_STORAGE_KEY), setRecent);
      loadAnime(readCompletedIds(), setCompleted);
      loadAnime(readIds("anithink:favorites"), setFavorites);

      // Проверяем сессию в Supabase
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        setAuthUser(data.user);

        // Если юзер авторизован — подтягиваем никнейм и тег из базы
        if (data.user) {
          const { data: dbProfile } = await supabase
            .from("profiles")
            .select("nickname, tag")
            .eq("id", data.user.id)
            .single();

          if (dbProfile) {
            setProfile((prev) =>
              prev
                ? { ...prev, nickname: dbProfile.nickname || prev.nickname, tag: dbProfile.tag || prev.tag }
                : prev
            );
          }
        }
      }
    };

    sync();

    // Слушатель смены авторизации
    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        setAuthUser(session?.user ?? null);
        if (session?.user) sync();
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  if (!profile) return null;

  const persist = (next: LocalProfile) => {
    setProfile(next);
    saveProfile(next);
  };

  const handleSaveAll = async () => {
    persist(profile);

    if (!supabase) {
      toast("Профиль сохранён локально (Supabase недоступен)");
      return;
    }

    setIsSaving(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData?.user) {
        toast("Профиль сохранен локально! Для синхронизации войдите в аккаунт.");
        setIsSaving(false);
        return;
      }

      const { error } = await supabase.from("profiles").upsert(
        {
          id: userData.user.id,
          user_id: userData.user.id,
          nickname: profile.nickname,
          tag: profile.tag,
          avatar_url: profile.avatar || null,
        },
        { onConflict: "id" }
      );

      if (error) {
        console.error("Ошибка сохранения в Supabase:", error);
        toast(`Локально сохранено, но в БД ошибка: ${error.message}`, true);
      } else {
        toast("Профиль успешно сохранён!");
      }
    } catch (err) {
      console.error(err);
      toast("Ошибка при отправке в Supabase", true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      toast("Вы вышли из аккаунта");
    }
  };

  const upload = async (field: "avatar" | "cover", file?: File) => {
    if (!file) return;
    try {
      persist({ ...profile, [field]: await compressImage(file) });
      toast(field === "avatar" ? "Аватар сохранён" : "Баннер сохранён");
    } catch {
      toast("Не удалось сохранить изображение", true);
    }
  };

  const updateCharacter = (index: number, value: string) => {
    const ids = [...profile.characterIds];
    ids[index] = value.replace(/\D/g, "");
    persist({ ...profile, characterIds: ids });
  };

  const episodes = completed.reduce((total, anime) => total + (anime.episodes || anime.episodes_aired || 0), 0);
  const minutes = completed.reduce(
    (total, anime) => total + (anime.duration || 0) * (anime.episodes || anime.episodes_aired || 0),
    0
  );

  const visibleRecent = recent.slice(0, 6);

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-cyber">
        <label className="relative block h-44 cursor-pointer overflow-hidden bg-[radial-gradient(circle_at_20%_30%,rgb(var(--accent)/0.45),transparent_25%),linear-gradient(120deg,rgb(var(--bg-panel-2)),rgb(var(--bg-main)))]">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void upload("cover", event.target.files?.[0])}
          />
          {profile.cover && <img src={profile.cover} alt="" className="h-full w-full object-cover opacity-80" />}
          <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-semibold opacity-0 transition hover:bg-background/45 hover:opacity-100">
            <Camera className="h-4 w-4" />Загрузить баннер
          </span>
        </label>
        <div className="relative p-5 md:p-7">
          <label className="absolute -top-14 h-28 w-28 cursor-pointer overflow-hidden rounded-3xl border-2 border-accent bg-accent-gradient shadow-neon">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void upload("avatar", event.target.files?.[0])}
            />
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-3xl font-bold text-background">
                {profile.nickname[0]?.toUpperCase()}
              </span>
            )}
          </label>

          <div className="ml-32 flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-extrabold">{profile.nickname}</h1>
              <p className="text-sm text-accent">@{profile.tag} · LVL 0</p>
            </div>
            <div className="hidden sm:block">
              <CharacterEditor profile={profile} onChange={updateCharacter} />
            </div>
          </div>

          <div className="mt-5 flex justify-end sm:hidden">
            <CharacterEditor profile={profile} onChange={updateCharacter} />
          </div>

          {/* Поле BIO */}
          <textarea
            value={profile.bio}
            onChange={(event) => setProfile({ ...profile, bio: event.target.value.slice(0, 300) })}
            className="mt-6 h-24 w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
            placeholder="BIO (расскажите о себе)"
          />

          {/* Соцсети */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Social
              icon={Send}
              value={profile.telegram}
              placeholder="Telegram link"
              onChange={(telegram) => setProfile({ ...profile, telegram })}
            />
            <Social
              icon={MessageCircle}
              value={profile.discord}
              placeholder="Discord link"
              onChange={(discord) => setProfile({ ...profile, discord })}
            />
            <Social
              icon={Gamepad2}
              value={profile.steam}
              placeholder="Steam link"
              onChange={(steam) => setProfile({ ...profile, steam })}
            />
          </div>

          {/* Кнопки действий: Сохранение + Авторизация */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAll}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-background transition hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Сохранение..." : "Сохранить профиль"}
            </button>

            {authUser ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-bold text-muted transition hover:text-foreground hover:border-border/80"
              >
                <LogOut className="h-4 w-4" /> Выйти
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-accent/50 bg-accent/10 px-4 py-2.5 text-sm font-bold text-accent transition hover:bg-accent/20"
              >
                <LogIn className="h-4 w-4" /> Войти в аккаунт
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-7 grid gap-3 sm:grid-cols-2">
        <Stat icon={Clock3} label="Затрачено времени" value={`${Math.round(minutes / 60)} ч`} />
        <Stat icon={Film} label="Просмотрено" value={`${episodes} серий · ${completed.length} тайтлов`} />
      </section>

      <Block title="Недавно посещаемые" icon={History} anime={visibleRecent} />

      <section className="mt-7 rounded-3xl border border-border/70 bg-card p-5 shadow-panel">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Film className="h-5 w-5 text-accent" />Просмотрено
        </h2>
        {completed.length ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {completed.slice(0, 6).map((item, index) => (
                <AnimeCard key={item.id} anime={item} index={index} />
              ))}
            </div>

            {completed.length > 6 && (
              <>
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${
                    showAllCompleted ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0 mt-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                      {completed.slice(6).map((item, index) => (
                        <AnimeCard key={item.id} anime={item} index={index + 6} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAllCompleted(!showAllCompleted)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-medium text-accent hover:border-accent/40 transition"
                  >
                    {showAllCompleted ? (
                      <>
                        Свернуть <ChevronUp className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        Показать всё ({completed.length}) <ChevronDown className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">Пока ничего нет.</p>
        )}
      </section>

      <section className="mt-7 rounded-3xl border border-border/70 bg-card p-5 shadow-panel">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <Heart className="h-5 w-5 text-accent" />Любимые аниме
          </h2>
          <button
            type="button"
            onClick={() => {
              const next = !hidden;
              setHidden(next);
              persist({ ...profile, isSavedPrivate: next });
            }}
            className="rounded-xl border border-border bg-surface p-2 text-muted hover:text-accent"
          >
            {hidden ? <Eye /> : <EyeOff />}
          </button>
        </div>
        <div className={`mt-4 transition ${hidden ? "pointer-events-none select-none opacity-20 blur-sm" : ""}`}>
          {favorites.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {favorites.map((anime, index) => (
                <AnimeCard key={anime.id} anime={anime} index={index} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Пока ничего нет.</p>
          )}
        </div>
      </section>

      {/* Модалка входа */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}

function CharacterEditor({
  profile,
  onChange,
}: {
  profile: LocalProfile;
  onChange: (index: number, value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href="https://shikimori.one/characters"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent/20"
      >
        Найти ID <ExternalLink className="h-3.5 w-3.5" />
      </a>
      {[0, 1, 2].map((index) => (
        <label key={index} className="relative">
          <img
            src={`https://shikimori.one/system/characters/original/${profile.characterIds[index] || 80}.jpg`}
            alt=""
            className="h-14 w-14 rounded-full border-2 border-accent object-cover shadow-neon-sm"
          />
          <input
            value={profile.characterIds[index] || ""}
            onChange={(event) => onChange(index, event.target.value)}
            className="absolute -bottom-3 left-0 w-14 rounded bg-surface px-1 text-center text-[10px] text-muted"
            aria-label="ID персонажа Shikimori"
          />
        </label>
      ))}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-panel">
      <Icon className="h-5 w-5 text-accent" />
      <p className="mt-2 text-xs text-muted">{label}</p>
      <p className="font-display text-lg font-bold">{value}</p>
    </div>
  );
}

function Social({
  icon: Icon,
  value,
  placeholder,
  onChange,
}: {
  icon: typeof Send;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 text-muted">
      <Icon className="h-4 w-4 text-accent" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent py-3 text-xs outline-none"
      />
      {value && (
        <a
          href={value.startsWith("http") ? value : `https://${value}`}
          target="_blank"
          rel="noreferrer"
          className="text-accent"
        >
          ↗
        </a>
      )}
    </label>
  );
}

function Block({ title, icon: Icon, anime }: { title: string; icon: typeof History; anime: Anime[] }) {
  return (
    <section className="mt-7 rounded-3xl border border-border/70 bg-card p-5 shadow-panel">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <Icon className="h-5 w-5 text-accent" />
        {title}
      </h2>
      {anime.length ? (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {anime.map((item, index) => (
            <AnimeCard key={item.id} anime={item} index={index} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Пока ничего нет.</p>
      )}
    </section>
  );
}