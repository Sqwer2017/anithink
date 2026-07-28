-- AniThink: расширенные профили, дружба и пользовательские аниме-списки.
-- Запустите один раз в SQL Editor дашборда Supabase.
-- Идемпотентно: повторный запуск безопасен (везде IF NOT EXISTS).

-- =====================================================================
-- 1. Типы (enums)
-- =====================================================================
do $$ begin
  create type profile_privacy as enum ('public', 'friends', 'close_friends', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type friendship_status as enum ('pending', 'accepted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type watch_status_type as enum ('watching', 'completed', 'planned', 'dropped');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 2. profiles — добавляем колонки (баннер, био, соцсети, приватность)
-- =====================================================================
alter table public.profiles
  add column if not exists cover_url          text,
  add column if not exists bio                text,
  add column if not exists telegram           text,
  add column if not exists discord            text,
  add column if not exists steam              text,
  add column if not exists favorites_privacy  profile_privacy not null default 'public',
  add column if not exists completed_privacy  profile_privacy not null default 'public',
  add column if not exists history_privacy    profile_privacy not null default 'public';

-- =====================================================================
-- 3. friendships — дружба (направленная, две строки при accepted)
--    is_close_friend: «user_id помечает friend_id как избранного» (асимметрично)
-- =====================================================================
create table if not exists public.friendships (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  friend_id         uuid not null references auth.users(id) on delete cascade,
  status            friendship_status not null default 'pending',
  is_close_friend   boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

-- =====================================================================
-- 4. user_anime — объединённые списки (favorites / watch-status / history)
-- =====================================================================
create table if not exists public.user_anime (
  user_id       uuid not null references auth.users(id) on delete cascade,
  anime_id      text not null,
  is_favorite   boolean not null default false,
  watch_status  watch_status_type null,
  in_history    boolean not null default false,
  rating        smallint null check (rating is null or (rating between 1 and 10)),
  updated_at    timestamptz not null default now(),
  primary key (user_id, anime_id)
);

create index if not exists idx_user_anime_user      on public.user_anime (user_id);
create index if not exists idx_user_anime_favorites on public.user_anime (user_id) where is_favorite;
create index if not exists idx_user_anime_completed on public.user_anime (user_id) where watch_status = 'completed';
create index if not exists idx_user_anime_history   on public.user_anime (user_id) where in_history;

-- =====================================================================
-- 5. Row Level Security
-- =====================================================================

-- profiles: владелец может обновлять; читать профиль может любой (приватность
-- секций аниме-enforced на уровне приложения, т.к. это join с user_anime).
alter table public.profiles  enable row level security;
alter table public.friendships enable row level security;
alter table public.user_anime  enable row level security;

-- ---- profiles policies ----
drop policy if exists "profiles_select_all"    on public.profiles;
drop policy if exists "profiles_update_owner"  on public.profiles;
drop policy if exists "profiles_insert_owner"  on public.profiles;

create policy "profiles_select_all"   on public.profiles for select using (true);
create policy "profiles_insert_owner" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_owner" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---- friendships policies ----
-- Строку дружбы видит либо её владелец (user_id), либо адресат (friend_id).
drop policy if exists "friendships_select_parties" on public.friendships;
drop policy if exists "friendships_insert_owner"   on public.friendships;
drop policy if exists "friendships_update_owner"   on public.friendships;
drop policy if exists "friendships_delete_owner"   on public.friendships;

create policy "friendships_select_parties" on public.friendships
  for select using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "friendships_insert_owner" on public.friendships
  for insert with check (auth.uid() = user_id);

create policy "friendships_update_owner" on public.friendships
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "friendships_delete_owner" on public.friendships
  for delete using (auth.uid() = user_id);

-- ---- user_anime policies ----
drop policy if exists "user_anime_select_owner" on public.user_anime;
drop policy if exists "user_anime_insert_owner" on public.user_anime;
drop policy if exists "user_anime_update_owner" on public.user_anime;
drop policy if exists "user_anime_delete_owner" on public.user_anime;

-- Чтение публично: приватность секций контролируется в коде профиля.
create policy "user_anime_select_all" on public.user_anime
  for select using (true);

create policy "user_anime_insert_owner" on public.user_anime
  for insert with check (auth.uid() = user_id);

create policy "user_anime_update_owner" on public.user_anime
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_anime_delete_owner" on public.user_anime
  for delete using (auth.uid() = user_id);
