# AniThink — Cyberpunk Edition

Современная киберпанк-платформа для просмотра аниме на базе **Shikimori API**.
Стек: **Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion + Lucide + Axios**.

## ✨ Возможности

- 🎨 **Динамические темы** (Material You стиль) — акцентный цвет меняется на лету
  через CSS-переменные (`[data-theme]` на `<html>`): Neon / Ice / Vapor / Blood.
- 🪟 **Кастомный скроллбар** — тонкий, подсвечивается акцентом при hover.
- 📐 **Полностью адаптивный layout**:
  - **Десктоп (≥ lg):** хедер (лого + горизонтальная навигация-пилюли + поиск) +
    правый анимированный сайдбар (76px → 264px по клику на аватар).
  - **Планшет (md):** хедер с пилюлями + контент.
  - **Мобайл (< lg):** хедер + bottom-nav + выезжающий drawer.
- 🔎 **Шапка-поиск** без аватарок и профиля.
- 🎞 **Framer Motion** анимации (layoutId-индикаторы, slide-in, hover-эффекты).
- 🌐 **Shikimori API** — серверные запросы с ISR, обязательный `User-Agent`,
  три секции на главной (Топ / Онгоинги / Популярное) + страница тайтла `/anime/[id]`.

## 🚀 Быстрый старт

```bash
npm install
npm run dev
```

Откройте http://localhost:3000

## 📁 Структура

```
src/
├── app/
│   ├── globals.css        # CSS-переменные тем + кастомный скроллбар
│   ├── layout.tsx         # Корневой layout (хедер + контент + правый сайдбар)
│   ├── page.tsx           # Главная (3 секции Shikimori + hero)
│   └── anime/[id]/page.tsx  # Страница тайтла
├── components/
│   ├── anime/
│   │   ├── anime-card.tsx     # Карточка аниме + скелетон
│   │   └── anime-section.tsx  # Серверная секция-сетка
│   ├── layout/
│   │   ├── header.tsx         # Лого + пилюли-навигация + поиск
│   │   ├── right-sidebar.tsx  # Анимированный профиль-сайдбар
│   │   └── mobile-nav.tsx     # Адаптив: bottom-nav + drawer
│   └── providers/
│       └── theme-provider.tsx # Context для смены акцента
└── lib/
    ├── api/shikimori.ts   # Axios + server fetch (User-Agent обязателен!)
    ├── navigation.ts      # Константы меню
    └── utils.ts           # cn() helper
```

## 🎨 Смена темы

Тема хранится в `localStorage` (`animex-accent`) и применяется через
атрибут `data-theme="green|blue|violet|red"` на `<html>`.

Переключатель доступен:
- В правом сайдбаре (после клика на аватар) — на десктопе.
- В мобильном drawer — на телефонах.

## 🔌 Shikimori API

> Shikimori требует уникальный `User-Agent`, иначе возвращает 403/401.

Настроено в `src/lib/api/shikimori.ts`:

```ts
headers: {
  "User-Agent": "AniThink/1.0 (...; contact: dev@anithink.app)",
}
```

Пример использования:

```ts
import { fetchAnimes } from "@/lib/api/shikimori";
const list = await fetchAnimes({ limit: 20, order: "ranked" });
```

## 🎯 Точки расширения

- [ ] Серверные компоненты с SSR-запросами к Shikimori.
- [ ] Карточка аниме + страница тайтла `[id]`.
- [ ] Реальный поиск с дебаунсом в хедере.
- [ ] OAuth Shikimori для приватных списков.
