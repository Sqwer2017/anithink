-- AniThink: фикс регистрации + приватность в profiles + триггер автопрофиля.
-- Запустите ОДИН раз в SQL Editor дашборда Supabase. Идемпотентно (повторный запуск безопасен).

-- =====================================================================
-- 0. На всякий случай гарантируем базовые колонки, которые использует
--    handle_new_user (если по какой-то причине их нет в вашей схеме).
-- =====================================================================
alter table public.profiles
  add column if not exists email       text,
  add column if not exists nickname    text,
  add column if not exists full_name   text,
  add column if not exists tag         text,
  add column if not exists avatar_url  text;

-- =====================================================================
-- 1. Колонки приватности/уведомлений для настроек
-- =====================================================================
alter table public.profiles
  add column if not exists hide_stats          boolean not null default false,
  add column if not exists private_lists       boolean not null default false,
  add column if not exists new_episode_notif   boolean not null default false;

-- Индекс для быстрой проверки тега при регистрации (если его ещё нет).
create unique index if not exists profiles_tag_key on public.profiles (tag);

-- =====================================================================
-- 2. Рекреим автопрофиль при регистрации.
--    ВАЖНО: insert обёрнут в exception — даже если создание profiles
--    падает (несовместимая схема, конфликт и т.п.), это НЕ должно
--    блокировать создание auth.users. Пользователь сможет войти,
--    а профиль до-создастся через онбординг/колбэк/апсайт.
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
  exception when others then
    -- Никогда не блокируем регистрацию из-за профиля.
    -- Тег мог быть уже занят (profiles_tag_key): обрабатываем отдельно.
    begin
      update public.profiles
         set email      = new.email,
             nickname   = coalesce(new.raw_user_meta_data ->> 'nickname', split_part(new.email, '@', 1)),
             full_name  = coalesce(
                            new.raw_user_meta_data ->> 'nickname',
                            new.raw_user_meta_data ->> 'full_name',
                            split_part(new.email, '@', 1)
                          )
       where id = new.id;
    exception when others then
      null; -- всё равно регистрацию не роняем
    end;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================================================================
-- 3. RLS profiles: владелец может вставлять/обновлять, все читать.
--    (уже есть, но подтверждаем идемпотентно)
-- =====================================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all"   on public.profiles;
drop policy if exists "profiles_insert_owner" on public.profiles;
drop policy if exists "profiles_update_owner" on public.profiles;

create policy "profiles_select_all"   on public.profiles for select using (true);
create policy "profiles_insert_owner" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_owner" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
