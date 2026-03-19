# Architecture Rundown & Multitenancy Assessment

This document summarizes the current single-tenant architecture and what’s needed to turn the app into a multitenant product, including embeddable/hosted booking and in-app payments.

---

## 1. Current Architecture Rundown

### High-level shape

- **Stack**: Next.js 15, Supabase (PostgreSQL + Auth), Square (payments), Google Calendar (schedule), Vercel.
- **Two user types**: **Customers** (book, view appointments, optional login) and **Admins** (dashboard: bookings, customers, services, schedule, campaigns, settings).
- **Single business**: All data and configuration assume one merchant (e.g. DUST Hair). There is no tenant, organization, or “business” entity.

### Data model (single tenant)

| Layer | What exists | Tenant scope today |
|-------|-------------|--------------------|
| **Auth** | Supabase Auth; `customers.auth_user_id` → `auth.users`; `admin_users` by email | None. One pool of users; admin check is “email in admin_users”. |
| **Core data** | `customers`, `services`, `bookings`, `waitlist_requests` | No `tenant_id`. All rows belong to the one business. |
| **Config** | `settings` (key/value: business_name, timezone, Square credentials, business_hours, waitlist_enabled, etc.) | Single global key-value store. |
| **Schedule** | Business hours in `settings` (business_hours, business_hours_timezone); `availability_overrides` (date-scoped); Google Calendar OAuth in settings | One business’s hours and one calendar. |
| **Marketing** | `campaigns`, `segments`, `campaign_send_jobs`, `campaign_send_history`, `campaign_registrations` | No `tenant_id`. Single business. |
| **Payments** | Square: credentials in `settings`; payment links and POS flow keyed off one `pos_pending_booking` in settings | One Square account; one pending POS booking at a time. |

### Request flow (no tenant resolution)

- **Customer**: Homepage → `/book` (login required) → services from `/api/services`, availability from `/api/admin/availability`, create booking via `/api/bookings`. No subdomain or path identifies “which business.”
- **Admin**: `/admin/*` → each route checks “is this user in `admin_users`?” then reads/writes the same global tables and settings.
- **Public APIs**: `/api/services`, `/api/availability`, `/api/bookings` all operate on the single business’s services, calendar, and bookings.

### What’s already “general”

- **Settings in DB**: Square and business config live in `settings`, not only in env vars (Square has env fallback). So “per-tenant config” could later be “per-tenant keys in settings” or a `tenant_id` on a settings row.
- **Structured domains**: Services, bookings, customers, business hours, campaigns are in clear tables; no hardcoded business names in core logic.
- **Auth**: Supabase Auth is shared; you’d add tenant context in your own tables (`admin_users.tenant_id`, `customers.tenant_id`) and in request resolution, not by splitting Auth projects per tenant.

So the app is a clean single-tenant codebase: one logical business, no tenant concept, but no major structural blockers to introducing a tenant dimension.

---

## 2. Multitenancy: What Has to Change

### 2.1 Introduce a tenant (organization) concept

- Add something like **`tenants`** (or `organizations`):
  - `id` (uuid), `name`, `slug` (unique, for URLs), `created_at`, optional branding (logo, primary color).
- **Tenant resolution** on every request that touches data:
  - **Option A – Subdomain**: `dust.yourproduct.com` → tenant by subdomain.
  - **Option B – Path**: `yourproduct.com/t/dust-hair/book` → tenant by path segment (slug).
  - **Option C – Hosted booking only (Vagar-style)**: `yourproduct.com/book/dust-hair` or `book.yourproduct.com/dust-hair`; tenant from path; rest of app can stay “one tenant per session” until you add full multi-dashboard.

For a **Vagar-style “link in bio”** first step, path-based resolution on `/book/:slug` (and later `/t/:slug/admin`) is enough.

### 2.2 Database: add tenant_id everywhere

- Add **`tenant_id`** (FK to `tenants`) to:
  - `admin_users`
  - `customers`
  - `services`
  - `bookings`
  - `waitlist_requests`
  - `availability_overrides`
  - `campaigns`, `segments`, `campaign_send_jobs`, `campaign_send_history`, `campaign_registrations` (if you keep these per-tenant)
- **Settings**: Either
  - add `tenant_id` to `settings` and use composite `(tenant_id, key)`, or
  - a separate `tenant_settings` table with `tenant_id` + key/value.
- **RLS**: Add policies so that each tenant only sees their own rows (e.g. `tenant_id = current_setting('app.current_tenant_id')::uuid` or similar, with a small middleware that sets this from resolved tenant).
- **Indexes**: Add indexes on `tenant_id` (and often `(tenant_id, date)` or `(tenant_id, created_at)`) for bookings, availability, etc.

### 2.3 Auth and admin access

- **Admin**: Resolve tenant (from subdomain/path/session), then check “user is in `admin_users` **for this tenant**” (and optionally “is_active”). Today you only check `admin_users` by email; you’ll add `tenant_id` to that check.
- **Customer**: For hosted booking, customers can stay “global” (same email can book at multiple tenants) or you can scope `customers` per tenant (e.g. `customers.tenant_id`). Per-tenant customers are simpler for “my bookings” and reporting per business.

### 2.4 APIs and middleware

- **Middleware**: Resolve tenant from host/path (and optionally from session for admin). Attach `tenantId` (and maybe `tenantSlug`) to request so APIs don’t re-parse URLs.
- **All admin APIs**: Use resolved `tenant_id` in every query (bookings, customers, services, settings, availability, campaigns, etc.).
- **Public booking APIs**: When called from the booking flow, accept tenant from path (e.g. `/api/t/[slug]/services` or `/api/book/[slug]/availability`) or from a header/cookie set by the booking page.

### 2.5 Config and integrations per tenant

- **Business info, hours, timezone**: Stored per tenant (tenant-scoped settings or `tenant_settings`).
- **Google Calendar**: One OAuth connection per tenant (tokens in tenant-scoped settings). Same for “booking available from” date and overrides.
- **Square**: Today one global Square account. For multitenant you have two paths (see Payments below).

---

## 3. Embeddable vs Hosted Booking (Vagar-style)

You mentioned two options: embeddable form on the merchant’s site, or a hosted “link in bio” page. Both need tenant resolution; the rest is where the UI runs.

### 3.1 Hosted booking (Vagar-style) – recommended first step

- **URLs**: e.g. `yourapp.com/book/dust-hair` or `book.yourapp.com/dust-hair`. Slug = tenant.
- **Flow**: Landing shows business name (from tenant), then same flow as today: service → date/time → details → confirmation. No embed, no iframe.
- **Implementation**:
  - Add `tenants` and `tenant_id` as above.
  - Add route: `app/(customer)/book/[slug]/page.tsx` (or `book/[slug]/...`) that resolves tenant by `slug`, fetches tenant-scoped services/settings.
  - Public APIs: e.g. `GET /api/book/[slug]/services`, `GET /api/book/[slug]/availability`, `POST /api/book/[slug]/bookings` that take `slug` and run all DB and calendar logic in that tenant’s context.
  - Optional: redirect root or `/book` to a tenant picker or to a default tenant for backward compatibility.
- **Customer accounts**: Either keep one global customer table with `tenant_id` so “same person” can book at multiple businesses, or scope customers per tenant; “my appointments” then filter by tenant.

This is the smaller lift: same UI as today, new route and tenant-scoped APIs.

### 3.2 Embeddable widget

- **Idea**: Merchant embeds a script on their site; script loads an iframe (or web component) that points to your app with a tenant identifier (e.g. `yourapp.com/embed/book?tenant=dust-hair` or path-based).
- **Needs**:
  - Tenant resolution from query or path in the embed URL.
  - Embed-friendly page: no full nav, minimal chrome, responsive; optionally postMessage API to resize iframe or pass “booking completed” back to parent.
  - **CORS / embedding**: Allow your app to be framed on arbitrary origins (or a allowlist). Often you serve the script from your domain and the iframe is same-origin or you use a dedicated embed subdomain.
  - The same tenant-scoped APIs as above back the embed.
- **Heavier**: script snippet, iframe contract, possible CSP and cookie/session handling in third-party context. Doing hosted booking first gets you tenant-scoped logic and APIs; the embed is then “another client” of those APIs.

---

## 4. Payments: From “Their Square” to “We Process”

Right now the **client’s** Square integration is used: their Square credentials live in `settings`; payment links and POS callback are for that one account. For multitenant you have two main directions.

### 4.1 Keep “their Square” (per-tenant Square)

- Each tenant has their own Square account; you store **per-tenant** Square credentials (e.g. in tenant-scoped settings: `square_access_token`, `square_location_id`, etc.).
- **`getSquareClient()`**: Takes `tenantId`, loads that tenant’s Square settings, returns a Square client for that tenant.
- **Payment links and webhooks**: Create links per tenant; Square webhooks can send to one endpoint that reads tenant from payload (e.g. location_id → tenant) or you use one webhook URL per tenant (messy). Usually one endpoint that identifies tenant from the Square payload (e.g. `location_id` or `merchant_id`) and then updates the correct tenant’s booking.
- **POS flow**: `pos_pending_booking` must be **per tenant** (e.g. key `pos_pending_booking_{tenant_id}` or a small `pos_pending_bookings` table with `tenant_id`). That also fixes “only one pending POS at a time” globally (see POS-PAYMENT-SCALING.md).

So the “heavy lift” here is: (1) tenant-scoped Square settings, (2) Square client factory by tenant, (3) webhook and POS callback logic that resolve tenant and update the right booking.

### 4.2 “We process” (you are the merchant of record)

- You use **Stripe** or **Square** as the platform; **each tenant is connected** via Connect (Stripe Connect / Square Connect). Customer pays you; you split to the tenant (minus your fee).
- **Heavier**: onboarding (connect onboarding flow, KYC), payouts, reporting, and compliance. In return you control the experience and can take a percentage or fee.
- Your current flow (pay-after-service, payment links, POS) would be reimplemented on top of Connect: e.g. Create PaymentIntent or Order for the tenant’s connected account; your webhook identifies the connected account (tenant) and marks the booking paid.

So: **short term**, per-tenant Square (4.1) is the smaller lift and keeps current UX. **Medium/long term**, moving to Connect (4.2) is the “we process payments” path.

---

## 5. Suggested order of work

1. **Tenant model and resolution**
   - Add `tenants` table and `tenant_id` to all relevant tables; run migrations; backfill existing data to one default tenant.
   - Add middleware (or helper) to resolve tenant from path (e.g. `/book/[slug]`) or subdomain; attach to request.

2. **Hosted booking (Vagar-style)**
   - Implement `/book/[slug]` and tenant-scoped public APIs (`/api/book/[slug]/services`, availability, bookings).
   - Use tenant-scoped settings for business name, timezone, hours; keep existing booking UI, just wired to slug.

3. **Admin and config per tenant**
   - Add `tenant_id` to `admin_users`; resolve tenant in admin routes (path or session); scope all admin reads/writes by `tenant_id`.
   - Move settings (and business hours, Google Calendar, etc.) to tenant-scoped storage.

4. **Payments – per-tenant Square**
   - Store Square credentials per tenant; `getSquareClient(tenantId)`; webhook and POS callback resolve tenant and update the right booking; `pos_pending_booking` per tenant.

5. **Optional later**
   - Embeddable widget (same APIs, new embed route and script).
   - Stripe/Square Connect if you want to process payments yourself and take a cut.

---

## 6. Summary

- **Current**: Single-tenant app: one business, global settings, one Square account, no tenant in the data model or URLs. Structure is clean and general; no tenant column anywhere yet.
- **Multitenant**: Add `tenants` and `tenant_id` everywhere; resolve tenant in middleware from path (or subdomain); scope all APIs and RLS by tenant.
- **Booking**: Easiest first step is **hosted booking** at e.g. `yourapp.com/book/:slug` with tenant-scoped APIs; **embeddable** form can follow using the same APIs.
- **Payments**: **Near term**: keep Square, make it per-tenant (credentials + webhook/POS keyed by tenant). **Later**: move to Connect if you want to process payments in your app and own the relationship with the payer.

If you want, next step can be a concrete migration plan (exact table changes and a minimal `/book/[slug]` + one API) or a short “Phase 1” checklist you can tick off in the repo.

---

## 7. Safe migration: launching multitenant without disrupting the current client

Yes. You can launch multitenancy so the **existing client (e.g. DUST) keeps the same URLs, same login, and same behavior** while new tenants use the new slug-based flows. The idea is: treat the current business as the **legacy tenant** and default to it whenever the request doesn't specify a tenant.

### 7.1 Principle: "no slug = legacy tenant"

- **Current client** keeps using:
  - `yourapp.com/` (home)
  - `yourapp.com/book` (booking, no slug)
  - `yourapp.com/admin` (admin)
  - `yourapp.com/api/services`, `/api/bookings`, `/api/admin/*` (no tenant in path)
- **Tenant resolution rule**: If the request has a tenant slug (e.g. path `/book/dust-hair` or `/book/[slug]`), resolve tenant by slug. If there is **no** slug (e.g. `/book`, `/admin`, `/api/services`), resolve to the **legacy tenant** (e.g. slug `dust-hair` or a fixed id in env).
- So you never break existing links or bookmarks; the app just "is" the legacy tenant when no slug is present.

### 7.2 Database migration (non-disruptive)

1. **Create `tenants` and the legacy row**
   - Create table `tenants` (id, name, slug, created_at, …).
   - Insert one row for the current client, e.g. `slug = 'dust-hair'`, `name = 'DUST Hair Studio'`. Store that `id` (e.g. as `LEGACY_TENANT_ID` in env or a well-known constant).

2. **Add `tenant_id` without breaking existing data**
   - Add `tenant_id` to each table as **nullable** or with **DEFAULT** set to the legacy tenant's id.
   - Backfill: `UPDATE … SET tenant_id = '<legacy-tenant-id>' WHERE tenant_id IS NULL`.
   - Then alter to `NOT NULL` (and drop default if you used one) so new tenants must always set it. Existing rows now all belong to the legacy tenant.

3. **Settings**
   - Either add `tenant_id` to `settings` with unique `(tenant_id, key)`, or create `tenant_settings(tenant_id, key, value)`.
   - Copy all current `settings` rows into the legacy tenant's scope. After deploy, code reads settings by `(tenant_id)`; for the legacy tenant that returns the same values as today.

4. **RLS (if you use it)**
   - Update policies to include `tenant_id = current_setting('app.current_tenant_id')::uuid` (or equivalent). Middleware sets `app.current_tenant_id` from resolved tenant; for legacy requests that's the legacy tenant id. Existing client's sessions behave as "that tenant."

### 7.3 App behavior: keep existing routes, add resolution

- **Existing routes stay**: `/book`, `/admin`, `/api/services`, `/api/bookings`, `/api/admin/availability`, etc. do **not** change URLs.
- **Resolution layer**: In middleware (or a small helper used by every tenant-aware route):
  - If path is e.g. `/book/[slug]` or `/api/book/[slug]/…`, resolve tenant by `slug`.
  - Else (e.g. `/book`, `/admin`, `/api/services`), set **resolved tenant = legacy tenant**.
- All DB and settings reads use this resolved `tenant_id`. So the current client never sees a different UX; they're just implicitly "tenant dust-hair."

### 7.4 What the current client does *not* see

- No URL changes (no redirect from `/book` to `/book/dust-hair` unless you add that later).
- No re-login; existing `admin_users` and `customers` get `tenant_id = legacy` in the backfill.
- No change to Square: legacy tenant keeps the same Square credentials and webhook; you just pass `tenant_id` into the Square helper and use legacy tenant's settings.
- No change to Google Calendar: legacy tenant's OAuth and business hours stay in that tenant's settings.

### 7.5 What *new* tenants see

- They get a slug (e.g. from signup). They use **new** URLs only: e.g. `yourapp.com/book/their-slug`, and later `yourapp.com/t/their-slug/admin` or similar.
- They never use `/book` or `/admin` without a slug; those remain "legacy" behavior.

### 7.6 Optional: explicit legacy URL later

- Once you're confident, you can optionally **redirect** `/book` → `/book/dust-hair` so everything is slug-based. That's a small, reversible change. Until then, "no slug = legacy" is enough to avoid disruption.

### 7.7 Rollback

- If you need to roll back: you can revert app code to ignore `tenant_id` and read/write as before; DB already has all rows with `tenant_id` set, so you're not losing data. The only irreversible part is adding and backfilling `tenant_id` columns; that's still compatible with "single tenant" code that simply doesn't filter on it.

**Summary:** Add the tenant model and backfill the current client as the legacy tenant; default resolution to that tenant when no slug is present; keep all existing URLs and behavior. The current client is unaffected; new tenants use the new slug-based flows.
