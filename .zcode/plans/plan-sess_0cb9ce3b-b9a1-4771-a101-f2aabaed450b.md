## Plan: 7 fixes

### 1. Плеер Kodik — увеличить (30px сверху, 25 снизу, 20 по бокам)
**Файл:** `src/components/player/kinobox-player.tsx`
- Родительский контейнер плеера: добавить `p-0` (уже есть), изменить `aspect-video` на кастомное соотношение или добавить negative margins.
- **Решение:** Обернуть iframe в дополнительный `div` с `scale-110` (zoom 110%) или использовать `transform: scale(1.1)` и обрезать через `overflow-hidden`.
- Проще: установить iframe `h-[calc(100%+55px)] w-[calc(100%+40px)] -top-[30px] -left-[20px]` — добавляет 30px сверху, 25 снизу, 20 по бокам. **Обновлённые классы:** `absolute -top-[30px] -left-[20px] h-[calc(100%+55px)] w-[calc(100%+40px)] border-0`.

**Kinobox:** Скрипт не работает (оба URL 404/недоступны). Текущий код с 5s таймаутом корректно показывает заглушку. Ничего не меняю в Kinobox — он не чинится.

### 2. Синхронизация профиля — подтягивать соцсети из БД при входе
**Файл:** `src/app/profile/profile-client.tsx`
- В `sync()` функции (useEffect), после `supabase.auth.getUser()`, расширить выборку с БД.
- Сейчас загружается: `nickname, full_name, tag, avatar_url, cover_url`.
- **Расширить до:** `nickname, full_name, tag, avatar_url, cover_url, telegram, discord, steam, instagram, bio`.
- Применить загруженные данные к `profile` state: обновлять `telegram`, `discord`, `steam`, `instagram`, `bio` из БД.
- Вызов `saveProfile(next)` после обновления — чтобы localStorage тоже синхронизировался.

### 3. Боковое меню — обновление аватара/ника после входа
**Файлы:** `src/components/layout/right-sidebar.tsx` + `src/components/layout/mobile-nav.tsx`
- Оба компонента уже слушают `anithink:profile-changed` event, который диспатчится в `saveProfile()`.
- **Проблема:** `saveProfile()` диспатчит event ТОЛЬКО когда вызван. При логине через Google (OAuth callback) `saveProfile()` не вызывается — profile данные приходят из `supabase.auth.getUser()` в `sync()` profile-client, но `saveProfile()` там не вызывается.
- **Решение:** В `profile-client.tsx` `sync()` — после применения данных из БД к `profile` state, вызвать `saveProfile(updatedProfile)`. Это диспатчнет `anithink:profile-changed` и все слушатели (sidebar, m-nav) обновятся.

### 4. Друзья — подтягивать из чат-контактов + поиск по тегу
**Файл:** `src/app/friends/friends-client.tsx`
- **Гибрид:** Показывать друзей из `friendships` (Supabase) **И** из `anithink:chat-contacts` (localStorage).
- Загружать контакты из localStorage: `JSON.parse(localStorage.getItem("anithink:chat-contacts") ?? "[]")`.
- Для каждого контакта (if it has `id`) — запрашивать профиль из `profiles` через Supabase, чтобы получить `cover_url` и др. Если контакт не имеет id (старый формат или номер телефона) — пропускать.
- Мержить списки, убирать дубли по id.
- **Поиск по тегу:** Добавить `<input>` вверху страницы друзей с `useState<searchTag>`. Фильтровать отображаемый список друзей по `friend.tag.includes(searchTag)`.
- Кнопка «Найти пользователя» рядом с поиском — ссылка на `/user/{searchTag}`.

### 5. Лимиты карточек + «Показать все» + перелинковка
**Файлы:** `profile-client.tsx`, `history-list.tsx`, `saved-anime-list.tsx`

- **profile-client:** Блоки «Недавние» / «Просмотрено» / «Любимые» — уже есть `slice(0,6)` и кнопка «Показать всё». **Ничего не менять.**
- **history-list.tsx:** Добавить `slice(0, 24)`. Если >24 — добавить кнопку «Перейти в полный список» (Link к `/history`).
- **saved-anime-list.tsx:** Добавить `slice(0, 48)`. Если >48 — кнопка «Перейти в полный список» (Link к `/saved`). На странице `/saved` — показать всё без лимита (уже 50 через API, этого достаточно).

### 6. Безопасность: гостевой баннер + модалка подтверждения выхода
**Файлы:** `profile-client.tsx`, `use-sign-out.ts`

- **Гостевой баннер** (profile-client.tsx): Если `!authUser`, показывать жёлтую плашку `.rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-400` с иконкой AlertTriangle и текстом «⚠️ Ваши данные хранятся локально в браузере! Войдите в аккаунт, чтобы не потерять их при очистке кэша.» + кнопка «Войти».
- **Модалка подтверждения выхода:** Создать `ConfirmSignOutModal` — анимированный overlay + backdrop, заголовок «Выход из аккаунта», текст «Вы уверены, что хотите выйти? Несохраненные локальные данные могут быть сброшены.», кнопки «Отмена» и «Да, выйти».
- В `use-sign-out.ts` — вместо прямого выхода, открыть модалку. Нужен стейт `showSignOutConfirm` в компонентах.
- В `profile-client.tsx` и навигации (right-sidebar, mobile-nav) — при клике на «Выйти» открывать модалку вместо прямого вызова.

### 7. Плейлисты: лимит 10, cover необязательный, генерация заглушки
**Файлы:** `local-playlists.ts`, `playlist-dialog.tsx`, `playlists-client.tsx`

- **Лимит 10:** В `createPlaylist()` проверять `if (playlists.length >= 10) { toast("Максимум 10 плейлистов", true); return; }`.
- **Cover необязательный:** Уже необязательный — просто не показывать картинку если `!cover`. Добавить **авто-генерацию заглушки**: вместо загруженной обложки показывать `div` с градиентом и названием плейлиста. Цвет градиента — из `accent` темы.
- **Оптимизация cover:** При загрузке cover в `playlist-dialog.tsx` и `playlists-client.tsx` — использовать `compressImage(file, 800)` из `local-media.ts` (сжать до 800px по длинной стороне, JPEG 0.75).

## Files to modify
1. `src/components/player/kinobox-player.tsx` — Kodik увелечение
2. `src/app/profile/profile-client.tsx` — sync profile data, guest banner, confirm modal
3. `src/lib/use-sign-out.ts` — confirm modal logic
4. `src/components/layout/right-sidebar.tsx` — sign out confirm modal
5. `src/components/layout/mobile-nav.tsx` — sign out confirm modal
6. `src/app/friends/friends-client.tsx` — chat-contacts hybrid, search
7. `src/app/history/history-list.tsx` — limit 24 + "show all" link
8. `src/app/saved/saved-anime-list.tsx` — limit 48 + "show all"
9. `src/components/anime/playlist-dialog.tsx` — limit 10, cover compress
10. `src/app/playlists/playlists-client.tsx` — limit 10, cover compress, auto-gradient
11. `src/lib/local-playlists.ts` — no changes needed (limits in components)

## Verification
- `npm run build`