"use client";

import Hls from "hls.js";
import {
  useEffect, useImperativeHandle, useRef, useState, forwardRef, useCallback,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users, Play, Pause, Copy, LogIn, Film, MonitorPlay, Send, ShieldCheck, ShieldOff, Crown,
  Volume2, VolumeX, Maximize2, Minimize2, PictureInPicture2,
} from "lucide-react";
import { toast } from "@/components/providers/toast-provider";
import { useWatchRoom, makeRoomId, type RoomControl, type RoomChatMsg } from "@/hooks/useWatchRoom";

/* =====================================================================
 * Типы / хелперы
 * ===================================================================== */

interface Episode { name: string; hlsUrl: string; }
interface EpisodesMap { [key: string]: Episode; }
type Mode = "anilibria" | "kodik";

interface PlayState { currentTime: number; isPlaying: boolean; duration: number; }

function fmt(tN: number): string {
  const t = Number.isFinite(tN) && tN >= 0 ? tN : 0;
  const s = Math.floor(t % 60);
  const m = Math.floor((t / 60) % 60);
  const h = Math.floor(t / 3600);
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

function colorFor(id: string): string {
  const palette = ["#FF5370", "#82AAFF", "#C3E88D", "#F78C6C", "#7FDBCA", "#C792EA", "#FFCB6B", "#80CBC4"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

const QUICK_EMOJI = ["🔥", "😂", "❤️", "👍", "👀", "🎉", "🤯", "🍿"];

export interface PlayerHandle {
  getState: () => PlayState;
  seek: (t: number) => void;
  togglePlay: () => void;
  setPlaying: (play: boolean) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  requestPip: () => void;
  toggleFullscreen: () => void;
}

/* =====================================================================
 * Плеер: HLS <video> + стеклянный chrome (звук / PiP / fullscreen / перемотка)
 * Синхрон: playTitle/pause/seek идут через реф-методы, громкость/мут — локально.
 * Локальные «нажатия» переадресуются родителю (авторизация + broadcast) через onUserToggle/onUserSeek.
 * ===================================================================== */

function ControlledVideo({
  src, interactive, onUserToggle, onUserSeek, onDenied, onState,
}: {
  src: string;
  interactive: boolean;
  onUserToggle: () => void;
  onUserSeek: (t: number) => void;
  onDenied: () => void;
  onState?: (s: PlayState) => void;
}, ref: React.ForwardedRef<PlayerHandle>) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [ready, setReady] = useState(false);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  // ForwardedRef в виде объекта (как при ref={useRef()}), чтобы дёргать собственный handle в chrome
  const api = () => (ref as React.MutableRefObject<PlayerHandle | null> | null)?.current;

  // локальный chrome-стейт
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlayingUi] = useState(false);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFs, setIsFs] = useState(false);

  const snapshot = useCallback((): PlayState => {
    const v = videoRef.current;
    const playingUi = !(v?.paused ?? true);
    const duration = Number.isFinite(v?.duration) ? v?.duration ?? 0 : 0;
    return { currentTime: v?.currentTime ?? 0, isPlaying: playingUi, duration };
  }, []);
  const publish = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      setCur(v.currentTime);
      setPlayingUi(!v.paused);
      const d = v.duration;
      if (Number.isFinite(d)) {
        setDur(d as number);
      }
    }
    onStateRef.current?.(snapshot());
  }, [snapshot]);

  useImperativeHandle(ref, () => ({
    getState: snapshot,
    seek: (t) => {
      const v = videoRef.current;
      if (v) v.currentTime = Math.max(0, t);
      publish();
    },
    togglePlay: () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) void v.play().catch(() => {}); else v.pause();
      window.setTimeout(publish, 40);
    },
    setPlaying: (play) => {
      const v = videoRef.current;
      if (!v) return;
      if (play && v.paused) void v.play().catch(() => {});
      else if (!play && !v.paused) v.pause();
    },
    setVolume: (vl) => {
      const v = videoRef.current;
      setVol(vl);
      if (v) {
        v.volume = vl;
        v.muted = false;
        setMuted(false);
      }
    },
    setMuted: (m) => {
      const v = videoRef.current;
      setMuted(m);
      if (v) v.muted = m;
    },
    requestPip: () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.pictureInPictureElement) {
        void document.exitPictureInPicture().catch(() => {});
      } else {
        void (v as HTMLVideoElement & { requestPictureInPicture?: () => Promise<void> })
          .requestPictureInPicture?.()
          .catch(() => {});
      }
    },
    toggleFullscreen: () => {
      const b = boxRef.current;
      if (!b) return;
      if (!document.fullscreenElement) void b.requestFullscreen().catch(() => {});
      else void document.exitFullscreen().catch(() => {});
    },
  }), [publish, snapshot]);

  // HLS loader
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) { setReady(false); return; }
    setReady(false);
    setCur(0);
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch { /* */ } }
    hlsRef.current = null;
    v.pause();
    v.removeAttribute("src");
    try { v.load(); } catch { /* */ }
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, () => setReady(true));
      hls.on(Hls.Events.ERROR, (_e, data) => { if (data && data.fatal) setReady(false); });
      hlsRef.current = hls;
    } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = src;
      setReady(true);
    }
    return () => { if (hlsRef.current) { try { hlsRef.current.destroy(); } catch { /* */ } } hlsRef.current = null; };
  }, [src]);

  // следим за native fullscreen
  useEffect(() => {
    const onFs = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const doToggle = () => { if (interactive) onUserToggle(); else onDenied(); };
  const canvasPip = typeof document !== "undefined" && (!!document.pictureInPictureEnabled || !!(document as unknown as { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled);

  return (
    <div
      ref={boxRef}
      className="group/vp relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-black shadow-cyber"
    >
      <video
        ref={videoRef}
        className="h-full w-full"
        playsInline
        preload="metadata"
        autoPlay
        onClick={doToggle}
        onDoubleClick={() => { if (interactive) api()?.toggleFullscreen(); }}
        onLoadedMetadata={publish}
        onDurationChange={publish}
        onTimeUpdate={publish}
        onPlay={publish}
        onPause={publish}
        onSeeked={publish}
        onEnded={publish}
      />

      {/* загрузчик */}
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      )}

      {/* центральная кнопка (когда пауза/не готов к тапу) */}
      {!playing && ready && (
        <button
          type="button"
          onClick={doToggle}
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-accent hover:text-background"
          aria-label="Смотреть"
        >
          <Play className="ml-1 h-7 w-7" />
        </button>
      )}

      {/* статус управления (если не дано) */}
      {!interactive && ready && (
        <button type="button" onClick={onDenied} className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-3 py-1.5 text-[11px] font-semibold text-white/85 backdrop-blur transition hover:bg-black/75">
          <ShieldCheck className="h-3.5 w-3.5" /> Управление у создателя
        </button>
      )}

      {/* нижний стеклянный бар */}
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2 pt-12 transition-opacity ${playing ? "opacity-0 group-hover/vp:opacity-100" : "opacity-100"}`}>
        <div
          className="pointer-events-auto flex items-center gap-2 text-white"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* play/pause */}
          <button type="button" onClick={doToggle} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12 backdrop-blur transition hover:bg-accent hover:text-background" aria-label={playing ? "Пауза" : "Смотреть"}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          </button>
          <span className="shrink-0 text-[11px] tabular-nums text-white/85">{fmt(cur)}</span>
          <input
            type="range"
            min={0}
            max={dur || 0}
            step={0.1}
            value={Math.min(cur, dur || 0)}
            onChange={(e) => { const t = Number(e.target.value); if (!interactive) { onDenied(); return; } onUserSeek(t); }}
            style={{ accentColor: "#22d3ee" }}
            className="min-w-0 flex-1 cursor-pointer"
          />
          <span className="shrink-0 text-[11px] tabular-nums text-white/85">{fmt(dur)}</span>

          {/* Звук (для себя — локально) */}
          <button type="button" onClick={() => api()?.setMuted(!muted)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/85 transition hover:text-white" aria-label={muted ? "Включить звук" : "Выключить звук"}>
            {muted || vol === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : vol}
            onChange={(e) => { const vv = Number(e.target.value); api()?.setVolume(vv); }}
            style={{ accentColor: "#22d3ee" }}
            className="hidden w-16 cursor-pointer sm:block"
          />

          {/* мини-окно (PiP) */}
          {canvasPip && (
            <button type="button" onClick={() => api()?.requestPip()} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/85 transition hover:text-white" aria-label="Мини-окно">
              <PictureInPicture2 className="h-4 w-4" />
            </button>
          )}

          {/* полноэкранно (native) */}
          <button
            type="button"
            onClick={() => api()?.toggleFullscreen()}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/85 transition hover:text-white"
            aria-label={isFs ? "Выйти из полного экрана" : "На весь экран"}
          >
            {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
const ControlledVideoForward = forwardRef(ControlledVideo);
ControlledVideoForward.displayName = "ControlledVideo";

/* =====================================================================
 * Аватары
 * ===================================================================== */

function AvatarImg({ nickname, avatar }: { nickname: string; avatar: string | null }) {
  return avatar ? (
    <img src={avatar} alt="" className="h-9 w-9 rounded-full border border-border object-cover" />
  ) : (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-gradient text-xs font-bold text-background">
      {(nickname || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
function AvatarMini({ nickname, avatar }: { nickname: string; avatar: string | null }) {
  return avatar ? (
    <img src={avatar} alt="" className="h-8 w-8 rounded-full border border-border object-cover" />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-gradient text-[10px] font-bold text-background">
      {(nickname || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

interface RoomSideProps {
  header: string;
  viewerCount: number;
  viewers: { clientId: string; user: { profileId: string; nickname: string; avatar: string | null } }[];
  meProfileId: string | null;
  hostProfileId: string | null;
  chat: RoomChatMsg[];
  draft: string;
  setDraft: (v: string) => void;
  onEnter: () => void;
  showEmoji: boolean;
  setShowEmoji: (v: boolean) => void;
  chatBoxRef: React.MutableRefObject<HTMLDivElement | null>;
  heightCls?: string;
}

function RoomSide(p: RoomSideProps) {
  const heightCls = p.heightCls || "h-[560px] lg:h-[680px]";
  return (
    <div className={`flex w-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-panel ${heightCls}`}>
      <div className="flex items-center justify-between border-b border-border bg-surface/40 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{p.header}</p>
        <span className="text-xs text-muted">{p.viewerCount}</span>
      </div>
      {/* участники */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-3">
        {p.viewers.map((v) => {
          const isHostUser = p.hostProfileId === v.user.profileId;
          const isMe = v.user.profileId === p.meProfileId;
          return (
            <div key={v.clientId} className="relative" title={`${v.user.nickname}${isHostUser ? " · создатель" : ""}`}>
              <AvatarImg nickname={v.user.nickname} avatar={v.user.avatar} />
              {isHostUser && <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-background"><Crown className="h-2.5 w-2.5" /></span>}
              {isMe && <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-card" />}
            </div>
          );
        })}
        {p.viewers.length === 0 && <span className="text-xs text-muted">Пока никого — пригласите друзей.</span>}
      </div>
      {/* чат */}
      <div ref={p.chatBoxRef as React.RefObject<HTMLDivElement>} className="min-h-[120px] flex-1 overflow-y-auto px-4 py-3 scrollbar-cyber">
        {p.chat.length === 0 && <p className="mt-3 text-center text-xs text-muted">Чат пуст — напишите первым 👋</p>}
        {p.chat.map((m: RoomChatMsg) => (
          <div key={m.id} className="mb-2.5 flex items-start gap-2">
            <span className="mt-0.5 shrink-0"><AvatarMini nickname={m.nickname} avatar={m.avatar} /></span>
            <div className="min-w-0">
              <span className="text-[11px] font-bold" style={{ color: colorFor(m.profileId) }}>{m.nickname}</span>
              <p className="mt-0.5 break-words text-sm leading-snug text-foreground/90">{m.text}</p>
            </div>
          </div>
        ))}
      </div>
      {/* ввод */}
      <div className="border-t border-border bg-surface/40 p-3">
        {p.showEmoji && (
          <div className="mb-2 flex flex-wrap gap-1">
            {QUICK_EMOJI.map((e) => (<button key={e} type="button" onClick={() => p.setDraft((p.draft + e))} className="rounded-md px-1 py-0.5 text-base transition hover:bg-surface-2">{e}</button>))}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => p.setShowEmoji(!p.showEmoji)} className="rounded-lg p-2 text-base leading-none hover:bg-surface-2" aria-label="Эмодзи">😀</button>
          <input value={p.draft} onChange={(e) => p.setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") p.onEnter(); }}
            placeholder="Сообщение…"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent" />
          <button type="button" onClick={p.onEnter} disabled={!p.draft.trim()} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-background transition hover:opacity-90 disabled:opacity-40" aria-label="Отправить"><Send className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 * Кодек/доменные зеркала + Главный компонент
 * ===================================================================== */

const KODIK_MIRRORS = [
  { id: "s1", name: "Сервер 1", domain: "https://kodik.ydns.eu" },
  { id: "s2", name: "Сервер 2", domain: "https://kodik.biz" },
  { id: "s3", name: "Сервер 3", domain: "https://kodik.info" },
];

export function WatchParty({ animeId, animeTitle, roomId }: { animeId: string; animeTitle: string; roomId: string | null }) {
  const [roomKey] = useState<string>(() => roomId || makeRoomId());
  const [mode, setMode] = useState<Mode>("anilibria");
  const [kodikServer, setKodikServer] = useState(KODIK_MIRRORS[0].domain);
  const [cinema, setCinema] = useState(false);

  const [episodes, setEpisodes] = useState<EpisodesMap>({});
  const [currentSrc, setCurrentSrc] = useState<string>("");
  const [activeEp, setActiveEp] = useState("");
  const [streamLoading, setStreamLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [freeCtrlVisible, setFreeCtrlVisible] = useState(false);
  const [gateDone, setGateDone] = useState(false);

  const playerRef = useRef<PlayerHandle | null>(null);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  const room = useWatchRoom({
    roomId: roomKey,
    onLocalPlayheadRequest: () => {
      const s = playerRef.current?.getState();
      return s ? { currentTime: s.currentTime, isPlaying: s.isPlaying } : null;
    },
    onRemoteCommand: (cmd) => applyRemoteRef.current(cmd),
  });

  const isMeHost = room.isHost;
  const canControl = !!room.isHost || !!room.freeControl;
  useEffect(() => { if (room.ready) setGateDone(true); }, [room.ready]);

  // Приём сетевых команд — реальный play/pause + автодогон при рассинхроне
  const applyRemoteRef = useRef<(cmd: RoomControl) => void>(() => {});
  applyRemoteRef.current = (cmd: RoomControl) => {
    if (cmd.type === "LOAD_EPISODE") { setCurrentSrc(cmd.hlsUrl); setActiveEp(cmd.name); return; }
    const h = playerRef.current;
    if (!h) return;
    if (cmd.type === "PLAYER_SEEK") { h.seek(cmd.currentTime); return; }
    const mine = h.getState().currentTime;
    if (cmd.type === "PLAYER_PLAY") h.setPlaying(true);
    if (cmd.type === "PLAYER_PAUSE") h.setPlaying(false);
    if (Math.abs(mine - cmd.currentTime) > 2) h.seek(cmd.currentTime);
  };

  // автоскролл чата
  useEffect(() => { chatBoxRef.current?.scrollTo({ top: chatBoxRef.current.scrollHeight, behavior: "smooth" }); }, [room.chat.length]);

  // новичка — сразу выдаём позицию
  const prevCountRef = useRef(0);
  useEffect(() => {
    const n = room.viewerCount;
    if (isMeHost && n > prevCountRef.current && n >= 2) {
      const st = playerRef.current?.getState();
      if (st) room.emitControl({ type: st.isPlaying ? "PLAYER_PLAY" : "PLAYER_PAUSE", currentTime: st.currentTime });
    }
    prevCountRef.current = n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.viewerCount, isMeHost]);

  // escape закрывает кино
  useEffect(() => {
    if (!cinema) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCinema(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cinema]);

  // данные AniLibria
  useEffect(() => {
    let mounted = true;
    setStreamLoading(true);
    setStreamError(null);
    fetch(`/api/anilibria?title=${encodeURIComponent(animeTitle)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        if (d?.success === false || !d?.episodes || Object.keys(d.episodes).length === 0) { setEpisodes({}); setStreamLoading(false); return; }
        const eps = d.episodes as EpisodesMap;
        setEpisodes(eps);
        const k = Object.keys(eps)[0];
        setActiveEp(eps[k].name || k);
        setCurrentSrc(eps[k].hlsUrl);
        setStreamLoading(false);
      })
      .catch((e: unknown) => { if (!mounted) return; setStreamError(e instanceof Error ? e.message : "Ошибка"); setStreamLoading(false); });
    return () => { mounted = false; };
  }, [animeTitle]);

  const denied = () => toast("Управление у создателя комнаты", true);
  const copyLink = () => { const u = `${window.location.origin}/watch/${animeId}?room=${roomKey}`; void navigator.clipboard?.writeText(u).catch(() => {}); toast("Ссылка на комнату скопирована ✨"); };
  const sendChat = () => { if (!draft.trim()) return; room.emitChat(draft); setDraft(""); setShowEmoji(false); };

  const doToggle = () => {
    if (!canControl) { denied(); return; }
    const was = playerRef.current?.getState().isPlaying;
    playerRef.current?.togglePlay();
    window.setTimeout(() => {
      const st = playerRef.current?.getState();
      if (!st) return;
      room.emitControl({ type: !was ? "PLAYER_PLAY" : "PLAYER_PAUSE", currentTime: st.currentTime });
    }, 80);
  };
  const doSeek = (t: number) => {
    if (!canControl) { denied(); return; }
    playerRef.current?.seek(t);
    room.emitControl({ type: "PLAYER_SEEK", currentTime: t });
  };
  const chooseEpisode = (hlsUrl: string, key: string) => {
    if (!canControl) { denied(); return; }
    const ep = episodes[key];
    const name = ep?.name || `Серия ${key}`;
    setCurrentSrc(hlsUrl); setActiveEp(name);
    room.emitControl({ type: "LOAD_EPISODE", hlsUrl, name });
  };
  const toggleFree = () => {
    if (!isMeHost) { denied(); return; }
    const next = !freeCtrlVisible;
    setFreeCtrlVisible(next);
    room.updateHostFreeControl(next);
  };

  // ── ранние экраны (auth/guest) ──
  if (!gateDone) return <div className="flex min-h-[50vh] items-center justify-center py-24"><span className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  if (!room.me) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-gradient text-background"><Users className="h-8 w-8" /></span>
        <h2 className="font-display text-2xl font-extrabold">Смотреть вместе</h2>
        <p className="text-sm text-muted">Комнаты совместного просмотра доступны только авторизованным пользователям. Войдите в аккаунт, чтобы создать или присоединиться к комнате.</p>
        <button type="button" onClick={() => toast("Откройте свой профиль и войдите", true)} className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-background hover:opacity-90"><LogIn className="h-4 w-4" /> Войти в аккаунт</button>
      </div>
    );
  }

  const showPlayer = mode === "anilibria" && !streamError && !!currentSrc;

  /* =========================================================
   * Общее «тело» (видео + панель комнаты) — переиспользую в
   * обычном режиме и в кино-оверлее.
   * ========================================================= */
  const roomSideProps: RoomSideProps = {
    header: "В комнате",
    viewerCount: room.viewerCount,
    viewers: room.viewers,
    meProfileId: room.me?.profileId ?? null,
    hostProfileId: room.host?.profileId ?? null,
    chat: room.chat,
    draft,
    setDraft,
    onEnter: sendChat,
    showEmoji,
    setShowEmoji,
    chatBoxRef,
  };

  const playerBlock = showPlayer ? (
    <ControlledVideoForward
      ref={playerRef}
      src={currentSrc}
      interactive={canControl}
      onUserToggle={doToggle}
      onUserSeek={doSeek}
      onDenied={denied}
    />
  ) : streamError ? (
    <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-border/60 bg-black/60">
      <p className="px-6 text-center text-sm text-red-300">Не удалось загрузить AniLibria: {streamError}</p>
    </div>
  ) : streamLoading ? (
    <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-border/60 bg-black/60"><span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>
  ) : (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-black/60 text-center text-muted">
      <Film className="h-8 w-8 text-accent/50" />
      <p className="max-w-sm text-sm">Для этого тайтла нет озвучки в AniLibria. Можно смотреть на Kodik — но синхрон будет только на AniLibria.</p>
    </div>
  );

  // Полная (обычная) компоновка
  const bodyNormal = (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-lg border border-border bg-surface p-1">
            {(["anilibria", "kodik"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${mode === m ? "bg-accent text-background shadow-neon-sm" : "text-muted hover:text-foreground"}`}>
                {m === "anilibria" ? <Film className="h-3.5 w-3.5" /> : <MonitorPlay className="h-3.5 w-3.5" />}
                {m === "anilibria" ? "AniLibria" : "Kodik"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${room.viewerCount > 0 ? "bg-emerald-400 animate-pulse-glow" : "bg-muted"}`} />{room.viewerCount} в сети</span>
            {isMeHost && (
              <button type="button" onClick={toggleFree} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition ${(freeCtrlVisible || room.freeControl) ? "bg-amber-400/15 text-amber-300" : "text-muted hover:text-foreground"}`}>
                {freeCtrlVisible || room.freeControl ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {freeCtrlVisible || room.freeControl ? "Свободное управление" : "Только хост"}
              </button>
            )}
          </div>
        </div>

        {playerBlock}

        {mode === "kodik" ? (
          <>
            <div className="flex gap-1.5">
              {KODIK_MIRRORS.map((m) => (
                <button key={m.id} type="button" onClick={() => setKodikServer(m.domain)} className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${kodikServer === m.domain ? "text-accent" : "text-muted hover:text-foreground"}`}>{m.name}</button>
              ))}
            </div>
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-black shadow-cyber">
              <iframe key={kodikServer} src={`${kodikServer}/?shikimoriID=${animeId}`} title="Kodik" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="origin" className="absolute inset-0 h-full w-full border-0" />
            </div>
            <p className="flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
              <MonitorPlay className="h-3.5 w-3.5 shrink-0" /> Kodik — внешний iframe. Смотрим вместе, но синхрон доступен только на AniLibria.
            </p>
          </>
        ) : (
          <>
            {Object.keys(episodes).length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Серии</p>{activeEp && <span className="text-[11px] text-accent">{activeEp}</span>}</div>
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto scrollbar-cyber">
                  {Object.keys(episodes).map((key) => {
                    const ep = episodes[key];
                    const activeHref = ep.hlsUrl === currentSrc;
                    return (
                      <button key={key} type="button" onClick={() => chooseEpisode(ep.hlsUrl, key)}
                        className={`rounded-lg px-3 py-1.5 text-xs transition border ${activeHref ? "border-accent bg-accent text-background font-bold shadow-neon-sm" : "border-border bg-surface text-muted hover:border-accent/40 hover:text-foreground"}`}>
                        {ep.name || `Серия ${key}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <RoomSide {...roomSideProps} heightCls="h-[560px] lg:h-[680px]" />
    </div>
  );

  /* ============== Рендер ============== */
  return (
    <section className="space-y-4">
      {/* Верхняя панель задач: развернуть в кино + копировать */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-cyber">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-background"><Users className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-extrabold leading-tight">Смотреть вместе</h1>
            <p className="truncate text-xs text-muted">{animeTitle} · комната <span className="font-mono text-accent">#{roomKey.slice(0, 8)}</span> · {isMeHost ? "вы создатель" : "вы гость"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Кино с чатом справа */}
          {mode === "anilibria" && showPlayer && (
            <button type="button" onClick={() => { setCinema(true); setShowEmoji(false); }}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:border-accent/60 hover:text-accent">
              <Maximize2 className="h-4 w-4" /> На весь экран
            </button>
          )}
          <button type="button" onClick={copyLink} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:border-accent/60 hover:text-accent"><Copy className="h-4 w-4" /> Скопировать</button>
        </div>
      </div>

      {/* обычный режим (пока не открыто кино) */}
      {!cinema && bodyNormal}

      {/* ═══ КИНО-РЕЖИМ: оверлей с живым фоном; видео вписано в кадр; чат съезжает справа ═══ */}
      <AnimatePresence>
        {cinema && (
          <motion.div
            key="cinema"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] flex flex-col bg-background"
            style={{ backgroundImage: "radial-gradient(rgb(var(--accent) / 0.05) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          >
            {/* верхняя плашка */}
            <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-surface/50 px-4 py-2 backdrop-blur">
              <span className="flex min-w-0 items-center gap-2 truncate text-sm font-bold text-foreground">
                <Maximize2 className="h-4 w-4 shrink-0 text-accent" /> Кино · <span className="truncate">{activeEp || animeTitle}</span>
              </span>
              <div className="flex items-center gap-2">
                {!canControl && <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-muted"><ShieldCheck className="h-3.5 w-3.5 text-accent" /> Управление у создателя</span>}
                {room.viewerCount > 0 && (
                  <span className="hidden items-center gap-1.5 text-xs text-muted sm:inline-flex">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-glow" />{room.viewerCount}
                  </span>
                )}
                <button type="button" onClick={() => { setShowEmoji(false); setCinema(false); }} title="Свернуть (Esc)"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-background transition hover:opacity-90">
                  <Minimize2 className="h-3.5 w-3.5" /> Свернуть
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
              {/* видео — вписывается и по ширине, и по высоте кадра */}
              <div className="relative flex min-h-0 items-center justify-center overflow-hidden p-2 sm:p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 24 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", stiffness: 150, damping: 22 }}
                  className="w-auto max-w-full"
                  // ширина исходя из высоты кадра: 16/9 * оставшееся вертикальное пространство
                  style={{ width: "min(100%, calc((100vh - 140px) * 16 / 9))" }}
                >
                  <ControlledVideoForward ref={playerRef} src={currentSrc} interactive={canControl}
                    onUserToggle={doToggle} onUserSeek={doSeek} onDenied={denied} />
                </motion.div>
              </div>

              {/* чат — правый край, увеличивается */}
              <motion.div
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 40, opacity: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 26 }}
                className="relative h-[42vh] border-t border-border/60 lg:h-full lg:border-l lg:border-t-0"
              >
                <RoomSide {...roomSideProps} header="Зрители · чат" heightCls="h-full" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
