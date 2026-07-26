import axios, { AxiosInstance } from "axios";

/**
 * Инстанс Axios для Shikimori REST API.
 *
 * ВАЖНО: Shikimori требует уникальный User-Agent и может
 * отдавать 403/401 при использовании дефолтных заголовков axios.
 *
 * Документация: https://shikimori.one/api
 * Эндпоинты подтверждают: /api/animes с параметрами
 *   limit, order (ranked|random|name|aired_on|id_desc|score),
 *   status (ongoing|released|anons), page, season, genre, type, score.
 */
const SHIKIMORI_BASE_URL = "https://shikimori.one/api";

const SHIKIMORI_HEADERS = {
  // Уникальный User-Agent обязателен, иначе 403/401.
  "User-Agent":
    "AniThink/1.0 (Windows; React/Next.js client; contact: dev@anithink.app)",
  "Content-Type": "application/json",
  Accept: "application/json",
  Referer: "https://shikimori.one",
};

/** Клиентский инстанс (если понадобится из компонентов) */
export const shikimoriApi: AxiosInstance = axios.create({
  baseURL: SHIKIMORI_BASE_URL,
  timeout: 15000,
  headers: SHIKIMORI_HEADERS,
});

shikimoriApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url;
    if (status === 401 || status === 403) {
      console.warn(
        `[Shikimori] ${status} на ${url} — проверьте User-Agent/заголовки.`,
      );
    } else if (status && status >= 500) {
      console.error(`[Shikimori] Серверная ошибка ${status} на ${url}.`);
    } else if (!error.response) {
      console.warn(`[Shikimori] Сеть/CORS ошибка для ${url}.`);
    }
    return Promise.reject(error);
  },
);

/* ----------------------------- Типы ----------------------------- */

export type AnimeKind =
  | "tv"
  | "movie"
  | "ova"
  | "ona"
  | "special"
  | "music"
  | "tv_13"
  | "tv_24"
  | "tv_48s";

export type AnimeStatus = "ongoing" | "released" | "anons";

export interface AnimeGenre {
  id: number;
  name: string;
  russian: string;
  kind?: string;
}

export interface AnimeImage {
  original: string;
  preview: string;
  x96: string;
  x48: string;
}

export interface Anime {
  id: string;
  name: string;
  russian?: string;
  english?: string[] | string;
  japanese?: string[] | string;
  synonyms?: string[];
  kind?: AnimeKind | string;
  status?: AnimeStatus | string;
  episodes?: number;
  episodes_aired?: number;
  duration?: number;
  score?: string;
  description?: string;
  description_html?: string;
  rating?: string;
  aired_on?: string;
  released_on?: string;
  genres?: AnimeGenre[];
  studios?: { id: number; name: string; filtered_name?: string }[];
  image?: AnimeImage;
  url?: string;
}

/* --------------------- Вспомогательные утилиты --------------------- */

const SHIKIMORI_HOST = "https://shikimori.one";

async function shikimoriFetch(url: string, revalidate: number) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: SHIKIMORI_HEADERS, next: { revalidate } });
      if (response.ok || response.status < 500 || attempt === 2) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }
  throw lastError ?? new Error("Shikimori request failed");
}

export function buildImageUrl(
  url?: string | null,
  size: "original" | "preview" | "x96" = "original"
): string | null {
  if (!url) return null;

  // КРИТИЧНО: Если Shikimori возвращает заглушку, возвращаем null.
  // Это позволит ImageWithFallback в onError показать твою error.png.
  if (url.includes("missing_original.jpg")) return null;

  // Дальше восстанавливаем логику под два аргумента
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${SHIKIMORI_HOST}${url}`;
  }

  // Дефолтная логика (если Shikimori API так работает)
  return `${SHIKIMORI_HOST}/${url}`;
}

/* --------------------------- Серверные методы ---------------------------- */

export interface AnimesQuery {
  limit?: number;
  page?: number;
  order?: "ranked" | "random" | "name" | "aired_on" | "id_desc" | "score";
  status?: AnimeStatus;
  kind?: AnimeKind | string;
  genre?: string;
  season?: string;
  duration?: string;
  rating?: string;
  score?: number;
  search?: string;
  censored?: "true" | "false";
}

/**
 * Серверный fetch списка аниме с кэшированием Next.js.
 * Используется в серверных компонентах App Router.
 *
 * @param revalidate секунды ISR (по умолчанию 1 час)
 */
export async function fetchAnimes(
  query: AnimesQuery = {},
  revalidate = 3600,
): Promise<Anime[]> {
  const params = new URLSearchParams();
  const apply = (key: string, val?: string | number) => {
    if (val !== undefined && val !== null && val !== "")
      params.set(key, String(val));
  };
  apply("limit", query.limit ?? 20);
  apply("page", query.page);
  apply("order", query.order);
  apply("status", query.status);
  apply("kind", query.kind);
  apply("genre", query.genre);
  apply("season", query.season);
  apply("score", query.score);
  apply("search", query.search);
  apply("censored", query.censored);

  const url = `${SHIKIMORI_BASE_URL}/animes?${params.toString()}`;

  try {
    const res = await shikimoriFetch(url, revalidate);
    if (!res.ok) {
      console.warn(`[Shikimori] fetchAnimes -> ${res.status}`);
      return [];
    }
    return (await res.json()) as Anime[];
  } catch (e) {
    console.warn("[Shikimori] fetchAnimes network error:", e);
    return [];
  }
}

/** Получить одно аниме по id (серверный) */
export async function fetchAnimeById(
  id: string,
  revalidate = 3600,
): Promise<Anime | null> {
  try {
    const res = await shikimoriFetch(`${SHIKIMORI_BASE_URL}/animes/${id}`, revalidate);
    if (!res.ok) return null;
    return (await res.json()) as Anime;
  } catch {
    return null;
  }
}

/* ======================= Жанры (/api/genres) ======================= */

export interface Genre {
  id: number;
  name: string;
  russian: string;
  kind?: string;
  entry_type?: string;
}

export async function fetchGenres(
  revalidate = 86400,
): Promise<Genre[]> {
  try {
    const res = await shikimoriFetch(`${SHIKIMORI_BASE_URL}/genres`, revalidate);
    if (!res.ok) return [];
    return (await res.json()) as Genre[];
  } catch {
    return [];
  }
}

/* ========================= Топики / Новости ========================= */

export interface TopicLinkedImage {
  original?: string;
  preview?: string;
  x96?: string;
  x48?: string;
}

export interface TopicLinked {
  id: number;
  type?: string;       // "anime" | "manga" | ...
  name?: string;
  russian?: string;
  image?: TopicLinkedImage | string;
  url?: string;
  kind?: string;
  status?: string;
  score?: string;
  episodes?: number;
  episodes_aired?: number;
  aired_on?: string;
}

export interface TopicUser {
  id: number;
  nickname: string;
  avatar?: string;         // ← реальное поле Shikimori (строка, полный URL)
  avatar_url?: string;     // иногда приходит как avatar_url
  image?: { x160?: string; x80?: string; x48?: string; x32?: string; x16?: string };
  image_url?: string;
  url?: string;
  last_online_at?: string;
}

export interface Topic {
  id: number;
  title?: string;
  topic_title?: string;       // ← реальное поле Shikimori
  body?: string;
  body_html?: string;
  html_body?: string;         // ← реальное поле Shikimori (HTML контент)
  html_footer?: string;
  created_at: string;
  comments_count?: number;
  view_count?: number;
  likes_count?: number;
  forum_id?: number;
  user?: TopicUser;
  // Shikimori отдаёт linked как объект для одного тайтла
  linked?: TopicLinked | TopicLinked[];
  linked_id?: number;
  linked_type?: string;       // "Anime" | "Manga"
  type?: string;
  url?: string;
}

/* -------- Нормализация и хелперы для топиков -------- */

/** Гарантированно возвращает linked как массив (Shikimori отдаёт объект). */
export function getTopicLinked(topic: Topic): TopicLinked[] {
  if (!topic.linked) return [];
  return Array.isArray(topic.linked) ? topic.linked : [topic.linked];
}

/** Заголовок топика (Shikimori использует topic_title). */
export function getTopicTitle(topic: Topic): string {
  return (
    topic.topic_title ||
    topic.title ||
    getTopicLinked(topic)[0]?.russian ||
    getTopicLinked(topic)[0]?.name ||
    "Без названия"
  );
}

/** HTML-контент тела топика (Shikimori использует html_body). */
export function getTopicBodyHtml(topic: Topic): string | null {
  return topic.html_body || topic.body_html || null;
}

/**
 * Извлекает первое изображение из html_footer/html_body (блок b-shiki_wall).
 * Shikimori хранит там обложки новостей, постеры и YouTube-превью.
 * Возвращает абсолютный URL или null.
 *
 * Форматы, которые обрабатываем:
 *   <a class="b-image"><img src="https://shikimori.io/...preview...jpg"></a>
 *   <div class="b-video"><a class="video-link"><img src="//img.youtube.com/vi/ID/hqdefault.jpg"></a></div>
 *   <img src="...">
 */
export function extractImageFromHtml(html?: string | null): string | null {
  if (!html) return null;
  // YouTube-превью (//img.youtube.com/vi/ID/hqdefault.jpg) → берём maxres
  const ytMatch = html.match(
    /img\.youtube\.com\/vi\/([\w-]{6,})\//,
  );
  if (ytMatch) {
    return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
  }
  // Shikimori user_images / system images
  const imgMatch = html.match(
    /<img[^>]+src=["'](https?:\/\/[^"']*(?:user_images|system\/animes|system\/mangas)[^"']*\.(?:jpg|jpeg|png|webp))["']/i,
  );
  if (imgMatch) {
    // предпочитаем original-качество
    return imgMatch[1].replace("/preview/", "/original/");
  }
  // Любой img
  const anyImg = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (anyImg && anyImg[1] && !anyImg[1].includes("missing_")) {
    return anyImg[1].startsWith("//") ? `https:${anyImg[1]}` : anyImg[1];
  }
  return null;
}

/**
 * Обложка новости в порядке приоритета:
 *  1. Первое изображение из html_footer (то, что показывает Shikimori)
 *  2. Постер linked-аниме (если не missing)
 *  3. CDN-fallback по linked_id
 *  4. null → вызывающий код покажет плейсхолдер
 */
export function getTopicCover(topic: Topic): string | null {
  // 1. Изображение из html_footer (как на Shikimori)
  const footerImg = extractImageFromHtml(topic.html_footer);
  if (footerImg && !footerImg.includes("missing_")) return footerImg;
  // 1b. Изображение из html_body
  const bodyImg = extractImageFromHtml(topic.html_body || topic.body_html);
  if (bodyImg && !bodyImg.includes("missing_")) return bodyImg;

  // 2. Постер linked-аниме
  const linked = getTopicLinked(topic)[0];
  if (linked) {
    let imgPath: string | undefined;
    if (typeof linked.image === "string") {
      imgPath = linked.image;
    } else if (linked.image) {
      imgPath = linked.image.original || linked.image.preview;
    }
    if (imgPath && !imgPath.includes("missing_")) {
      return buildImageUrl(imgPath);
    }
    // 3. CDN-fallback по id
    const id = linked.id || topic.linked_id;
    if (id) return `${SHIKIMORI_HOST}/system/animes/original/${id}.jpg`;
  }

  // 3b. CDN-fallback только по linked_id
  if (topic.linked_id && topic.linked_type === "Anime") {
    return `${SHIKIMORI_HOST}/system/animes/original/${topic.linked_id}.jpg`;
  }

  return null;
}

/**
 * Получить топики (новости).
 * forum: "news" — новости сайта, "updates" — обновления тайтлов.
 */
export async function fetchTopics(
  query: {
    limit?: number;
    page?: number;
    forum?: string;
    linked_id?: number;
    linked_type?: string;
  } = {},
  revalidate = 1800,
): Promise<Topic[]> {
  const params = new URLSearchParams();
  const apply = (key: string, val?: string | number) => {
    if (val !== undefined && val !== null && val !== "")
      params.set(key, String(val));
  };
  apply("limit", query.limit ?? 20);
  apply("page", query.page);
  apply("forum", query.forum);
  apply("linked_id", query.linked_id);
  apply("linked_type", query.linked_type);

  const url = `${SHIKIMORI_BASE_URL}/topics?${params.toString()}`;

  try {
    const res = await shikimoriFetch(url, revalidate);
    if (!res.ok) return [];
    return (await res.json()) as Topic[];
  } catch {
    return [];
  }
}

/** Получить один топик по id */
export async function fetchTopicById(
  id: string,
  revalidate = 3600,
): Promise<Topic | null> {
  try {
    const res = await shikimoriFetch(`${SHIKIMORI_BASE_URL}/topics/${id}`, revalidate);
    if (!res.ok) return null;
    return (await res.json()) as Topic;
  } catch {
    return null;
  }
}

/* ========================= Комментарии ========================= */

export interface Comment {
  id: number;
  user_id?: number;
  commentable_id: string;
  commentable_type: string;
  body?: string;            // ← plain text
  body_html?: string;
  html_body?: string;       // ← реальное поле Shikimori (HTML)
  created_at: string;
  updated_at?: string;
  is_offtopic?: boolean;
  is_summary?: boolean;
  can_be_edited?: boolean;
  user?: TopicUser;
}

/** HTML-контент комментария (Shikimori использует html_body). */
export function getCommentBodyHtml(comment: Comment): string | null {
  return comment.html_body || comment.body_html || null;
}

/**
 * Получить комментарии топика.
 * commentable_id — id топика/аниме, commentable_type — "Topic" | "Anime" | ...
 */
export async function fetchComments(
  commentable_id: string,
  commentable_type: "Topic" | "Anime" | "Manga" = "Topic",
  page = 1,
  limit = 30,
  revalidate = 600,
): Promise<Comment[]> {
  const params = new URLSearchParams({
    commentable_id,
    commentable_type,
    page: String(page),
    limit: String(limit),
  });

  const url = `${SHIKIMORI_BASE_URL}/comments?${params.toString()}`;

  try {
    const res = await shikimoriFetch(url, revalidate);
    if (!res.ok) return [];
    return (await res.json()) as Comment[];
  } catch {
    return [];
  }
}

/**
 * Полный URL аватара пользователя из любого варианта поля.
 * Shikimori отдаёт аватар в user.avatar (строка), user.image.x48 (объект)
 * или в user.avatar_url (legacy). Принимает как саму строку, так и объект user.
 */
export function buildUserAvatarUrl(
  source?: string | null | TopicUser,
): string | null {
  if (!source) return null;

  // Передали объект user
  if (typeof source === "object") {
    const direct = source.avatar || source.avatar_url;
    if (direct) return normalizeUrl(direct);
    if (source.image?.x48) return normalizeUrl(source.image.x48);
    if (source.image?.x80) return normalizeUrl(source.image.x80);
    if (source.image_url) return normalizeUrl(source.image_url);
    return null;
  }

  // Передали строку
  return normalizeUrl(source);
}

function normalizeUrl(path: string): string | null {
  if (typeof path !== "string" || !path) return null;
  if (path.startsWith("http")) return path;
  // Shikimori относительные пути начинаются с /
  if (path.startsWith("//")) return `https:${path}`;
  return `${SHIKIMORI_HOST}${path.startsWith("/") ? "" : "/"}${path}`;
}
