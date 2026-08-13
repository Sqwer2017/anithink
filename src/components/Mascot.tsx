"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, X, Sparkles } from "lucide-react";
import { readSettings } from "@/lib/local-settings";

/**
 * Интерактивный Live2D-маскот (Unity-chan) + ИИ-чат.
 *
 * - Рендер через PixiJS v6 + pixi-live2d-display.
 * - Клик (смещение < 5px) → Tap-анимация + открытие чата.
 * - Drag (смещение >= 5px) → перемещение маскота, позиция в localStorage.
 * - Чат-облачко над головой, отсылка в /api/mascot/chat (Gemini + fallback).
 */

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

type PixiLive2D = typeof import("pixi-live2d-display");
type Live2DModelType = Awaited<ReturnType<PixiLive2D["Live2DModel"]["from"]>>;

const POS_KEY = "mascot_position";
const CHAT_KEY = "mascot_chat";

export default function Mascot() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pixi / модель
  const modelRef = useRef<Live2DModelType | null>(null);
  const motionPlayingRef = useRef(false);

  // Drag-состояние
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    moved: false,
  });

  // Чат-состояние
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Включён ли маскот (из настроек). При выключении — не рендерим ничего.
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return readSettings().mascotEnabled ?? true;
    } catch {
      return true;
    }
  });

  // Слушаем изменения настроек (переключатель Синко в /settings)
  useEffect(() => {
    const onSettings = () => {
      try {
        setEnabled(readSettings().mascotEnabled ?? true);
      } catch { /* ignore */ }
    };
    window.addEventListener("anithink:settings-changed", onSettings);
    return () => window.removeEventListener("anithink:settings-changed", onSettings);
  }, []);

  // Позиция маскота. Стартуем как null (одинаково на сервере и клиенте — нет hydration-мисматча),
  // реальную позицию вычисляем в useEffect после гидрации. Дефолт — правый нижний угол.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let next: { x: number; y: number };
    try {
      const raw = window.localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { x: number; y: number };
        if (typeof p?.x === "number" && typeof p?.y === "number") {
          p.x = Math.max(0, Math.min(p.x, w - 80));
          p.y = Math.max(0, Math.min(p.y, h - 120));
          next = p;
        } else {
          next = { x: w - 280, y: h - 360 };
        }
      } else {
        next = { x: w - 280, y: h - 360 };
      }
    } catch {
      next = { x: w - 280, y: h - 360 };
    }
    setPos(next);
  }, []);

  // Восстановление истории чата
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMsg[];
        if (Array.isArray(parsed)) setMessages(parsed.slice(-6));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ── Чат: прокрутка вниз при новых сообщениях ──
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  // ── Блокировка повторного запуска моушена ──
  function playMotion(
    model: Live2DModelType | null,
    group: string,
    index: number,
    priority: number,
    duration = 1500,
  ) {
    if (!model || motionPlayingRef.current) return;
    const mm = (model as any).internalModel?.motionManager;
    if (!mm) return;

    motionPlayingRef.current = true;
    try {
      mm.startMotion(group, index, priority);
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      motionPlayingRef.current = false;
    }, duration);
  }

  // ── Отправка сообщения в чат ──
  async function sendMessage() {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    const userMsg: ChatMsg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setThinking(true);
    // "Разговор/мысль" маскота
    playMotion(modelRef.current, "Tap", Math.floor(Math.random() * 3), 12, 1200);

    try {
      // Клиентский таймаут 20с — чтобы "Синко думает…" не висело вечно,
      // если роут/сеть зависла.
      const controller = new AbortController();
      const clientTimeout = setTimeout(() => controller.abort(), 20000);
      try {
        const res = await fetch("/api/mascot/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ message: text, history: messages }),
        });
        const data = await res.json();
        const reply: ChatMsg = { role: "assistant", content: data.reply || "…" };
        const final = [...next, reply];
        setMessages(final);
        window.localStorage.setItem(CHAT_KEY, JSON.stringify(final.slice(-6)));
      } finally {
        clearTimeout(clientTimeout);
      }
    } catch {
      const reply: ChatMsg = { role: "assistant", content: "Ой, у меня сбой! Попробуй ещё раз 🌸" };
      setMessages((m) => [...m, reply]);
    } finally {
      setThinking(false);
    }
  }

  // ── Пикси / Live2D ──
  useEffect(() => {
    let app: import("pixi.js").Application | null = null;
    let destroyed = false;

    async function init() {
      const [{ Application, Ticker }, { Live2DModel, MotionPriority }] = await Promise.all([
        import("pixi.js"),
        import("pixi-live2d-display"),
      ]);
      if (destroyed || !containerRef.current) return;

      Live2DModel.registerTicker(Ticker);

      app = new Application({
        view: document.createElement("canvas"),
        autoStart: true,
        resizeTo: containerRef.current,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.max(window.devicePixelRatio, 1),
        autoDensity: true,
      });
      // Гарантированно растягиваем канвас на весь контейнер:
      // без inline-стилей Tailwind arbitrary-классы могут не примениться.
      const canvas = app.view as HTMLCanvasElement;
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      containerRef.current.appendChild(canvas);

      const model = await Live2DModel.from("/mascot/unitychan.model3.json");
      modelRef.current = model;

      const scale = Math.min(app.screen.width / model.width, app.screen.height / model.height) * 0.9;
      model.scale.set(scale);
      model.anchor.set(0.5, 1);
      model.position.set(app.screen.width / 2, app.screen.height);

      app.stage.addChild(model as import("pixi.js").DisplayObject);

      // Стартовая idle
      playMotion(model, "Idle", 0, MotionPriority.NORMAL, 4000);
      // Авто-idle каждые 6 секунд (без блокировки кликов)
      const idleTimer = window.setInterval(() => {
        if (!motionPlayingRef.current) {
          motionPlayingRef.current = true;
          try {
            (model as any).internalModel?.motionManager?.startMotion(
              "Idle",
              Math.floor(Math.random() * 3),
              MotionPriority.NORMAL,
            );
          } catch { /* ignore */ }
          window.setTimeout(() => { motionPlayingRef.current = false; }, 2000);
        }
      }, 6000);

      const view = app.view as HTMLCanvasElement;

      // ── Pointer Events: клик vs drag ──
      const onPointerDown = (e: PointerEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        // Смещение курсора от левого верхнего угла контейнера
        dragRef.current.offsetX = e.clientX - rect.left;
        dragRef.current.offsetY = e.clientY - rect.top;
        dragRef.current.active = true;
        dragRef.current.moved = false;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        try { view.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!dragRef.current.active || !containerRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        if (!dragRef.current.moved && Math.hypot(dx, dy) > 5) {
          dragRef.current.moved = true;
        }
        if (dragRef.current.moved) {
          // Новые координаты = курсор минус смещение захвата
          const width = containerRef.current.offsetWidth;
          const height = containerRef.current.offsetHeight;
          const newX = e.clientX - dragRef.current.offsetX;
          const newY = e.clientY - dragRef.current.offsetY;
          // Clamp, чтобы маскот следовал за курсором, но не улетал за границы
          const nx = Math.max(0, Math.min(newX, window.innerWidth - width));
          const ny = Math.max(0, Math.min(newY, window.innerHeight - height));
          const el = containerRef.current;
          el.style.left = `${nx}px`;
          el.style.top = `${ny}px`;
          el.style.right = "auto";
          el.style.bottom = "auto";
        }
      };

      const onPointerUp = (e: PointerEvent) => {
        if (!dragRef.current.active) return;
        const moved = dragRef.current.moved;
        dragRef.current.active = false;

        if (!moved) {
          // Короткий клик → Tap-анимация + открыть/закрыть чат
          playMotion(model, "Tap", Math.floor(Math.random() * 3), MotionPriority.FORCE, 1200);
          setChatOpen((v) => !v);
        } else {
          // Переместили → сохранить позицию
          const el = containerRef.current;
          if (el) {
            const rect = el.getBoundingClientRect();
            const save = { x: rect.left, y: rect.top };
            setPos(save);
            window.localStorage.setItem(POS_KEY, JSON.stringify(save));
          }
        }
        try { view.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      };

      view.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);

      (app as any).__cleanup = () => {
        window.clearInterval(idleTimer);
        view.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        model.destroy();
        modelRef.current = null;
      };
    }

    init().catch((err) => console.error("Mascot init error:", err));

    return () => {
      destroyed = true;
      try {
        (app as any)?.__cleanup?.();
        app?.destroy(true, { children: true, texture: true, baseTexture: true });
      } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed z-50 h-[280px] w-[220px] sm:h-[340px] sm:w-[260px] [&_canvas]:pointer-events-auto"
      style={
        pos
          ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto", display: enabled ? undefined : "none" }
          : { left: 0, top: 0, right: "auto", bottom: "auto", display: enabled ? undefined : "none" }
      }
    >
      {/* ── Чат Синко ──
          Мобильник: почти полноэкранный оверлей (fixed inset-0), не сбивает прогресс страницы.
          ПК (sm+): окно сбоку от маскота, чтобы не перекрывать саму Синко
          (справа, если она слева; слева — если она справа). */}
      <AnimatePresence>
        {chatOpen && (() => {
          const screenW = typeof window !== "undefined" ? window.innerWidth : 1280;
          const mascotLeft = pos ? pos.x < screenW / 2 : true;
          const sideClass = mascotLeft ? "sm:left-full sm:ml-2" : "sm:right-full sm:mr-2";
          const tailClass = mascotLeft ? "sm:left-[-7px] sm:border-l sm:border-t sm:border-r-0 sm:border-b-0" : "sm:right-[-7px] sm:border-r sm:border-b sm:border-l-0 sm:border-t-0";
          return (
            <motion.div
              key="mascot-chat"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18 }}
              aria-hidden="false"
              className={`pointer-events-auto fixed inset-0 z-50 flex flex-col overflow-hidden m-0 sm:m-0 sm:absolute sm:inset-auto sm:top-0 sm:h-auto sm:w-[320px] sm:max-w-[40vw] ${sideClass}`}
              style={{
                backgroundColor: "#12131C",
                border: "1px solid #FF007F",
                boxShadow: "0 0 18px rgba(255, 0, 127, 0.35)",
              }}
            >
              {/* Своя обёртка контента (мобилка full, ПК compact) */}
              <div className="flex max-h-[60vh] min-h-[60vh] flex-col sm:max-h-[calc(100vh-360px)] sm:min-h-0">
                {/* Заголовок */}
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-sm font-bold sm:text-xs" style={{ color: "#FF9BC9" }}>
                    <Sparkles className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    Синко
                  </span>
                  <button
                    type="button"
                    onClick={() => setChatOpen(false)}
                    className="rounded p-1 text-white/40 transition hover:text-white"
                    aria-label="Закрыть чат"
                  >
                    <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </button>
                </div>

                {/* Сообщения — растягиваются на весь ответ, скролл при переполнении */}
                <div
                  ref={chatRef}
                  className="min-h-[60px] flex-1 overflow-y-auto px-3 py-2.5 scrollbar-cyber"
                >
                  {thinking ? (
                    <p className="text-sm text-white/70 italic">Синко думает…</p>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-white/70">Привет! Я Синко 🌸 Спроси меня про аниме!</p>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed" style={{ color: "#F0F0F5" }}>
                      {messages[messages.length - 1].content}
                    </p>
                  )}
                </div>

                {/* Компактный ввод */}
                <form
                  className="flex items-center gap-1.5 border-t border-white/10 px-2 py-2"
                  onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Сообщение…"
                    className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#FF007F]"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || thinking}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40"
                    style={{ backgroundColor: "#FF007F", color: "#fff" }}
                    aria-label="Отправить"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>

              {/* Хвостик-указатель (только на ПК, у мобилки оверлей без хвоста) */}
              <div
                aria-hidden="true"
                className={`absolute bottom-auto top-6 hidden h-3 w-3 rotate-45 sm:block ${tailClass}`}
                style={{ backgroundColor: "#12131C", border: "1px solid #FF007F" }}
              />
          </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
