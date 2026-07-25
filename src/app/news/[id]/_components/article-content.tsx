"use client";

import { useEffect, useRef } from "react";

/**
 * Клиентская обёртка для HTML-контента статьи.
 *
 * Зачем:
 *  - Активирует YouTube-видео: при клике на .video-frame подменяет превью
 *    на встроенный <iframe> (через YouTube no-cookie embed). Видео играет
 *    прямо на сайте, без перехода наружу.
 *  - Активирует спойлеры (Shikimori span.b-spoiler): клик раскрывает текст.
 *
 * Контент рендерится через dangerouslySetInnerHTML (уже обработан
 * processShikimoriHtml на сервере).
 */
export function ArticleContent({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    // ── YouTube-видео: клик → iframe ──
    const videoFrames = root.querySelectorAll<HTMLDivElement>(".video-frame");
    const handlers: Array<{ el: HTMLDivElement; fn: () => void }> = [];

    videoFrames.forEach((frame) => {
      const id = frame.getAttribute("data-youtube-id");
      if (!id) return;

      const activate = () => {
        if (frame.querySelector("iframe")) return; // уже активировано
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
        iframe.title = "YouTube video";
        iframe.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        iframe.allowFullscreen = true;
        // скрываем превью и кнопку, показываем iframe
        const preview = frame.querySelector("img");
        const btn = frame.querySelector(".video-play-btn");

        if (preview && preview instanceof HTMLElement) {
        preview.style.display = "none";
        }
        
        if (btn && btn instanceof HTMLElement) {
          btn.style.display = "none";
        }
      };

      frame.addEventListener("click", activate);
      handlers.push({ el: frame, fn: activate });
    });

    // ── Спойлеры: клик → раскрытие ──
    const spoilers =
      root.querySelectorAll<HTMLSpanElement>("span.b-spoiler, span.spoiler");
    const spoilerHandlers: Array<{
      el: HTMLSpanElement;
      fn: () => void;
    }> = [];
    spoilers.forEach((sp) => {
      const toggle = () => sp.classList.toggle("shown");
      sp.addEventListener("click", toggle);
      spoilerHandlers.push({ el: sp, fn: toggle });
    });

    return () => {
      handlers.forEach(({ el, fn }) => el.removeEventListener("click", fn));
      spoilerHandlers.forEach(({ el, fn }) =>
        el.removeEventListener("click", fn),
      );
    };
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="prose-cyber mt-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
