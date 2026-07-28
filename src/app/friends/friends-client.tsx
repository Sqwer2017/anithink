"use client";

import {
  Star,
  User,
  Clock3,
  Film,
  X,
  Loader2,
  Users,
  Search,
  ExternalLink,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/providers/toast-provider";
import Link from "next/link";

interface FriendProfile {
  id: string;
  nickname: string;
  tag: string;
  avatar_url: string | null;
  cover_url: string | null;
  telegram: string | null;
  discord: string | null;
  steam: string | null;
  is_close_friend: boolean;
  watchHours: number;
}

export default function FriendsClient() {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [searchTag, setSearchTag] = useState("");

  /** Загружает контакты из localStorage (anithink:chat-contacts) */
  const loadLocalContacts = useCallback(async () => {
    if (!supabase) return [];
    const sb = supabase;
    try {
      const raw = localStorage.getItem("anithink:chat-contacts");
      if (!raw) return [];
      const contacts: { id?: string; nickname?: string; tag?: string; avatar?: string | null }[] =
        JSON.parse(raw);
      if (!Array.isArray(contacts)) return [];

      const ids = contacts
        .map((c) => c.id)
        .filter((id): id is string => typeof id === "string" && id.length > 5);

      if (ids.length === 0) return [];

      const { data: profiles } = await sb
        .from("profiles")
        .select("id, nickname, tag, avatar_url, cover_url, telegram, discord, steam")
        .in("id", ids);

      if (!profiles) return [];

      return profiles.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        tag: p.tag,
        avatar_url: p.avatar_url,
        cover_url: p.cover_url,
        telegram: p.telegram,
        discord: p.discord,
        steam: p.steam,
        is_close_friend: false,
        watchHours: 0,
      }));
    } catch {
      return [];
    }
  }, []);

  const loadFriends = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const sb = supabase;

    try {
      const { data: userData } = await sb.auth.getUser();
      const viewerId = userData?.user?.id;
      if (!viewerId) {
        setLoading(false);
        return;
      }

      // Получаем accepted друзей
      const { data: friendships } = await sb
        .from("friendships")
        .select("friend_id, is_close_friend")
        .eq("user_id", viewerId)
        .eq("status", "accepted");

      const friendIds = friendships
        ? friendships.map((f) => f.friend_id)
        : [];

      const closeFriendMap = new Map<string, boolean>(
        friendships
          ? friendships.map((f) => [f.friend_id, f.is_close_friend])
          : [],
      );

      // Загружаем контакты из chat-contacts (localStorage) и мержим
      const localContacts = await loadLocalContacts();
      for (const contact of localContacts) {
        if (!friendIds.includes(contact.id)) {
          friendIds.push(contact.id);
        }
      }

      // Профили друзей
      const { data: profiles } = await sb
        .from("profiles")
        .select("id, nickname, tag, avatar_url, cover_url, telegram, discord, steam")
        .in("id", friendIds);

      if (!profiles) {
        setLoading(false);
        return;
      }

      // Для каждого друга получаем статистику просмотров
      const friendsWithStats: FriendProfile[] = await Promise.all(
        profiles.map(async (p) => {
          const { data: animeData } = await sb
            .from("user_anime")
            .select("watch_status")
            .eq("user_id", p.id)
            .eq("watch_status", "completed");

          // Грубая оценка часов (25 минут на эпизод, 12 эпизодов в среднем на тайтл = 5ч)
          // На самом деле пользователи могут иметь разное количество эпизодов,
          // но для простоты используем количество completed * 5 часов
          const watchHours = (animeData?.length ?? 0) * 5;

          return {
            id: p.id,
            nickname: p.nickname,
            tag: p.tag,
            avatar_url: p.avatar_url,
            cover_url: p.cover_url,
            telegram: p.telegram,
            discord: p.discord,
            steam: p.steam,
            is_close_friend: closeFriendMap.get(p.id) ?? false,
            watchHours,
          };
        }),
      );

      setFriends(friendsWithStats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  const toggleCloseFriend = async (friendId: string, current: boolean) => {
    if (!supabase) return;
    const next = !current;
    const { error } = await supabase
      .from("friendships")
      .update({ is_close_friend: next })
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
      .eq("friend_id", friendId);

    if (error) {
      toast(error.message, true);
      return;
    }

    setFriends((prev) =>
      prev.map((f) => (f.id === friendId ? { ...f, is_close_friend: next } : f)),
    );
    toast(next ? "В избранных друзьях" : "Убран из избранных");
  };

  const filteredFriends = friends.filter(
    (f) => !searchTag || f.tag.toLowerCase().includes(searchTag.toLowerCase()),
  );
  const favoriteFriends = filteredFriends.filter((f) => f.is_close_friend);
  const regularFriends = filteredFriends.filter((f) => !f.is_close_friend);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <main className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-cyber">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Social</p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold">
            <Users className="h-7 w-7 text-accent" />
            Друзья
          </h1>
          <p className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
            Пока нет добавленных друзей. Найдите их по тегу на странице профиля пользователя.
          </p>
        </section>
      </main>
    );
  }

  const renderFriendCard = (friend: FriendProfile) => (
    <div
      key={friend.id}
      onClick={() => setSelectedFriend(friend)}
      className="group relative w-full max-w-[450px] h-[250px] cursor-pointer overflow-hidden rounded-3xl border border-border/70 transition-all duration-300 hover:scale-[1.02] hover:shadow-neon"
    >
      {/* Баннер */}
      <div className="absolute inset-0 bg-gradient-to-b from-surface-2/30 to-background/90">
        {friend.cover_url && (
          <img
            src={friend.cover_url}
            alt=""
            className="h-full w-full object-cover opacity-50"
          />
        )}
      </div>

      {/* Градиент-оверлей */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

      {/* Контент */}
      <div className="relative z-10 flex h-full flex-col justify-end p-5">
        <div className="flex items-center gap-3">
          {/* Аватар */}
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-accent bg-accent-gradient shadow-neon-sm">
            {friend.avatar_url ? (
              <img src={friend.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-lg font-bold text-background">
                {friend.nickname[0]?.toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-lg font-bold text-foreground truncate">{friend.nickname}</p>
            <p className="text-xs text-accent">@{friend.tag}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Film className="h-3.5 w-3.5" />
            {friend.watchHours} ч
          </span>
        </div>
      </div>

      {/* Звёздочка избранного */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void toggleCloseFriend(friend.id, friend.is_close_friend);
        }}
        className={`absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full transition ${
          friend.is_close_friend
            ? "bg-yellow-500/20 text-yellow-400"
            : "bg-background/50 text-muted/50 hover:text-yellow-400"
        }`}
      >
        <Star className={`h-4 w-4 ${friend.is_close_friend ? "fill-yellow-400" : ""}`} />
      </button>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-cyber">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Social</p>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold">
          <Users className="h-7 w-7 text-accent" />
          Друзья
        </h1>

        {/* Поиск по тегу */}
        <div className="mt-4 flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchTag}
              onChange={(e) => setSearchTag(e.target.value)}
              placeholder="Поиск по тегу..."
              className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-4 text-xs outline-none focus:border-accent"
            />
          </div>
          {searchTag && (
            <Link
              href={`/user/${searchTag}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-background hover:opacity-90"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Найти @{searchTag}
            </Link>
          )}
        </div>

        {/* Избранные друзья */}
        {favoriteFriends.length > 0 && (
          <>
            <h2 className="mt-6 flex items-center gap-2 text-sm font-bold text-yellow-400">
              <Star className="h-4 w-4 fill-yellow-400" />
              Избранные друзья
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favoriteFriends.map(renderFriendCard)}
            </div>
          </>
        )}

        {/* Остальные друзья */}
        {regularFriends.length > 0 && (
          <>
            {favoriteFriends.length > 0 && (
              <h2 className="mt-8 flex items-center gap-2 text-sm font-bold text-muted">
                <User className="h-4 w-4" />
                Все друзья
              </h2>
            )}
            <div className={`mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
              {regularFriends.map(renderFriendCard)}
            </div>
          </>
        )}
      </section>

      {/* Модалка просмотра профиля друга */}
      {selectedFriend && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedFriend(null)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-cyber animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedFriend(null)}
              className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-surface hover:text-foreground transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="h-20 w-20 overflow-hidden rounded-3xl border-2 border-accent bg-accent-gradient shadow-neon">
                {selectedFriend.avatar_url ? (
                  <img src={selectedFriend.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-2xl font-bold text-background">
                    {selectedFriend.nickname[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <h2 className="mt-4 text-xl font-extrabold">{selectedFriend.nickname}</h2>
              <p className="text-sm text-accent">@{selectedFriend.tag}</p>
              <p className="mt-3 text-xs text-muted">
                Просмотрено: ~{selectedFriend.watchHours} часов
              </p>

              <a
                href={`/user/${selectedFriend.tag}`}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-background hover:opacity-90"
              >
                Открыть профиль
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
