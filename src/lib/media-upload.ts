"use client";

import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/local-media";

export type MediaField = "avatar" | "cover";

/**
 * Загружает файл в бакет `media` Supabase Storage и возвращает публичную ссылку.
 * Файл пережимается на клиенте (compressImage -> JPEG data URL) и кладётся в
 * подпапку avatars/ или covers/. Имя файла уникально per-user.
 *
 * Возвращает публичный URL (getPublicUrl). При ошибке выбрасывает исключение —
 * вызывающий код ловит и показывает toast.
 */
export async function uploadProfileMedia(
  file: File,
  field: MediaField,
  userId: string,
): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase недоступен");
  }

  // 1. Пережимаем картинку -> JPEG data URL
  const dataUrl = await compressImage(file);

  // 2. data URL -> Blob для загрузки в Storage
  const blob = await (await fetch(dataUrl)).blob();

  // 3. Уникальный путь: <folder>/<userId>-<rand>.jpg
  const folder = field === "avatar" ? "avatars" : "covers";
  const random = Math.random().toString(36).slice(2, 10);
  const path = `${folder}/${userId}-${random}.jpg`;

  // 4. Загружаем (upsert — на случай коллизии пути)
  const { error } = await supabase.storage
    .from("media")
    .upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    });

  if (error) {
    throw new Error(error.message);
  }

  // 5. Публичная ссылка
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return data.publicUrl;
}
