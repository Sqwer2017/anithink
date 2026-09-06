"use client";

import Hls from "hls.js";
import {
  useEffect, useImperativeHandle, useRef, useState, forwardRef, useCallback,
} from "react";
import {
  Users, Play, Pause, Copy, LogIn, Film, MonitorPlay, Send, ShieldCheck, ShieldOff, Crown,
} from "lucide-react";
import { toast } from "@/components/providers/toast-provider";
import { useWatchRoom, makeRoomId, type RoomControl, type RoomChatMsg } from "@/hooks/useWatchRoom";

/* =====================================================================
 * Типы
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

/* =====================================================================
 * HLS "<video>" — только воспроизведение. Управляем извне через handle.
 * ===================================================================== */

export interface PlayerHandle {
  getState: () => PlayState;
  seek: (t: number) => void;
  togglePlay: () => void;
  /** включить/выключить воспроизведение (приходит издалека по сети) */
  setPlaying: (play: boolean) => void;
}

function ControlledVideo(
  { src, onPlayState }: { src: string; onPlayState?: (s: PlayState) => void },
  ref: React.ForwardedRef<PlayerHandle>,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [ready, setReady] = useState(false);
  const onPlayStateRef = useRef(onPlayState);
  onPlayStateRef.current = onPlayState;

  const snapshot = useCallback((): PlayState => {
    const v = videoRef.current;
    const t = v?.currentTime ?? 0;
    const playing = !(v?.paused ?? true);
    const duration = Number.isFinite(v?.duration) ? v?.duration ?? 0 : 0;
    return { currentTime: t, isPlaying: playing, duration };
  }, []);

  const publish = useCallback(() => { onPlayStateRef.current?.(snapshot()); }, [snapshot]);

  useImperativeHandle(ref, () => ({
    getState: snapshot,
    seek: (t) => { if (videoRef.current) { videoRef.current.currentTime = t; } publish(); },
    togglePlay: () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) void v.play().catch(() => {}); else v.pause();
      // publish slight delay: 'play'/'pause' events also do
      window.setTimeout(publish, 40);
    },
    setPlaying: (play) => {
      const v = videoRef.current;
      if (!v) return;
      if (play && v.paused) void v.play().catch(() => {});
      else if (!play && !v.paused) v.pause();
    },
  }), [snapshot, publish]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) { setReady(false); return; }
    setReady(false);
    const prev = hlsRef.current;
    if (prev) { try { prev.destroy(); } catch { /* */ } }
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
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data && data.fatal) setReady(false);
      });
      hlsRef.current = hls;
    } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = src;
      setReady(true);
    }

    return () => {
      if (hlsRef.current) { try { hlsRef.current.destroy(); } catch { /* */ } }
      hlsRef.current = null;
    };
  }, [src]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-black shadow-cyber">
      <video
        ref={videoRef}
        className="h-full w-full"
        playsInline
        preload="metadata"
        autoPlay
        onLoadedMetadata={publish}
        onDurationChange={publish}
        onTimeUpdate={publish}
        onPlay={publish}
        onPause={publish}
        onSeeked={publish}
        onEnded={publish}
      />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/50">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      )}
    </div>
  );
}
const ControlledVideoForward = forwardRef(ControlledVideo);
ControlledVideoForward.displayName = "ControlledVideo";

/* =====================================================================
 * Панель управления (рендерится там, где есть доступ)
 * ===================================================================== */

function PlaybackBar({ actions, state }: {
  actions: { onToggle: () => void; onSeek: (t: number) => void };
  state: PlayState;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-panel">
      <button
        type="button"
        onClick={actions.onToggle}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-background shadow-neon-sm transition hover:opacity-90"
        aria-label={state.isPlaying ? "Пауза" : "Смотреть"}
      >
        {state.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
      </button>
      <span className="w-12 text-right text-xs tabular-nums text-muted">{fmt(state.currentTime)}</span>
      <input
        type="range"
        min={0}
        max={state.duration || 0}
        step={0.1}
        value={Math.min(state.currentTime, state.duration || 0)}
        onChange={(e) => actions.onSeek(Number(e.target.value))}
        className="min-w-0 flex-1"
        style={{ accentColor: "#22d3ee" }}
      />
      <span className="w-12 text-xs tabular-nums text-muted">{fmt(state.duration)}</span>
    </div>
  );
}

/* =====================================================================
 * Аватар (фиксированные размеры — Tailwind не умеет динамику)
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

/* =====================================================================
 * MAIN: комната
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

  const [episodes, setEpisodes] = useState<EpisodesMap>({});
  const [currentSrc, setCurrentSrc] = useState<string>("");
  const [activeEp, setActiveEp] = useState("");
  const [streamLoading, setStreamLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [playerState, setPlayerState] = useState<PlayState>({ currentTime: 0, isPlaying: false, duration: 0 });
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

  // приём сетевых команд (от хоста/контролёра) — плавная передача:
  // реально включаем/ставим на паузу видео + догоняем при рассинхроне > 2 c
  const applyRemoteRef = useRef<(cmd: RoomControl) => void>(() => {});
  applyRemoteRef.current = (cmd: RoomControl) => {
    if (cmd.type === "LOAD_EPISODE") {
      setCurrentSrc(cmd.hlsUrl);
      setActiveEp(cmd.name);
      return;
    }
    const h = playerRef.current;
    if (!h) return;

    if (cmd.type === "PLAYER_SEEK") { h.seek(cmd.currentTime); return; }

    // PLAY / PAUSE: применяем реальное состояние воспроизведения
    const mine = h.getState().currentTime;
    if (cmd.type === "PLAYER_PLAY") h.setPlaying(true);
    if (cmd.type === "PLAYER_PAUSE") h.setPlaying(false);
    // догоняем позицию, если отстали/обогнали больше чем на 2 c
    if (Math.abs(mine - cmd.currentTime) > 2) h.seek(cmd.currentTime);
  };

  // Автопрокрутка чата
  useEffect(() => { chatBoxRef.current?.scrollTo({ top: chatBoxRef.current.scrollHeight, behavior: "smooth" }); }, [room.chat.length]);

  // Когда в комнату зашёл новый зритель — хост сразу выдаёт свою позицию,
  // чтобы новичок не просидел в начале, ожидая первый heartbeat.
  const prevCountRef = useRef(0);
  useEffect(() => {
    const n = room.viewerCount;
    if (isMeHost && n > prevCountRef.current && n >= 2) {
      const st = playerRef.current?.getState();
      if (st) {
        room.emitControl({ type: st.isPlaying ? "PLAYER_PLAY" : "PLAYER_PAUSE", currentTime: st.currentTime });
      }
    }
    prevCountRef.current = n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.viewerCount, isMeHost]);

  // данные AniLibria
  useEffect(() => {
    let mounted = true;
    setStreamLoading(true);
    setStreamError(null);
    fetch(`/api/anilibria?title=${encodeURIComponent(animeTitle)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        if (d?.success === false || !d?.episodes || Object.keys(d.episodes).length === 0) {
          setEpisodes({});
          setStreamLoading(false);
          return;
        }
        const eps = d.episodes as EpisodesMap;
        setEpisodes(eps);
        const k = Object.keys(eps)[0];
        setActiveEp(eps[k].name || k);
        setCurrentSrc(eps[k].hlsUrl);
        setStreamLoading(false);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setStreamError(e instanceof Error ? e.message : "Ошибка");
        setStreamLoading(false);
      });
    return () => { mounted = false; };
  }, [animeTitle]);

  const denied = () => toast("Управление у создателя комнаты", true);
  const copyLink = () => {
    const u = `${window.location.origin}/watch/${animeId}?room=${roomKey}`;
    void navigator.clipboard?.writeText(u).catch(() => {});
    toast("Ссылка на комнату скопирована ✨");
  };
  const sendChat = () => { if (!draft.trim()) return; room.emitChat(draft); setDraft(""); setShowEmoji(false); };

  const handleToggle = () => {
    if (!canControl) { denied(); return; }
    const h = playerRef.current; if (!h) return;
    const was = playerRef.current!.getState().isPlaying;
    h.togglePlay();
    window.setTimeout(() => {
      const st = playerRef.current?.getState();
      if (!st) return;
      // если только что пауза -> отправить Pause, если ушло в play -> Play
      room.emitControl({ type: !was ? "PLAYER_PLAY" : "PLAYER_PAUSE", currentTime: st.currentTime });
    }, 80);
  };
  const handleSeek = (t: number) => {
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

  // Если снова стал гостем после ухода хоста — сбросить локальный тумблер управления
  const onPlayerChange = (s: PlayState) => setPlayerState(s);

  if (!gateDone) {
    return <div className="flex min-h-[50vh] items-center justify-center py-24"><span className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

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

  return (
    <section className="space-y-4">
      {/* заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-cyber">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-gradient text-background"><Users className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-extrabold leading-tight">Смотреть вместе</h1>
            <p className="truncate text-xs text-muted">{animeTitle} · комната <span className="font-mono text-accent">#{roomKey.slice(0, 8)}</span> · {isMeHost ? "вы создатель" : "вы гость"}</p>
          </div>
        </div>
        <button type="button" onClick={copyLink} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:border-accent/60 hover:text-accent"><Copy className="h-4 w-4" /> Скопировать ссылку</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* левая колонка */}
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
                <button type="button" onClick={toggleFree} title="Кто может управлять воспроизведением"
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition ${(freeCtrlVisible || room.freeControl) ? "bg-amber-400/15 text-amber-300" : "text-muted hover:text-foreground"}`}>
                  {freeCtrlVisible || room.freeControl ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  {freeCtrlVisible || room.freeControl ? "Свободное управление" : "Только хост"}
                </button>
              )}
            </div>
          </div>

          {/* видео + контрол */}
          {mode === "anilibria" ? (
            <>
              {showPlayer ? (
                <>
                  <ControlledVideoForward ref={playerRef} src={currentSrc} onPlayState={onPlayerChange} />
                  <PlaybackBar state={playerState}
                    actions={{
                      onToggle: handleToggle,
                      onSeek: handleSeek,
                    }} />
                  {/* подсказка для тех, кому нельзя управлять */}
                  {!canControl && (
                    <button type="button" onClick={denied} className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-foreground">
                      <ShieldCheck className="h-4 w-4" /> Управление у создателя комнаты (нажмите, чтобы узнать)
                    </button>
                  )}
                </>
              ) : streamError ? (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-5 text-sm text-red-300">Не удалось загрузить AniLibria: {streamError}</p>
              ) : streamLoading ? (
                <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-border/60 bg-black/60"><span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-black/60 text-center text-muted">
                  <Film className="h-8 w-8 text-accent/50" />
                  <p className="max-w-sm text-sm">Для этого тайтла нет озвучки в AniLibria. Можно смотреть на Kodik — но синхрон будет только на AniLibria.</p>
                </div>
              )}

              {/* эпизоды */}
              {Object.keys(episodes).length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Серии</p>
                    {activeEp && <span className="text-[11px] text-accent">{activeEp}</span>}
                  </div>
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
          ) : (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                {KODIK_MIRRORS.map((m) => (
                  <button key={m.id} type="button" onClick={() => setKodikServer(m.domain)}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${kodikServer === m.domain ? "text-accent" : "text-muted hover:text-foreground"}`}>{m.name}</button>
                ))}
              </div>
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-black shadow-cyber">
                <iframe key={kodikServer} src={`${kodikServer}/?shikimoriID=${animeId}`} title="Kodik"
                  allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="origin"
                  className="absolute inset-0 h-full w-full border-0" />
              </div>
              <p className="flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
                <MonitorPlay className="h-3.5 w-3.5 shrink-0" /> Kodik — внешний iframe. Смотрим вместе, но программная синхронизация доступна только на AniLibria.
              </p>
            </div>
          )}
        </div>

        {/* правая панель — комната */}
        <aside className="flex h-[540px] w-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-panel lg:h-[640px]">
          <div className="flex items-center justify-between border-b border-border bg-surface/40 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">В комнате</p>
            <span className="text-xs text-muted">{room.viewerCount}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-3">
            {room.viewers.map((v) => {
              const isHostUser = room.host?.profileId === v.user.profileId;
              const isMe = v.user.profileId === room.me?.profileId;
              return (
                <div key={v.clientId} className="relative" title={`${v.user.nickname}${isHostUser ? " · создатель" : ""}`}>
                  <AvatarImg nickname={v.user.nickname} avatar={v.user.avatar} />
                  {isHostUser && <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-background"><Crown className="h-2.5 w-2.5" /></span>}
                  {isMe && <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-card" />}
                </div>
              );
            })}
            {room.viewers.length === 0 && <span className="text-xs text-muted">Пока никого — пригласите друзей.</span>}
          </div>

          {/* чат */}
          <div ref={chatBoxRef} className="min-h-[120px] flex-1 overflow-y-auto px-4 py-3 scrollbar-cyber">
            {room.chat.length === 0 && <p className="mt-3 text-center text-xs text-muted">Чат пуст — напишите первым 👋</p>}
            {room.chat.map((m: RoomChatMsg) => (
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
            {showEmoji && (
              <div className="mb-2 flex flex-wrap gap-1">
                {QUICK_EMOJI.map((e) => (<button key={e} type="button" onClick={() => setDraft((dd) => dd + e)} className="rounded-md px-1 py-0.5 text-base transition hover:bg-surface-2">{e}</button>))}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setShowEmoji((v) => !v)} className="rounded-lg p-2 text-base leading-none hover:bg-surface-2" aria-label="Эмодзи">😀</button>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                placeholder="Сообщение…"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent" />
              <button type="button" onClick={sendChat} disabled={!draft.trim()} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-background transition hover:opacity-90 disabled:opacity-40" aria-label="Отправить"><Send className="h-4 w-4" /></button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
