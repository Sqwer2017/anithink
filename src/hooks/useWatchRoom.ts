"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

/* =====================================================================
 * Watch Party комната через Supabase Realtime (Presence + Broadcast).
 * ===================================================================== */

export interface RoomUser {
  profileId: string;
  nickname: string;
  avatar: string | null;
}

/** Мета участника в presence. */
interface PresenceMeta extends RoomUser {
  clientId: string; // уникальный id вкладки
  joinedAt: number;
  allowControl?: boolean;
}

export interface ViewerView {
  user: RoomUser;
  clientId: string;
  joinedAt: number;
}

/** Управляющие команды от хоста зрителям. */
export type RoomControl =
  | { type: "PLAYER_PLAY"; currentTime: number }
  | { type: "PLAYER_PAUSE"; currentTime: number }
  | { type: "PLAYER_SEEK"; currentTime: number }
  | { type: "LOAD_EPISODE"; hlsUrl: string; name: string };

export interface RoomChatMsg {
  id: string;
  profileId: string;
  nickname: string;
  avatar: string | null;
  text: string;
  createdAt: number;
  local?: boolean;
}

export interface PlayheadState {
  currentTime: number;
  isPlaying: boolean;
}

/** Короткий читаемый id комнаты (base36). */
export function makeRoomId(length = 7): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[values[i] % alphabet.length];
  return out;
}

async function resolveMe(): Promise<RoomUser | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return null;
    let nickname = (user.user_metadata?.nickname as string) || user.email?.split("@")[0] || "Юзер";
    let avatar: string | null = null;
    const { data: prof } = await supabase
      .from("profiles")
      .select("nickname, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    if (prof) {
      if (prof.nickname) nickname = prof.nickname;
      if (prof.avatar_url != null) avatar = prof.avatar_url;
    }
    return { profileId: user.id, nickname, avatar };
  } catch {
    return null;
  }
}

// Реалтайм-канал супабаз: типы по версии местами строгие, потому каст под неявный
// runtime-overshoot. Runtime окна используют метод send/track/presenceState.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RealtimeChannel = any;

interface WatchRoomOptions {
  roomId: string | null;
  /** берётся на лету из heartbeat (не замыканием) */
  onLocalPlayheadRequest: (() => PlayheadState | null) | null;
  onRemoteCommand?: (cmd: RoomControl) => void;
}

export interface UseWatchRoomResult {
  ready: boolean;
  subscribed: boolean;
  me: RoomUser | null;
  isHost: boolean;
  host: RoomUser | null;
  viewers: ViewerView[];
  viewerCount: number;
  chat: RoomChatMsg[];
  hostSyncActive: boolean;
  isRemoteInProgress: boolean;
  freeControl: boolean;
  emitControl: (cmd: RoomControl) => void;
  emitChat: (text: string) => void;
  updateHostFreeControl: (allow: boolean) => void;
}

export function useWatchRoom(options: WatchRoomOptions): UseWatchRoomResult {
  const { roomId, onRemoteCommand } = options;

  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<RoomUser | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [metaList, setMetaList] = useState<PresenceMeta[]>([]);
  const [chat, setChat] = useState<RoomChatMsg[]>([]);
  const [isRemoteInProgress, setIsRemoteInProgress] = useState(false);
  const [freeControlState, setFreeControlState] = useState(false);

  const clientIdRef = useRef<string>(crypto.randomUUID());
  const joinedAtRef = useRef<number>(Date.now());
  const playheadRef = useRef(options.onLocalPlayheadRequest);
  const onRemoteRef = useRef(onRemoteCommand);
  playheadRef.current = options.onLocalPlayheadRequest;
  onRemoteRef.current = onRemoteCommand;

  const meRef = useRef<RoomUser | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const allowControlRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    resolveMe().then((u) => {
      if (cancelled) return;
      meRef.current = u;
      setMe(u);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // ---- Presence + Broadcast канал ----
  useEffect(() => {
    const client = supabase;
    const rid = roomId;
    const meSnapshot = me;
    if (!client || !rid || !meSnapshot) return;
    let alive = true;

    const cid = clientIdRef.current;
    const joinedAt = joinedAtRef.current;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ch: RealtimeChannel = (client as any).channel(`watch:${rid}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = ch;

    const trackMe = (allowControl: boolean) => {
      const u = meRef.current;
      if (!u || !alive) return;
      const meta: PresenceMeta = {
        clientId: cid,
        profileId: u.profileId,
        nickname: u.nickname,
        avatar: u.avatar,
        joinedAt,
        allowControl,
      };
      void ch.track(meta as unknown as Record<string, unknown>).catch(() => {});
    };
    allowControlRef.current = false;

    ch.on("presence", { event: "sync" }, () => {
      if (!alive) return;
      // presenceState(): { [key]: meta[] }
      const state = ch.presenceState() as Record<string, PresenceMeta[]>;
      const flat: PresenceMeta[] = [];
      Object.keys(state || {}).forEach((k) => {
        const arr = state[k];
        const items = Array.isArray(arr) ? arr : [arr];
        items.forEach((m) => { if (m && typeof m === "object") flat.push(m as PresenceMeta); });
      });
      setMetaList(flat);
    });

    ch.on("broadcast", { event: "ROOM_COMMAND" }, (payload: { payload?: { cmd?: RoomControl } }) => {
      if (!alive) return;
      const cmd = payload?.payload?.cmd;
      if (!cmd) return;
      setIsRemoteInProgress(true);
      window.setTimeout(() => setIsRemoteInProgress(false), 2500);
      onRemoteRef.current?.(cmd);
    });

    ch.on("broadcast", { event: "ROOM_CHAT" }, (payload: { payload?: RoomChatMsg }) => {
      if (!alive) return;
      const m = payload?.payload;
      if (!m || !m.id) return;
      setChat((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
    });

    ch.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED" && alive) {
        setSubscribed(true);
        trackMe(false);
      }
    });

    return () => {
      alive = false;
      void client.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, me?.profileId]);

  // ---- Хост = самый ранний joinedAt; читаем его allowControl ----
  const { hostClient, isHost } = useMemo(() => {
    let resultClient: PresenceMeta | null = null;
    if (metaList.length) {
      const seen = new Map<string, PresenceMeta>();
      for (const m of metaList) {
        const prev = seen.get(m.clientId);
        if (!prev || m.joinedAt < prev.joinedAt) seen.set(m.clientId, m);
      }
      for (const m of seen.values()) {
        if (!resultClient || m.joinedAt < resultClient.joinedAt) resultClient = m;
      }
    }
    return { hostClient: resultClient, isHost: resultClient !== null && resultClient.clientId === clientIdRef.current };
  }, [metaList]);

  // freeControl = хост разрешил свободное управление (или my own toggle)
  useEffect(() => {
    if (isHost) {
      setFreeControlState(allowControlRef.current);
    } else if (hostClient) {
      setFreeControlState(Boolean(hostClient.allowControl));
    }
  }, [isHost, hostClient]);

  // Когда хост начинает управлять — этот юзер он
  const hostUser: RoomUser | null = useMemo(
    () => (hostClient ? { profileId: hostClient.profileId, nickname: hostClient.nickname, avatar: hostClient.avatar } : null),
    [hostClient],
  );

  const viewers: ViewerView[] = useMemo(() => {
    const byClient = new Map<string, PresenceMeta>();
    metaList.forEach((m) => {
      const old = byClient.get(m.clientId);
      if (!old || m.joinedAt >= old.joinedAt) byClient.set(m.clientId, m);
    });
    const out: ViewerView[] = [];
    byClient.forEach((m) => {
      out.push({ user: { profileId: m.profileId, nickname: m.nickname, avatar: m.avatar }, clientId: m.clientId, joinedAt: m.joinedAt });
    });
    return out.sort((a, b) => a.joinedAt - b.joinedAt);
  }, [metaList]);

  const emitChat = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      const u = meRef.current;
      if (!trimmed || !roomId || !u || !channelRef.current) return;
      const msg: RoomChatMsg = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        profileId: u.profileId,
        nickname: u.nickname,
        avatar: u.avatar,
        text: trimmed,
        createdAt: Date.now(),
        local: true,
      };
      setChat((cur) => [...cur, msg]);
      void (channelRef.current as RealtimeChannel)
        .send({ type: "broadcast", event: "ROOM_CHAT", payload: msg })
        .catch(() => {});
    },
    [roomId],
  );

  const emitControl = useCallback(
    (cmd: RoomControl) => {
      // Авторизация выполняется на стороне вызывающего (хост или free-control).
      if (!roomId || !channelRef.current) return;
      void (channelRef.current as RealtimeChannel)
        .send({ type: "broadcast", event: "ROOM_COMMAND", payload: { cmd } })
        .catch(() => {});
    },
    [roomId],
  );

  const updateHostFreeControl = useCallback(
    (allow: boolean) => {
      allowControlRef.current = allow;
      if (!isHost) return;
      setFreeControlState(allow);
      const u = meRef.current;
      if (!channelRef.current || !u) return;
      const meta: PresenceMeta = {
        clientId: clientIdRef.current,
        profileId: u.profileId,
        nickname: u.nickname,
        avatar: u.avatar,
        joinedAt: joinedAtRef.current,
        allowControl: allow,
      };
      void (channelRef.current as RealtimeChannel).track(meta as unknown as Record<string, unknown>).catch(() => {});
    },
    [isHost],
  );

  // ---- Heartbeat хоста: раз в 5 с шлём play/pause pulse ----
  useEffect(() => {
    if (!isHost || !roomId) return;
    const timer = setInterval(() => {
      const ph = playheadRef.current?.();
      if (!ph) return;
      emitControl({ type: ph.isPlaying ? "PLAYER_PLAY" : "PLAYER_PAUSE", currentTime: ph.currentTime });
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, roomId]);

  return {
    ready,
    subscribed,
    me,
    isHost,
    host: hostUser,
    viewers,
    viewerCount: viewers.length,
    chat,
    hostSyncActive: isHost,
    isRemoteInProgress,
    freeControl: isHost ? freeControlState : freeControlState,
    emitControl,
    emitChat,
    updateHostFreeControl,
  };
}
