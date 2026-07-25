"use client";

import { useState, useEffect } from "react";
import Image, { type ImageProps } from "next/image";
// Импортируем твою обложку прямо из компонента
import fallbackImage from "./error.png";

/**
 * Image с автоматическим fallback на собственное изображение при ошибке загрузки.
 * Shikimori часто отдаёт missing_original.jpg или 404 для свежих анонсов —
 * этот компонент подменяет их на error.png.
 */
export function ImageWithFallback({
  title,
  className,
  alt,
  ...props
}: ImageProps & { title?: string }) {
  const [error, setError] = useState(false);

  // Сбрасываем состояние ошибки, если ссылка на картинку изменилась
  useEffect(() => {
    setError(false);
  }, [props.src]);

  if (error || !props.src) {
    return (
      <Image
        src={fallbackImage}
        alt={alt || title || "Failed to load image"}
        className={className}
        // Сохраняем размеры original props, если они были переданы
        width={props.width}
        height={props.height}
        fill={props.fill}
        sizes={props.sizes}
        style={props.style}
      />
    );
  }

  return (
    <Image
      {...props}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
}