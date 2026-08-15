
## План: фикс регистрации, статистики/истории в профиле и настроек приватности

### Что выяснилось (по итогам исследования)

**1. Новые юзеры не могут зарегаться**
- Строка в `profiles` для нового email/password-юзера создаётся ТОЛЬКО БД-триггером `on_auth_user_created` → `public.handle_new_user()` (`supabase/migrations/2026_auth_onboarding_sync.sql`). App-код для этого пути строку НЕ создаёт (апсайты есть только в onboarding/Google и вручную в профиле).
- Если триггер устарел/не применился в продакшене — новый `auth.users` не получает строку, либо (если `handle_new_user` падает в ошибке) `after insert` триггер откатывает создание юзера → **регистрация реально ломается**. У старых юзеров строка уже была — потому «старые ок, новые фейл».
- Дополнительно: после `signUp()` успех судится только по `!error`, строку профиля никто не создаёт и никакой фолбэк-путь для email/password нет.

**2. Статистика / недавние / история «через раз»**
- Весь вывод зависит от `/api/saved` → Shikimori (best-effort, `fetchAnimeById` с таймаутом/ретраями), а `loadAnime` в профиле **глотает ошибку и не ретраит** — остаются пустые массивы.
- `sync()` вызывается дважды (mount + `onAuthStateChange`) — гонка, свежий перезаписывается старым.
- Локальные данные гостя грузятся только ПОСЛЕ `await supabase.auth.getUser()` — задержка.
- Несоответствие капа: клиент шлёт `slice(0,60)`, сервер режет до 50.

**3. Настройки приватности**
- Три тумблера сейчас **только localStorage** (`anithink:settings`), в Supabase не сохраняются и не влияют ни на что. Колонок `hide_stats/private_lists/new_episode_notif` в `profiles` нет.
- Публичный профиль `user/[tag]/user-client.tsx` уже гейтит секции по `favorites_privacy/completed_privacy/history_privacy` (enum `public/friends/close_friends/private`). Часов там сейчас нет.

---

### Решения пользователя
- **Приватный список** → «Только для друзей» (пишем во все `*_privacy` = `'friends'`).
- **Скрыть статистику часов** → только в публичном профиле (у себя всегда видно).
- **Уведомления о новых сериях** → сохранять флаг в БД + баннер на `/notifications`.

---

### Изменения

**A. SQL миграция `supabase/migrations/2026_fix_signup_plus_privacy.sql` (НОВАЯ, вставишь в Supabase)**
1. Добавить в `profiles`: `hide_stats boolean not null default false`, `private_lists boolean not null default false`, `new_episode_notif boolean not null default false`.
2. Пересоздать `public.handle_new_user()` так, чтобы **не могла заблокировать регистрацию**: обернуть `insert` в `begin...exception when others then` → даже если создание профиля падает, `auth.users` остаётся созданным (юзер заходит, профиль до-создастся через onboarding/callback/апсайт).
3. На всякий случай `alter table profiles add column if not exists avatar_url/email/nickname/tag/full_name` (идемпотентно, чтобы `handle_new_user` не падал на несуществующей колонке).
4. Пересоздать триггер `on_auth_user_created`.

**B. `src/components/auth/auth-modal.tsx` — страховка при регистрации**
- После успешного `signUp()`: если `data.user` и есть сессия — **upsert строки profiles прямо из клиента** (RLS `profiles_insert_owner` это позволяет), используя введённые nickname/tag. Это убирает зависимость от триггера в базовом сценарии (email-confirm выключен, что по умолчанию).
- Если сессии нет (включено подтверждение email) — показать тост «Подтвердите почту по ссылке из письма» и в localStorage сохранить nickname/tag, чтобы `/auth/callback` до-создал профиль.

**C. `src/app/profile/profile-client.tsx` — фикс статистики/недавних/истории**
- Гонку двух `sync()` убрать: добавить `useRef`-генерацию; старый (неактуальный) sync игнорируется.
- Локальные списки рендерить СРАЗУ (до `await auth.getUser()`), а после мерджа с БД перезапускать `loadAnime`. Гость не будет ждать Supabase.
- `loadAnime`: добавить повтор (до ~2 попыток с небольшой паузой) при сетевой ошибке; не сбрасывать на 0.
- Привести кап на клиенте к 50 (как на сервере), чтобы не обрезались последние.

**D. `src/app/settings/settings-client.tsx` — сохранение в БД**
- При переключении тумблеров и авторизации upsert в `profiles`: `hide_stats`, `private_lists`, `new_episode_notif`; при «Приватный список» также ставить `favorites_privacy/completed_privacy/history_privacy = 'friends'` (выкл → `'public'`).
- Локально по-прежнему сохранять в `anithink:settings`; при логине подтягивать текущие значения из профиля.

**E. `src/app/user/[tag]/user-client.tsx` — приватность публичного профиля**
- Добавить в блок статистики карточку «Затрачено времени X ч» (счёт из метаданных `completed`), которая **скрывается**, если `profile.hide_stats = true`.
- Приватные списки уже учитываются через `*_privacy=friends` (заглушка с замком для не-друзей).

**F. `src/app/notifications/notifications-client.tsx` — баннер уведомлений**
- При логине прочитать `new_episode_notif` из profiles; если включён — показать баннер-подсказку вверху страницы о новых сериях. Если выключен — баннер с кнопкой «Включить» (ведёт на /settings).

### Файлы
1. `supabase/migrations/2026_fix_signup_plus_privacy.sql` — новый (даю текст для вставки в Supabase).
2. `src/components/auth/auth-modal.tsx`
3. `src/app/profile/profile-client.tsx`
4. `src/app/settings/settings-client.tsx`
5. `src/app/user/[tag]/user-client.tsx`
6. `src/app/notifications/notifications-client.tsx`

### Проверка
- `npm run build`.
- Запуск dev: попытка регистрации (локально), логика профиля, настройки пишутся в БД.
- Текст SQL дам отдельно — вставишь в Supabase SQL Editor.
