"use client";

import {
  AlertTriangle,
  Camera,
  Clock3,
  ExternalLink,
  Film,
  Gamepad2,
  Heart,
  History,
  Instagram,
  MessageCircle,
  Save,
  Send,
  Settings2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  LogIn,
  LogOut,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { readProfile, saveProfile, type LocalProfile } from "@/lib/local-profile";
import { HISTORY_STORAGE_KEY, WATCH_STATUS_STORAGE_KEY } from "@/lib/local-playlists";
import { AnimeCard } from "@/components/anime/anime-card";
import type { Anime } from "@/lib/api/shikimori";
import { compressImage } from "@/lib/local-media";
import { uploadProfileMedia } from "@/lib/media-upload";
import { toast } from "@/components/providers/toast-provider";
import { supabase } from "@/lib/supabase";
import { mergeLocalToSupabase } from "@/lib/user-anime";
import { AuthModal } from "@/components/auth/auth-modal";
import { useSignOut } from "@/lib/use-sign-out";

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
  // Показываем, что авторизация/данные ещё грузятся — чтобы не сбрасывать статистику в 0
  const [authLoading, setAuthLoading] = useState(true);

  // Состояние авторизации
  const [authUser, setAuthUser] = useState<unknown>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [socialEditOpen, setSocialEditOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const signOut = useSignOut();

  useEffect(() => {
    let cancelled = false;

    // Загрузка списка аниме по ids. НЕ сбрасываем на 0 при ошибке сети —
    // иначе статистика мигает/обнуляется.
    const loadAnime = (ids: string[], set: (anime: Anime[]) => void) => {
      if (!ids.length) {
        if (!cancelled && !authLoading) set([]);
        return;
      }
      void fetch(`/api/saved?ids=${ids.slice(0, 60).join(",")}`)
        .then((response) => response.json())
        .then((data) => { if (!cancelled) set(data); })
        .catch(() => { /* НЕ обнуляем на сетевой ошибке */ });
    };

    // Мерджит локальные ids с данными из user_anime (если юзер залогинен)
    const mergeWithDb = (localIds: string[], dbRows: { anime_id: string }[]): string[] => {
      const set = new Set(localIds);
      dbRows.forEach((r) => set.add(r.anime_id));
      return [...set];
    };

    const sync = async () => {
      // Пока статус авторизации грузится — не трогаем уже отрисованную статистику
      if (cancelled) return;

      const saved = readProfile();
      setProfile(saved);
      setHidden(saved.isSavedPrivate);

      let historyIds = readIds(HISTORY_STORAGE_KEY);
      let completedIds = readCompletedIds();
      let favorIds = readIds("anithink:favorites");

      // Проверяем сессию в Supabase
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        setAuthUser(data.user);

        // Если юзер авторизован — подтягиваем данные из базы и мерджим
        if (data.user) {
          try {
            const { data: dbProfile } = await supabase
              .from("profiles")
              .select("nickname, full_name, tag, avatar_url, cover_url, telegram, discord, steam, instagram, bio")
              .eq("id", data.user.id)
              .single();

            if (dbProfile) {
              const fetchedName =
                dbProfile.nickname || dbProfile.full_name || data.user.email?.split("@")[0];

              setProfile((prev) => {
                if (!prev) return prev;
                const next = {
                  ...prev,
                  nickname: fetchedName || prev.nickname,
                  tag: dbProfile.tag || prev.tag,
                  avatar: dbProfile.avatar_url || prev.avatar,
                  cover: dbProfile.cover_url || prev.cover,
                  telegram: dbProfile.telegram || prev.telegram,
                  discord: dbProfile.discord || prev.discord,
                  steam: dbProfile.steam || prev.steam,
                  instagram: dbProfile.instagram || prev.instagram,
                  bio: dbProfile.bio || prev.bio,
                };
                saveProfile(next);
                return next;
              });
            }

            // Мерджим локальные списки с user_anime (избранное/статусы/история)
            const { data: userAnime } = await supabase
              .from("user_anime")
              .select("anime_id, is_favorite, watch_status, in_history")
              .eq("user_id", data.user.id);
            if (userAnime && !cancelled) {
              if (userAnime.some((r) => r.in_history)) {
                historyIds = mergeWithDb(historyIds, userAnime.filter((r) => r.in_history));
              }
              if (userAnime.some((r) => r.watch_status === "completed")) {
                completedIds = mergeWithDb(
                  completedIds,
                  userAnime.filter((r) => r.watch_status === "completed"),
                );
              }
              if (userAnime.some((r) => r.is_favorite)) {
                favorIds = mergeWithDb(favorIds, userAnime.filter((r) => r.is_favorite));
              }
            }
          } catch (err) {
            // Ошибка сети/запроса к Supabase — НЕ сбрасываем локальные данные
            console.error("profile sync supabase error:", err);
          }
        }
      }

      if (cancelled) return;
      setAuthLoading(false);
      loadAnime(historyIds, setRecent);
      loadAnime(completedIds, setCompleted);
      loadAnime(favorIds, setFavorites);
    };

    sync();

    // Слушатель смены авторизации
    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        setAuthUser(session?.user ?? null);
        if (session?.user) {
          sync();
          // При входе сливаем локальные сохранёнки/историю в Supabase
          void mergeLocalToSupabase(session.user.id);
        } else {
          setAuthLoading(false);
        }
      });

      return () => {
        cancelled = true;
        authListener.subscription.unsubscribe();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile) return null;

  const persist = (next: LocalProfile) => {
    setProfile(next);
    saveProfile(next);
  };

  const handleSaveAll = async () => {
    persist(profile);

    if (!authUser) {
      toast("Для изменения профиля необходимо войти в аккаунт", true);
      setIsAuthOpen(true);
      return;
    }

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
          full_name: profile.nickname,
          tag: profile.tag,
          avatar_url: profile.avatar || null,
          cover_url: profile.cover || null,
          bio: profile.bio || null,
          telegram: profile.telegram || null,
          discord: profile.discord || null,
          steam: profile.steam || null,
          instagram: profile.instagram || null,
          favorites_privacy: profile.favoritesPrivacy,
          completed_privacy: profile.completedPrivacy,
          history_privacy: profile.historyPrivacy,
        },
        { onConflict: "id" }
      );

      if (error) {
        console.error("Ошибка сохранения в Supabase:", error);
        if (error.code === "23505") {
          toast("Этот тег уже занят, попробуйте другой", true);
        } else {
          toast(`Локально сохранено, но в БД ошибка: ${error.message}`, true);
        }
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

  const handleSignOut = () => {
    setConfirmSignOut(true);
  };

  const upload = async (field: "avatar" | "cover", file?: File) => {
    if (!file || !profile) return;

    // Гостевой гейт: без авторизации — toast + модалка
    if (!authUser) {
      toast("Для изменения профиля необходимо войти в аккаунт", true);
      setIsAuthOpen(true);
      return;
    }

    // 1. Мгновенный локальный превью (data URL)
    const dataUrl = await compressImage(file).catch(() => null);
    if (!dataUrl) {
      toast("Не удалось обработать изображение", true);
      return;
    }

    persist({ ...profile, [field]: dataUrl });
    toast(field === "avatar" ? "Загрузка аватара…" : "Загрузка баннера…");

    // 2. Если нет Supabase — остаётся локальным превью
    if (!supabase) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;

      if (!currentUserId) return; // Гость: остаётся только локальное превью

      // 3. Загрузка в Supabase Storage
      const publicUrl = await uploadProfileMedia(file, field, currentUserId);
      const dbField = field === "cover" ? "cover_url" : "avatar_url";

      // 4. Запись ссылки в таблицу profiles
      const { error: dbError } = await supabase
        .from("profiles")
        .update({ [dbField]: publicUrl })
        .eq("id", currentUserId);

      if (dbError) {
        console.error("Ошибка обновления базы данных:", dbError);
        toast("Изображение загружено, но не удалось привязать к БД", true);
        return;
      }

      // 5. Финальное обновление state публичным URL
      setProfile((prev) => {
        if (!prev) return prev;
        const next = { ...prev, [field]: publicUrl };
        saveProfile(next);
        return next;
      });

      toast(field === "avatar" ? "Аватар сохранён в облаке!" : "Баннер сохранён в облаке!");
    } catch (err) {
      console.error("media upload error:", err);
      toast("Изображение сохранено локально, но произошла ошибка загрузки в облако", true);
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
      {/* Гостевой баннер */}
      {!authUser && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="flex-1">
            ⚠️ Ваши данные хранятся локально в браузере! Войдите в аккаунт, чтобы не потерять их при очистке кэша.
          </span>
          <button
            type="button"
            onClick={() => setIsAuthOpen(true)}
            className="shrink-0 rounded-lg bg-yellow-500/20 px-3 py-1.5 font-bold hover:bg-yellow-500/30"
          >
            Войти
          </button>
        </div>
      )}
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
            <div className="min-w-0 flex-1">
              {editingName ? (
                <>
                  <input
                    value={nicknameDraft}
                    onChange={(e) => setNicknameDraft(e.target.value.slice(0, 40))}
                    className="w-full rounded-xl border-2 border-accent/60 bg-surface px-3 py-1.5 font-display text-3xl font-extrabold outline-none focus:border-accent"
                    placeholder="Никнейм"
                    autoFocus
                  />
                  <div className="mt-2 flex items-center gap-1 text-sm text-accent">
                    <span>@</span>
                    <input
                      value={tagDraft}
                      onChange={(e) =>
                        setTagDraft(
                          e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30),
                        )
                      }
                      className="rounded-lg border-2 border-accent/60 bg-surface px-2 py-1 outline-none focus:border-accent"
                      placeholder="tag"
                    />
                    <span className="text-muted">· LVL 0</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setProfile({ ...profile, nickname: nicknameDraft, tag: tagDraft });
                        setEditingName(false);
                      }}
                      className="rounded-xl bg-accent px-4 py-1.5 text-xs font-bold text-background hover:opacity-90"
                    >
                      ✓ Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingName(false)}
                      className="rounded-xl border border-border bg-surface px-4 py-1.5 text-xs font-bold text-muted hover:text-foreground"
                    >
                      Отмена
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="font-display text-3xl font-extrabold">{profile.nickname}</h1>
                  <p className="text-sm text-accent">@{profile.tag} · LVL 0</p>
                </>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="hidden sm:block">
                <CharacterEditor profile={profile} onChange={updateCharacter} />
              </div>
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

          {/* Соцсети — круглые иконки */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SocialIcon
              icon={Send}
              href={profile.telegram}
              label="Telegram"
            />
            <SocialIcon
              icon={MessageCircle}
              href={profile.discord}
              label="Discord"
            />
            <SocialIcon
              icon={Gamepad2}
              href={profile.steam}
              label="Steam"
            />
            <SocialIcon
              icon={Instagram}
              href={profile.instagram}
              label="Instagram"
            />
            <button
              type="button"
              onClick={() => setSocialEditOpen(true)}
              className="ml-1 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted transition hover:border-accent/40 hover:text-accent"
              title="Изменить соцсети"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>

          {/* Кнопка ✏️ Изменить имя — нижний правый угол */}
          {!editingName && (
            <button
              type="button"
              onClick={() => {
                if (!authUser) {
                  toast("Для изменения профиля необходимо войти в аккаунт", true);
                  setIsAuthOpen(true);
                  return;
                }
                setNicknameDraft(profile.nickname);
                setTagDraft(profile.tag);
                setEditingName(true);
              }}
              className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-bold text-muted transition hover:border-accent/40 hover:text-accent hover:shadow-neon-sm"
            >
              ✏️ Изменить имя
            </button>
          )}

          {/* Кнопки действий */}
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

      {/* Модалка редактирования соцсетей */}
      <SocialEditModal
        open={socialEditOpen}
        profile={profile}
        onSave={(updated) => {
          const next = { ...profile, ...updated };
          persist(next);
          // Если авторизован — сохраняем в Supabase
          if (supabase && authUser) {
            supabase.from("profiles").upsert(
              {
                id: (authUser as { id: string }).id,
                telegram: next.telegram || null,
                discord: next.discord || null,
                steam: next.steam || null,
                instagram: next.instagram || null,
              },
              { onConflict: "id" },
            ).then(({ error }) => {
              if (error) console.error("social save error:", error);
            });
          }
        }}
        onClose={() => setSocialEditOpen(false)}
      />

      {/* Модалка подтверждения выхода */}
      {confirmSignOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-cyber animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-extrabold font-display mb-2">Выход из аккаунта</h2>
            <p className="text-sm text-muted">
              Вы уверены, что хотите выйти? Несохраненные локальные данные могут быть сброшены.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmSignOut(false);
                  void signOut();
                }}
                className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white hover:opacity-90"
              >
                Да, выйти
              </button>
              <button
                type="button"
                onClick={() => setConfirmSignOut(false)}
                className="flex-1 rounded-xl border border-border bg-surface py-3 text-sm font-bold text-muted hover:text-foreground"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
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

/* ==================== Круглая иконка соцсети ==================== */

const SOCIAL_LINKS: { icon: typeof Send; field: keyof LocalProfile; label: string }[] = [
  { icon: Send, field: "telegram", label: "Telegram" },
  { icon: MessageCircle, field: "discord", label: "Discord" },
  { icon: Gamepad2, field: "steam", label: "Steam" },
  { icon: Instagram, field: "instagram", label: "Instagram" },
];

function SocialIcon({
  icon: Icon,
  href,
  label,
}: {
  icon: typeof Send;
  href: string;
  label: string;
}) {
  const hasLink = Boolean(href);
  return (
    <a
      href={hasLink ? (href.startsWith("http") ? href : `https://${href}`) : undefined}
      target={hasLink ? "_blank" : undefined}
      rel={hasLink ? "noreferrer" : undefined}
      title={label}
      className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
        hasLink
          ? "border-border bg-surface text-muted hover:border-accent/40 hover:text-accent hover:shadow-neon-sm"
          : "border-border/40 bg-surface/50 text-muted/30 line-through opacity-40 cursor-default"
      }`}
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

/* ==================== Модалка редактирования соцсетей ==================== */

interface SocialEditModalProps {
  open: boolean;
  profile: LocalProfile;
  onSave: (updated: Partial<LocalProfile>) => void;
  onClose: () => void;
}

function SocialEditModal({ open, profile, onSave, onClose }: SocialEditModalProps) {
  const [draft, setDraft] = useState({ telegram: "", discord: "", steam: "", instagram: "" });

  useEffect(() => {
    if (open) {
      setDraft({
        telegram: profile.telegram || "",
        discord: profile.discord || "",
        steam: profile.steam || "",
        instagram: profile.instagram || "",
      });
    }
  }, [open, profile]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-cyber animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-surface hover:text-foreground transition"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-extrabold font-display mb-5">Редактировать соцсети</h2>

        <div className="space-y-3">
          <SocialInput
            label="Telegram"
            value={draft.telegram}
            onChange={(v) => setDraft((d) => ({ ...d, telegram: v }))}
          />
          <SocialInput
            label="Discord"
            value={draft.discord}
            onChange={(v) => setDraft((d) => ({ ...d, discord: v }))}
          />
          <SocialInput
            label="Steam"
            value={draft.steam}
            onChange={(v) => setDraft((d) => ({ ...d, steam: v }))}
          />
          <SocialInput
            label="Instagram"
            value={draft.instagram}
            onChange={(v) => setDraft((d) => ({ ...d, instagram: v }))}
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="flex-1 rounded-xl bg-accent py-3 text-sm font-bold text-background hover:opacity-90"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-surface py-3 text-sm font-bold text-muted hover:text-foreground"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function SocialInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 text-muted">
      <span className="text-xs font-bold uppercase tracking-wide w-20 shrink-0">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Ссылка на ${label}`}
        className="min-w-0 flex-1 bg-transparent py-3 text-xs outline-none"
      />
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