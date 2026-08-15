# План: Дизайн отзывов + плавающая кнопка «Отзыв» с морфингом

## Исследование подтверждает
- `reviews.user_id` → `profiles.id` = `profiles.tag`. Нужно подтягивать `tag` отдельным запросом (нет FK на profiles; `user_id` → auth.users.id → profiles.id).
- Рейтинг в БД `check 1-10`; оставлю (не сломает старые), форма = max 5 звёзд.
- `PROFILE_NAV` в `navigation.ts` автоматически появляется в сайдбаре (right-sidebar) и мобильном drawer — достаточно добавить элемент.
- Старая кнопка «Отзыв» в header убирается в пользу плавающей.

---

## 1. Плавающая круглая кнопка «Отзыв» с морфингом (везде)
**Новый компонент `src/components/FeedbackFab.tsx`** (client):
- **`fixed` в правом нижнем углу**: `bottom-24 right-3 sm:bottom-6 sm:right-6` (на мобиле выше мобильной навигации bottom-bar, ~96px).
- **Круглая кнопка** `h-14 w-14 rounded-full` с иконкой `MessageSquarePlus`, цвет от темы (`bg-accent text-background shadow-neon`), hover-scale.
- **Морфинг**: по клику кнопка анимированно расширяется (`framer-motion` scale/borderRadius) в **вытянутое вертикальное окно** обратной связи (широкое, ~320-360px). Суть: единый элемент `motion.div` анимирует `width/height/borderRadius` между «кружком» и «панелью», внутри которого рендерится либо иконка, либо форма.
- **Форма** — reuse/встроить содержимое `FeedbackModal` (категории-табы, textarea, контакт, отправка, success). Закрытие — сжатие обратно в круг.
- Разместить в `layout.tsx` рядом с `<Mascot />`.
- Удалить старую кнопку «Отзыв» из header + старый `<FeedbackModal>` оттуда (заменить на FAB).

## 2. Пункт «Отзывы» в боковом меню + разделитель
- **`src/lib/navigation.ts`**: добавить в `PROFILE_NAV` элемент `{ href: "/feedback", label: "Отзывы", icon: MessageSquarePlus }` ПОСЛЕ «Друзья». (Иконка уже импортируется в feedback; добавить импорт `MessageSquarePlus` в navigation.ts.)
- **Разделитель**: чтобы «Отзывы» визуально отделить от «Друзей»:
  - В `right-sidebar.tsx` — в рендере `PROFILE_NAV.map` вставить `<div className="my-1 border-t border-border/60" />` перед элементом `href === "/feedback"`.
  - В `mobile-nav.tsx` — аналогичный разделитель в `PROFILE_NAV.map`.

## 3. Страница отзывов: звезды, ава→профиль, заявка в друзья
**`src/app/feedback/page.tsx`**:
- **Рейтинг**: форма max **5 звёзд** (заменить `[1..10]` на `[1..5]`).
- **Аватар кликабельный**: при загрузке отзывов добавить `user_id` в select + второй запрос `profiles.select("id, tag").in("id", userIds)` → мапа `user_id → tag`. Если у отзыва есть `tag` → обернуть ава в `<Link href={/user/${tag}}>` (переход на публичный профиль, где уже есть кнопка «Добавить в друзья» / заявка). Если `tag` нет (аноним) — `<span>`, не ссылка.
- **Ава**: показать реальную `avatar_url` если есть (через profiles), иначе инициалы.
- Остальное (ник, title, 5 звёзд визуально, дата) — оставить.
- Убрать старую FAB/`FeedbackModal` со страницы — плавающая кнопка уже глобальная.

## Файлы
1. `src/components/FeedbackFab.tsx` — новый (плавающая кнопка + морф-панель).
2. `src/components/FeedbackModal.tsx` — оставлю (используется в FAB и на /feedback), при необходимости слегка подправлю использование.
3. `src/app/layout.tsx` — добавить `<FeedbackFab />`.
4. `src/components/layout/header.tsx` — убрать старую кнопку «Отзыв» + FeedbackModal.
5. `src/lib/navigation.ts` — добавить «Отзывы» в PROFILE_NAV.
6. `src/components/layout/right-sidebar.tsx` + `mobile-nav.tsx` — разделитель перед «Отзывы».
7. `src/app/feedback/page.tsx` — 5 звёзд, ава→профиль (tag lookup), ник, поддержка avatar_url.
8. `supabase/migrations/2026_reviews.sql` — (опционально) оставить check 1-10; не трогаю (безопасно). Никаких новых SQL не нужно для отзывов (форма по-прежнему вставляет max 5, что < 10).

## Проверка
- `npm run build`.
- Вручную: FAB виден в правом нижнем углу, морфит в окно и обратно, цвет от темы; «Отзывы» в сайдбаре (после Друзей с разделителем) и в мобиле; на /feedback форма 5 звёзд, ава кликает на /user/<tag>, рейтинг сохраняется.
- Telegram-отправка из FAB работает (роут уже проверен ранее).