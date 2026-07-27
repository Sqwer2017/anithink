## Plan: Fix Supabase auth (OAuth callback + redirect)

### Findings (what's already correct — no action needed)
- **No double profile creation to remove.** There is **no** `.from('profiles').insert(...)` anywhere in the codebase. The only write to `profiles` is `profile-client.tsx:151`, which already uses `.upsert({…}, { onConflict: 'id' })` exactly as the task recommends for step 2. ✅
- **No `.update()` on profiles either.** The trigger handles creation; the upsert handles updates. Steps 1 & 2 of the task are effectively already done.

### What's actually broken
1. **No OAuth callback.** Google sign-in (`auth-modal.tsx:107`) redirects straight to `/profile` with `?code=…` in the URL, but nothing ever calls `exchangeCodeForSession(code)`. Under Supabase's PKCE flow the session is never established → Google login is broken.
2. **`redirectTo` has no `NEXT_PUBLIC_SITE_URL` support** and points at the wrong destination (should point at the callback).

### Chosen approach (per your answers)
Keep the existing single `@supabase/supabase-js` browser client; use a **client-side callback page** (not a server `route.ts`, which can't write to the browser's localStorage session) and add **`NEXT_PUBLIC_SITE_URL`** support.

---

### Changes

**1. Create `src/app/auth/callback/page.tsx`** (new file)
- `"use client"` component.
- Read `code` from `useSearchParams()`.
- On mount: call `await supabase.auth.exchangeCodeForSession(code)` on the shared browser client.
- On success (or always, to avoid dead-ends): `router.replace('/profile')`.
- Show a minimal "Вход…" loader while exchanging.
- Guard `supabase === null` (project pattern — the shared client can be null if env missing).
- The existing `onAuthStateChange` listener in `profile-client.tsx:114` will automatically pick up the resulting session when the user lands on `/profile`, so no extra wiring is needed.

**2. Edit `src/components/auth/auth-modal.tsx`**
- Add a `getURL()` helper: `process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin` (with trailing-slash trim).
- Change `redirectTo` in `handleGoogleLogin` from `` `${window.location.origin}/profile` `` → `` `${getURL()}/auth/callback` ``.

**3. Edit `.env.local`**
- Append `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (the dev origin). The user can set the production URL at deploy time.

### Out of scope (intentionally)
- Migrating to `@supabase/ssr` / adding `middleware.ts` — not needed for the current localStorage-session architecture; would be a much larger change.
- Touching `profile-client.tsx` — its upsert already follows the recommended `onConflict: 'id'` pattern.
- Any SQL/trigger changes — the DB trigger is already working per the task.

### Verification
- `npm run build` to confirm no type/build errors from the new file.
- Manual: Google button → redirect to Supabase → callback exchanges code → lands on `/profile` authenticated (verified by `authUser` populating and nickname/tag syncing).