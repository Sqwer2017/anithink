-- =====================================================================
-- AniThink — Cloud-sync хранилок пользователя + таблицы плейлистов.
-- Запустите ОДИН раз в SQL Editor дашборда Supabase. Скрипт идемпотентный
-- (повторный запуск безопасен: везде IF NOT EXISTS / EXCEPTION).
--
-- Покрывает структуру, которую ожидает фронтенд:
--   - public.user_anime       (история / статусы / избранное)  PK (user_id, anime_id)
--   - public.playlists        (id, user_id, name, cover, created_at, updated_at)
--   - public.playlist_items   (playlist_id, anime_id, added_at)
--   + уникальные индексы под upsert + RLS на auth.uid() = user_id.
-- =====================================================================

-- 0. Enum watch_status_type (если вдруг ещё не создан)
do $$ begin
  create type watch_status_type as enum ('watching', 'completed', 'planned', 'dropped');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 1. user_anime — отдельный список (новые колонки не нужны, гарантируем PK/idx)
-- =====================================================================
create table if not exists public.user_anime (
  user_id      uuid not null references auth.users (id) on delete cascade,
  anime_id     text not null,
  is_favorite  boolean not null default false,
  watch_status watch_status_type null,
  in_history   boolean not null default false,
  rating       smallint null check (rating is null or (rating between 1 and 10)),
  updated_at   timestamptz not null default now(),
  primary key (user_id, anime_id)
);

create index if not exists idx_user_anime_user      on public.user_anime (user_id);
create index if not exists idx_user_anime_favorites on public.user_anime (user_id) where is_favorite;
create index if not exists idx_user_anime_completed on public.user_anime (user_id) where watch_status = 'completed';
create index if not exists idx_user_anime_history   on public.user_anime (user_id) where in_history;

-- =====================================================================
-- 2. playlists
-- =====================================================================
create table if not exists public.playlists (
  id         text  primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  cover      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_playlists_owner on public.playlists (user_id);

-- =====================================================================
-- 3. playlist_items
-- =====================================================================
create table if not exists public.playlist_items (
  playlist_id text not null references public.playlists (id) on delete cascade,
  anime_id    text not null,
  added_at    timestamptz not null default now(),
  primary key (playlist_id, anime_id)
);
create index if not exists idx_playlist_items_anime on public.playlist_items (anime_id);

-- =====================================================================
-- 4. Row Level Security: доступ только владельцу (auth.uid() = user_id)
-- =====================================================================
alter table public.user_anime     enable row level security;
alter table public.playlists      enable row level security;
alter table public.playlist_items enable row level security;

-- --- user_anime (существующие политики тоже перечётливо пер ставим) ----
drop policy if exists "user_anime_select_owner" on public.user_anime;
drop policy if exists "user_anime_insert_owner" on public.user_anime;
drop policy if exists "user_anime_update_owner" on public.user_anime;
drop policy if exists "user_anime_delete_owner" on public.user_anime;

create policy "user_anime_select_owner" on public.user_anime
  for select using (auth.uid() = user_id);
create policy "user_anime_insert_owner" on public.user_anime
  for insert with check (auth.uid() = user_id);
create policy "user_anime_update_owner" on public.user_anime
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_anime_delete_owner" on public.user_anime
  for delete using (auth.uid() = user_id);

-- --- playlists ----
drop policy if exists "playlists_owner_select" on public.playlists;
drop policy if exists "playlists_owner_insert" on public.playlists;
drop policy if exists "playlists_owner_update" on public.playlists;
drop policy if exists "playlists_owner_delete" on public.playlists;

create policy "playlists_owner_select" on public.playlists
  for select using (auth.uid() = user_id);
create policy "playlists_owner_insert" on public.playlists
  for insert with check (auth.uid() = user_id);
create policy "playlists_owner_update" on public.playlists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "playlists_owner_delete" on public.playlists
  for delete using (auth.uid() = user_id);

-- --- playlist_items (владелец через join к playlists) ----
drop policy if exists "playlist_items_owner_select" on public.playlist_items;
drop policy if exists "playlist_items_owner_insert" on public.playlist_items;
drop policy if exists "playlist_items_owner_update" on public.playlist_items;
drop policy if exists "playlist_items_owner_delete" on public.playlist_items;

create policy "playlist_items_owner_select" on public.playlist_items
  for select using (exists (
    select 1 from public.playlists p where p.id = playlist_items.playlist_id and p.user_id = auth.uid()
  ));
create policy "playlist_items_owner_insert" on public.playlist_items
  for insert with check (exists (
    select 1 from public.playlists p where p.id = playlist_items.playlist_id and p.user_id = auth.uid()
  ));
create policy "playlist_items_owner_update" on public.playlist_items
  for update using (exists (
    select 1 from public.playlists p where p.id = playlist_items.playlist_id and p.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.playlists p where p.id = playlist_items.playlist_id and p.user_id = auth.uid()
  ));
create policy "playlist_items_owner_delete" on public.playlist_items
  for delete using (exists (
    select 1 from public.playlists p where p.id = playlist_items.playlist_id and p.user_id = auth.uid()
  ));

-- Grанты для анon/authenticated создаются автоматически политиками RLS, но на случай
-- если project defaults отключили grant — явно даём доступ к select/insert/... на эти таблицы.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.user_anime      to authenticated;
grant select, insert, update, delete on public.playlists       to authenticated;
grant select, insert, update, delete on public.playlist_items  to authenticated;
