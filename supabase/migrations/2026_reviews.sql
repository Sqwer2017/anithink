-- AniThink: страница отзывов. Таблица отзывов пользователей + RLS.
-- Запустите один раз в SQL Editor дашборда Supabase. Идемпотентно.

-- =====================================================================
-- 1. Таблица отзывов
-- =====================================================================
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid null references auth.users(id) on delete set null,
  nickname    text null,
  rating      smallint not null default 5 check (rating between 1 and 10),
  title       text null,
  content     text not null,
  created_at  timestamptz not null default now(),
  is_published boolean not null default true
);

create index if not exists idx_reviews_created on public.reviews (created_at desc);

-- =====================================================================
-- 2. RLS
-- =====================================================================
alter table public.reviews enable row level security;

-- Читать опубликованные отзывы может любой
drop policy if exists "reviews_select_published" on public.reviews;
create policy "reviews_select_published" on public.reviews
  for select using (is_published = true);

-- Писать может любой анонимно (публичная страница отзывов)
drop policy if exists "reviews_insert_anon" on public.reviews;
create policy "reviews_insert_anon" on public.reviews
  for insert with check (true);

-- =====================================================================
-- 3. Гранты для anon (по умолчанию anon не может писать в RLS-таблицы,
--    нужен явный grant)
-- =====================================================================
grant select, insert on table public.reviews to anon, authenticated;
