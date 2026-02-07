# Admin Invite Flow – Supabase URL Configuration

Invites are sent via Supabase Auth `inviteUserByEmail` with `redirectTo: ${NEXT_PUBLIC_APP_URL}/admin/accept-invite`. If the redirect URL is not in Supabase’s allow list, Supabase sends users to the **Site URL** with tokens in the hash (e.g. `https://www.dusthairstudio.com/#access_token=...`). The app then redirects those requests to `/admin/accept-invite` so the “Set Your Password” page can run.

For the cleanest behavior (invite link going straight to accept-invite), configure Supabase and env as below.

## 1. Supabase Dashboard – URL Configuration

**Authentication → URL Configuration**

- **Site URL**  
  Production: `https://www.dusthairstudio.com`  
  (Or your production domain; this is the fallback when a redirect is rejected.)

- **Redirect URLs**  
  Add these **exact** URLs (wildcards like `http://localhost:3000/**` can still fail for invite links; explicit paths are more reliable):

  - `http://localhost:3000/admin/accept-invite`
  - `https://www.dusthairstudio.com/admin/accept-invite`

  Add both so local and production invite links work. Save the configuration.

## 2. Environment – NEXT_PUBLIC_APP_URL

The invite API uses `NEXT_PUBLIC_APP_URL` to build `redirectTo`. It must match the origin where the user will open the link.

- **Local**: `NEXT_PUBLIC_APP_URL=http://localhost:3000` (in `.env.local`).
- **Production (Vercel)**:  
  `NEXT_PUBLIC_APP_URL=https://www.dusthairstudio.com`  
  (or your production domain). Set this in Vercel → Project → Settings → Environment Variables.

If this is wrong, the link in the email will point to the wrong origin and Supabase may reject it and fall back to Site URL.

## 3. Flow Summary

1. **POST /api/admin/invite-admin** – Sends invite with `redirectTo: ${NEXT_PUBLIC_APP_URL}/admin/accept-invite`.
2. User clicks link in email → Supabase verifies token and redirects:
   - If redirect URL is allowed → browser goes to `.../admin/accept-invite` with tokens in hash/query.
   - If not allowed → browser goes to **Site URL** with tokens in hash.
3. **InviteRedirectHandler** (root layout): If the app loads on any page with invite/recovery tokens in the hash (e.g. Site URL with `#access_token=...&type=invite`), it redirects to `/admin/accept-invite` and preserves the hash so tokens are not lost.
4. **/admin/accept-invite** – Reads tokens from hash/query, calls `setSession()`, then shows “Set Your Password”. Admin layout allows this route without auth.

## 4. If Invite Link Still Lands on Login or Wrong Page

- Confirm the **exact URL** in the invite email (what comes after Supabase’s `/auth/v1/verify?...`).
- In Supabase, add the **exact** accept-invite URLs (no trailing slash) to Redirect URLs and save.
- In Vercel, confirm `NEXT_PUBLIC_APP_URL` matches the production domain (e.g. `https://www.dusthairstudio.com`).
- Check **Supabase Auth logs** when the invite link is clicked to see which redirect was used.
- Send a **new invite** after changing URL configuration; old emails still contain the old redirect.
