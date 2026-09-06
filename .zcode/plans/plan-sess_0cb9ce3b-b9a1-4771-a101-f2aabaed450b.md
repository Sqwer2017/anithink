# План: Watch Party комнаты через Supabase Realtime

## Что выяснено (архитектура)
- Только **браузерный** supabase-клиент (`src/lib/supabase.ts`), Realtime доступен по умолчанию; прецедент — `chat-client.tsx` (`postgres_changes`). Presence/Broadcast `.track/.on(...)` ещё нигде не используются.
- Реально синхронизировать плейбек можно ТОЛЬКО на источнике с настоящим `<video>` = **AniLibria (`CustomPlayer` на ArtPlayer+HLS)**. **Kodik** — внешний `<iframe>`, им JS управлять не может (по вашему выбору источник Kodik тоже оставляем на странице — там работает присутствие+чат, но кнопки-синхрон недоступны с подсказкой переключиться на AniLibria).
- `CustomPlayer` сейчас не отдаёт наружу файлы управления (нет `forwardRef`/событий) → надо добавить.
- Страницы комнаты нет — создаю маршрут `/watch/[id]`.
- Идентичность: паттерн `auth.getUser()` → `profiles.select(id,nickname,tag,avatar_url).eq(id,user.id).maybeSingle()`; гостей пускаем, но (по выбору) комнату доступна только зарегистрированным.

## Решения по твоим ответам
- Источники: и Kodik, и AniLibria на странице комнаты; реальная синхронизация — AniLibria.
- Комната — выделенная страница `/watch/[id]?room=<id>`.
- Только зарегистрированные пользователи (гостям — экран «Войдите»).

## Новое

### 1. `src/hooks/useWatchRoom.ts`
- `makeRoomId()` — короткий id (7 симв., base36 + crypto.getRandomValues).
- Хук `useWatchRoom({ roomId, me, canHost })`:
  - Канал `room:<roomId>` с `broadcast.self=false`.
  - **Presence**: `track({clientId,userId,nickname,avatar,joinedAt})`; участники in state; **хост** = участник с мин. `joinedAt`; `isHost = own joinedAt` минимальный. Присутствие онлайн-счётчика.
  - **Broadcast-события**: `PLAYER_PLAY`, `PLAYER_PAUSE`, `PLAYER_SEEK`, `LOAD_EPISODE`, `HEARTBEAT`, `ROOM_CHAT`.
  - **HEARTBEAT**: хост шлёт раз в 5 с `{currentTime,isPlaying}`; зритель при рассинхроне >2 с делает локальный seek (без ре-отправки).
  - **Защита цикла**: флаг `isRemoteUpdate` — применяя сетевую команду, плеер не «отзеркаливает» её обратно в канал.
  - **Счётчик/чат**: сообщения хранятся только в памяти сессии (Room Chat) ключом `id`-уникальный.
  - API возврата: `{ viewers, isHost, hostAllowedControl, send(msg), broadcastPlay/pause/seek/loadEpisode, onRemote* , subscribeRegistry }`. Сердце контроля: хук как «шина» команд; плеер сам применяет play/pause/seek касательно `video`, дергая `getLocalState()` для heartbeat.

### 2. `src/components/player/CustomPlayer.tsx` — импрув
- Обернуть в `forwardRef`, наружу отдать:
  - `getTime()`, `getPlaying()`, `seekTo(s)`, `play()`, `pause()`, `getDuration()`, `getCurrentEpisode()`.
  - Проп `onSync` (колбэк `{t, isPlaying, src, ep}` на изменения времени/паузы — нужно хосту для heartbeat + события `PLAYER_*`).
- Внутри добавить в `new Artplayer(...)` обработчики `art.on('play'|'pause'|'seeked'|'timeupdate')`, транслируя в `onSync` и внешний `ref`.
- Внутренние перемотки по перечню серий остаются; при смене серии — тоже `onSync`/broadcast `LOAD_EPISODE`.

### 3. `/watch/[id]` страница + комната
- `src/app/watch/[id]/page.tsx` (server): `fetchAnimeById(id)` → `title`; лёгкая обёртка.
- `src/app/watch/[id]/watch-party.tsx` (client): 
  - Гейт авторизации (только зарегистрированные; не залогинен → панель «Войдите»).
  - Хедер: назад к `/anime/[id]`, кнопка «Скопировать ссылку», статус.
  - Основной лейаут посреди 2-колоночного (по образцу anime-watch-card): слева плеер, справа панель комнаты.
  - Плеер: переключатель Kodik ↔ AniLibria. AniLibria = `<CustomPlayer ref=… />` (реальный контент с синхроном); Kodik = iframe (режим без синхрона + подсказка «для совместного просмотра выбери AniLibria»).
  - **Панель комнаты** (правая колонка, mobile — снизу):
    - Шапка: «Смотреть вместе», счётчик зрителей онлайн + аватарки участников.
    - Чат: сообщения с цветными никами (ник из `profiles`), автоскролл вниз, поле + эмодзи-строки.
    - Ограничение: если не хост — блокировка play/pause/seek (мягкая плашка «Управление у создателя комнаты»); если включён режим свободного управления (хост включил тег) — можно всем (free_control).

### 4. Кнопка «Смотреть вместе» на anime/[id]
- В `AnimeWatchCard` рядом с плеером/сердцем-звёздами добавить кнопку:
  - генерирует `makeRoomId()`, копирует и открывает `/watch/<id>?room=<roomId>`.
  - со secondary actions: копирование ссылки поверх.

> Примечание: комнаты живут только через Realtime канал (память присутствия). Никаких новых SQL-таблиц НЕ требуется, и публикация realtime уже активна (канал overlay, не postgres_changes). Доп. миграция не нужна.

## Проверка
- `npm run build` (типовые прогоны по новым файлам).
- Ручной smoke dev: открытие двух вкладок `/watch/[id]?room=X` под двумя аккаунтами → host видит 2 зрителя, сообщения/шуточки инициалов, парсек; контроль перемотки у хоста, наличие `HEARTBEAT`.
