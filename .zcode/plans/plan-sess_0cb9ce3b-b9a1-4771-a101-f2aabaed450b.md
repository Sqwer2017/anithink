# План: Комплексный фикс (Gemini, регистрация, Google-онбординг, синхронизация)

## Схема: ответы подтверждают
- Google-онбординг → сущ-ая `profiles` (nickname/tag/password_set)
- SQL → пишу миграции, пользователь запустит вручную в Supabase
- История → единая `user_anime` (is_favorite/watch_status/in_history)

---

## Задача 1 — Gemini роут (`src/app/api/mascot/chat/route.ts`)
- Добавить `export const dynamic = "force-dynamic";` (рядом с `runtime = "nodejs"`).
- Расширить `catch` в POST: `console.error("[Gemini Error Detail]:", err)` c полным объектом/сообщением (плюс `err?.status`/`err?.cause` если есть).
- Убедиться fetch: `headers: { "Content-Type": "application/json" }` (уже есть) + корректный payload `systemInstruction`/`contents` (уже есть) — поправлю если отхожу.

## Задача 2 — Регистрация (email/password) + тег
- **`auth-modal.tsx`**: в `handleSubmit` signup уже передаёт `options.data { nickname, tag }` — оставляю. Улучшаю:
  - Sanitize тега: `cleanTag` → `lowercase.replace(/[\s@]/g,"").replace(/[^a-z0-9_]/g,"").slice(0,30)` (убрать лишний `@`, пробелы, спецсимволы; cap 30).
  - Placeholder "Sqwer"/"sqwer" → убираю (пусто/"@nickname"). Проверю: это placeholder, не value; заменю на нейтральные.
- **Главный фикс — триггер profiles**: создать SQL-миграцию с функцией `handle_new_user()` и триггером `on_auth_user_created`:
  ```sql
  create or replace function public.handle_new_user()
  returns trigger as $$
  begin
    insert into public.profiles (id, email, nickname, tag, full_name, avatar_url)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email,'@',1)),
      coalesce(lower(new.raw_user_meta_data->>'tag'), split_part(new.email,'@',1)),
      coalesce(new.raw_user_meta_data->>'nickname', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
      new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (id) do nothing;
    return new;
  end; $$ language plpgsql security definer;
  create trigger on_auth_user_created after insert on auth.users
    for each row execute procedure public.handle_new_user();
  ```
  - Использует ИМЕННО `raw_user_meta_data.nickname/tag` (а НЕ email), как просили. Email — только фолбэк в `nickname`.
  - `@` к тегу: на фронте cleanTag без `@`; триггер хранит tag без `@` (UI показывает `@${tag}`). В онбординге (З3) обработаю ручной ввод с `@`.

## Задача 3 — Google-онбординг после OAuth
- **Новый файл `src/app/auth/onboarding/page.tsx`** (клиент): вызывается после `/auth/callback` если профиль не заполнен.
- **`src/app/auth/callback/page.tsx`** — после успешного `exchangeCodeForSession`:
  ```ts
  const { data } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("id, tag, nickname").eq("id", user.id).maybeSingle();
  const completed = profile && profile.tag && profile.tag !== "anithink_user" && profile.nickname;
  router.replace(completed ? "/" : "/auth/onboarding");
  ```
- **Обнарддинг-модалка** (на странице `/auth/onboarding`): поля Нікнейм, Тег (с префиксом @), опционально пароль. Кнопка «Завершить регистрацию»:
  ```ts
  // тег: ввод с @ → очистить в @, sanitize
  upsert profiles (id, nickname, tag) onConflict id
  если не пуст пароль → supabase.auth.updateUser({ password }); update password_set = true
  router.replace("/")
  ```
- Добавить колонку `password_set boolean default false` в `profiles` (миграция).
- Показывать пароль-поле только если это Google-юз (можно всегда показывать опционально).

## Задача 4 — синхронизация user_anime
- **Слияние при входе**: добавить в клиент (например, в `profile-client.tsx` после onAuthStateChange при наличии сессии) функцию, которая читает localStorage-списки (`anithink:favorites`, `anithink:history`, `anithink:watch-statuses`) и батчем upsert в `user_anime`:
  - favorites → `{ is_favorite: true }`
  - history → `{ in_history: true }`
  - watch-status → `{ watch_status }`
  - делаю `upsert(rows, { onConflict:"user_id,anime_id" })` одним запросом (батч).
- **RLS**: уже есть в `user_anime` (select_all / insert/update/delete_owner с `auth.uid()=user_id`). Подтверждаю в миграции; добавлю если чего-то не хватает.
- **Исправить `syncHistoryToUserAnime`**: сейчас ставит `in_history` и не дедуплицирует/не лимитирует — ок, но при выходе не очищается. Оставляю (это персистент).
- Обновлю `user-anime.ts` при необходимости (батч-upsert helper `mergeLocalToSupabase`).

## Файлы (код)
1. `src/app/api/mascot/chat/route.ts` — dynamic, лог.
2. `src/components/auth/auth-modal.tsx` — sanitize тега, placeholder.
3. `src/app/auth/callback/page.tsx` — проверка профиля + редирект на онбординг.
4. `src/app/auth/onboarding/page.tsx` — новый (модалка заполнения).
5. `src/lib/user-anime.ts` — helper батч-слияния localStorage→user_anime.
6. `src/app/profile/profile-client.tsx` (или хука) — вызов слияния при входе.

## Supabase (миграция — пользователь запустит сам)
`supabase/migrations/<date>_auth_onboarding_sync.sql`:
- `alter table profiles add column if not exists password_set boolean not null default false;`
- функция+триггер `handle_new_user` / `on_auth_user_created`
- (опционально) усиление RLS на user_anime если нужно.

## Проверка
- `npm run build` — типы.
- Вручную: регистрация → триггер создаёт profile с nickname/tag из metadata; Google-вход → если без tag, редирект на онбординг; после заполнения → на "/"; автор залогинен → локальные сохранёнки сливаются в user_anime.