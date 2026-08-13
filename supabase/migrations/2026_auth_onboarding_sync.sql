-- AniThink: автопрофиль при регистрации + Google-онбординг + синхронизация списков.
-- Запустите один раз в SQL Editor дашборда Supabase. Идемпотентно.

-- =====================================================================
-- 1. Колонка password_set в profiles (поставлен ли пароль для email-входа)
-- =====================================================================
alter table public.profiles
  add column if not exists password_set boolean not null default false;

-- =====================================================================
-- 2. Автоматическое создание profiles при создании auth.users
--    Используем nickname/tag ИМЕННО из raw_user_meta_data (передаются
--    при signUp options.data), НЕ email. Email — только фолбэк.
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nickname, tag, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nickname', split_part(new.email, '@', 1)),
    coalesce(
      lower(regexp_replace(new.raw_user_meta_data ->> 'tag', '[^a-zA-Z0-9_]', '', 'g')),
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'nickname',
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Триггер уже мог существовать (создавался ранее) — сначала удаляем по правильному
-- отношению auth.users, затем пересоздаём, чтобы применить новую функцию.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================================================================
-- 3. RLS: подтверждаем правила для user_anime (SELECT/INSERT/UPDATE/DELETE
--    с auth.uid() = user_id). Чтение публичное — приватность секций на UI.
-- =====================================================================
alter table public.user_anime enable row level security;

drop policy if exists "user_anime_select_all" on public.user_anime;
drop policy if exists "user_anime_insert_owner" on public.user_anime;
drop policy if exists "user_anime_update_owner" on public.user_anime;
drop policy if exists "user_anime_delete_owner" on public.user_anime;

create policy "user_anime_select_all" on public.user_anime
  for select using (true);

create policy "user_anime_insert_owner" on public.user_anime
  for insert with check (auth.uid() = user_id);

create policy "user_anime_update_owner" on public.user_anime
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_anime_delete_owner" on public.user_anime
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- 4. RLS для profiles: владелец может читать/обновлять, все могут читать.
-- =====================================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_update_owner" on public.profiles;

create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_update_owner" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
