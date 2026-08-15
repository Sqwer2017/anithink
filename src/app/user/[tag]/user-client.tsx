"use client";

import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Heart,
  Star,
  Clock3,
  Send,
  MessageCircle,
  Gamepad2,
  Camera,
  Film,
  History,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AnimeCard } from "@/components/anime/anime-card";
import type { Anime } from "@/lib/api/shikimori";
import { toast } from "@/components/providers/toast-provider";
import Link from "next/link";

/* ======================== Types ======================== */

type FriendshipStatus = "none" | "outgoing_pending" | "incoming_pending" | "accepted";

interface TargetProfile {
  id: string;
  nickname: string;
  tag: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  telegram: string | null;
  discord: string | null;
  steam: string | null;
  favorites_privacy: string;
  completed_privacy: string;
  history_privacy: string;
  hide_stats?: boolean;
}

/* ======================== Component ======================== */

export function UserClient({ tag }: { tag: string }) {
  const [profile, setProfile] = useState<TargetProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  // Viewer / friendship
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>("none");
  const [isCloseFriend, setIsCloseFriend] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState(false);

  // Anime lists
  const [favorites, setFavorites] = useState<Anime[]>([]);
  const [completed, setCompleted] = useState<Anime[]>([]);
  const [history, setHistory] = useState<Anime[]>([]);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  // Privacy gating
  const [friendshipAccepted, setFriendshipAccepted] = useState(false);
  const [targetMarksCloseFriend, setTargetMarksCloseFriend] = useState(false);

  const canSee = useCallback(
    (privacy: string) => {
      if (viewerId === profile?.id) return true;
      switch (privacy) {
        case "public":
          return true;
        case "friends":
          return friendshipAccepted;
        case "close_friends":
          return targetMarksCloseFriend;
        case "private":
          return false;
        default:
          return true;
      }
    },
    [viewerId, profile?.id, friendshipAccepted, targetMarksCloseFriend],
  );

  // ---- Load ----
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        // Таргет
        const { data: target } = await supabase
          .from("profiles")
          .select("*")
          .ilike("tag", tag.trim())
          .maybeSingle();

        if (!target) {
          if (!cancelled) setNotFound(true);
          setLoading(false);
          return;
        }

        if (!cancelled) setProfile(target as unknown as TargetProfile);

        // Текущий зритель
        const { data: userData } = await supabase.auth.getUser();
        const viewer = userData?.user?.id ?? null;
        if (!cancelled) setViewerId(viewer);

        // Дружба (если зритель ≠ владелец и зритель есть)
        if (viewer && viewer !== target.id) {
          const { data: myRow } = await supabase
            .from("friendships")
            .select("status, is_close_friend")
            .eq("user_id", viewer)
            .eq("friend_id", target.id)
            .maybeSingle();

          const { data: theirRow } = await supabase
            .from("friendships")
            .select("status, is_close_friend")
            .eq("user_id", target.id)
            .eq("friend_id", viewer)
            .maybeSingle();

          const myStatus = myRow?.status;
          const theirStatus = theirRow?.status;

          let fs: FriendshipStatus = "none";
          if (myStatus === "accepted" && theirStatus === "accepted") {
            fs = "accepted";
          } else if (myStatus === "pending") {
            fs = "outgoing_pending";
          } else if (theirStatus === "pending") {
            fs = "incoming_pending";
          }

          if (!cancelled) {
            setFriendshipStatus(fs);
            setFriendshipAccepted(fs === "accepted");
            setIsCloseFriend(myRow?.is_close_friend ?? false);
            setTargetMarksCloseFriend(theirRow?.is_close_friend ?? false);
          }
        } else if (viewer === target.id) {
          if (!cancelled) {
            setFriendshipStatus("accepted");
            setFriendshipAccepted(true);
            setTargetMarksCloseFriend(true);
          }
        }

        // Аниме-списки таргета
        const { data: userAnime } = await supabase
          .from("user_anime")
          .select("anime_id, is_favorite, watch_status, in_history")
          .eq("user_id", target.id);

        const favIds: string[] = [];
        const compIds: string[] = [];
        const histIds: string[] = [];

        if (userAnime) {
          for (const row of userAnime) {
            if (row.is_favorite) favIds.push(row.anime_id);
            if (row.watch_status === "completed") compIds.push(row.anime_id);
            if (row.in_history) histIds.push(row.anime_id);
          }
        }

        // Загрузка данных аниме
        const fetchAnime = async (ids: string[]) => {
          if (ids.length === 0) return [] as Anime[];
          const res = await fetch(`/api/saved?ids=${ids.slice(0, 50).join(",")}`);
          if (!res.ok) return [] as Anime[];
          return (await res.json()) as Anime[];
        };

        const [fav, comp, hist] = await Promise.all([
          fetchAnime(favIds),
          fetchAnime(compIds),
          fetchAnime(histIds),
        ]);

        if (!cancelled) {
          setFavorites(fav);
          setCompleted(comp);
          setHistory(hist);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tag]);

  // ---- Friendship actions ----
  const sendFriendRequest = async () => {
    if (!viewerId || !profile || !supabase || friendActionLoading) return;
    setFriendActionLoading(true);
    try {
      const { error } = await supabase.from("friendships").insert({
        user_id: viewerId,
        friend_id: profile.id,
        status: "pending",
      });
      if (error) {
        toast(error.message, true);
        return;
      }
      setFriendshipStatus("outgoing_pending");
      toast("Заявка отправлена");
    } catch {
      toast("Ошибка", true);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const acceptFriendRequest = async () => {
    if (!viewerId || !profile || !supabase || friendActionLoading) return;
    setFriendActionLoading(true);
    try {
      // Вставляем нашу строку как accepted
      const { error: err1 } = await supabase.from("friendships").upsert(
        { user_id: viewerId, friend_id: profile.id, status: "accepted" },
        { onConflict: "user_id,friend_id" },
      );
      if (err1) {
        toast(err1.message, true);
        return;
      }
      // Обновляем их строку на accepted
      const { error: err2 } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("user_id", profile.id)
        .eq("friend_id", viewerId);

      if (err2) {
        toast(err2.message, true);
        return;
      }
      setFriendshipStatus("accepted");
      setFriendshipAccepted(true);
      toast("Вы теперь друзья!");
    } catch {
      toast("Ошибка", true);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const removeFriend = async () => {
    if (!viewerId || !profile || !supabase || friendActionLoading) return;
    setFriendActionLoading(true);
    try {
      // Удаляем обе строки
      await supabase
        .from("friendships")
        .delete()
        .eq("user_id", viewerId)
        .eq("friend_id", profile.id);
      await supabase
        .from("friendships")
        .delete()
        .eq("user_id", profile.id)
        .eq("friend_id", viewerId);

      setFriendshipStatus("none");
      setFriendshipAccepted(false);
      setIsCloseFriend(false);
      setTargetMarksCloseFriend(false);
      toast("Пользователь удалён из друзей");
    } catch {
      toast("Ошибка", true);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const toggleCloseFriend = async () => {
    if (!viewerId || !profile || !supabase || friendActionLoading) return;
    setFriendActionLoading(true);
    const next = !isCloseFriend;
    try {
      const { error } = await supabase
        .from("friendships")
        .update({ is_close_friend: next })
        .eq("user_id", viewerId)
        .eq("friend_id", profile.id);
      if (error) {
        toast(error.message, true);
        return;
      }
      setIsCloseFriend(next);
      toast(next ? "В избранных друзьях" : "Убран из избранных");
    } catch {
      toast("Ошибка", true);
    } finally {
      setFriendActionLoading(false);
    }
  };

  // ---- Render ----
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted">Загрузка профиля…</p>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <UserX className="h-12 w-12 text-muted" />
        <p className="font-semibold text-muted">Пользователь @{tag} не найден</p>
        <Link href="/" className="text-sm text-accent hover:underline">
          На главную
        </Link>
      </div>
    );
  }

  const favVisible = canSee(profile.favorites_privacy);
  const compVisible = canSee(profile.completed_privacy);
  const histVisible = canSee(profile.history_privacy);

  // Затраченное время из метаданных просмотренных тайтлов.
  const showHours = !profile.hide_stats;
  const minutesWatched = completed.reduce(
    (total, anime) => total + (anime.duration || 0) * (anime.episodes || anime.episodes_aired || 0),
    0,
  );

  return (
    <>
      {/* Шапка профиля */}
      <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-cyber">
        {/* Баннер */}
        <div className="relative h-44 overflow-hidden bg-[radial-gradient(circle_at_20%_30%,rgb(var(--accent)/0.3),transparent_25%),linear-gradient(120deg,rgb(var(--bg-panel-2)),rgb(var(--bg-main)))]">
          {profile.cover_url && (
            <img src={profile.cover_url} alt="" className="h-full w-full object-cover opacity-80" />
          )}
        </div>

        <div className="relative p-5 md:p-7">
          {/* Аватар */}
          <div className="absolute -top-14 h-28 w-28 overflow-hidden rounded-3xl border-2 border-accent bg-accent-gradient shadow-neon">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-3xl font-bold text-background">
                {profile.nickname?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>

          <div className="ml-32 flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-extrabold">{profile.nickname}</h1>
              <p className="text-sm text-accent">@{profile.tag}</p>
            </div>

            {/* Кнопки дружбы */}
            <div className="flex flex-col items-end gap-2">
              {viewerId !== profile.id && (
                <>
                  {friendshipStatus === "none" && (
                    <button
                      type="button"
                      onClick={sendFriendRequest}
                      disabled={friendActionLoading}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-background transition hover:opacity-90 disabled:opacity-50"
                    >
                      <UserPlus className="h-4 w-4" />
                      Добавить в друзья
                    </button>
                  )}

                  {friendshipStatus === "outgoing_pending" && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-muted">
                      <Clock3 className="h-4 w-4" />
                      Заявка отправлена
                    </span>
                  )}

                  {friendshipStatus === "incoming_pending" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={acceptFriendRequest}
                        disabled={friendActionLoading}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-background hover:opacity-90 disabled:opacity-50"
                      >
                        <UserCheck className="h-4 w-4" />
                        Принять
                      </button>
                    </div>
                  )}

                  {friendshipStatus === "accepted" && (
                    <div className="flex flex-col items-end gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-accent">
                        <Users className="h-4 w-4" />
                        В друзьях
                      </span>
                      <button
                        type="button"
                        onClick={toggleCloseFriend}
                        disabled={friendActionLoading}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
                          isCloseFriend
                            ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                            : "border border-border bg-surface text-muted hover:border-accent/40"
                        }`}
                      >
                        <Star className={`h-3.5 w-3.5 ${isCloseFriend ? "fill-yellow-400" : ""}`} />
                        {isCloseFriend ? "Избранный друг" : "В избранные"}
                      </button>
                      <button
                        type="button"
                        onClick={removeFriend}
                        disabled={friendActionLoading}
                        className="inline-flex items-center gap-1 rounded-xl px-3 py-1 text-[11px] font-semibold text-red-400/70 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                      >
                        <UserX className="h-3.5 w-3.5" />
                        Удалить
                      </button>
                    </div>
                  )}
                </>
              )}

              {viewerId === profile.id && (
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-muted transition hover:border-accent/40 hover:text-accent"
                >
                  ✏️ Редактировать
                </Link>
              )}
            </div>
          </div>

          {/* BIO */}
          {profile.bio && (
            <p className="mt-4 max-w-lg text-sm text-muted">{profile.bio}</p>
          )}

          {/* Соцсети */}
          {(profile.telegram || profile.discord || profile.steam) && (
            <div className="mt-4 flex flex-wrap gap-3">
              {profile.telegram && (
                <a
                  href={profile.telegram.startsWith("http") ? profile.telegram : `https://${profile.telegram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:text-accent"
                >
                  <Send className="h-3.5 w-3.5" /> Telegram
                </a>
              )}
              {profile.discord && (
                <a
                  href={profile.discord.startsWith("http") ? profile.discord : `https://${profile.discord}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:text-accent"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Discord
                </a>
              )}
              {profile.steam && (
                <a
                  href={profile.steam.startsWith("http") ? profile.steam : `https://${profile.steam}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:text-accent"
                >
                  <Gamepad2 className="h-3.5 w-3.5" /> Steam
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Статистика */}
      <section className={`mt-7 grid gap-3 ${showHours ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        {showHours && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-panel">
            <Clock3 className="h-5 w-5 text-accent" />
            <p className="mt-2 text-xs text-muted">Затрачено времени</p>
            <p className="font-display text-lg font-bold">{Math.round(minutesWatched / 60)} ч</p>
          </div>
        )}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-panel">
          <Film className="h-5 w-5 text-accent" />
          <p className="mt-2 text-xs text-muted">Просмотрено</p>
          <p className="font-display text-lg font-bold">{completed.length} тайтлов</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-panel">
          <Heart className="h-5 w-5 text-accent" />
          <p className="mt-2 text-xs text-muted">В избранном</p>
          <p className="font-display text-lg font-bold">{favorites.length} тайтлов</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-panel">
          <History className="h-5 w-5 text-accent" />
          <p className="mt-2 text-xs text-muted">В истории</p>
          <p className="font-display text-lg font-bold">{history.length} записей</p>
        </div>
      </section>

      {/* Просмотрено */}
      <ProfileSection
        title="Просмотрено"
        icon={Film}
        anime={completed}
        visible={compVisible}
        showAll={showAllCompleted}
        setShowAll={setShowAllCompleted}
      />

      {/* История */}
      <ProfileSection
        title="История"
        icon={History}
        anime={history}
        visible={histVisible}
      />

      {/* Избранное */}
      <ProfileSection
        title="Любимые аниме"
        icon={Heart}
        anime={favorites}
        visible={favVisible}
      />
    </>
  );
}

/* ==================== Вспомогательные компоненты ==================== */

function PrivacyPlaceholder({ icon: Icon, title }: { icon: typeof Lock; title: string }) {
  return (
    <section className="mt-7 rounded-3xl border border-border/70 bg-card p-5 shadow-panel">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <Icon className="h-5 w-5 text-accent" />
        {title}
      </h2>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 py-8 text-center">
        <Lock className="h-8 w-8 text-muted/40" />
        <p className="text-sm text-muted">Пользователь ограничил доступ к этому разделу</p>
      </div>
    </section>
  );
}

function ProfileSection({
  title,
  icon: Icon,
  anime,
  visible,
  showAll,
  setShowAll,
}: {
  title: string;
  icon: typeof Film;
  anime: Anime[];
  visible: boolean;
  showAll?: boolean;
  setShowAll?: (v: boolean) => void;
}) {
  if (!visible) {
    return <PrivacyPlaceholder icon={Lock} title={title} />;
  }

  if (!anime.length) {
    return (
      <section className="mt-7 rounded-3xl border border-border/70 bg-card p-5 shadow-panel">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Icon className="h-5 w-5 text-accent" />
          {title}
        </h2>
        <p className="mt-3 text-sm text-muted">Пока ничего нет.</p>
      </section>
    );
  }

  const display = showAll ? anime : anime.slice(0, 6);

  return (
    <section className="mt-7 rounded-3xl border border-border/70 bg-card p-5 shadow-panel">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <Icon className="h-5 w-5 text-accent" />
        {title}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {display.map((item, index) => (
          <AnimeCard key={item.id} anime={item} index={index} />
        ))}
      </div>
      {showAll !== undefined && setShowAll && anime.length > 6 && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-medium text-accent hover:border-accent/40 transition"
          >
            {showAll ? (
              <>
                Свернуть <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Показать всё ({anime.length}) <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
