# Plan: Profile media + public profiles + privacy + player fixes

## Phase 0 — SQL migration (new file, you run it in Supabase dashboard)
File: `supabase/migrations/2026_07_profile_friends_user_anime.sql`

Since the repo has zero SQL, I'll write a self-contained migration matching your confirmed choices (separate columns for socials). I'll **append** columns / create tables idempotently. You run it once in the SQL editor.

**`profiles` — add columns:**
- `cover_url text`, `bio text`, `telegram text`, `discord text`, `steam text`
- `favorites_privacy profile_privacy NOT NULL DEFAULT 'public'`
- `completed_privacy profile_privacy NOT NULL DEFAULT 'public'`
- `history_privacy profile_privacy NOT NULL DEFAULT 'public'`
- New enum `profile_privacy AS ENUM ('public','friends','close_friends','private')`

**`friendships` table** (directed, dual-row-on-accept — cleanest for asymmetric close-friend):
```
id uuid pk, user_id uuid, friend_id uuid, 
status friendship_status ('pending','accepted'),
is_close_friend bool default false,   -- "user_id marks friend_id as close"
created_at timestamptz default now(),
unique(user_id, friend_id), check(user_id <> friend_id)
```
+ RLS: owner (user_id = auth.uid()) can insert/update/delete; both parties' rows readable by either user.

**`user_anime` table** (unifies favorites + watch-status + history per the localStorage audit):
```
user_id uuid, anime_id text, 
is_favorite bool default false,
watch_status watch_status_type NULL ('watching','completed','planned','dropped'),
in_history bool default false,
rating smallint NULL,
updated_at timestamptz default now(),
primary key (user_id, anime_id)
```
+ RLS: writes only where `user_id = auth.uid()`; reads public (privacy enforced in app code since it's join-driven with profiles).

---

## Phase 1 — Own profile (`ProfileClient.tsx`) + new lib

**`src/lib/user-anime.ts`** (new) — central sync layer (replaces scattered inline writes). Exposes:
- `syncFavoriteToUserAnime(animeId, isFav)`, `syncWatchStatusToUserAnime(animeId, status|null)`, `syncHistoryToUserAnime(animeId)`
- Each: auth-gated (`getUser()`), null-safe on `supabase`, `upsert({…}, { onConflict: 'user_id,anime_id' })` (or delete when removed), then `window.dispatchEvent(new CustomEvent('anithink:user-anime-changed'))`. Mirrors the existing `handleSaveAll` auth-gate pattern.

**`src/lib/media-upload.ts`** (new) — `uploadProfileMedia(file, field): Promise<string>`: `compressImage` → `supabase.storage.from('media').upload(path, blob)` (path `avatars|covers/<userId>-<rand>.jpg`, `upsert:true`, `contentType:'image/jpeg'`) → return `getPublicUrl()`.

**Wire sync into existing write points** (minimal, one line each after localStorage write):
- `anime-watch-card.tsx` `toggleListItem` (favorites) + `setStatus`
- `saved-anime-list.tsx` `removeFromList`
- `anime-history-tracker.tsx` effect

**`ProfileClient.tsx` edits:**
- `upload()`: after compress (keep local data-URL preview), call `uploadProfileMedia` → set profile field to the **public URL** (avatar/cover).
- Add **editable nickname + tag inputs** (currently read-only `<h1>`/`<p>` at lines 250–251) — inline-edit fields.
- Add **3 privacy `<select>`** (favorites/completed/history) with labels «Видят все / Только друзья / Только избранные друзья / Никто».
- `handleSaveAll` upsert: extend payload with `cover_url, bio, telegram, discord, steam, favorites_privacy, completed_privacy, history_privacy, full_name`. On `error.code === '23505'` → `toast("Этот тег уже занят, попробуйте другой", true)`.

---

## Phase 2 — Public profile page `src/app/user/[tag]/`

**`src/app/user/[tag]/page.tsx`** (new, server component) — extracts `params.tag`, passes to client component.

**`src/app/user/[tag]/user-client.tsx`** (new, `"use client"`) — does all the work:
- Load target profile: `.from('profiles').select('*').ilike('tag', tag).maybeSingle()` → 404/«не найден» state.
- Load current viewer via `auth.getUser()`.
- Load friendship: rows `(viewer,target)` and `(target,viewer)`. Derive: `none | outgoing_pending | incoming_pending | accepted`.
- **Friendship buttons** (disabled for self / anon): «Добавить в друзья» (insert pending), «Заявка отправлена», «Принять» (set both rows accepted) / «В друзьях» / «Удалить из друзей».
- **Close-friend toggle** (only if accepted): reflects `(viewer,target).is_close_friend`, toggles it.
- Load target's `user_anime`, split into favorites / completed(`watch_status='completed'`) / history(`in_history`), fetch `Anime[]` via `/api/saved?ids=…`.
- **Privacy gating helper** `canSee(privacy)`: `public`→true; `friends`→isAcceptedFriend; `close_friends`→ `(target,viewer).is_close_friend`; `private`→false. Owner sees all. Closed sections render the skeleton «Пользователь ограничил доступ к этому разделу».
- Header: `cover_url` banner, `avatar_url`, nickname, `@tag`, bio, social icons (Telegram/Discord/Steam).
- Reuse existing `AnimeCard`, `Block`, visual style from ProfileClient.

---

## Phase 3 — Players (`src/components/player/kinobox-player.tsx`)

**KinoBox (root-cause fix):** migrate to `next/script` with `strategy="afterInteractive"`:
- Global type already exists in `src/types/global.d.ts` as `window.kbox(container, options)`.
- `useEffect`: on `<Script onLoad>`, call `window.kbox('#id', { search: { shikimori: shikimoriId } })` (pass `shikimoriId` into `KinoboxEmbed`, not just title). Init **only after** load.
- 5s timeout: if `!window.kbox` when it fires → `setUnavailable(true)` → show fallback (already-built «KinoBox временно недоступен, переключитесь на Kodik»).
- Remove the stale `declare global { Kinobox }` block (conflicts with `global.d.ts`).

**Kodik CSS:** adjust the iframe transform/offset — tighten `-left/-top`/height/width so the iframe fills the card without empty bands, slightly enlarge and raise it inside the `relative aspect-video` frame. Concrete values tuned in-place; small iteration acceptable.

## Verification
- `npm run build` — type-check (esp. new global `window.kbox`, `user_anime` types, privacy enums as string unions in TS).
- Manual: avatar/cover upload → public URL in `profiles`; tag duplicate → 23505 toast; `/user/<tag>` renders header + gated sections; friend add/accept/remove + close-friend toggle; KinoBox loads via `kbox` (fallback after 5s if SDK down); Kodik fills frame cleanly.

## Out of scope
- Ratings sync (`anithink:ratings`) — noted but not in this task.
- Realtime on friendships/user_anime — polling on page load is sufficient for now.
- Migrating to `@supabase/ssr` — staying on the existing localStorage-session architecture.